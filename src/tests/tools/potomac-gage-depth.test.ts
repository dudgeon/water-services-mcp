import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPotomacGageDepth, GetPotomacGageDepthSchema } from '../../tools/potomac-gage-depth.js';
import { USGSApiService } from '../../services/usgs-api.js';
import { CacheService } from '../../services/cache.js';

// Mock the services
vi.mock('../../services/usgs-api.js');
vi.mock('../../services/cache.js', () => ({
  CacheService: vi.fn().mockImplementation(() => ({
    cacheCurrentWaterLevel: vi.fn(),
    cacheHistoricalWaterLevel: vi.fn(),
    cache90MinuteWaterLevel: vi.fn()
  }))
}));

describe('getPotomacGageDepth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('response format consistency', () => {
    it('should return consistent NAVD88 format in response text', async () => {
      // Mock current water level data
      const mockCurrentData = {
        navd88_ft: 2.5,
        wmlw_ft: 1.2,
        timestamp: '2024-01-15T12:00:00Z'
      };

      // Mock historical data
      const mockHistoricalData = [
        { navd88_ft: 2.0, timestamp: '2024-01-14T12:00:00Z' },
        { navd88_ft: 3.0, timestamp: '2024-01-13T12:00:00Z' },
        { navd88_ft: 2.7, timestamp: '2024-01-12T12:00:00Z' }
      ];

      // Mock cache service
      const mockCacheService = {
        cacheCurrentWaterLevel: vi.fn().mockResolvedValue(mockCurrentData),
        cacheHistoricalWaterLevel: vi.fn().mockResolvedValue(mockHistoricalData),
        cache90MinuteWaterLevel: vi.fn().mockResolvedValue([])
      };

      // Mock USGS API service
      const mockUSGSService = {
        getCurrentWaterLevel: vi.fn().mockResolvedValue(mockCurrentData),
        getHistoricalWaterLevelPoints: vi.fn().mockResolvedValue(mockHistoricalData),
        get90MinuteWaterLevelPoints: vi.fn().mockResolvedValue([])
      };

      // Replace the service constructors
      vi.mocked(USGSApiService).mockImplementation(() => mockUSGSService as any);
      vi.mocked(CacheService).mockImplementation(() => mockCacheService as any);
      
      // Mock the static method
      const MockedCacheService = vi.mocked(CacheService);
      MockedCacheService.extractCacheHeaders = vi.fn().mockReturnValue({});

      // Call the function
      const result = await getPotomacGageDepth({});

      // Verify the response structure
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');

      const responseText = result.content[0].text;

      // Test the expected format improvements
      // 1. Should contain consistent NAVD88 labeling
      expect(responseText).toMatch(/Current: 2\.5 feet \(NAVD88\)/);
      
      // 2. Should contain 7-day range with NAVD88 label
      expect(responseText).toMatch(/7-day range: 2\.0 to 3\.0 feet \(NAVD88\)/);
      
      // 3. Should NOT contain WMLW in the main text (only NAVD88 for consistency)
      expect(responseText).not.toMatch(/WMLW/);
      
      // 4. Should include timestamp information
      expect(responseText).toContain('2024-01-15T12:00:00Z');
      
      // 5. Should include station information
      expect(responseText).toContain('Georgetown');
      expect(responseText).toContain('USGS Station 01647600');
    });

    it('should handle stale data indicators properly', async () => {
      // Mock stale data (older than 30 minutes)
      const staleTimestamp = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 minutes ago
      
      const mockCurrentData = {
        navd88_ft: 2.5,
        wmlw_ft: 1.2,
        timestamp: staleTimestamp
      };

      const mockHistoricalData = [
        { navd88_ft: 2.0, timestamp: '2024-01-14T12:00:00Z' },
        { navd88_ft: 3.0, timestamp: '2024-01-13T12:00:00Z' }
      ];

      // Mock services
      const mockCacheService = {
        cacheCurrentWaterLevel: vi.fn().mockResolvedValue(mockCurrentData),
        cacheHistoricalWaterLevel: vi.fn().mockResolvedValue(mockHistoricalData),
        cache90MinuteWaterLevel: vi.fn().mockResolvedValue([])
      };

      const mockUSGSService = {
        getCurrentWaterLevel: vi.fn().mockResolvedValue(mockCurrentData),
        getHistoricalWaterLevelPoints: vi.fn().mockResolvedValue(mockHistoricalData),
        get90MinuteWaterLevelPoints: vi.fn().mockResolvedValue([])
      };

      vi.mocked(USGSApiService).mockImplementation(() => mockUSGSService as any);
      vi.mocked(CacheService).mockImplementation(() => mockCacheService as any);
      
      // Mock the static method
      const MockedCacheService = vi.mocked(CacheService);
      MockedCacheService.extractCacheHeaders = vi.fn().mockReturnValue({});

      const result = await getPotomacGageDepth({});
      const responseText = result.content[0].text;

      // Should indicate stale data
      expect(responseText).toMatch(/Data is \d+ minutes old and may be stale/);
      
      // Should still maintain consistent format
      expect(responseText).toMatch(/Current: 2\.5 feet \(NAVD88\)/);
      expect(responseText).toMatch(/7-day range: 2\.0 to 3\.0 feet \(NAVD88\)/);
    });

    it('should handle missing historical data gracefully', async () => {
      const mockCurrentData = {
        navd88_ft: 2.5,
        wmlw_ft: 1.2,
        timestamp: '2024-01-15T12:00:00Z'
      };

      // Mock services with no historical data
      const mockCacheService = {
        cacheCurrentWaterLevel: vi.fn().mockResolvedValue(mockCurrentData),
        cacheHistoricalWaterLevel: vi.fn().mockResolvedValue(null),
        cache90MinuteWaterLevel: vi.fn().mockResolvedValue([])
      };

      const mockUSGSService = {
        getCurrentWaterLevel: vi.fn().mockResolvedValue(mockCurrentData),
        getHistoricalWaterLevelPoints: vi.fn().mockResolvedValue(null),
        get90MinuteWaterLevelPoints: vi.fn().mockResolvedValue([])
      };

      vi.mocked(USGSApiService).mockImplementation(() => mockUSGSService as any);
      vi.mocked(CacheService).mockImplementation(() => mockCacheService as any);
      
      // Mock the static method
      const MockedCacheService = vi.mocked(CacheService);
      MockedCacheService.extractCacheHeaders = vi.fn().mockReturnValue({});

      const result = await getPotomacGageDepth({});
      const responseText = result.content[0].text;

      // Should still show current reading in consistent format
      expect(responseText).toMatch(/Current: 2\.5 feet \(NAVD88\)/);
      
      // Should not show a 7-day range when no historical data
      expect(responseText).not.toMatch(/7-day range/);
    });

    it('should handle error cases with clear messaging', async () => {
      // Mock services to return null (simulating API failure)
      const mockCacheService = {
        cacheCurrentWaterLevel: vi.fn().mockResolvedValue(null),
        cacheHistoricalWaterLevel: vi.fn().mockResolvedValue(null),
        cache90MinuteWaterLevel: vi.fn().mockResolvedValue([])
      };

      const mockUSGSService = {
        getCurrentWaterLevel: vi.fn().mockResolvedValue(null),
        getHistoricalWaterLevelPoints: vi.fn().mockResolvedValue(null),
        get90MinuteWaterLevelPoints: vi.fn().mockResolvedValue([])
      };

      vi.mocked(USGSApiService).mockImplementation(() => mockUSGSService as any);
      vi.mocked(CacheService).mockImplementation(() => mockCacheService as any);
      
      // Mock the static method
      const MockedCacheService = vi.mocked(CacheService);
      MockedCacheService.extractCacheHeaders = vi.fn().mockReturnValue({});

      const result = await getPotomacGageDepth({});
      const responseText = result.content[0].text;

      // Should provide clear error message
      expect(responseText).toContain('Unable to fetch current water level data');
      expect(responseText).toContain('USGS station 01647600');
      expect(responseText).toContain('Georgetown');
    });
  });

  describe('schema validation', () => {
    it('should accept empty or undefined input parameters', () => {
      // Test the input schema
      expect(() => GetPotomacGageDepthSchema.parse({})).not.toThrow();
      expect(() => GetPotomacGageDepthSchema.parse(undefined)).not.toThrow();
    });
  });
});