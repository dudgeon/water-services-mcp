/**
 * Cache service wrapper for Cloudflare Cache API
 * Provides TTL management, cache key generation, and graceful fallback handling
 */

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Custom cache key suffix */
  keySuffix?: string;
  /** Whether to log cache hits/misses */
  enableLogging?: boolean;
  /** Tool type for cache key differentiation */
  toolType?: 'water-level' | 'flow-rate' | 'combined-conditions';
  /** Data type for cache key differentiation */
  dataType?: 'current' | 'historical';
  /** Time window for cache bucketing (in minutes) */
  timeWindow?: number;
  /** Force refresh - bypass cache and fetch fresh data */
  forceRefresh?: boolean;
  /** Request headers for cache invalidation checks */
  requestHeaders?: Headers | Record<string, string>;
  /** Fallback strategy when cache operations fail */
  fallbackStrategy?: 'ignore' | 'stale' | 'emergency' | 'throw';
  /** Maximum age for stale data fallback (in seconds) */
  maxStaleAge?: number;
}

export interface CacheFallbackResult<T> {
  data: T;
  source: 'cache' | 'fresh' | 'stale' | 'emergency';
  cacheAge?: number;
  fallbackReason?: string;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  bypasses: number;
  invalidations: number;
  staleEntries: number;
  fallbackHits: number;
  emergencyFallbacks: number;
  cacheFailures: number;
}

export interface DetailedCacheMetrics extends CacheMetrics {
  hitsByToolType: Record<string, number>;
  missesByToolType: Record<string, number>;
  errorsByToolType: Record<string, number>;
  hitsByDataType: Record<string, number>;
  missesByDataType: Record<string, number>;
  totalRequests: number;
  hitRatio: number;
  averageResponseTime: number;
  lastActivity: string;
}

export interface CacheLogEntry {
  timestamp: string;
  action: 'HIT' | 'MISS' | 'SET' | 'DELETE' | 'BYPASS' | 'STALE' | 'ERROR' | 'INVALIDATE' | 'FALLBACK' | 'EMERGENCY' | 'CACHE_FAILURE';
  cacheKey: string;
  toolType?: string;
  dataType?: string;
  ttl?: number;
  responseTimeMs?: number;
  error?: string;
  url?: string;
  fallbackReason?: string;
  cacheAge?: number;
}

export class CacheService {
  private cache: Cache;
  private metrics: CacheMetrics = { 
    hits: 0, 
    misses: 0, 
    errors: 0, 
    bypasses: 0, 
    invalidations: 0, 
    staleEntries: 0,
    fallbackHits: 0,
    emergencyFallbacks: 0,
    cacheFailures: 0
  };
  private detailedMetrics: DetailedCacheMetrics;
  private cacheLog: CacheLogEntry[] = [];
  private responseTimes: number[] = [];
  private readonly maxLogEntries = 1000; // Keep last 1000 log entries
  private readonly keyPrefix = 'water-services:';
  
  // TTL Management Constants (in seconds)
  private readonly TTL_CONFIG = {
    // Current data TTLs - shorter for fresher data
    CURRENT_WATER_LEVEL: 840,    // 14 minutes
    CURRENT_FLOW_RATE: 840,      // 14 minutes
    CURRENT_COMBINED: 840,       // 14 minutes
    
    // Historical data TTLs - longer since data doesn't change
    HISTORICAL_WATER_LEVEL: 1800, // 30 minutes
    HISTORICAL_FLOW_RATE: 1800,   // 30 minutes
    
    // Fallback and emergency TTLs
    DEFAULT: 300,                 // 5 minutes default
    EMERGENCY_STALE: 3600,       // 1 hour for emergency fallback
    MINIMUM: 60,                 // 1 minute minimum TTL
    MAXIMUM: 7200                // 2 hours maximum TTL
  } as const;
  
  // Time window constants (in minutes) for cache bucketing
  private readonly TIME_WINDOWS = {
    CURRENT_DATA: 14,    // 14-minute buckets for current data
    HISTORICAL_DATA: 30, // 30-minute buckets for historical data
    DEFAULT: 5           // 5-minute buckets for generic data
  } as const;

  constructor() {
    this.cache = caches.default;
    this.detailedMetrics = this.initializeDetailedMetrics();
  }

  /**
   * Initialize detailed metrics structure
   */
  private initializeDetailedMetrics(): DetailedCacheMetrics {
    return {
      ...this.metrics,
      hitsByToolType: {},
      missesByToolType: {},
      errorsByToolType: {},
      hitsByDataType: {},
      missesByDataType: {},
      totalRequests: 0,
      hitRatio: 0,
      averageResponseTime: 0,
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * Generate a cache key for the given URL and options
   * Strategy: {prefix}:{tool-type}:{data-type}:{time-bucket}:{url-hash}:{suffix}
   */
  private generateCacheKey(url: string, options?: CacheOptions): string {
    const parts = [this.keyPrefix.slice(0, -1)]; // Remove trailing colon
    
    // Add tool type differentiation
    if (options?.toolType) {
      parts.push(options.toolType);
    } else {
      parts.push('generic');
    }
    
    // Add data type differentiation
    if (options?.dataType) {
      parts.push(options.dataType);
    } else {
      parts.push('unknown');
    }
    
    // Add time window bucketing for cache alignment
    if (options?.timeWindow && options.timeWindow > 0) {
      const timeBucket = this.generateTimeBucket(options.timeWindow);
      parts.push(timeBucket);
    } else {
      // Default 5-minute time buckets for cache alignment
      const timeBucket = this.generateTimeBucket(5);
      parts.push(timeBucket);
    }
    
    // Add URL hash to keep keys manageable
    const urlHash = this.hashString(url);
    parts.push(urlHash);
    
    // Add custom suffix if provided
    if (options?.keySuffix) {
      parts.push(options.keySuffix);
    }
    
    return parts.join(':');
  }

  /**
   * Generate time bucket for cache key alignment
   * This ensures cache keys are consistent within time windows
   */
  private generateTimeBucket(windowMinutes: number): string {
    const now = new Date();
    const bucketSize = windowMinutes * 60 * 1000; // Convert to milliseconds
    const bucketStart = Math.floor(now.getTime() / bucketSize) * bucketSize;
    return new Date(bucketStart).toISOString().slice(0, 16).replace(/[-:]/g, ''); // YYYYMMDDHHMM format
  }

  /**
   * Generate a simple hash of a string for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Create a cache-compatible request with appropriate headers
   */
  private createCacheRequest(url: string, options?: CacheOptions): Request {
    const cacheKey = this.generateCacheKey(url, options);
    const request = new Request(cacheKey, {
      method: 'GET',
      headers: {
        'Cache-Control': `max-age=${options?.ttl || this.TTL_CONFIG.DEFAULT}`,
        'Content-Type': 'application/json'
      }
    });
    return request;
  }

  /**
   * Create a response with cache headers
   */
  private createCacheResponse(data: any, options?: CacheOptions): Response {
    const ttl = options?.ttl || this.TTL_CONFIG.DEFAULT;
    const response = new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
        'Expires': new Date(Date.now() + ttl * 1000).toUTCString(),
        'X-Cache-TTL': ttl.toString(),
        'X-Cached-At': new Date().toISOString()
      }
    });
    return response;
  }

  /**
   * Get data from cache
   */
  async get<T>(url: string, options?: CacheOptions): Promise<T | null> {
    try {
      // Check if cache should be bypassed due to refresh headers or force refresh
      if (this.shouldBypassCache(options)) {
        this.metrics.bypasses++;
        const cacheKey = this.generateCacheKey(url, options);
        this.logCacheActivity('BYPASS', cacheKey, options, url);
        
        // If force refresh, also invalidate existing cache entry
        if (options?.forceRefresh || this.shouldRefreshFromHeaders(options?.requestHeaders)) {
          await this.delete(url, options);
          this.metrics.invalidations++;
          this.logCacheActivity('INVALIDATE', cacheKey, options, url);
        }
        
        return null;
      }

      const cacheRequest = this.createCacheRequest(url, options);
      const cachedResponse = await this.cache.match(cacheRequest);

      const cacheKey = this.generateCacheKey(url, options);
      
      if (cachedResponse) {
        // Check if response is still fresh
        const cacheControl = cachedResponse.headers.get('Cache-Control');
        const cachedAt = cachedResponse.headers.get('X-Cached-At');
        
        if (cachedAt && cacheControl) {
          const maxAge = this.extractMaxAge(cacheControl);
          const cacheTime = new Date(cachedAt).getTime();
          const now = Date.now();
          
          if (now - cacheTime > maxAge * 1000) {
            // Cache entry is stale, remove it
            await this.delete(url, options);
            this.metrics.staleEntries++;
            this.logCacheActivity('STALE', cacheKey, options, url);
            return null;
          }
        }

        this.metrics.hits++;
        this.logCacheActivity('HIT', cacheKey, options, url);
        
        const data = await cachedResponse.json();
        return data as T;
      }

      this.metrics.misses++;
      this.logCacheActivity('MISS', cacheKey, options, url);
      return null;
    } catch (error) {
      this.metrics.errors++;
      const cacheKey = this.generateCacheKey(url, options);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logCacheActivity('ERROR', cacheKey, options, url, undefined, errorMessage);
      return null; // Graceful fallback
    }
  }

  /**
   * Store data in cache
   */
  async set(url: string, data: any, options?: CacheOptions): Promise<boolean> {
    const startTime = Date.now();
    try {
      const cacheRequest = this.createCacheRequest(url, options);
      const cacheResponse = this.createCacheResponse(data, options);

      await this.cache.put(cacheRequest, cacheResponse);
      
      const responseTime = Date.now() - startTime;
      const cacheKey = this.generateCacheKey(url, options);
      this.logCacheActivity('SET', cacheKey, options, url, responseTime);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      const cacheKey = this.generateCacheKey(url, options);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logCacheActivity('ERROR', cacheKey, options, url, undefined, errorMessage);
      return false; // Graceful fallback
    }
  }

  /**
   * Delete data from cache
   */
  async delete(url: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheRequest = this.createCacheRequest(url, options);
      const deleted = await this.cache.delete(cacheRequest);
      
      const cacheKey = this.generateCacheKey(url, options);
      this.logCacheActivity('DELETE', cacheKey, options, url);
      
      return deleted;
    } catch (error) {
      this.metrics.errors++;
      const cacheKey = this.generateCacheKey(url, options);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logCacheActivity('ERROR', cacheKey, options, url, undefined, errorMessage);
      return false; // Graceful fallback
    }
  }

  /**
   * Invalidate cache entries by pattern (prefix matching)
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    // Note: Cloudflare Cache API doesn't support pattern-based deletion
    // This is a placeholder for potential future implementation
    // or could be implemented with a registry of cache keys
    console.warn('Pattern-based cache invalidation not supported by Cloudflare Cache API');
    return 0;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = { 
      hits: 0, 
      misses: 0, 
      errors: 0, 
      bypasses: 0, 
      invalidations: 0, 
      staleEntries: 0,
      fallbackHits: 0,
      emergencyFallbacks: 0,
      cacheFailures: 0
    };
    this.detailedMetrics = this.initializeDetailedMetrics();
    this.cacheLog = [];
    this.responseTimes = [];
  }

  /**
   * Extract max-age value from Cache-Control header
   */
  private extractMaxAge(cacheControl: string): number {
    const match = cacheControl.match(/max-age=(\d+)/);
    return match ? parseInt(match[1], 10) : this.TTL_CONFIG.DEFAULT;
  }

  /**
   * Get cache hit ratio
   */
  getCacheHitRatio(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Get appropriate TTL for given tool and data type
   */
  private getTtlForType(toolType?: string, dataType?: string): number {
    if (!toolType || !dataType) {
      return this.TTL_CONFIG.DEFAULT;
    }

    const key = `${dataType.toUpperCase()}_${toolType.toUpperCase().replace('-', '_')}` as keyof typeof this.TTL_CONFIG;
    
    // Handle special cases
    if (dataType === 'current') {
      switch (toolType) {
        case 'water-level':
          return this.TTL_CONFIG.CURRENT_WATER_LEVEL;
        case 'flow-rate':
          return this.TTL_CONFIG.CURRENT_FLOW_RATE;
        case 'combined-conditions':
          return this.TTL_CONFIG.CURRENT_COMBINED;
        default:
          return this.TTL_CONFIG.DEFAULT;
      }
    } else if (dataType === 'historical') {
      switch (toolType) {
        case 'water-level':
          return this.TTL_CONFIG.HISTORICAL_WATER_LEVEL;
        case 'flow-rate':
          return this.TTL_CONFIG.HISTORICAL_FLOW_RATE;
        default:
          return this.TTL_CONFIG.HISTORICAL_WATER_LEVEL; // Default to water level TTL
      }
    }

    return this.TTL_CONFIG.DEFAULT;
  }

  /**
   * Get appropriate time window for given data type
   */
  private getTimeWindowForType(dataType?: string): number {
    switch (dataType) {
      case 'current':
        return this.TIME_WINDOWS.CURRENT_DATA;
      case 'historical':
        return this.TIME_WINDOWS.HISTORICAL_DATA;
      default:
        return this.TIME_WINDOWS.DEFAULT;
    }
  }

  /**
   * Validate and clamp TTL to acceptable range
   */
  private validateTtl(ttl: number): number {
    return Math.max(
      this.TTL_CONFIG.MINIMUM,
      Math.min(this.TTL_CONFIG.MAXIMUM, ttl)
    );
  }

  /**
   * Check if cached data is approaching expiration (within 10% of TTL)
   */
  private isApproachingExpiration(cachedAt: string, ttl: number): boolean {
    const cacheTime = new Date(cachedAt).getTime();
    const now = Date.now();
    const age = now - cacheTime;
    const threshold = ttl * 1000 * 0.9; // 90% of TTL
    return age > threshold;
  }

  /**
   * Log cache activity with detailed information
   */
  private logCacheActivity(
    action: CacheLogEntry['action'],
    cacheKey: string,
    options?: CacheOptions,
    url?: string,
    responseTimeMs?: number,
    error?: string
  ): void {
    const logEntry: CacheLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      cacheKey,
      toolType: options?.toolType,
      dataType: options?.dataType,
      ttl: options?.ttl,
      responseTimeMs,
      error,
      url
    };

    // Add to log (maintain size limit)
    this.cacheLog.push(logEntry);
    if (this.cacheLog.length > this.maxLogEntries) {
      this.cacheLog.shift(); // Remove oldest entry
    }

    // Update detailed metrics
    this.updateDetailedMetrics(action, options, responseTimeMs);

    // Console logging if enabled
    if (options?.enableLogging) {
      const logMessage = this.formatLogMessage(logEntry);
      console.log(logMessage);
    }
  }

  /**
   * Update detailed metrics based on cache activity
   */
  private updateDetailedMetrics(
    action: CacheLogEntry['action'],
    options?: CacheOptions,
    responseTimeMs?: number
  ): void {
    const toolType = options?.toolType || 'unknown';
    const dataType = options?.dataType || 'unknown';

    // Update detailed metrics
    this.detailedMetrics.totalRequests++;
    this.detailedMetrics.lastActivity = new Date().toISOString();

    // Track by tool type
    if (action === 'HIT') {
      this.detailedMetrics.hitsByToolType[toolType] = (this.detailedMetrics.hitsByToolType[toolType] || 0) + 1;
    } else if (action === 'MISS') {
      this.detailedMetrics.missesByToolType[toolType] = (this.detailedMetrics.missesByToolType[toolType] || 0) + 1;
    } else if (action === 'ERROR') {
      this.detailedMetrics.errorsByToolType[toolType] = (this.detailedMetrics.errorsByToolType[toolType] || 0) + 1;
    }

    // Track by data type
    if (action === 'HIT') {
      this.detailedMetrics.hitsByDataType[dataType] = (this.detailedMetrics.hitsByDataType[dataType] || 0) + 1;
    } else if (action === 'MISS') {
      this.detailedMetrics.missesByDataType[dataType] = (this.detailedMetrics.missesByDataType[dataType] || 0) + 1;
    }

    // Track response times
    if (responseTimeMs !== undefined) {
      this.responseTimes.push(responseTimeMs);
      // Keep only last 100 response times for average calculation
      if (this.responseTimes.length > 100) {
        this.responseTimes.shift();
      }
      
      // Update average response time
      this.detailedMetrics.averageResponseTime = 
        this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    }

    // Update basic metrics in detailed metrics
    this.detailedMetrics.hits = this.metrics.hits;
    this.detailedMetrics.misses = this.metrics.misses;
    this.detailedMetrics.errors = this.metrics.errors;
    this.detailedMetrics.bypasses = this.metrics.bypasses;
    this.detailedMetrics.invalidations = this.metrics.invalidations;
    this.detailedMetrics.staleEntries = this.metrics.staleEntries;
    this.detailedMetrics.hitRatio = this.getCacheHitRatio();
  }

  /**
   * Format log message for console output
   */
  private formatLogMessage(entry: CacheLogEntry): string {
    const parts = [`[CACHE-${entry.action}]`, entry.cacheKey];
    
    if (entry.toolType || entry.dataType) {
      parts.push(`(${entry.toolType || 'unknown'}:${entry.dataType || 'unknown'})`);
    }
    
    if (entry.responseTimeMs !== undefined) {
      parts.push(`${entry.responseTimeMs}ms`);
    }
    
    if (entry.ttl !== undefined) {
      parts.push(`TTL:${entry.ttl}s`);
    }
    
    if (entry.error) {
      parts.push(`ERROR: ${entry.error}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Check if request headers indicate cache should be refreshed
   */
  private shouldRefreshFromHeaders(headers?: Headers | Record<string, string>): boolean {
    if (!headers) return false;

    const getHeader = (name: string): string | null => {
      if (headers instanceof Headers) {
        return headers.get(name);
      }
      return headers[name] || headers[name.toLowerCase()] || null;
    };

    // Check various cache invalidation headers
    const cacheControl = getHeader('cache-control');
    const pragma = getHeader('pragma');
    const refresh = getHeader('x-refresh-cache');
    const forceRefresh = getHeader('x-force-refresh');

    // Standard HTTP cache invalidation patterns
    if (cacheControl) {
      const lowerCC = cacheControl.toLowerCase();
      if (lowerCC.includes('no-cache') || 
          lowerCC.includes('no-store') || 
          lowerCC.includes('max-age=0')) {
        return true;
      }
    }

    // Legacy pragma header
    if (pragma && pragma.toLowerCase() === 'no-cache') {
      return true;
    }

    // Custom refresh headers
    if (refresh && ['true', '1', 'yes'].includes(refresh.toLowerCase())) {
      return true;
    }

    if (forceRefresh && ['true', '1', 'yes'].includes(forceRefresh.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Determine if cache should be bypassed based on options and headers
   */
  private shouldBypassCache(options?: CacheOptions): boolean {
    // Explicit force refresh option
    if (options?.forceRefresh) {
      return true;
    }

    // Check request headers for cache invalidation
    if (this.shouldRefreshFromHeaders(options?.requestHeaders)) {
      return true;
    }

    return false;
  }

  /**
   * Attempt to get stale data from cache beyond normal TTL
   */
  private async getStaleData<T>(url: string, options?: CacheOptions): Promise<{ data: T; age: number } | null> {
    try {
      const cacheKey = this.generateCacheKey(url, options);
      const request = this.createCacheRequest(url, options);
      const response = await this.cache.match(request);
      
      if (!response) {
        return null;
      }

      const cachedAt = response.headers.get('X-Cached-At');
      if (!cachedAt) {
        return null;
      }

      const age = (Date.now() - parseInt(cachedAt)) / 1000;
      const maxStaleAge = options?.maxStaleAge || 3600; // Default 1 hour for stale data
      
      if (age > maxStaleAge) {
        this.logCacheActivity('STALE', cacheKey, options, url, undefined, 'Data too old for stale fallback');
        return null;
      }

      const data = await response.json() as T;
      this.logCacheActivity('FALLBACK', cacheKey, options, url, undefined, `Using stale data (${Math.round(age)}s old)`);
      return { data, age };
    } catch (error) {
      this.logCacheActivity('ERROR', this.generateCacheKey(url, options), options, url, undefined, 
        `Stale data retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Emergency fallback with minimal data structure
   */
  private createEmergencyFallback<T>(url: string, options?: CacheOptions): T | null {
    try {
      // Try to extract station ID from URL for minimal response
      const stationMatch = url.match(/sites=(\d+)/);
      const paramMatch = url.match(/parameterCd=(\d+)/);
      
      if (!stationMatch) {
        return null;
      }

      const stationId = stationMatch[1];
      const paramCode = paramMatch?.[1];
      
      // Create minimal emergency response based on tool type
      const toolType = options?.toolType;
      const dataType = options?.dataType;
      
      let emergencyData: any;
      
      if (toolType === 'water-level' || paramCode === '00065') {
        emergencyData = {
          name: "USGS Water Data",
          declaredType: "org.cuahsi.waterml.TimeSeriesResponseType",
          scope: "javax.xml.bind.JAXBElement$GlobalScope",
          value: {
            queryInfo: {
              queryURL: url,
              criteria: { locationParam: `[ALL:${stationId}]` }
            },
            timeSeries: [{
              sourceInfo: {
                siteName: `Emergency fallback for station ${stationId}`,
                siteCode: [{ value: stationId }],
                geoLocation: { geogLocation: { latitude: 0, longitude: 0 } }
              },
              variable: {
                variableCode: [{ value: paramCode || "00065" }],
                variableName: "Gage height, ft",
                unit: { unitCode: "ft" }
              },
              values: [{
                value: [{
                  value: "0.00",
                  dateTime: new Date().toISOString(),
                  qualifiers: ["P"]
                }]
              }]
            }]
          }
        };
      } else if (toolType === 'flow-rate' || paramCode === '00060') {
        emergencyData = {
          name: "USGS Water Data", 
          declaredType: "org.cuahsi.waterml.TimeSeriesResponseType",
          scope: "javax.xml.bind.JAXBElement$GlobalScope",
          value: {
            queryInfo: {
              queryURL: url,
              criteria: { locationParam: `[ALL:${stationId}]` }
            },
            timeSeries: [{
              sourceInfo: {
                siteName: `Emergency fallback for station ${stationId}`,
                siteCode: [{ value: stationId }],
                geoLocation: { geogLocation: { latitude: 0, longitude: 0 } }
              },
              variable: {
                variableCode: [{ value: paramCode || "00060" }],
                variableName: "Discharge, cubic feet per second",
                unit: { unitCode: "ft3/s" }
              },
              values: [{
                value: [{
                  value: "0.00",
                  dateTime: new Date().toISOString(),
                  qualifiers: ["P"]
                }]
              }]
            }]
          }
        };
      } else {
        // Generic fallback
        emergencyData = {
          error: "Service temporarily unavailable",
          emergency: true,
          station: stationId,
          timestamp: new Date().toISOString()
        };
      }

      this.metrics.emergencyFallbacks++;
      this.logCacheActivity('EMERGENCY', this.generateCacheKey(url, options), options, url, 
        undefined, `Emergency fallback for station ${stationId}`);
      
      return emergencyData as T;
    } catch (error) {
      this.logCacheActivity('ERROR', this.generateCacheKey(url, options), options, url, undefined,
        `Emergency fallback creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Enhanced fetch with comprehensive fallback strategies
   */
  async fetchWithFallback<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<CacheFallbackResult<T>> {
    const startTime = Date.now();
    
    try {
      // Try cache first (unless bypassed)
      if (!this.shouldBypassCache(options)) {
        const cached = await this.get<T>(url, options);
        if (cached !== null) {
          return {
            data: cached,
            source: 'cache'
          };
        }
      }

      // Cache miss or bypassed - try fresh fetch
      try {
        const freshData = await fetchFn();
        
        // Store in cache for next time (ignore cache failures here)
        try {
          await this.set(url, freshData, options);
        } catch (cacheError) {
          this.metrics.cacheFailures++;
          this.logCacheActivity('CACHE_FAILURE', this.generateCacheKey(url, options), options, url,
            Date.now() - startTime, `Cache set failed: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`);
        }
        
        return {
          data: freshData,
          source: 'fresh'
        };
      } catch (fetchError) {
        // Fresh fetch failed - try fallback strategies
        const fallbackStrategy = options?.fallbackStrategy || 'stale';
        
        switch (fallbackStrategy) {
          case 'stale': {
            const staleResult = await this.getStaleData<T>(url, options);
            if (staleResult) {
              this.metrics.fallbackHits++;
              return {
                data: staleResult.data,
                source: 'stale',
                cacheAge: staleResult.age,
                fallbackReason: `Fresh fetch failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
              };
            }
            // Fall through to emergency if stale fails
          }
          
          case 'emergency': {
            const emergencyData = this.createEmergencyFallback<T>(url, options);
            if (emergencyData) {
              return {
                data: emergencyData,
                source: 'emergency',
                fallbackReason: `All other methods failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
              };
            }
            // Fall through to throw if emergency fails
          }
          
          case 'throw':
            throw fetchError;
            
          case 'ignore':
          default:
            // Try one more time with stale data as last resort
            const lastResortStale = await this.getStaleData<T>(url, { ...options, maxStaleAge: 86400 }); // 24 hours
            if (lastResortStale) {
              this.metrics.fallbackHits++;
              return {
                data: lastResortStale.data,
                source: 'stale',
                cacheAge: lastResortStale.age,
                fallbackReason: `Last resort stale data: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
              };
            }
            throw fetchError;
        }
      }
    } catch (error) {
      this.logCacheActivity('ERROR', this.generateCacheKey(url, options), options, url,
        Date.now() - startTime, `All fallback strategies failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Wrapper for fetch with automatic caching (backward compatibility)
   */
  async fetchWithCache<T>(
    url: string, 
    fetchFn: () => Promise<T>, 
    options?: CacheOptions
  ): Promise<T> {
    // Use the enhanced fallback method but return just the data for backward compatibility
    const result = await this.fetchWithFallback(url, fetchFn, options);
    return result.data;
  }

  /**
   * Helper method for caching current water level data
   */
  async cacheCurrentWaterLevel<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<T> {
    const toolType = 'water-level';
    const dataType = 'current';
    return this.fetchWithCache(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Enhanced helper method for caching current water level data with fallback result
   */
  async cacheCurrentWaterLevelWithFallback<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<CacheFallbackResult<T>> {
    const toolType = 'water-level';
    const dataType = 'current';
    return this.fetchWithFallback(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Helper method for caching current water level data with request context
   */
  async cacheCurrentWaterLevelFromRequest<T>(
    url: string,
    fetchFn: () => Promise<T>,
    request: Request,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow' | 'requestHeaders'>
  ): Promise<T> {
    const cacheOptions = CacheService.createOptionsFromRequest(request, {
      ...options,
      toolType: 'water-level',
      dataType: 'current'
    });
    
    return this.cacheCurrentWaterLevel(url, fetchFn, cacheOptions);
  }

  /**
   * Helper method for caching historical water level data
   */
  async cacheHistoricalWaterLevel<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<T> {
    const toolType = 'water-level';
    const dataType = 'historical';
    return this.fetchWithCache(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Helper method for caching current flow rate data
   */
  async cacheCurrentFlowRate<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<T> {
    const toolType = 'flow-rate';
    const dataType = 'current';
    return this.fetchWithCache(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Helper method for caching historical flow rate data
   */
  async cacheHistoricalFlowRate<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<T> {
    const toolType = 'flow-rate';
    const dataType = 'historical';
    return this.fetchWithCache(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Helper method for caching combined conditions data
   */
  async cacheCombinedConditions<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<T> {
    const toolType = 'combined-conditions';
    const dataType = 'current';
    return this.fetchWithCache(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Enhanced helper method for caching historical water level data with fallback result
   */
  async cacheHistoricalWaterLevelWithFallback<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<CacheFallbackResult<T>> {
    const toolType = 'water-level';
    const dataType = 'historical';
    return this.fetchWithFallback(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Enhanced helper method for caching current flow rate data with fallback result
   */
  async cacheCurrentFlowRateWithFallback<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<CacheFallbackResult<T>> {
    const toolType = 'flow-rate';
    const dataType = 'current';
    return this.fetchWithFallback(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Enhanced helper method for caching historical flow rate data with fallback result
   */
  async cacheHistoricalFlowRateWithFallback<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<CacheFallbackResult<T>> {
    const toolType = 'flow-rate';
    const dataType = 'historical';
    return this.fetchWithFallback(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  // 90-minute cache methods for trend analysis
  async cache90MinuteWaterLevel<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<T> {
    const toolType = 'water-level';
    const dataType = 'current'; // Use 'current' dataType since it's recent trend data
    return this.fetchWithCache(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType('current'), // Use current time window for recent trend data
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, 'current'))
    });
  }

  async cache90MinuteFlowRate<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<T> {
    const toolType = 'flow-rate';
    const dataType = 'current'; // Use 'current' dataType since it's recent trend data
    return this.fetchWithCache(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType('current'), // Use current time window for recent trend data
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, 'current'))
    });
  }

  /**
   * Enhanced helper method for caching combined conditions data with fallback result
   */
  async cacheCombinedConditionsWithFallback<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow'>
  ): Promise<CacheFallbackResult<T>> {
    const toolType = 'combined-conditions';
    const dataType = 'current';
    return this.fetchWithFallback(url, fetchFn, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
  }

  /**
   * Helper method for caching any data type with request context
   */
  async cacheFromRequest<T>(
    url: string,
    fetchFn: () => Promise<T>,
    request: Request,
    toolType: 'water-level' | 'flow-rate' | 'combined-conditions',
    dataType: 'current' | 'historical',
    options?: Omit<CacheOptions, 'toolType' | 'dataType' | 'timeWindow' | 'requestHeaders'>
  ): Promise<T> {
    const cacheOptions = CacheService.createOptionsFromRequest(request, {
      ...options,
      toolType,
      dataType,
      timeWindow: this.getTimeWindowForType(dataType),
      ttl: this.validateTtl(options?.ttl || this.getTtlForType(toolType, dataType))
    });
    
    return this.fetchWithCache(url, fetchFn, cacheOptions);
  }

  /**
   * Invalidate all cache entries for a specific tool type
   */
  async invalidateToolCache(toolType: 'water-level' | 'flow-rate' | 'combined-conditions'): Promise<void> {
    console.log(`Invalidating cache for tool type: ${toolType}`);
    // Note: Due to Cloudflare Cache API limitations, we can't do pattern-based deletion
    // This would need to be implemented with a cache key registry in production
    console.warn('Tool-specific cache invalidation requires cache key registry implementation');
  }

  /**
   * Get TTL configuration for monitoring and debugging
   */
  getTtlConfiguration(): Record<string, number> {
    return {
      ...this.TTL_CONFIG,
      // Add computed values for convenience
      CURRENT_DATA_MINUTES: this.TTL_CONFIG.CURRENT_WATER_LEVEL / 60,
      HISTORICAL_DATA_MINUTES: this.TTL_CONFIG.HISTORICAL_WATER_LEVEL / 60,
      DEFAULT_MINUTES: this.TTL_CONFIG.DEFAULT / 60
    };
  }

  /**
   * Get time window configuration for monitoring and debugging
   */
  getTimeWindowConfiguration(): Record<string, number> {
    return { ...this.TIME_WINDOWS };
  }

  /**
   * Get comprehensive cache status including TTL info
   */
  getCacheStatus(): {
    metrics: CacheMetrics;
    hitRatio: number;
    ttlConfig: Record<string, number>;
    timeWindows: Record<string, number>;
  } {
    return {
      metrics: this.getMetrics(),
      hitRatio: this.getCacheHitRatio(),
      ttlConfig: this.getTtlConfiguration(),
      timeWindows: this.getTimeWindowConfiguration()
    };
  }

  /**
   * Get detailed cache metrics with breakdowns
   */
  getDetailedMetrics(): DetailedCacheMetrics {
    // Update basic metrics in detailed metrics before returning
    this.detailedMetrics.hits = this.metrics.hits;
    this.detailedMetrics.misses = this.metrics.misses;
    this.detailedMetrics.errors = this.metrics.errors;
    this.detailedMetrics.bypasses = this.metrics.bypasses;
    this.detailedMetrics.invalidations = this.metrics.invalidations;
    this.detailedMetrics.staleEntries = this.metrics.staleEntries;
    this.detailedMetrics.hitRatio = this.getCacheHitRatio();
    
    return { ...this.detailedMetrics };
  }

  /**
   * Get recent cache log entries
   */
  getCacheLog(limit?: number): CacheLogEntry[] {
    const entries = [...this.cacheLog]; // Create copy
    return limit ? entries.slice(-limit) : entries;
  }

  /**
   * Get cache log entries filtered by action type
   */
  getCacheLogByAction(action: CacheLogEntry['action'], limit?: number): CacheLogEntry[] {
    const filtered = this.cacheLog.filter(entry => entry.action === action);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get cache log entries for a specific tool type
   */
  getCacheLogByToolType(toolType: string, limit?: number): CacheLogEntry[] {
    const filtered = this.cacheLog.filter(entry => entry.toolType === toolType);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get cache performance summary
   */
  getPerformanceSummary(): {
    totalRequests: number;
    hitRatio: number;
    averageResponseTime: number;
    errorRate: number;
    staleRate: number;
    bypassRate: number;
    fallbackRate: number;
    emergencyRate: number;
    cacheFailureRate: number;
    topToolTypes: Array<{ toolType: string; hits: number; misses: number; hitRatio: number }>;
  } {
    const total = this.detailedMetrics.totalRequests;
    const errorRate = total > 0 ? this.metrics.errors / total : 0;
    const staleRate = total > 0 ? this.metrics.staleEntries / total : 0;
    const bypassRate = total > 0 ? this.metrics.bypasses / total : 0;
    const fallbackRate = total > 0 ? this.metrics.fallbackHits / total : 0;
    const emergencyRate = total > 0 ? this.metrics.emergencyFallbacks / total : 0;
    const cacheFailureRate = total > 0 ? this.metrics.cacheFailures / total : 0;

    // Calculate top tool types by activity
    const toolTypes = new Set([
      ...Object.keys(this.detailedMetrics.hitsByToolType),
      ...Object.keys(this.detailedMetrics.missesByToolType)
    ]);

    const topToolTypes = Array.from(toolTypes).map(toolType => {
      const hits = this.detailedMetrics.hitsByToolType[toolType] || 0;
      const misses = this.detailedMetrics.missesByToolType[toolType] || 0;
      const toolTotal = hits + misses;
      const hitRatio = toolTotal > 0 ? hits / toolTotal : 0;
      
      return { toolType, hits, misses, hitRatio };
    }).sort((a, b) => (b.hits + b.misses) - (a.hits + a.misses));

    return {
      totalRequests: total,
      hitRatio: this.getCacheHitRatio(),
      averageResponseTime: this.detailedMetrics.averageResponseTime,
      errorRate,
      staleRate,
      bypassRate,
      fallbackRate,
      emergencyRate,
      cacheFailureRate,
      topToolTypes: topToolTypes.slice(0, 5) // Top 5 tool types
    };
  }

  /**
   * Extract cache-relevant headers from an incoming request
   */
  static extractCacheHeaders(request: Request): Record<string, string> {
    const relevantHeaders = [
      'cache-control',
      'pragma',
      'x-refresh-cache',
      'x-force-refresh',
      'if-none-match',
      'if-modified-since'
    ];

    const headers: Record<string, string> = {};
    
    for (const headerName of relevantHeaders) {
      const value = request.headers.get(headerName);
      if (value) {
        headers[headerName] = value;
      }
    }

    return headers;
  }

  /**
   * Create cache options from request headers
   */
  static createOptionsFromRequest(
    request: Request, 
    baseOptions?: Omit<CacheOptions, 'requestHeaders'>
  ): CacheOptions {
    const requestHeaders = this.extractCacheHeaders(request);
    
    return {
      ...baseOptions,
      requestHeaders,
      enableLogging: baseOptions?.enableLogging ?? true // Enable logging by default for requests
    };
  }

  /**
   * Helper method to force refresh cache for a specific URL and options
   */
  async forceRefresh(url: string, options?: Omit<CacheOptions, 'forceRefresh'>): Promise<boolean> {
    return await this.delete(url, { ...options, forceRefresh: true });
  }

  /**
   * Helper method to check if a request should bypass cache without actually accessing cache
   */
  shouldRequestBypassCache(request: Request): boolean {
    const headers = CacheService.extractCacheHeaders(request);
    return this.shouldRefreshFromHeaders(headers);
  }
}

// Export a singleton instance
export const cacheService = new CacheService(); 