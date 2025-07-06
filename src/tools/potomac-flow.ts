import { z } from "zod";
import { USGSApiService } from "../services/usgs-api.js";
import { CacheService } from "../services/cache.js";
import { FlowRateData, FlowRateHistoricalPoint } from "../types/potomac-data.js";

// Input schema for the tool (no parameters required)
export const GetPotomacFlowSchema = z.object({}).optional();

// Output schema for structured content
export const FlowRateOutputSchema = z.object({
  discharge_cfs: z.number().describe("Current discharge in cubic feet per second"),
  timestamp: z.string().describe("ISO 8601 timestamp of the reading"),
  seven_day_min_cfs: z.number().describe("7-day minimum discharge in cubic feet per second"),
  seven_day_max_cfs: z.number().describe("7-day maximum discharge in cubic feet per second"),
  stale: z.boolean().describe("True if data is older than 30 minutes"),
  trend_direction: z.enum(["rising", "falling", "stable"]).describe("Trend direction compared to 90 minutes ago"),
  trend_change_cfs: z.number().describe("Change in CFS from 90 minutes ago (positive = rising, negative = falling)"),
  reading_90min_ago_cfs: z.number().optional().describe("Reading from approximately 90 minutes ago in cubic feet per second")
});

export type FlowRateOutput = z.infer<typeof FlowRateOutputSchema>;

/**
 * MCP Tool: get_potomac_flow
 * 
 * Fetches current flow rate data from USGS station 01646500 (Little Falls)
 * with 7-day historical context and staleness detection.
 * 
 * @param params - No parameters required
 * @returns Structured flow rate data with current reading and 7-day range
 */
export async function getPotomacFlow(
  params: z.infer<typeof GetPotomacFlowSchema>,
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
    
    // Fetch current, historical, and 90-minute data concurrently with fallback
    const [currentReading, historicalData, ninetyMinuteData] = await Promise.all([
      // Current data with fallback
      (async () => {
        try {
          return await cacheService.cacheCurrentFlowRate(
            'current-flow-rate',
            () => usgsService.getCurrentFlowRate(),
            cacheHeaders
          );
        } catch (error) {
          // Fallback to direct API call if cache fails
          return await usgsService.getCurrentFlowRate();
        }
      })(),
      
      // Historical data with fallback  
      (async () => {
        try {
          return await cacheService.cacheHistoricalFlowRate(
            'historical-flow-rate',
            () => usgsService.getHistoricalFlowRatePoints(),
            cacheHeaders
          );
        } catch (error) {
          // Fallback to direct API call if cache fails
          return await usgsService.getHistoricalFlowRatePoints();
        }
      })(),
      
      // 90-minute data with fallback
      (async () => {
        try {
          // Check if cache method exists before calling
          if (typeof cacheService.cache90MinuteFlowRate === 'function') {
            return await cacheService.cache90MinuteFlowRate(
              '90-minute-flow-rate',
              () => usgsService.get90MinuteFlowRatePoints(),
              cacheHeaders
            );
          } else {
            // Method doesn't exist, use direct API call
            return await usgsService.get90MinuteFlowRatePoints();
          }
        } catch (error) {
          // Fallback to direct API call if cache fails
          return await usgsService.get90MinuteFlowRatePoints();
        }
      })()
    ]);
    
    // Handle case where current reading is not available
    if (!currentReading) {
      const errorMessage = "Unable to fetch current flow rate data from USGS station 01646500 (Little Falls). The station may be temporarily unavailable or experiencing technical issues.";
      return {
        content: [{ type: "text", text: errorMessage }]
      };
    }
    
    // Calculate 7-day min/max from historical data
    let sevenDayMin = currentReading.discharge_cfs;
    let sevenDayMax = currentReading.discharge_cfs;
    
    if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
      const validPoints = historicalData.filter((point: FlowRateHistoricalPoint) => !isNaN(point.discharge_cfs));
      if (validPoints.length > 0) {
        sevenDayMin = Math.min(...validPoints.map((p: FlowRateHistoricalPoint) => p.discharge_cfs));
        sevenDayMax = Math.max(...validPoints.map((p: FlowRateHistoricalPoint) => p.discharge_cfs));
      }
    }
    
    // Calculate trend from 90-minute data
    let trendDirection: "rising" | "falling" | "stable" = "stable";
    let trendChangeCfs = 0;
    let reading90MinAgo: number | undefined;
    
    if (ninetyMinuteData && Array.isArray(ninetyMinuteData) && ninetyMinuteData.length > 0) {
      // Find reading closest to 90 minutes ago (sort by timestamp and take oldest)
      const validPoints = ninetyMinuteData
        .filter((point: FlowRateHistoricalPoint) => !isNaN(point.discharge_cfs))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      if (validPoints.length > 0) {
        const oldestPoint = validPoints[0];
        reading90MinAgo = oldestPoint.discharge_cfs;
        trendChangeCfs = currentReading.discharge_cfs - reading90MinAgo;
        
        // Determine trend direction (threshold of 10 CFS to account for measurement precision)
        if (Math.abs(trendChangeCfs) < 10) {
          trendDirection = "stable";
        } else if (trendChangeCfs > 0) {
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
    const flowRateData: FlowRateOutput = {
      discharge_cfs: currentReading.discharge_cfs,
      timestamp: currentReading.timestamp,
      seven_day_min_cfs: sevenDayMin,
      seven_day_max_cfs: sevenDayMax,
      stale: isStale,
      trend_direction: trendDirection,
      trend_change_cfs: trendChangeCfs,
      reading_90min_ago_cfs: reading90MinAgo
    };
    
    // Create human-readable text content
    const staleness = isStale ? ` (Data is ${Math.round(ageMinutes)} minutes old and may be stale)` : "";
    const range = sevenDayMax > sevenDayMin ? 
      ` 7-day range: ${sevenDayMin.toLocaleString()} to ${sevenDayMax.toLocaleString()} CFS.` : 
      "";
    
    // Create trend description
    let trendText = "";
    if (reading90MinAgo !== undefined) {
      const changeText = Math.abs(trendChangeCfs) > 10 ? 
        ` (${trendChangeCfs >= 0 ? '+' : ''}${Math.round(trendChangeCfs).toLocaleString()} CFS from 90 min ago)` : 
        " (stable from 90 min ago)";
      trendText = ` Trend: ${trendDirection}${changeText}`;
    }
    
    const textContent = `Current Potomac River flow rate at Little Falls:
Current: ${flowRateData.discharge_cfs.toLocaleString()} CFS
Timestamp: ${flowRateData.timestamp}${staleness}${range}${trendText}

💡 For technical details about flow measurement methods, units, and station specifications, use the get_measurement_info tool.`;
    
    return {
      content: [{ type: "text", text: textContent }]
    };
    
  } catch (error) {
    // Handle errors gracefully
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const fullErrorMessage = `Error fetching Potomac flow rate data: ${errorMessage}. Please try again later or check if the USGS station is operational.`;
    
    return {
      content: [{ type: "text", text: fullErrorMessage }]
    };
  }
}