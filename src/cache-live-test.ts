#!/usr/bin/env node

import { USGSApiService } from './services/usgs-api.js';

// Simple in-memory cache for Node.js testing
class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    bypasses: 0
  };

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.metrics.misses++;
      return null;
    }

    this.metrics.hits++;
    return entry.data;
  }

  async set<T>(key: string, data: T, ttlMs: number = 60000): Promise<void> {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
    this.metrics.sets++;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getHitRatio() {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  clear() {
    this.cache.clear();
    this.metrics = { hits: 0, misses: 0, sets: 0, bypasses: 0 };
  }
}

// Create cache instance
const cache = new SimpleCache();

// Cached fetch function
async function fetchWithCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: { ttlMs?: number; forceRefresh?: boolean } = {}
): Promise<{ data: T; source: 'cache' | 'fresh' }> {
  const { ttlMs = 60000, forceRefresh = false } = options;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await cache.get<T>(cacheKey);
    if (cached !== null) {
      return { data: cached, source: 'cache' };
    }
  } else {
    cache.getMetrics().bypasses++;
  }

  // Fetch fresh data
  const freshData = await fetchFn();
  
  // Store in cache
  await cache.set(cacheKey, freshData, ttlMs);
  
  return { data: freshData, source: 'fresh' };
}

/**
 * Live test script to demonstrate cache functionality with real USGS API calls
 */
async function runCacheLiveTest() {
  console.log('🌊 Starting Cache Live Test with USGS API\n');
  
  const usgsApi = new USGSApiService();
  
  // Test 1: Cache Miss - First call should fetch from API
  console.log('📡 Test 1: Cache Miss - First API call');
  const start1 = Date.now();
  
  const result1 = await fetchWithCache(
    'water-level-01647600',
    () => usgsApi.getCurrentWaterLevel(),
    { ttlMs: 60000 }
  );
  
  const duration1 = Date.now() - start1;
  console.log(`✅ Source: ${result1.source}, Duration: ${duration1}ms`);
  if (result1.data) {
    console.log(`   Water Level: ${result1.data.navd88_ft} ft NAVD88`);
    console.log(`   Timestamp: ${result1.data.timestamp}`);
    console.log(`   Stale: ${result1.data.stale}`);
  }
  console.log();

  // Test 2: Cache Hit - Second call should use cache
  console.log('💾 Test 2: Cache Hit - Second API call (should be cached)');
  const start2 = Date.now();
  
  const result2 = await fetchWithCache(
    'water-level-01647600',
    () => usgsApi.getCurrentWaterLevel(),
    { ttlMs: 60000 }
  );
  
  const duration2 = Date.now() - start2;
  console.log(`✅ Source: ${result2.source}, Duration: ${duration2}ms`);
  if (result2.data) {
    console.log(`   Water Level: ${result2.data.navd88_ft} ft NAVD88`);
    console.log(`   Timestamp: ${result2.data.timestamp}`);
    console.log(`   Stale: ${result2.data.stale}`);
  }
  console.log();

  // Test 3: Force Refresh - Bypass cache
  console.log('🔄 Test 3: Force Refresh - Bypass cache');
  const start3 = Date.now();
  
  const result3 = await fetchWithCache(
    'water-level-01647600',
    () => usgsApi.getCurrentWaterLevel(),
    { ttlMs: 60000, forceRefresh: true }
  );
  
  const duration3 = Date.now() - start3;
  console.log(`✅ Source: ${result3.source}, Duration: ${duration3}ms`);
  if (result3.data) {
    console.log(`   Water Level: ${result3.data.navd88_ft} ft NAVD88`);
    console.log(`   Timestamp: ${result3.data.timestamp}`);
    console.log(`   Stale: ${result3.data.stale}`);
  }
  console.log();

  // Test 4: Flow Rate with different cache key
  console.log('🌊 Test 4: Flow Rate API call (different cache key)');
  const start4 = Date.now();
  
  const result4 = await fetchWithCache(
    'flow-rate-01646500',
    () => usgsApi.getCurrentFlowRate(),
    { ttlMs: 60000 }
  );
  
  const duration4 = Date.now() - start4;
  console.log(`✅ Source: ${result4.source}, Duration: ${duration4}ms`);
  if (result4.data) {
    console.log(`   Flow Rate: ${result4.data.discharge_cfs} cfs`);
    console.log(`   Timestamp: ${result4.data.timestamp}`);
    console.log(`   Stale: ${result4.data.stale}`);
  }
  console.log();

  // Test 5: Cache Hit on Flow Rate
  console.log('💾 Test 5: Flow Rate Cache Hit');
  const start5 = Date.now();
  
  const result5 = await fetchWithCache(
    'flow-rate-01646500',
    () => usgsApi.getCurrentFlowRate(),
    { ttlMs: 60000 }
  );
  
  const duration5 = Date.now() - start5;
  console.log(`✅ Source: ${result5.source}, Duration: ${duration5}ms`);
  if (result5.data) {
    console.log(`   Flow Rate: ${result5.data.discharge_cfs} cfs`);
    console.log(`   Timestamp: ${result5.data.timestamp}`);
    console.log(`   Stale: ${result5.data.stale}`);
  }
  console.log();

  // Test 6: Historical Data (should be slower)
  console.log('📊 Test 6: Historical Water Level Data');
  const start6 = Date.now();
  
  const result6 = await fetchWithCache(
    'historical-water-level-01647600',
    () => usgsApi.getHistoricalWaterLevelPoints(),
    { ttlMs: 300000 } // 5 minutes for historical data
  );
  
  const duration6 = Date.now() - start6;
  console.log(`✅ Source: ${result6.source}, Duration: ${duration6}ms`);
  if (result6.data) {
    console.log(`   Historical Points: ${result6.data.length}`);
    if (result6.data.length > 0) {
      const latest = result6.data[result6.data.length - 1];
      const oldest = result6.data[0];
      console.log(`   Latest: ${latest.navd88_ft} ft at ${latest.timestamp}`);
      console.log(`   Oldest: ${oldest.navd88_ft} ft at ${oldest.timestamp}`);
    }
  }
  console.log();

  // Display Cache Performance Summary
  console.log('📊 Cache Performance Summary');
  console.log('=' .repeat(50));
  
  const metrics = cache.getMetrics();
  console.log(`Cache Hits: ${metrics.hits}`);
  console.log(`Cache Misses: ${metrics.misses}`);
  console.log(`Cache Sets: ${metrics.sets}`);
  console.log(`Cache Bypasses: ${metrics.bypasses}`);
  
  const hitRatio = cache.getHitRatio();
  console.log(`Hit Ratio: ${(hitRatio * 100).toFixed(1)}%`);
  
  const totalRequests = metrics.hits + metrics.misses;
  console.log(`Total Requests: ${totalRequests}`);
  
  // Performance analysis
  console.log('\n🎯 Performance Analysis');
  console.log('=' .repeat(50));
  
  console.log(`Cache effectiveness: ${hitRatio > 0.3 ? '✅ Good' : '⚠️ Could be better'}`);
  console.log(`API calls saved: ${metrics.hits} out of ${totalRequests}`);
  
  if (duration1 > 0 && duration2 > 0) {
    const speedup = duration1 / duration2;
    console.log(`Cache speedup: ${speedup.toFixed(1)}x faster`);
  }
  
  console.log('\n🎉 Cache Live Test Complete!');
  console.log('\n💡 Key Observations:');
  console.log('- First calls to each endpoint are cache misses (expected)');
  console.log('- Subsequent calls to same endpoint are cache hits (much faster)');
  console.log('- Force refresh bypasses cache and fetches fresh data');
  console.log('- Different endpoints have separate cache keys');
  console.log('- Historical data can be cached with longer TTL');
}

// Run the test
runCacheLiveTest().catch(error => {
  console.error('❌ Cache Live Test Failed:', error);
  process.exit(1);
}); 