import { z } from "zod";
import { USGSApiService } from "../services/usgs-api.js";
import { CacheService } from "../services/cache.js";
import { WaterLevelData, WaterLevelHistoricalPoint } from "../types/potomac-data.js";

// Input schema for the tool (no parameters required)
export const GetPotomacGageDepthSchema = z.object({}).optional();

// Output schema for structured content
export const WaterLevelOutputSchema = z.object({
  navd88_ft: z.number().describe("Current gage height in NAVD88 datum (feet)"),
  wmlw_ft: z.number().describe("Current gage height in WMLW datum (feet)"),
  timestamp: z.string().describe("ISO 8601 timestamp of the reading"),
  seven_day_min_ft: z.number().describe("7-day minimum gage height in NAVD88 datum (feet)"),
  seven_day_max_ft: z.number().describe("7-day maximum gage height in NAVD88 datum (feet)"),
  stale: z.boolean().describe("True if data is older than 30 minutes"),
  trend_direction: z.enum(["rising", "falling", "stable"]).describe("Trend direction compared to 90 minutes ago"),
  trend_change_ft: z.number().describe("Change in feet from 90 minutes ago (positive = rising, negative = falling)"),
  reading_90min_ago_ft: z.number().optional().describe("Reading from approximately 90 minutes ago in NAVD88 datum (feet)")
});

export type WaterLevelOutput = z.infer<typeof WaterLevelOutputSchema>;

/**
 * MCP Tool: get_potomac_gage_depth
 * 
 * Fetches current water level data from USGS station 01647600 (Georgetown)
 * with 7-day historical context and staleness detection.
 * 
 * @param params - No parameters required
 * @returns Structured water level data with current reading and 7-day range
 */
export async function getPotomacGageDepth(
  params: z.infer<typeof GetPotomacGageDepthSchema>,
  request?: Request
): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    // Initialize services
    const usgsService = new USGSApiService();
    const cacheService = new CacheService();
    
    // Extract cache refresh headers if request is provided
    const cacheHeaders = request ? CacheService.extractCacheHeaders(request) : {};
    
    // Fetch current, historical, and 90-minute data concurrently
    const [currentReading, historicalData, ninetyMinuteData] = await Promise.all([
      cacheService.cacheCurrentWaterLevel(
        'current-water-level',
        () => usgsService.getCurrentWaterLevel(),
        cacheHeaders
      ),
      cacheService.cacheHistoricalWaterLevel(
        'historical-water-level',
        () => usgsService.getHistoricalWaterLevelPoints(),
        cacheHeaders
      ),
      cacheService.cache90MinuteWaterLevel(
        '90-minute-water-level',
        () => usgsService.get90MinuteWaterLevelPoints(),
        cacheHeaders
      )
    ]);
    
    // Handle case where current reading is not available
    if (!currentReading) {
      const errorMessage = "Unable to fetch current water level data from USGS station 01647600 (Georgetown). The station may be temporarily unavailable or experiencing technical issues.";
      return {
        content: [{ type: "text", text: errorMessage }]
      };
    }
    
    // Calculate 7-day min/max from historical data
    let sevenDayMin = currentReading.navd88_ft;
    let sevenDayMax = currentReading.navd88_ft;
    
    if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
      const validPoints = historicalData.filter((point: WaterLevelHistoricalPoint) => !isNaN(point.navd88_ft));
      if (validPoints.length > 0) {
        sevenDayMin = Math.min(...validPoints.map((p: WaterLevelHistoricalPoint) => p.navd88_ft));
        sevenDayMax = Math.max(...validPoints.map((p: WaterLevelHistoricalPoint) => p.navd88_ft));
      }
    }
    
    // Calculate trend from 90-minute data
    let trendDirection: "rising" | "falling" | "stable" = "stable";
    let trendChangeFt = 0;
    let reading90MinAgo: number | undefined;
    
    if (ninetyMinuteData && Array.isArray(ninetyMinuteData) && ninetyMinuteData.length > 0) {
      // Find reading closest to 90 minutes ago (sort by timestamp and take oldest)
      const validPoints = ninetyMinuteData
        .filter((point: WaterLevelHistoricalPoint) => !isNaN(point.navd88_ft))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      if (validPoints.length > 0) {
        const oldestPoint = validPoints[0];
        reading90MinAgo = oldestPoint.navd88_ft;
        trendChangeFt = currentReading.navd88_ft - reading90MinAgo;
        
        // Determine trend direction (threshold of 0.01 ft to account for measurement precision)
        if (Math.abs(trendChangeFt) < 0.01) {
          trendDirection = "stable";
        } else if (trendChangeFt > 0) {
          trendDirection = "rising";
        } else {
          trendDirection = "falling";
        }
      }
    }

    // Implement staleness detection (>30 minutes old)
    const readingTime = new Date(currentReading.timestamp);
    const now = new Date();
    const ageMinutes = (now.getTime() - readingTime.getTime()) / (1000 * 60);
    const isStale = ageMinutes > 30;
    
    // Format response according to PRD specification
    const waterLevelData: WaterLevelOutput = {
      navd88_ft: currentReading.navd88_ft,
      wmlw_ft: currentReading.wmlw_ft,
      timestamp: currentReading.timestamp,
      seven_day_min_ft: sevenDayMin,
      seven_day_max_ft: sevenDayMax,
      stale: isStale,
      trend_direction: trendDirection,
      trend_change_ft: trendChangeFt,
      reading_90min_ago_ft: reading90MinAgo
    };
    
    // Create human-readable text content with consistent NAVD88 format
    const staleness = isStale ? ` (Data is ${Math.round(ageMinutes)} minutes old and may be stale)` : "";
    const range = sevenDayMax > sevenDayMin ? 
      ` 7-day range: ${sevenDayMin.toFixed(1)} to ${sevenDayMax.toFixed(1)} feet.` : 
      "";
    
    // Create trend description
    let trendText = "";
    if (reading90MinAgo !== undefined) {
      const changeText = Math.abs(trendChangeFt) > 0.01 ? 
        ` (${trendChangeFt >= 0 ? '+' : ''}${trendChangeFt.toFixed(2)} ft from 90 min ago)` : 
        " (stable from 90 min ago)";
      trendText = ` Trend: ${trendDirection}${changeText}`;
    }
    
    const textContent = `Current Potomac River water level at Georgetown:
Current: ${waterLevelData.navd88_ft.toFixed(1)} feet
Timestamp: ${waterLevelData.timestamp}${staleness}${range}${trendText}

💡 For technical details about measurement methods, datums, and station specifications, use the get_measurement_info tool.`;
    
    return {
      content: [{ type: "text", text: textContent }]
    };
    
  } catch (error) {
    // Handle errors gracefully
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const fullErrorMessage = `Error fetching Potomac water level data: ${errorMessage}. Please try again later or check if the USGS station is operational.`;
    
    return {
      content: [{ type: "text", text: fullErrorMessage }]
    };
  }
} 