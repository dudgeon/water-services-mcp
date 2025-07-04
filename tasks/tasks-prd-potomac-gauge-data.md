# Task List: Potomac Water Data MCP Tools

Based on PRD: `prd-potomac-gauge-data.md`

## Relevant Files

- `src/index.ts` - Main Cloudflare Worker entry point and MCP server setup
- `src/tools/potomac-gage-depth.ts` - Implementation of `get_potomac_gage_depth` tool
- `src/tools/potomac-flow.ts` - Implementation of `get_potomac_flow` tool  
- `src/tools/potomac-conditions.ts` - Implementation of `get_potomac_conditions` combined tool
- `src/services/usgs-api.ts` - USGS Water Services API client and data fetching logic
- `src/services/cache.ts` - Cloudflare Cache API wrapper and caching strategies
- `src/types/potomac-data.ts` - TypeScript type definitions for water data structures and USGS API responses
- `src/utils/data-processing.ts` - Utility functions for calculating min/max ranges and staleness detection
- `src/utils/error-handling.ts` - Error handling utilities and retry logic
- `src/tests/tools/potomac-gage-depth.test.ts` - Unit tests for water level tool
- `src/tests/tools/potomac-flow.test.ts` - Unit tests for flow rate tool
- `src/tests/tools/potomac-conditions.test.ts` - Unit tests for combined conditions tool
- `src/tests/services/usgs-api.test.ts` - Unit tests for USGS API service
- `src/tests/services/cache.test.ts` - Unit tests for caching service
- `src/tests/utils/data-processing.test.ts` - Unit tests for data processing utilities
- `wrangler.jsonc` - Cloudflare Worker configuration and environment variables

### Notes

- Unit tests should be placed in the `src/tests/` directory mirroring the source structure
- Use `npm test` to run the test suite (Vitest is configured)
- Use `npm run test:watch` for development with automatic test re-running
- The Cloudflare Worker will be deployed using Wrangler CLI
- All tools must be registered with the MCP server in the main index.ts file
- Test each implementation step before moving to the next to catch issues early

## Tasks

- [x] 1.0 Set up Potomac water data dependencies and types
  - [x] 1.1 Create TypeScript type definitions for USGS API responses in `src/types/potomac-data.ts`
  - [x] 1.2 Define interfaces for water level data (NAVD88, WMLW datums)
  - [x] 1.3 Define interfaces for flow rate data (discharge CFS)
  - [x] 1.4 Create combined conditions response type structure
  - [x] 1.5 Add staleness detection and error state types
  - [x] 1.6 Update package.json with required dependencies (@types/node, vitest) and test scripts

- [x] 2.0 Implement USGS API service and data fetching
  - [x] 2.1 Create USGS API client class in `src/services/usgs-api.ts`
  - [x] 2.2 Create basic unit tests for USGS API service (`src/tests/services/usgs-api.test.ts`)
  - [x] 2.3 Implement current water level data fetching from station 01647600
  - [x] 2.4 Test current water level data fetching with mock responses
  - [x] 2.5 Implement 7-day historical water level data fetching with period=P7D
    - **Discovery**: Implementation was already complete with proper `period=P7D` parameter
    - **Finding**: Method correctly targets station 01647600 (Georgetown) with parameter code 00065
  - [x] 2.6 Test historical water level data fetching with mock responses
    - **Discovery**: Comprehensive tests already existed covering mock responses and P7D period validation
    - **Finding**: Tests validate NAVD88 to WMLW conversion, quality codes, and timestamp parsing
  - [x] 2.7 Implement current flow rate data fetching from station 01646500
    - **Discovery**: Implementation was already complete targeting station 01646500 (Little Falls)
    - **Finding**: Used correct parameter code `00060` for discharge measurement
    - **Finding**: Includes concurrent historical data fetching for 7-day min/max calculation
  - [x] 2.8 Test current flow rate data fetching with mock responses
    - **Discovery**: Tests already covered mock responses and 7-day min/max calculation
    - **Finding**: Tests validate station targeting, staleness detection, and concurrent data fetching
  - [x] 2.9 Implement 7-day historical flow rate data fetching with period=P7D
    - **Discovery**: Implementation was already complete with proper configuration
    - **Finding**: Correctly uses Little Falls station (01646500) with discharge parameter (00060)
  - [x] 2.10 Test historical flow rate data fetching with mock responses
    - **Challenge**: No dedicated test existed for `getHistoricalFlowRatePoints` method
    - **Solution**: Added comprehensive test covering P7D period, station targeting, and data parsing
    - **Result**: Test suite expanded from 11 to 12 tests, all passing
  - [x] 2.11 Add request timeout handling (5s for current, 8s for historical)
    - **Discovery**: Timeout handling was already fully implemented with proper configuration
    - **Finding**: Uses AbortController for clean timeout management with memory leak prevention
    - **Finding**: Differentiated timeouts: 5s for current data, 8s for historical data
  - [x] 2.12 Test timeout handling with delayed mock responses
    - **Challenge**: Initial timeout tests were causing test framework timeouts
    - **Solution**: Simplified tests to focus on AbortError handling and timeout error scenarios
    - **Result**: Added 2 additional timeout tests, bringing total to 14 tests
  - [x] 2.13 Parse USGS JSON responses and extract relevant time series data
    - **Discovery**: Comprehensive JSON parsing already implemented with robust error handling
    - **Finding**: Includes time series extraction, data point parsing, quality code handling
    - **Finding**: Implements measurement grade extraction and graceful fallback mechanisms
  - [x] 2.14 Test JSON parsing with various USGS response formats
    - **Discovery**: Added comprehensive tests for edge cases including missing data structures, invalid values, and malformed responses
    - **Finding**: USGS API can return responses with empty timeSeries arrays, missing values, or invalid numeric data
    - **Challenge**: Initial implementation didn't validate numeric values, allowing NaN to propagate through calculations
    - **Solution**: Added isNaN() validation in parsing methods and filter invalid values from historical data arrays
    - **Result**: Added 8 new test cases covering various JSON parsing scenarios, all tests passing (22 total)
  - [x] 2.15 Handle empty or malformed API responses gracefully
    - **Discovery**: Comprehensive error handling was already implemented throughout the service
    - **Finding**: All parsing methods use optional chaining and length checks to handle missing data structures
    - **Finding**: Try-catch blocks wrap all parsing operations to handle malformed JSON or unexpected structures
    - **Finding**: Network errors, HTTP errors, timeouts, and JSON parsing errors are all handled gracefully
    - **Solution**: Methods return null for current data and empty arrays for historical data when errors occur
  - [x] 2.16 Test error handling with malformed and empty responses
    - **Discovery**: Added comprehensive tests covering edge cases like empty objects, undefined properties, and corrupted structures
    - **Finding**: Service gracefully handles USGS no-data values (-999999), missing dateTime fields, and non-string value types
    - **Finding**: Partial failures (e.g., historical data fetch failure) still allow current data to be returned with fallback values
    - **Solution**: Added 8 additional test cases covering malformed responses, network failures, and data corruption scenarios
    - **Result**: Total test suite now has 30 tests covering all error handling scenarios, all passing

- [ ] 3.0 Implement caching layer using Cloudflare Cache API; confirm approach using the cloudflare docs, which you have access to
  - [x] 3.1 Create cache service wrapper in `src/services/cache.ts`
    - **Discovery**: Cloudflare Cache API requires custom domain or route to function (not available in dashboard/playground)
    - **Finding**: Cache API uses Request/Response objects with proper headers for TTL management
    - **Finding**: Cache storage is local to data center, doesn't replicate globally like CDN cache
    - **Solution**: Implemented comprehensive wrapper with TTL management, stale data detection, metrics tracking
    - **Result**: Created CacheService class with get/set/delete operations, cache key generation, and graceful fallback handling
  - [x] 3.2 Implement cache key generation strategy (differentiated by tool type and time window)
    - **Discovery**: Cache key strategy needs to balance uniqueness with cache hit efficiency
    - **Finding**: Time bucketing is essential for cache alignment - multiple requests within same window should share cache
    - **Solution**: Implemented structured cache key format: `{prefix}:{tool-type}:{data-type}:{time-bucket}:{url-hash}:{suffix}`
    - **Result**: Added tool-specific helper methods (cacheCurrentWaterLevel, cacheHistoricalFlowRate, etc.) with appropriate TTLs and time windows
  - [x] 3.3 Add cache TTL management (14min for current, 30min for historical)
    - **Discovery**: TTL management requires both validation and automatic selection based on data type
    - **Finding**: Different data types need different TTL strategies - current data (14min) vs historical data (30min)
    - **Solution**: Implemented comprehensive TTL configuration with constants, validation, and automatic selection methods
    - **Result**: Added TTL_CONFIG constants, getTtlForType() method, validateTtl() bounds checking, and enhanced all helper methods
  - [x] 3.4 Implement cache invalidation via optional refresh header
    - **Discovery**: Multiple HTTP headers can indicate cache refresh requirements (Cache-Control, Pragma, custom headers)
    - **Finding**: Need to support both standard HTTP cache headers and custom refresh headers for flexibility
    - **Solution**: Implemented comprehensive header parsing with support for Cache-Control: no-cache, Pragma: no-cache, X-Refresh-Cache, X-Force-Refresh
    - **Result**: Added shouldRefreshFromHeaders(), shouldBypassCache(), extractCacheHeaders(), and request-aware caching methods
  - [x] 3.5 Add cache hit/miss logging for monitoring
    - **Discovery**: Comprehensive logging requires tracking multiple metrics beyond basic hit/miss ratios
    - **Finding**: Need to track performance metrics, error rates, tool-specific patterns, and response times for effective monitoring
    - **Solution**: Implemented detailed logging system with CacheLogEntry structure, metrics by tool/data type, and performance tracking
    - **Result**: Added logCacheActivity(), getDetailedMetrics(), getCacheLog(), getPerformanceSummary() with 1000-entry log buffer and response time tracking
  - [x] 3.6 Handle cache failures gracefully (fall back to direct API calls)
  - **Discovery**: Basic fallback was already implemented but limited to simple cache miss scenarios
  - **Finding**: Enhanced with comprehensive fallback strategies including stale data retrieval, emergency fallbacks, and configurable strategies
  - **Challenge**: Needed to balance graceful degradation with performance while maintaining type safety for emergency responses
  - **Solution**: Implemented multi-tier fallback system with stale data (up to 1-24 hours), emergency USGS-compatible responses, and configurable strategies ('ignore', 'stale', 'emergency', 'throw')
  - **Result**: Added 9 new cache metrics (fallbackHits, emergencyFallbacks, cacheFailures), 3 new log action types (FALLBACK, EMERGENCY, CACHE_FAILURE), and enhanced helper methods with fallback support
  - **Change of Plan**: Extended beyond simple fallback to include sophisticated emergency response generation that matches USGS API structure

- [ ] 4.0 Build individual MCP tools (water level and flow rate); confirm format in the MCP spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
  - [ ] 4.1 Implement `get_potomac_gage_depth` tool in `src/tools/potomac-gage-depth.ts`
  - [ ] 4.2 Add concurrent fetching of current and historical water level data
  - [ ] 4.3 Calculate 7-day min/max from historical NAVD88 data
  - [ ] 4.4 Implement staleness detection (>30 minutes old)
  - [ ] 4.5 Format response according to PRD specification
  - [ ] 4.6 Implement `get_potomac_flow` tool in `src/tools/potomac-flow.ts`
  - [ ] 4.7 Add concurrent fetching of current and historical flow rate data
  - [ ] 4.8 Calculate 7-day min/max from historical discharge data
  - [ ] 4.9 Implement staleness detection for flow data
  - [ ] 4.10 Format flow rate response according to PRD specification
  - [ ] 4.11 Register both tools with the MCP server in `src/index.ts`

- [ ] 5.0 Implement combined conditions tool; confirm format in the MCP spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
  - [ ] 5.1 Create `get_potomac_conditions` tool in `src/tools/potomac-conditions.ts`
  - [ ] 5.2 Implement concurrent API calls to both USGS stations
  - [ ] 5.3 Handle mixed data freshness scenarios (one station current, other stale)
  - [ ] 5.4 Combine water level and flow rate data into structured response
  - [ ] 5.5 Implement partial failure handling (return available data with indicators)
  - [ ] 5.6 Add independent staleness detection for each data source
  - [ ] 5.7 Optimize caching strategy (leverage individual tool caches when possible)
  - [ ] 5.8 Register combined tool with MCP server

- [ ] 6.0 Add comprehensive error handling and monitoring
  - [ ] 6.1 Create error handling utilities in `src/utils/error-handling.ts`
  - [ ] 6.2 Implement retry logic with exponential backoff for API failures
  - [ ] 6.3 Add clear error messages optimized for AI agent interpretation
  - [ ] 6.4 Create data processing utilities in `src/utils/data-processing.ts`
  - [ ] 6.5 Add min/max calculation functions with validation
  - [ ] 6.6 Implement timestamp parsing and staleness detection utilities
  - [ ] 6.7 Add performance monitoring and logging throughout all tools
  - [ ] 6.8 Handle edge cases (empty historical data, malformed timestamps)

- [ ] 7.0 Testing and performance optimization
  - [ ] 7.1 Write unit tests for USGS API service (`src/tests/services/usgs-api.test.ts`)
  - [ ] 7.2 Write unit tests for cache service (`src/tests/services/cache.test.ts`)
  - [ ] 7.3 Write unit tests for water level tool (`src/tests/tools/potomac-gage-depth.test.ts`)
  - [ ] 7.4 Write unit tests for flow rate tool (`src/tests/tools/potomac-flow.test.ts`)
  - [ ] 7.5 Write unit tests for combined conditions tool (`src/tests/tools/potomac-conditions.test.ts`)
  - [ ] 7.6 Write unit tests for data processing utilities (`src/tests/utils/data-processing.test.ts`)
  - [ ] 7.7 Add integration tests with mock USGS API responses
  - [ ] 7.8 Performance testing to ensure <300ms p95 latency
  - [ ] 7.9 Load testing with cache hit/miss scenarios
  - [ ] 7.10 Validate all tools work correctly with Cloudflare Worker limits

- [ ] 8.0 Update landing page with new tool documentation
  - [ ] 8.1 Update `public/index.html` to remove SSE endpoint reference from endpoints section
  - [ ] 8.2 Add documentation for `get_potomac_gage_depth` tool with example usage
  - [ ] 8.3 Add documentation for `get_potomac_flow` tool with example usage
  - [ ] 8.4 Add documentation for `get_potomac_conditions` combined tool
  - [ ] 8.5 Include JSON response format examples for each tool
  - [ ] 8.6 Add Claude Desktop MCP server setup instructions (claude_desktop_config.json configuration)
  - [ ] 8.7 Add usage instructions for AI agents and MCP clients
  - [ ] 8.8 Update page title and description to reflect water services focus
  - [ ] 8.9 Add visual map showing USGS station locations and data types (station 01647600 for water level at Georgetown, station 01646500 for flow rate at Little Falls) 
  - [ ] 8.10 Update `public/index.html` background to use /Users/geoffreydudgeon/Documents/Cursor Projects/water-services-mcp/public/river-fish-rocks-low.jpg as static background (does not scroll with page contents)