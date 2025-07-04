// TypeScript type definitions for Potomac water data and USGS API responses

// USGS API Response Structure
export interface USGSTimeSeriesValue {
  value: string;
  qualifiers?: string[];
  dateTime: string;
}

export interface USGSValueArray {
  value: USGSTimeSeriesValue[];
  qualifier?: any[];
  qualityControlLevel?: any[];
  method?: any[];
  source?: any[];
}

export interface USGSVariable {
  variableCode: Array<{
    value: string;
    network: string;
    vocabulary: string;
    variableID: number;
    default: boolean;
  }>;
  variableName: string;
  variableDescription: string;
  valueType: string;
  unit: {
    unitCode: string;
    unitName: string;
    unitType: string;
    unitAbbreviation: string;
  };
  options: {
    option: Array<{
      name: string;
      optionCode: string;
    }>;
  };
  note?: any[];
  noDataValue: number;
}

export interface USGSTimeSeries {
  sourceInfo: {
    siteName: string;
    siteCode: Array<{
      value: string;
      network: string;
      agencyCode: string;
    }>;
    timeZoneInfo: {
      defaultTimeZone: {
        zoneOffset: string;
        zoneAbbreviation: string;
      };
      daylightSavingsTimeZone: {
        zoneOffset: string;
        zoneAbbreviation: string;
      };
      siteUsesDaylightSavingsTime: boolean;
    };
    geoLocation: {
      geogLocation: {
        srs: string;
        latitude: number;
        longitude: number;
      };
      localSiteXY: any[];
    };
    note: any[];
    siteType: any[];
    siteProperty: any[];
  };
  variable: USGSVariable;
  values: USGSValueArray[];
  name: string;
}

export interface USGSAPIResponse {
  name: string;
  declaredType: string;
  scope: string;
  value: {
    queryInfo: {
      queryURL: string;
      criteria: {
        locationParam: string;
        variableParam?: string;
        parameter?: any[];
      };
      note: Array<{
        value: string;
        title: string;
      }>;
    };
    timeSeries: USGSTimeSeries[];
  };
  nil: boolean;
  globalScope: boolean;
  typeSubstituted: boolean;
}

// Water Level Data Types

// NAVD88 Datum (North American Vertical Datum of 1988)
export interface NAVD88Reading {
  value_ft: number;
  datum: 'NAVD88';
  description: 'North American Vertical Datum of 1988';
}

// WMLW Datum (Washington Mean Low Water)
export interface WMLWReading {
  value_ft: number;
  datum: 'WMLW';
  description: 'Washington Mean Low Water';
}

// Combined water level data with both datums
export interface WaterLevelData {
  navd88_ft: number;
  wmlw_ft: number;
  timestamp: string;
  seven_day_min_ft: number;
  seven_day_max_ft: number;
  stale: boolean;
}

// Detailed water level reading with datum information
export interface DetailedWaterLevelReading {
  navd88: NAVD88Reading;
  wmlw: WMLWReading;
  timestamp: string;
  station_id: string;
  station_name: string;
  stale: boolean;
}

// Historical water level data point
export interface WaterLevelHistoricalPoint {
  navd88_ft: number;
  wmlw_ft: number;
  timestamp: string;
  quality_code?: string;
}

// Flow Rate Data Types

// Discharge measurement in Cubic Feet per Second (CFS)
export interface DischargeReading {
  value_cfs: number;
  unit: 'CFS';
  unit_description: 'Cubic Feet per Second';
  parameter_code: '00060';
  parameter_name: 'Discharge';
}

// Flow rate data for MCP tool response
export interface FlowRateData {
  discharge_cfs: number;
  timestamp: string;
  seven_day_min_cfs: number;
  seven_day_max_cfs: number;
  stale: boolean;
}

// Detailed flow rate reading with measurement information
export interface DetailedFlowRateReading {
  discharge: DischargeReading;
  timestamp: string;
  station_id: string;
  station_name: string;
  measurement_method?: string;
  quality_code?: string;
  stale: boolean;
}

// Historical flow rate data point
export interface FlowRateHistoricalPoint {
  discharge_cfs: number;
  timestamp: string;
  quality_code?: string;
  measurement_grade?: 'A' | 'B' | 'C' | 'D' | 'E'; // USGS measurement grades
}

// Flow rate statistics and analysis
export interface FlowRateStatistics {
  current_cfs: number;
  seven_day_min_cfs: number;
  seven_day_max_cfs: number;
  seven_day_avg_cfs: number;
  seven_day_median_cfs: number;
  data_points_count: number;
  period_start: string;
  period_end: string;
}

// Flow conditions classification
export type FlowCondition = 'very_low' | 'low' | 'normal' | 'high' | 'very_high' | 'flood';

export interface FlowConditionAssessment {
  condition: FlowCondition;
  description: string;
  current_cfs: number;
  normal_range_min_cfs?: number;
  normal_range_max_cfs?: number;
  percentile_rank?: number; // 0-100 percentile within historical data
}

// Combined Conditions Data Types

// Basic combined conditions response (PRD specification)
export interface CombinedConditionsData {
  gage_height: WaterLevelData;
  flow_rate: FlowRateData;
}

// Enhanced combined conditions with additional metadata
export interface DetailedCombinedConditions {
  gage_height: {
    data: WaterLevelData;
    station: typeof USGS_STATIONS.POTOMAC_GEORGETOWN;
    last_updated: string;
    data_quality: 'good' | 'fair' | 'poor' | 'unavailable';
  };
  flow_rate: {
    data: FlowRateData;
    station: typeof USGS_STATIONS.POTOMAC_LITTLE_FALLS;
    last_updated: string;
    data_quality: 'good' | 'fair' | 'poor' | 'unavailable';
  };
  combined_assessment?: WaterConditionAssessment;
}

// Water condition assessment combining both metrics
export interface WaterConditionAssessment {
  overall_condition: 'excellent' | 'good' | 'fair' | 'poor' | 'dangerous';
  level_condition: 'very_low' | 'low' | 'normal' | 'high' | 'very_high';
  flow_condition: FlowCondition;
  recreational_suitability: {
    kayaking: 'excellent' | 'good' | 'fair' | 'poor' | 'dangerous';
    fishing: 'excellent' | 'good' | 'fair' | 'poor';
    swimming: 'excellent' | 'good' | 'fair' | 'poor' | 'dangerous';
    sandbar_access: 'accessible' | 'partially_accessible' | 'inaccessible';
  };
  safety_notes?: string[];
}

// Partial data scenarios (for handling mixed freshness/failures)
export interface PartialConditionsData {
  gage_height?: {
    data: WaterLevelData;
    available: boolean;
    error?: string;
  };
  flow_rate?: {
    data: FlowRateData;
    available: boolean;
    error?: string;
  };
  data_completeness: 'complete' | 'partial' | 'minimal';
  missing_data_reason?: string;
}

// Combined conditions with failure handling
export interface RobustCombinedConditions {
  success: boolean;
  data?: CombinedConditionsData;
  partial_data?: PartialConditionsData;
  errors?: {
    gage_height_error?: APIError;
    flow_rate_error?: APIError;
    system_error?: APIError;
  };
  data_freshness: {
    gage_height_age_minutes?: number;
    flow_rate_age_minutes?: number;
    oldest_data_age_minutes: number;
  };
  cache_info?: {
    gage_height_cached: boolean;
    flow_rate_cached: boolean;
    cache_hit_rate: number;
  };
}

// Historical combined conditions for trend analysis
export interface HistoricalCombinedConditions {
  timestamp: string;
  gage_height_ft: number;
  flow_rate_cfs: number;
  conditions_assessment?: WaterConditionAssessment;
}

// Combined conditions time series
export interface CombinedConditionsTimeSeries {
  data_points: HistoricalCombinedConditions[];
  period_start: string;
  period_end: string;
  summary: {
    level_range: { min: number; max: number };
    flow_range: { min: number; max: number };
    predominant_condition: WaterConditionAssessment['overall_condition'];
  };
}

// Staleness Detection Types

// Basic staleness information
export interface StalenessInfo {
  isStale: boolean;
  ageMinutes: number;
  threshold: number;
}

// Detailed staleness assessment
export interface DetailedStalenessInfo {
  isStale: boolean;
  ageMinutes: number;
  thresholdMinutes: number;
  lastUpdated: string;
  dataSource: 'usgs_api' | 'cache';
  staleness_level: 'fresh' | 'acceptable' | 'stale' | 'very_stale';
  staleness_description: string;
}

// Multi-source staleness tracking for combined tools
export interface CombinedStalenessInfo {
  gage_height: DetailedStalenessInfo;
  flow_rate: DetailedStalenessInfo;
  overall_staleness: 'fresh' | 'mixed' | 'stale';
  oldest_data_age_minutes: number;
  freshest_data_age_minutes: number;
}

// Error State Types

// Comprehensive API error with context
export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  source: 'usgs_api' | 'cache' | 'processing' | 'network' | 'timeout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  retry_count?: number;
}

// USGS-specific error codes and messages
export interface USGSAPIError extends APIError {
  usgs_error_code?: string;
  usgs_message?: string;
  station_id?: string;
  parameter_code?: string;
  request_url?: string;
}

// Network and timeout errors
export interface NetworkError extends APIError {
  request_timeout_ms: number;
  response_time_ms?: number;
  http_status?: number;
  network_issue: 'timeout' | 'connection_refused' | 'dns_failure' | 'ssl_error' | 'unknown';
}

// Cache-related errors
export interface CacheError extends APIError {
  cache_operation: 'read' | 'write' | 'invalidate' | 'key_generation';
  cache_key?: string;
  fallback_used: boolean;
}

// Data processing errors
export interface ProcessingError extends APIError {
  processing_stage: 'parsing' | 'validation' | 'calculation' | 'formatting';
  input_data?: any;
  expected_format?: string;
}

// Generic tool response with enhanced error handling
export interface ToolResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  warnings?: string[];
  metadata?: {
    response_time_ms: number;
    cache_used: boolean;
    data_freshness: StalenessInfo;
  };
}

// Multi-source error aggregation for combined tools
export interface CombinedToolErrors {
  gage_height_errors: APIError[];
  flow_rate_errors: APIError[];
  system_errors: APIError[];
  error_count: number;
  has_critical_errors: boolean;
  has_retryable_errors: boolean;
  error_summary: string;
}

// Error recovery and retry information
export interface ErrorRecoveryInfo {
  attempted_retries: number;
  max_retries: number;
  retry_delays_ms: number[];
  recovery_strategy: 'immediate_retry' | 'exponential_backoff' | 'circuit_breaker' | 'fallback_data';
  recovery_successful: boolean;
  fallback_data_used: boolean;
}

// Comprehensive error context for debugging
export interface ErrorContext {
  tool_name: string;
  station_id?: string;
  request_timestamp: string;
  user_agent?: string;
  cache_key?: string;
  request_parameters?: Record<string, any>;
  system_info: {
    worker_region?: string;
    memory_usage_mb?: number;
    execution_time_ms?: number;
  };
}

// USGS Station Configuration
export interface USGSStation {
  id: string;
  name: string;
  description: string;
  dataType: 'water_level' | 'flow_rate';
  parameters?: string[]; // Parameter codes like '00060' for discharge
}

// Cache-related Types
export interface CacheKey {
  station: string;
  dataType: 'current' | 'historical';
  timestamp: string;
}

export interface CachedData<T> {
  data: T;
  cachedAt: string;
  expiresAt: string;
}

// Historical Data Processing Types
export interface HistoricalDataPoint {
  value: number;
  timestamp: string;
  quality?: string;
}

export interface HistoricalDataSummary {
  min: number;
  max: number;
  count: number;
  startDate: string;
  endDate: string;
}

// Constants
export const USGS_STATIONS = {
  POTOMAC_GEORGETOWN: {
    id: '01647600',
    name: 'Potomac River at Wisconsin Ave, Washington DC',
    description: 'Water level gauge at Georgetown',
    dataType: 'water_level' as const
  },
  POTOMAC_LITTLE_FALLS: {
    id: '01646500',
    name: 'Potomac River near Little Falls Pump Station',
    description: 'Flow rate gauge at Little Falls',
    dataType: 'flow_rate' as const,
    parameters: ['00060'] // Discharge parameter code
  }
} as const;

export const STALENESS_THRESHOLD_MINUTES = 30;
export const CACHE_TTL_CURRENT_MINUTES = 14;
export const CACHE_TTL_HISTORICAL_MINUTES = 30; 