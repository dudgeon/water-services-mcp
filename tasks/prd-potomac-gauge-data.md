# Product Requirements Document
## MCP Tools – Potomac Water Data: Gauge Height + Flow Rate

---

## 1. Introduction/Overview

This feature provides water sports enthusiasts with comprehensive real-time water condition information for the Potomac River through their preferred AI assistants (Claude, ChatGPT, etc.). The tools solve the critical problem of helping users understand current water conditions in context - not just "what is the water level?" but "is this level normal, high, or low compared to recent conditions?" and "is the flow rate suitable for my activity?"

**Goal:** Enable AI agents to provide interpretable, actionable water condition information (both water level and flow rate) that helps users make informed decisions about water activities like accessing sandbars, kayaking, or other recreational activities.

---

## 2. Goals

1. **Primary Goal:** Provide instant, contextual water condition information (level + flow) that AI agents can interpret and communicate clearly to users
2. **User Experience Goal:** Reduce follow-up questions by providing both current readings and historical context in a single request
3. **Technical Goal:** Deliver sub-300ms response times for real-time user interactions
4. **Reliability Goal:** Ensure data freshness and clearly indicate when data may be stale
5. **Completeness Goal:** Enable comprehensive water condition assessment through complementary gauge height and flow rate data

---

## 3. User Stories

**Primary User Stories:**
> As a water sports enthusiast, I want to ask my AI assistant "What are the water conditions on the Potomac?" and receive both current water level and flow rate with context about whether they're unusually high or low, so I can make informed decisions about my water activities.

> As a water sports enthusiast, I want to ask my AI assistant "How high is the water at Georgetown?" and receive not just the current level, but also context about whether it's unusually high or low, so I can decide if my favorite sandbar will be accessible today.

> As a kayaker, I want to ask "What's the flow rate on the Potomac?" and understand if it's low, normal, or high flow so I can plan my route difficulty and safety accordingly.

**Supporting User Stories:**
- As a kayaker, I want to know if current water levels AND flow rates are safe for my planned route
- As a paddleboarder, I want to understand if conditions are typical for this time period
- As a recreational boater, I want to quickly assess if water levels have changed significantly from yesterday
- As a whitewater enthusiast, I want to know if flow rates are sufficient for exciting rapids or too dangerous
- As a fishing enthusiast, I want to understand both water level and flow to determine optimal fishing conditions

---

## 4. Functional Requirements

### Core Functionality - Water Level Tool
**F-1:** Provide an MCP tool named `get_potomac_gage_depth` that requires no input parameters

**F-2:** Return comprehensive water level data in a single response including:
- Current gage height in both NAVD88 and WMLW datums (feet)
- Exact timestamp of the reading
- 7-day minimum and maximum levels for context
- Data freshness indicator

**F-3:** Fetch live data from USGS station 01647600 (Potomac River at Wisconsin Ave, Washington DC)

**F-4:** Calculate 7-day range from historical instantaneous values to provide context

**F-5:** Implement staleness detection - mark data as stale if newest reading is older than 30 minutes

### Core Functionality - Flow Rate Tool
**F-6:** Provide an MCP tool named `get_potomac_flow` that requires no input parameters

**F-7:** Return comprehensive flow rate data in a single response including:
- Current discharge in cubic feet per second (CFS)
- Exact timestamp of the reading
- 7-day minimum and maximum flow rates for context
- Data freshness indicator

**F-8:** Fetch live data from USGS station 01646500 (Potomac River near Little Falls Pump Station)

**F-9:** Calculate 7-day flow range from historical instantaneous values to provide context

**F-10:** Implement staleness detection - mark data as stale if newest reading is older than 30 minutes

### Core Functionality - Combined Conditions Tool
**F-11:** Provide an MCP tool named `get_potomac_conditions` that requires no input parameters

**F-12:** Return comprehensive water conditions data in a single response including:
- Current gage height in both NAVD88 and WMLW datums (feet)
- Current discharge in cubic feet per second (CFS)
- Exact timestamp of each reading
- 7-day minimum and maximum levels and flow rates for context
- Data freshness indicator for each data source

**F-13:** Fetch live data from both USGS stations concurrently to minimize latency

**F-14:** Handle mixed data freshness scenarios (e.g., one station current, other stale)

**F-15:** Implement staleness detection for both data sources independently

### Performance Requirements
**F-16:** Achieve p95 latency ≤ 300ms for optimal user experience (all tools)

**F-17:** Implement stateless caching strategy using Cloudflare Worker capabilities:
- Utilize Cloudflare Cache API for HTTP response caching
- Water level: Current readings cached for 14 minutes, 7-day range cached for 30 minutes
- Flow rate: Current readings cached for 14 minutes, 7-day range cached for 30 minutes
- Combined conditions: Cache strategy leverages individual tool caches or implements combined caching

**F-18:** For combined conditions tool, implement concurrent API calls to both USGS stations to minimize total response time

### Data Quality Requirements
**F-19:** Handle API failures gracefully with retry logic and clear error messaging (all tools)

**F-20:** Provide fallback behavior when 7-day historical data is insufficient (all tools)

**F-21:** Return structured JSON format optimized for AI agent interpretation (all tools)

**F-22:** For combined conditions tool, handle partial failures gracefully (e.g., return available data with clear indicators of missing data)

---

## 5. Non-Goals (Out of Scope)

- **Multiple gauge stations:** This version focuses on Georgetown/Wisconsin Ave (water level) and Little Falls (flow rate) locations only
- **Extended historical data:** Beyond 7-day range for both tools
- **Predictive modeling:** No forecasting of future water levels or flow rates
- **Direct user interface:** Tools are designed for AI agent consumption only
- **Real-time streaming:** Polling-based updates only
- **WMLW datum range data:** 7-day min/max only provided in NAVD88
- **Daily adjusted flow:** Raw instantaneous flow only, not USGS daily adjusted values
- **Forecast flows:** No NOAA National Water Model integration

---

## 6. Design Considerations

### API Response Formats

#### Water Level Tool (`get_potomac_gage_depth`)
```json
{
  "navd88_ft": 2.1,
  "wmlw_ft": 8.3,
  "timestamp": "2024-01-15T14:30:00Z",
  "seven_day_min_ft": 0.8,
  "seven_day_max_ft": 2.9,
  "stale": false
}
```

#### Flow Rate Tool (`get_potomac_flow`)
```json
{
  "discharge_cfs": 1250.0,
  "timestamp": "2024-01-15T14:30:00Z",
  "seven_day_min_cfs": 980.0,
  "seven_day_max_cfs": 1800.0,
  "stale": false
}
```

#### Combined Conditions Tool (`get_potomac_conditions`)
```json
{
  "gage_height": {
    "navd88_ft": 2.1,
    "wmlw_ft": 8.3,
    "timestamp": "2024-01-15T14:30:00Z",
    "seven_day_min_ft": 0.8,
    "seven_day_max_ft": 2.9,
    "stale": false
  },
  "flow_rate": {
    "discharge_cfs": 1250.0,
    "timestamp": "2024-01-15T14:30:00Z",
    "seven_day_min_cfs": 980.0,
    "seven_day_max_cfs": 1800.0,
    "stale": false
  }
}
```

### AI Agent Interpretation Guidelines
The response formats are designed to enable AI agents to provide contextual responses like:
- **Water Level:** "The current water level is 2.1 feet, which is in the middle range compared to the last week (0.8-2.9 feet)"
- **Flow Rate:** "The current flow is 1,250 cubic feet per second, which is moderate compared to the 7-day range of 980-1,800 CFS"
- **Combined:** "Water conditions show moderate levels (2.1 ft) with normal flow (1,250 CFS) - good conditions for kayaking"

### Implementation Strategy for Combined Tool
The combined conditions tool can be implemented using one of these approaches:
1. **Concurrent API Calls:** Make simultaneous calls to both USGS stations and combine results
2. **Internal Tool Composition:** Call the individual `get_potomac_gage_depth` and `get_potomac_flow` tools internally
3. **Hybrid Caching:** Leverage existing individual tool caches when available, fall back to direct API calls when needed

**Recommended Approach:** Concurrent API calls with shared caching strategy for optimal performance and cache efficiency.

---

## 7. Technical Considerations

### Data Sources

#### Water Level Data
- **Primary:** USGS Water Services API (waterservices.usgs.gov)
- **Station:** 01647600 (Potomac River at Wisconsin Ave, Washington DC)
- **Data Type:** Instantaneous values (IV) at 15-minute intervals
- **Parameters:** Gage height in NAVD88 and WMLW datums

#### Flow Rate Data
- **Primary:** USGS Water Services API (waterservices.usgs.gov)
- **Station:** 01646500 (Potomac River near Little Falls Pump Station)
- **Data Type:** Instantaneous values (IV) at 15-minute intervals
- **Parameters:** Discharge (parameter code 00060) in cubic feet per second

### Caching Strategy (Stateless)
- **Cloudflare Cache API:** Leverage built-in edge caching for HTTP responses
- **Cache Keys:** Differentiated by tool type (water level vs flow rate vs combined) and time window for optimal hit rates
- **TTL Management:** HTTP headers control cache duration (14min current, 30min range) for all tools
- **Cache Invalidation:** Optional refresh header bypasses cache for all tools
- **No Persistent State:** Worker remains stateless, relying on Cloudflare's distributed cache
- **Combined Tool Caching:** Can leverage individual tool caches or implement dedicated combined cache key

### Error Handling
- Retry logic with exponential backoff
- Graceful degradation when historical data unavailable
- Clear error messaging for AI agent consumption

---

## 8. Success Metrics

### Primary Success Metrics
1. **User Satisfaction:** Reduction in follow-up questions about water conditions (target: 50% reduction)
2. **Response Quality:** AI agents can provide contextual water condition information (level + flow) without additional API calls
3. **Performance:** 95% of requests complete within 300ms for both tools
4. **Reliability:** 99.5% uptime for both MCP tools

### Secondary Metrics
- API response time distribution for both tools
- Cloudflare Cache hit rates (target: >90% for both current and range data across both tools)
- Error rate monitoring for both USGS data sources
- Usage patterns and peak times for water level vs flow rate queries
- Worker execution time and memory usage for both tools

---

## 9. Open Questions

1. **Seasonal Context:** Should we consider adding seasonal averages for even better context?
2. **Alert Thresholds:** Are there specific water levels that should trigger warnings or alerts?
3. **Update Frequency:** Is 15-minute resolution sufficient, or do users need more frequent updates?
4. **Datum Preference:** Do users have a preference between NAVD88 and WMLW datums?

---

## 10. Future Considerations

This tool is designed as the foundation for a broader water services ecosystem:

- **Additional Gauge Stations:** Expand to other popular water recreation areas
- **Enhanced Context:** Seasonal averages, flood stage information
- **Predictive Features:** Short-term water level forecasting
- **Integration:** Connect with weather data, tide information
- **User Personalization:** Remember user preferences for specific locations

---

## 11. Acceptance Criteria

### Must Have
- [ ] All three MCP tools respond within 300ms for 95% of requests
- [ ] Water level tool returns current level in both datums (NAVD88, WMLW)
- [ ] Flow rate tool returns current discharge in CFS
- [ ] Combined conditions tool returns both water level and flow rate data
- [ ] All tools provide 7-day min/max context
- [ ] All tools correctly identify stale data (>30 minutes old)
- [ ] All tools handle API failures gracefully
- [ ] Combined tool handles partial failures gracefully (returns available data)

### Should Have
- [ ] Cloudflare Cache hit rate >90% for both current and historical data across all tools
- [ ] Clear error messages for AI agent interpretation for all tools
- [ ] Monitoring and alerting for cache performance for all tools
- [ ] Worker execution stays within Cloudflare limits (CPU time, memory) for all tools
- [ ] Combined tool efficiently leverages individual tool caches when possible

### Could Have
- [ ] Optional refresh parameter for cache invalidation (all tools)
- [ ] Additional metadata for enhanced context (all tools)
- [ ] Performance metrics logging via Cloudflare Analytics
- [ ] Edge location optimization for fastest response times
- [ ] Smart caching strategy that pre-fetches both data sources for combined tool efficiency

---

*This PRD serves as the foundation for developing comprehensive water condition monitoring tools that prioritize user experience and AI agent interpretability while maintaining technical excellence.* 