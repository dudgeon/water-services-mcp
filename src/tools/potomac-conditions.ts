import { z } from "zod";
import { getPotomacGageDepth } from "./potomac-gage-depth.js";
import { getPotomacFlow } from "./potomac-flow.js";
import { CacheService } from "../services/cache.js";
import { CombinedConditionsData, PartialConditionsData, WaterLevelData, FlowRateData } from "../types/potomac-data.js";

// Input schema for the tool (no parameters required)
export const GetPotomacConditionsSchema = z.object({}).optional();

// Output schema for structured content
export const CombinedConditionsOutputSchema = z.object({
  gage_height: z.object({
    navd88_ft: z.number().describe("Current gage height in NAVD88 datum (feet)"),
    wmlw_ft: z.number().describe("Current gage height in WMLW datum (feet)"),
    timestamp: z.string().describe("ISO 8601 timestamp of the reading"),
    seven_day_min_ft: z.number().describe("7-day minimum gage height in NAVD88 datum (feet)"),
    seven_day_max_ft: z.number().describe("7-day maximum gage height in NAVD88 datum (feet)"),
    stale: z.boolean().describe("True if data is older than 30 minutes"),
    trend_direction: z.enum(["rising", "falling", "stable"]).describe("Trend direction compared to 90 minutes ago"),
    trend_change_ft: z.number().describe("Change in feet from 90 minutes ago (positive = rising, negative = falling)"),
    reading_90min_ago_ft: z.number().optional().describe("Reading from approximately 90 minutes ago in NAVD88 datum (feet)")
  }).describe("Water level data from Georgetown station"),
  
  flow_rate: z.object({
    discharge_cfs: z.number().describe("Current discharge in cubic feet per second"),
    timestamp: z.string().describe("ISO 8601 timestamp of the reading"),
    seven_day_min_cfs: z.number().describe("7-day minimum discharge in cubic feet per second"),
    seven_day_max_cfs: z.number().describe("7-day maximum discharge in cubic feet per second"),
    stale: z.boolean().describe("True if data is older than 30 minutes"),
    trend_direction: z.enum(["rising", "falling", "stable"]).describe("Trend direction compared to 90 minutes ago"),
    trend_change_cfs: z.number().describe("Change in CFS from 90 minutes ago (positive = rising, negative = falling)"),
    reading_90min_ago_cfs: z.number().optional().describe("Reading from approximately 90 minutes ago in cubic feet per second")
  }).describe("Flow rate data from Little Falls station"),
  
  data_completeness: z.enum(["complete", "partial", "minimal"]).describe("Indicates if both data sources are available"),
  overall_staleness: z.enum(["fresh", "mixed", "stale"]).describe("Overall data freshness across both sources"),
  oldest_data_age_minutes: z.number().describe("Age in minutes of the oldest data point"),
  freshest_data_age_minutes: z.number().describe("Age in minutes of the freshest data point")
});

export type CombinedConditionsOutput = z.infer<typeof CombinedConditionsOutputSchema>;

/**
 * Interface for internal data processing
 */
interface ProcessedConditionsData {
  waterLevel?: {
    data: WaterLevelData;
    available: boolean;
    error?: string;
    ageMinutes: number;
  };
  flowRate?: {
    data: FlowRateData;
    available: boolean;
    error?: string;
    ageMinutes: number;
  };
  dataCompleteness: 'complete' | 'partial' | 'minimal';
  overallStaleness: 'fresh' | 'mixed' | 'stale';
  oldestDataAgeMinutes: number;
  freshestDataAgeMinutes: number;
}

/**
 * MCP Tool: get_potomac_conditions
 * 
 * Fetches combined water level and flow rate data from both USGS stations
 * with comprehensive error handling and partial failure support.
 * 
 * @param params - No parameters required
 * @returns Structured combined conditions data with current readings and historical context
 */
export async function getPotomacConditions(
  params: z.infer<typeof GetPotomacConditionsSchema>,
  request?: Request
): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    // Initialize cache service for combined conditions caching
    const cacheService = new CacheService();
    
    // Extract cache refresh headers if request is provided
    const cacheHeaders = request ? CacheService.extractCacheHeaders(request) : {};
    
    // Attempt to use combined conditions cache first
    const combinedData = await cacheService.cacheCombinedConditions(
      'combined-potomac-conditions',
      async () => await fetchCombinedDataDirectly(request),
      cacheHeaders
    );
    
    return formatCombinedResponse(combinedData);
    
  } catch (error) {
    // Handle errors gracefully with degraded service
    console.warn('Combined conditions cache failed, attempting direct fetch:', error);
    
    try {
      const directData = await fetchCombinedDataDirectly(request);
      return formatCombinedResponse(directData);
    } catch (directError) {
      const errorMessage = directError instanceof Error ? directError.message : "Unknown error occurred";
      const fullErrorMessage = `Error fetching combined Potomac conditions: ${errorMessage}. Individual tools may still be available.`;
      
      return {
        content: [{ type: "text", text: fullErrorMessage }]
      };
    }
  }
}

/**
 * Fetch combined data directly using individual tool functions
 */
async function fetchCombinedDataDirectly(request?: Request): Promise<ProcessedConditionsData> {
  // Fetch data from both tools concurrently
  const [waterLevelResponse, flowRateResponse] = await Promise.allSettled([
    // Water level data
    (async () => {
      try {
        const response = await getPotomacGageDepth({}, request);
        return { success: true, response };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    })(),
    
    // Flow rate data
    (async () => {
      try {
        const response = await getPotomacFlow({}, request);
        return { success: true, response };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    })()
  ]);
  
  // Process results and handle partial failures
  const processedData: ProcessedConditionsData = {
    dataCompleteness: 'minimal',
    overallStaleness: 'stale',
    oldestDataAgeMinutes: 0,
    freshestDataAgeMinutes: 0
  };
  
  // Extract water level data
  if (waterLevelResponse.status === 'fulfilled' && waterLevelResponse.value.success && waterLevelResponse.value.response) {
    const waterLevelText = waterLevelResponse.value.response.content[0].text;
    const waterLevelData = extractWaterLevelFromText(waterLevelText);
    
    if (waterLevelData) {
      processedData.waterLevel = {
        data: waterLevelData,
        available: true,
        ageMinutes: waterLevelData.ageMinutes || 0
      };
    }
  } else {
    const error = waterLevelResponse.status === 'rejected' ? 
      waterLevelResponse.reason : 
      (waterLevelResponse.value as any).error;
    
    processedData.waterLevel = {
      data: {} as WaterLevelData, // Placeholder
      available: false,
      error: error,
      ageMinutes: 0
    };
  }
  
  // Extract flow rate data
  if (flowRateResponse.status === 'fulfilled' && flowRateResponse.value.success && flowRateResponse.value.response) {
    const flowRateText = flowRateResponse.value.response.content[0].text;
    const flowRateData = extractFlowRateFromText(flowRateText);
    
    if (flowRateData) {
      processedData.flowRate = {
        data: flowRateData,
        available: true,
        ageMinutes: flowRateData.ageMinutes || 0
      };
    }
  } else {
    const error = flowRateResponse.status === 'rejected' ? 
      flowRateResponse.reason : 
      (flowRateResponse.value as any).error;
    
    processedData.flowRate = {
      data: {} as FlowRateData, // Placeholder
      available: false,
      error: error,
      ageMinutes: 0
    };
  }
  
  // Determine data completeness
  const availableCount = (processedData.waterLevel?.available ? 1 : 0) + 
                        (processedData.flowRate?.available ? 1 : 0);
  
  if (availableCount === 2) {
    processedData.dataCompleteness = 'complete';
  } else if (availableCount === 1) {
    processedData.dataCompleteness = 'partial';
  } else {
    processedData.dataCompleteness = 'minimal';
  }
  
  // Calculate overall staleness and age metrics
  const ageData: number[] = [];
  
  if (processedData.waterLevel?.available) {
    ageData.push(processedData.waterLevel.ageMinutes);
  }
  
  if (processedData.flowRate?.available) {
    ageData.push(processedData.flowRate.ageMinutes);
  }
  
  if (ageData.length > 0) {
    processedData.oldestDataAgeMinutes = Math.max(...ageData);
    processedData.freshestDataAgeMinutes = Math.min(...ageData);
    
    // Determine overall staleness (30-minute threshold)
    const staleCount = ageData.filter(age => age > 30).length;
    
    if (staleCount === 0) {
      processedData.overallStaleness = 'fresh';
    } else if (staleCount === ageData.length) {
      processedData.overallStaleness = 'stale';
    } else {
      processedData.overallStaleness = 'mixed';
    }
  }
  
  return processedData;
}

/**
 * Extract water level data from tool response text
 */
function extractWaterLevelFromText(text: string): (WaterLevelData & { ageMinutes?: number }) | null {
  try {
    // Parse the text response to extract structured data
    // This is a simplified parser - in production, we'd want more robust parsing
    const currentMatch = text.match(/Current:\s*([\d.]+)\s*feet/);
    const timestampMatch = text.match(/Timestamp:\s*([^\n(]+)/);
    const rangeMatch = text.match(/7-day range:\s*([\d.]+)\s*to\s*([\d.]+)\s*feet/);
    const staleMatch = text.match(/\(Data is (\d+) minutes old/);
    const trendMatch = text.match(/Trend:\s*(rising|falling|stable)/);
    
    if (!currentMatch || !timestampMatch) {
      return null;
    }
    
    const navd88_ft = parseFloat(currentMatch[1]);
    const wmlw_ft = navd88_ft - 1.27; // Approximate conversion
    const timestamp = timestampMatch[1].trim();
    const seven_day_min_ft = rangeMatch ? parseFloat(rangeMatch[1]) : navd88_ft;
    const seven_day_max_ft = rangeMatch ? parseFloat(rangeMatch[2]) : navd88_ft;
    const ageMinutes = staleMatch ? parseInt(staleMatch[1]) : 0;
    const stale = ageMinutes > 30;
    
    return {
      navd88_ft,
      wmlw_ft,
      timestamp,
      seven_day_min_ft,
      seven_day_max_ft,
      stale,
      ageMinutes
    };
  } catch (error) {
    console.warn('Failed to parse water level data from text:', error);
    return null;
  }
}

/**
 * Extract flow rate data from tool response text
 */
function extractFlowRateFromText(text: string): (FlowRateData & { ageMinutes?: number }) | null {
  try {
    // Parse the text response to extract structured data
    const currentMatch = text.match(/Current:\s*([\d,]+)\s*CFS/);
    const timestampMatch = text.match(/Timestamp:\s*([^\n(]+)/);
    const rangeMatch = text.match(/7-day range:\s*([\d,]+)\s*to\s*([\d,]+)\s*CFS/);
    const staleMatch = text.match(/\(Data is (\d+) minutes old/);
    const trendMatch = text.match(/Trend:\s*(rising|falling|stable)/);
    
    if (!currentMatch || !timestampMatch) {
      return null;
    }
    
    const discharge_cfs = parseFloat(currentMatch[1].replace(/,/g, ''));
    const timestamp = timestampMatch[1].trim();
    const seven_day_min_cfs = rangeMatch ? parseFloat(rangeMatch[1].replace(/,/g, '')) : discharge_cfs;
    const seven_day_max_cfs = rangeMatch ? parseFloat(rangeMatch[2].replace(/,/g, '')) : discharge_cfs;
    const ageMinutes = staleMatch ? parseInt(staleMatch[1]) : 0;
    const stale = ageMinutes > 30;
    
    return {
      discharge_cfs,
      timestamp,
      seven_day_min_cfs,
      seven_day_max_cfs,
      stale,
      ageMinutes
    };
  } catch (error) {
    console.warn('Failed to parse flow rate data from text:', error);
    return null;
  }
}

/**
 * Format the combined response for return to user
 */
function formatCombinedResponse(data: ProcessedConditionsData): { content: Array<{ type: "text"; text: string }> } {
  let responseText = "# Current Potomac River Conditions\n\n";
  
  // Water level section
  if (data.waterLevel?.available && data.waterLevel.data) {
    const wl = data.waterLevel.data;
    const staleness = wl.stale ? ` (Data is ${data.waterLevel.ageMinutes} minutes old and may be stale)` : "";
    const range = wl.seven_day_max_ft > wl.seven_day_min_ft ? 
      ` 7-day range: ${wl.seven_day_min_ft.toFixed(1)} to ${wl.seven_day_max_ft.toFixed(1)} feet.` : 
      "";
    
    responseText += `## Georgetown Water Level\n`;
    responseText += `Current: ${wl.navd88_ft.toFixed(1)} feet\n`;
    responseText += `Timestamp: ${wl.timestamp}${staleness}${range}\n\n`;
  } else {
    responseText += `## Georgetown Water Level\n`;
    responseText += `❌ **Unavailable** - ${data.waterLevel?.error || "Unknown error"}\n\n`;
  }
  
  // Flow rate section
  if (data.flowRate?.available && data.flowRate.data) {
    const fr = data.flowRate.data;
    const staleness = fr.stale ? ` (Data is ${data.flowRate.ageMinutes} minutes old and may be stale)` : "";
    const range = fr.seven_day_max_cfs > fr.seven_day_min_cfs ? 
      ` 7-day range: ${fr.seven_day_min_cfs.toLocaleString()} to ${fr.seven_day_max_cfs.toLocaleString()} CFS.` : 
      "";
    
    responseText += `## Little Falls Flow Rate\n`;
    responseText += `Current: ${fr.discharge_cfs.toLocaleString()} CFS\n`;
    responseText += `Timestamp: ${fr.timestamp}${staleness}${range}\n\n`;
  } else {
    responseText += `## Little Falls Flow Rate\n`;
    responseText += `❌ **Unavailable** - ${data.flowRate?.error || "Unknown error"}\n\n`;
  }
  
  // Overall status section
  responseText += `## Overall Status\n`;
  responseText += `Data Completeness: ${data.dataCompleteness.charAt(0).toUpperCase() + data.dataCompleteness.slice(1)}\n`;
  responseText += `Data Freshness: ${data.overallStaleness.charAt(0).toUpperCase() + data.overallStaleness.slice(1)}\n`;
  
  if (data.dataCompleteness !== 'minimal') {
    responseText += `Oldest Data: ${data.oldestDataAgeMinutes} minutes ago\n`;
    responseText += `Freshest Data: ${data.freshestDataAgeMinutes} minutes ago\n`;
  }
  
  responseText += `\n💡 For technical details about measurement methods and station specifications, use the get_measurement_info tool.\n`;
  responseText += `📊 For individual tool access, use get_potomac_gage_depth (water level) or get_potomac_flow (flow rate) tools.`;
  
  return {
    content: [{ type: "text", text: responseText }]
  };
}