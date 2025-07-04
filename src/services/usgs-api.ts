import { 
  USGSAPIResponse, 
  WaterLevelData, 
  FlowRateData, 
  USGS_STATIONS,
  WaterLevelHistoricalPoint,
  FlowRateHistoricalPoint
} from '../types/potomac-data.js';

// USGS Parameter Codes
const USGS_PARAMETER_CODES = {
  GAGE_HEIGHT: '00065', // Gage height, feet
  DISCHARGE: '00060'    // Discharge, cubic feet per second
} as const;

/**
 * USGS Water Services API client for fetching Potomac River data
 * Handles requests to USGS Instantaneous Values Web Service
 */
export class USGSApiService {
  private readonly baseUrl = 'https://waterservices.usgs.gov/nwis/iv';
  private readonly defaultTimeout = 5000; // 5 seconds
  private readonly historicalTimeout = 8000; // 8 seconds

  /**
   * Fetch current water level data from Georgetown station (01647600)
   * @returns Promise<WaterLevelData | null>
   */
  async getCurrentWaterLevel(): Promise<WaterLevelData | null> {
    const url = this.buildUrl({
      sites: USGS_STATIONS.POTOMAC_GEORGETOWN.id,
      parameterCd: USGS_PARAMETER_CODES.GAGE_HEIGHT,
      format: 'json',
      siteStatus: 'all'
    });

    try {
      const response = await this.fetchWithTimeout(url, this.defaultTimeout);
      const historical = await this.getHistoricalWaterLevelPoints();
      return this.parseCurrentWaterLevelResponse(response, historical);
    } catch (error) {
      console.error('Failed to fetch current water level:', error);
      return null;
    }
  }

  /**
   * Fetch 7-day historical water level data points
   * @returns Promise<WaterLevelHistoricalPoint[]>
   */
  async getHistoricalWaterLevelPoints(): Promise<WaterLevelHistoricalPoint[]> {
    const url = this.buildUrl({
      sites: USGS_STATIONS.POTOMAC_GEORGETOWN.id,
      parameterCd: USGS_PARAMETER_CODES.GAGE_HEIGHT,
      format: 'json',
      period: 'P7D',
      siteStatus: 'all'
    });

    try {
      const response = await this.fetchWithTimeout(url, this.historicalTimeout);
      return this.parseHistoricalWaterLevelResponse(response);
    } catch (error) {
      console.error('Failed to fetch historical water level:', error);
      return [];
    }
  }

  /**
   * Fetch current flow rate data from Little Falls station (01646500)
   * @returns Promise<FlowRateData | null>
   */
  async getCurrentFlowRate(): Promise<FlowRateData | null> {
    const url = this.buildUrl({
      sites: USGS_STATIONS.POTOMAC_LITTLE_FALLS.id,
      parameterCd: USGS_PARAMETER_CODES.DISCHARGE,
      format: 'json',
      siteStatus: 'all'
    });

    try {
      const response = await this.fetchWithTimeout(url, this.defaultTimeout);
      const historical = await this.getHistoricalFlowRatePoints();
      return this.parseCurrentFlowRateResponse(response, historical);
    } catch (error) {
      console.error('Failed to fetch current flow rate:', error);
      return null;
    }
  }

  /**
   * Fetch 7-day historical flow rate data points
   * @returns Promise<FlowRateHistoricalPoint[]>
   */
  async getHistoricalFlowRatePoints(): Promise<FlowRateHistoricalPoint[]> {
    const url = this.buildUrl({
      sites: USGS_STATIONS.POTOMAC_LITTLE_FALLS.id,
      parameterCd: USGS_PARAMETER_CODES.DISCHARGE,
      format: 'json',
      period: 'P7D',
      siteStatus: 'all'
    });

    try {
      const response = await this.fetchWithTimeout(url, this.historicalTimeout);
      return this.parseHistoricalFlowRateResponse(response);
    } catch (error) {
      console.error('Failed to fetch historical flow rate:', error);
      return [];
    }
  }

  /**
   * Build USGS API URL with query parameters
   */
  private buildUrl(params: Record<string, string>): string {
    const url = new URL(this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return url.toString();
  }

  /**
   * Fetch with timeout using AbortController
   */
  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<USGSAPIResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'water-services-mcp/1.0.0',
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as USGSAPIResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  /**
   * Parse current water level response and combine with historical data
   */
  private parseCurrentWaterLevelResponse(
    response: USGSAPIResponse, 
    historical: WaterLevelHistoricalPoint[]
  ): WaterLevelData | null {
    try {
      const timeSeries = response.value?.timeSeries?.[0];
      if (!timeSeries?.values?.[0]?.value?.length) {
        return null;
      }

      const latestValue = timeSeries.values[0].value[0];
      const currentValue = parseFloat(latestValue.value);
      const timestamp = latestValue.dateTime;

      // Check if parsed value is valid
      if (isNaN(currentValue)) {
        return null;
      }

      // Calculate min/max from historical data
      const historicalValues = historical.map(point => point.navd88_ft);
      const sevenDayMin = historicalValues.length > 0 ? Math.min(...historicalValues) : currentValue;
      const sevenDayMax = historicalValues.length > 0 ? Math.max(...historicalValues) : currentValue;

      // Convert NAVD88 to WMLW (approximate conversion for DC area)
      const wmlwValue = currentValue - 1.0; // Approximate offset

      return {
        navd88_ft: currentValue,
        wmlw_ft: wmlwValue,
        timestamp: timestamp,
        seven_day_min_ft: sevenDayMin,
        seven_day_max_ft: sevenDayMax,
        stale: this.isDataStale(new Date(timestamp))
      };
    } catch (error) {
      console.error('Failed to parse current water level response:', error);
      return null;
    }
  }

  /**
   * Parse historical water level response
   */
  private parseHistoricalWaterLevelResponse(response: USGSAPIResponse): WaterLevelHistoricalPoint[] {
    try {
      const timeSeries = response.value?.timeSeries?.[0];
      if (!timeSeries?.values?.[0]?.value?.length) {
        return [];
      }

      const values = timeSeries.values[0].value;

      return values
        .map(value => {
          const navd88Value = parseFloat(value.value);
          const wmlwValue = navd88Value - 1.0; // Approximate conversion

          return {
            navd88_ft: navd88Value,
            wmlw_ft: wmlwValue,
            timestamp: value.dateTime,
            quality_code: value.qualifiers?.[0]
          };
        })
        .filter(point => !isNaN(point.navd88_ft)); // Filter out invalid values
    } catch (error) {
      console.error('Failed to parse historical water level response:', error);
      return [];
    }
  }

  /**
   * Parse current flow rate response and combine with historical data
   */
  private parseCurrentFlowRateResponse(
    response: USGSAPIResponse, 
    historical: FlowRateHistoricalPoint[]
  ): FlowRateData | null {
    try {
      const timeSeries = response.value?.timeSeries?.[0];
      if (!timeSeries?.values?.[0]?.value?.length) {
        return null;
      }

      const latestValue = timeSeries.values[0].value[0];
      const currentValue = parseFloat(latestValue.value);
      const timestamp = latestValue.dateTime;

      // Check if parsed value is valid
      if (isNaN(currentValue)) {
        return null;
      }

      // Calculate min/max from historical data
      const historicalValues = historical.map(point => point.discharge_cfs);
      const sevenDayMin = historicalValues.length > 0 ? Math.min(...historicalValues) : currentValue;
      const sevenDayMax = historicalValues.length > 0 ? Math.max(...historicalValues) : currentValue;

      return {
        discharge_cfs: currentValue,
        timestamp: timestamp,
        seven_day_min_cfs: sevenDayMin,
        seven_day_max_cfs: sevenDayMax,
        stale: this.isDataStale(new Date(timestamp))
      };
    } catch (error) {
      console.error('Failed to parse current flow rate response:', error);
      return null;
    }
  }

  /**
   * Parse historical flow rate response
   */
  private parseHistoricalFlowRateResponse(response: USGSAPIResponse): FlowRateHistoricalPoint[] {
    try {
      const timeSeries = response.value?.timeSeries?.[0];
      if (!timeSeries?.values?.[0]?.value?.length) {
        return [];
      }

      const values = timeSeries.values[0].value;

      return values
        .map(value => ({
          discharge_cfs: parseFloat(value.value),
          timestamp: value.dateTime,
          quality_code: value.qualifiers?.[0],
          measurement_grade: this.extractMeasurementGrade(value.qualifiers || [])
        }))
        .filter(point => !isNaN(point.discharge_cfs)); // Filter out invalid values
    } catch (error) {
      console.error('Failed to parse historical flow rate response:', error);
      return [];
    }
  }

  /**
   * Extract measurement grade from qualifiers
   */
  private extractMeasurementGrade(qualifiers: string[]): 'A' | 'B' | 'C' | 'D' | 'E' | undefined {
    const grades: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
    return grades.find(grade => qualifiers.includes(grade));
  }

  /**
   * Check if data is stale (older than 30 minutes)
   */
  private isDataStale(dataTime: Date): boolean {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    return dataTime < thirtyMinutesAgo;
  }
} 