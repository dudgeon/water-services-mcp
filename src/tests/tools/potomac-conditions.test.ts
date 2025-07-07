import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the global caches object for CacheService
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
};

// @ts-ignore
global.caches = {
  default: mockCache
};

// Mock the individual tools with explicit return types
vi.mock('../../tools/potomac-gage-depth.js', () => ({
  getPotomacGageDepth: vi.fn()
}));

vi.mock('../../tools/potomac-flow.js', () => ({
  getPotomacFlow: vi.fn()
}));

// Now import the modules after mocking
import { getPotomacConditions } from '../../tools/potomac-conditions.js';
import { getPotomacGageDepth } from '../../tools/potomac-gage-depth.js';
import { getPotomacFlow } from '../../tools/potomac-flow.js';

describe('getPotomacConditions', () => {
  let mockGetPotomacGageDepth: any;
  let mockGetPotomacFlow: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset cache mocks
    mockCache.match.mockReset();
    mockCache.put.mockReset();
    mockCache.delete.mockReset();
    
    // Mock individual tool functions
    mockGetPotomacGageDepth = vi.mocked(getPotomacGageDepth);
    mockGetPotomacFlow = vi.mocked(getPotomacFlow);
  });

  describe('Successful combined data scenarios', () => {
    it('should return complete combined conditions when both tools succeed', async () => {
      // Mock successful responses from both tools
      const mockWaterLevelResponse = {
        content: [{
          type: "text" as const,
          text: `Current Potomac River water level at Georgetown:
Current: 2.5 feet
Timestamp: 2024-01-15T17:30:00.000Z
7-day range: 1.8 to 3.2 feet
Trend: rising (+0.15 ft from 90 min ago)`
        }]
      };

      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: `Current Potomac River flow rate at Little Falls:
Current: 12,450 CFS
Timestamp: 2024-01-15T17:30:00.000Z
7-day range: 8,200 to 15,600 CFS
Trend: stable (-5 CFS from 90 min ago)`
        }]
      };

      mockGetPotomacGageDepth.mockResolvedValue(mockWaterLevelResponse);
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Current Potomac River Conditions");
      expect(result.content[0].text).toContain("Georgetown Water Level");
      expect(result.content[0].text).toContain("Little Falls Flow Rate");
      expect(result.content[0].text).toContain("Current: 2.5 feet");
      expect(result.content[0].text).toContain("Current: 12,450 CFS");
      expect(result.content[0].text).toContain("Data Completeness: Complete");
      expect(result.content[0].text).toContain("Data Freshness: Fresh");
    });

    it('should handle stale data correctly', async () => {
      const mockWaterLevelResponse = {
        content: [{
          type: "text" as const,
          text: `Current Potomac River water level at Georgetown:
Current: 2.5 feet
Timestamp: 2024-01-15T16:45:00.000Z (Data is 45 minutes old and may be stale)
7-day range: 1.8 to 3.2 feet`
        }]
      };

      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: `Current Potomac River flow rate at Little Falls:
Current: 12,450 CFS
Timestamp: 2024-01-15T17:25:00.000Z (Data is 5 minutes old and may be stale)
7-day range: 8,200 to 15,600 CFS`
        }]
      };

      mockGetPotomacGageDepth.mockResolvedValue(mockWaterLevelResponse);
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("Data Freshness: Mixed");
      expect(result.content[0].text).toContain("Oldest Data: 45 minutes ago");
      expect(result.content[0].text).toContain("Freshest Data: 5 minutes ago");
    });

    it('should handle mixed trend directions correctly', async () => {
      const mockWaterLevelResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 2.5 feet
Timestamp: 2024-01-15T17:30:00.000Z
Trend: falling (-0.08 ft from 90 min ago)`
        }]
      };

      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 12,450 CFS
Timestamp: 2024-01-15T17:30:00.000Z
Trend: rising (+125 CFS from 90 min ago)`
        }]
      };

      mockGetPotomacGageDepth.mockResolvedValue(mockWaterLevelResponse);
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("Current: 2.5 feet");
      expect(result.content[0].text).toContain("Current: 12,450 CFS");
      expect(result.content[0].text).toContain("Data Completeness: Complete");
    });
  });

  describe('Partial failure scenarios', () => {
    it('should handle water level tool failure gracefully', async () => {
      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 12,450 CFS
Timestamp: 2024-01-15T17:30:00.000Z
7-day range: 8,200 to 15,600 CFS`
        }]
      };

      mockGetPotomacGageDepth.mockRejectedValue(new Error("Water level station offline"));
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("Georgetown Water Level");
      expect(result.content[0].text).toContain("❌ **Unavailable**");
      expect(result.content[0].text).toContain("Water level station offline");
      expect(result.content[0].text).toContain("Little Falls Flow Rate");
      expect(result.content[0].text).toContain("Current: 12,450 CFS");
      expect(result.content[0].text).toContain("Data Completeness: Partial");
    });

    it('should handle flow rate tool failure gracefully', async () => {
      const mockWaterLevelResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 2.5 feet
Timestamp: 2024-01-15T17:30:00.000Z
7-day range: 1.8 to 3.2 feet`
        }]
      };

      mockGetPotomacGageDepth.mockResolvedValue(mockWaterLevelResponse);
      mockGetPotomacFlow.mockRejectedValue(new Error("Flow rate sensor malfunction"));
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("Georgetown Water Level");
      expect(result.content[0].text).toContain("Current: 2.5 feet");
      expect(result.content[0].text).toContain("Little Falls Flow Rate");
      expect(result.content[0].text).toContain("❌ **Unavailable**");
      expect(result.content[0].text).toContain("Flow rate sensor malfunction");
      expect(result.content[0].text).toContain("Data Completeness: Partial");
    });

    it('should handle both tools failing gracefully', async () => {
      mockGetPotomacGageDepth.mockRejectedValue(new Error("Water level station offline"));
      mockGetPotomacFlow.mockRejectedValue(new Error("Flow rate sensor malfunction"));
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("Georgetown Water Level");
      expect(result.content[0].text).toContain("❌ **Unavailable**");
      expect(result.content[0].text).toContain("Little Falls Flow Rate");
      expect(result.content[0].text).toContain("❌ **Unavailable**");
      expect(result.content[0].text).toContain("Data Completeness: Minimal");
    });
  });

  describe('Cache fallback scenarios', () => {
    it('should handle request headers for cache control', async () => {
      const mockRequest = new Request('http://example.com', {
        headers: {
          'cache-control': 'no-cache'
        }
      });

      const mockWaterLevelResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 2.5 feet
Timestamp: 2024-01-15T17:30:00.000Z`
        }]
      };

      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 12,450 CFS
Timestamp: 2024-01-15T17:30:00.000Z`
        }]
      };

      mockGetPotomacGageDepth.mockResolvedValue(mockWaterLevelResponse);
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({}, mockRequest);

      expect(result.content[0].text).toContain("Current Potomac River Conditions");
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle unparseable tool responses', async () => {
      const mockWaterLevelResponse = {
        content: [{
          type: "text" as const,
          text: "Invalid response format - no current level found"
        }]
      };

      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: "Invalid response format - no current flow found"
        }]
      };

      mockGetPotomacGageDepth.mockResolvedValue(mockWaterLevelResponse);
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("Georgetown Water Level");
      expect(result.content[0].text).toContain("Little Falls Flow Rate");
      expect(result.content[0].text).toContain("Data Completeness: Minimal");
    });

    it('should handle complete system failure gracefully', async () => {
      // Mock cache to return null (cache miss) which triggers direct fetch
      mockCache.match.mockResolvedValue(null);
      mockGetPotomacGageDepth.mockRejectedValue(new Error("Water level system failure"));
      mockGetPotomacFlow.mockRejectedValue(new Error("Flow rate system failure"));

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("Error fetching combined Potomac conditions");
      expect(result.content[0].text).toContain("Individual tools may still be available");
    });

    it('should handle missing content arrays in tool responses', async () => {
      const mockWaterLevelResponse = {
        content: []
      };

      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 12,450 CFS
Timestamp: 2024-01-15T17:30:00.000Z`
        }]
      };

      mockGetPotomacGageDepth.mockResolvedValue(mockWaterLevelResponse);
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("Georgetown Water Level");
      expect(result.content[0].text).toContain("Little Falls Flow Rate");
      expect(result.content[0].text).toContain("Data Completeness: Partial");
    });
  });

  describe('Response format validation', () => {
    it('should include all required sections in response', async () => {
      const mockWaterLevelResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 2.5 feet
Timestamp: 2024-01-15T17:30:00.000Z`
        }]
      };

      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 12,450 CFS
Timestamp: 2024-01-15T17:30:00.000Z`
        }]
      };

      mockGetPotomacGageDepth.mockResolvedValue(mockWaterLevelResponse);
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      // Check required sections
      expect(result.content[0].text).toContain("# Current Potomac River Conditions");
      expect(result.content[0].text).toContain("## Georgetown Water Level");
      expect(result.content[0].text).toContain("## Little Falls Flow Rate");
      expect(result.content[0].text).toContain("## Overall Status");
      expect(result.content[0].text).toContain("Data Completeness:");
      expect(result.content[0].text).toContain("Data Freshness:");
      expect(result.content[0].text).toContain("💡 For technical details");
      expect(result.content[0].text).toContain("📊 For individual tool access");
    });

    it('should format numbers correctly with locale formatting', async () => {
      const mockFlowRateResponse = {
        content: [{
          type: "text" as const,
          text: `Current: 1234567 CFS
Timestamp: 2024-01-15T17:30:00.000Z
7-day range: 100000 to 2000000 CFS`
        }]
      };

      mockGetPotomacGageDepth.mockRejectedValue(new Error("Test error"));
      mockGetPotomacFlow.mockResolvedValue(mockFlowRateResponse);
      
      // Mock cache to return null (cache miss)
      mockCache.match.mockResolvedValue(null);

      const result = await getPotomacConditions({});

      expect(result.content[0].text).toContain("1,234,567 CFS");
      expect(result.content[0].text).toContain("100,000 to 2,000,000 CFS");
    });
  });
});