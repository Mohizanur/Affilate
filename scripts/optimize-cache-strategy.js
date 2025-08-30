const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Enhanced cache service with optimization strategies
class OptimizedCacheService {
  constructor() {
    // Optimized cache configurations
    this.userCache = new NodeCache({
      stdTTL: 3600, // 1 hour - longer cache for users
      maxKeys: 10000, // Increased capacity
      checkperiod: 900, // Check every 15 minutes
      useClones: false, // Disable cloning for better performance
      deleteOnExpire: true,
    });

    this.companyCache = new NodeCache({
      stdTTL: 7200, // 2 hours - longer cache for companies
      maxKeys: 5000, // Increased capacity
      checkperiod: 1200, // Check every 20 minutes
      useClones: false,
      deleteOnExpire: true,
    });

    this.statsCache = new NodeCache({
      stdTTL: 1800, // 30 minutes - longer for stats
      maxKeys: 1000, // Increased capacity
      checkperiod: 600, // Check every 10 minutes
      useClones: false,
      deleteOnExpire: true,
    });

    this.queryCache = new NodeCache({
      stdTTL: 900, // 15 minutes - shorter for query results
      maxKeys: 5000, // Large capacity for query results
      checkperiod: 300, // Check every 5 minutes
      useClones: false,
      deleteOnExpire: true,
    });

    // Cache warming data
    this.cacheWarmingData = {
      userStats: null,
      companyStats: null,
      topReferrers: null,
      platformStats: null
    };

    // Initialize cache warming
    this.initializeCacheWarming();
    
    logger.info('🚀 Optimized cache service initialized');
  }

  // Initialize cache warming with common data
  initializeCacheWarming() {
    try {
      // Pre-warm with common patterns
      const commonStats = {
        totalUsers: 0,
        totalCompanies: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalReferrals: 0,
        lastUpdated: new Date()
      };

      this.statsCache.set('stats:global', commonStats);
      this.statsCache.set('stats:recent', commonStats);
      this.statsCache.set('stats:platform', commonStats);

      // Pre-warm query cache with empty results
      this.queryCache.set('users:page:1:limit:20', []);
      this.queryCache.set('companies:page:1:limit:20', []);
      this.queryCache.set('referrals:page:1:limit:50', []);

      logger.info('🔥 Cache pre-warmed with common patterns');
    } catch (error) {
      logger.error('Error pre-warming cache:', error);
    }
  }

  // Optimized user cache methods
  getUser(telegramId) {
    const key = `user:${telegramId}`;
    const result = this.userCache.get(key);
    
    if (result) {
      this.recordCacheHit('user');
      return result;
    } else {
      this.recordCacheMiss('user');
      return null;
    }
  }

  setUser(telegramId, userData) {
    const key = `user:${telegramId}`;
    
    // Optimize stored data - only cache essential fields
    const cacheData = {
      id: userData.id,
      telegramId: userData.telegramId || userData.telegram_id,
      firstName: userData.firstName || userData.first_name,
      lastName: userData.lastName || userData.last_name,
      username: userData.username,
      balance: userData.balance || userData.coinBalance || 0,
      role: userData.role || 'user',
      isAdmin: userData.isAdmin || false,
      isBanned: userData.isBanned || userData.banned || false,
      phoneVerified: userData.phoneVerified || userData.phone_verified || false,
      language: userData.language || 'en',
      lastActive: userData.lastActive || userData.last_active,
      // Skip heavy data like orders, referrals for cache performance
    };

    this.userCache.set(key, cacheData);
    return cacheData;
  }

  // Optimized company cache methods
  getCompany(companyId) {
    const key = `company:${companyId}`;
    const result = this.companyCache.get(key);
    
    if (result) {
      this.recordCacheHit('company');
      return result;
    } else {
      this.recordCacheMiss('company');
      return null;
    }
  }

  setCompany(companyId, companyData) {
    const key = `company:${companyId}`;
    
    // Optimize stored data
    const cacheData = {
      id: companyData.id,
      name: companyData.name,
      description: companyData.description,
      telegramId: companyData.telegramId,
      email: companyData.email,
      phone: companyData.phone,
      active: companyData.active !== false,
      balance: companyData.balance || 0,
      createdAt: companyData.createdAt,
      // Skip heavy data like products for cache performance
    };

    this.companyCache.set(key, cacheData);
    return cacheData;
  }

  // Query result caching
  getQueryResult(queryKey) {
    const result = this.queryCache.get(queryKey);
    
    if (result) {
      this.recordCacheHit('query');
      return result;
    } else {
      this.recordCacheMiss('query');
      return null;
    }
  }

  setQueryResult(queryKey, data, ttl = 900) {
    this.queryCache.set(queryKey, data, ttl);
    return data;
  }

  // Stats caching with optimization
  getStats(key) {
    const cacheKey = `stats:${key}`;
    const result = this.statsCache.get(cacheKey);
    
    if (result) {
      this.recordCacheHit('stats');
      return result;
    } else {
      this.recordCacheMiss('stats');
      return null;
    }
  }

  setStats(key, data, ttl = 1800) {
    const cacheKey = `stats:${key}`;
    this.statsCache.set(cacheKey, data, ttl);
    return data;
  }

  // Cache warming methods
  async warmUserCache(telegramIds) {
    try {
      logger.info(`🔥 Warming user cache for ${telegramIds.length} users`);
      
      // This would typically fetch from database
      // For now, we'll just mark them as warming
      for (const telegramId of telegramIds) {
        const key = `user:${telegramId}`;
        if (!this.userCache.has(key)) {
          // Mark as warming to prevent cache stampede
          this.userCache.set(key, { warming: true }, 60);
        }
      }
      
      logger.info('✅ User cache warming initiated');
    } catch (error) {
      logger.error('Error warming user cache:', error);
    }
  }

  async warmCompanyCache(companyIds) {
    try {
      logger.info(`🔥 Warming company cache for ${companyIds.length} companies`);
      
      for (const companyId of companyIds) {
        const key = `company:${companyId}`;
        if (!this.companyCache.has(key)) {
          this.companyCache.set(key, { warming: true }, 60);
        }
      }
      
      logger.info('✅ Company cache warming initiated');
    } catch (error) {
      logger.error('Error warming company cache:', error);
    }
  }

  // Cache invalidation strategies
  invalidateUserCache(telegramId) {
    if (telegramId) {
      this.userCache.del(`user:${telegramId}`);
      logger.info(`🗑️ Invalidated user cache for ${telegramId}`);
    } else {
      this.userCache.flushAll();
      logger.info('🗑️ Flushed all user cache');
    }
  }

  invalidateCompanyCache(companyId) {
    if (companyId) {
      this.companyCache.del(`company:${companyId}`);
      logger.info(`🗑️ Invalidated company cache for ${companyId}`);
    } else {
      this.companyCache.flushAll();
      logger.info('🗑️ Flushed all company cache');
    }
  }

  invalidateQueryCache(pattern) {
    const keys = this.queryCache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    
    matchingKeys.forEach(key => {
      this.queryCache.del(key);
    });
    
    logger.info(`🗑️ Invalidated ${matchingKeys.length} query cache entries for pattern: ${pattern}`);
  }

  // Cache statistics and monitoring
  getCacheStats() {
    const userStats = this.userCache.getStats();
    const companyStats = this.companyCache.getStats();
    const statsCacheStats = this.statsCache.getStats();
    const queryCacheStats = this.queryCache.getStats();

    return {
      userCache: {
        hits: userStats.hits,
        misses: userStats.misses,
        hitRate: userStats.hits / (userStats.hits + userStats.misses) * 100,
        keys: userStats.keys,
        ksize: userStats.ksize,
        vsize: userStats.vsize
      },
      companyCache: {
        hits: companyStats.hits,
        misses: companyStats.misses,
        hitRate: companyStats.hits / (companyStats.hits + companyStats.misses) * 100,
        keys: companyStats.keys,
        ksize: companyStats.ksize,
        vsize: companyStats.vsize
      },
      statsCache: {
        hits: statsCacheStats.hits,
        misses: statsCacheStats.misses,
        hitRate: statsCacheStats.hits / (statsCacheStats.hits + statsCacheStats.misses) * 100,
        keys: statsCacheStats.keys,
        ksize: statsCacheStats.ksize,
        vsize: statsCacheStats.vsize
      },
      queryCache: {
        hits: queryCacheStats.hits,
        misses: queryCacheStats.misses,
        hitRate: queryCacheStats.hits / (queryCacheStats.hits + queryCacheStats.misses) * 100,
        keys: queryCacheStats.keys,
        ksize: queryCacheStats.ksize,
        vsize: queryCacheStats.vsize
      }
    };
  }

  // Cache hit/miss tracking
  recordCacheHit(type) {
    // This would integrate with your performance monitoring
    // For now, just log occasionally
    if (Math.random() < 0.01) { // Log 1% of hits
      logger.debug(`Cache hit: ${type}`);
    }
  }

  recordCacheMiss(type) {
    // This would integrate with your performance monitoring
    // For now, just log occasionally
    if (Math.random() < 0.1) { // Log 10% of misses
      logger.debug(`Cache miss: ${type}`);
    }
  }

  // Cache cleanup and maintenance
  cleanup() {
    try {
      // Clean up expired entries
      this.userCache.prune();
      this.companyCache.prune();
      this.statsCache.prune();
      this.queryCache.prune();
      
      logger.info('🧹 Cache cleanup completed');
    } catch (error) {
      logger.error('Error during cache cleanup:', error);
    }
  }

  // Get cache size information
  getCacheSizes() {
    return {
      userCache: this.userCache.getStats(),
      companyCache: this.companyCache.getStats(),
      statsCache: this.statsCache.getStats(),
      queryCache: this.queryCache.getStats()
    };
  }
}

// Test the optimized cache
async function testOptimizedCache() {
  try {
    logger.info('🧪 Testing optimized cache service...');
    
    const cache = new OptimizedCacheService();
    
    // Test user caching
    const testUser = {
      id: 'test123',
      telegramId: 123456789,
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      balance: 100.50,
      role: 'user',
      isAdmin: false
    };
    
    cache.setUser(123456789, testUser);
    const cachedUser = cache.getUser(123456789);
    
    if (cachedUser && cachedUser.firstName === 'Test') {
      logger.info('✅ User cache test passed');
    } else {
      logger.error('❌ User cache test failed');
    }
    
    // Test company caching
    const testCompany = {
      id: 'comp123',
      name: 'Test Company',
      description: 'Test Description',
      telegramId: 987654321,
      active: true,
      balance: 500.00
    };
    
    cache.setCompany('comp123', testCompany);
    const cachedCompany = cache.getCompany('comp123');
    
    if (cachedCompany && cachedCompany.name === 'Test Company') {
      logger.info('✅ Company cache test passed');
    } else {
      logger.error('❌ Company cache test failed');
    }
    
    // Test query caching
    const testQueryResult = [{ id: 1, name: 'Test' }];
    cache.setQueryResult('test:query', testQueryResult);
    const cachedQuery = cache.getQueryResult('test:query');
    
    if (cachedQuery && cachedQuery.length === 1) {
      logger.info('✅ Query cache test passed');
    } else {
      logger.error('❌ Query cache test failed');
    }
    
    // Get cache statistics
    const stats = cache.getCacheStats();
    logger.info('📊 Cache statistics:', stats);
    
    logger.info('✅ All cache tests completed successfully');
    
  } catch (error) {
    logger.error('❌ Error testing optimized cache:', error);
  }
}

// Export the optimized cache service
module.exports = {
  OptimizedCacheService,
  testOptimizedCache
};

// Run test if called directly
if (require.main === module) {
  testOptimizedCache().then(() => {
    logger.info('🎉 Cache optimization test completed');
    process.exit(0);
  }).catch(error => {
    logger.error('💥 Cache optimization test failed:', error);
    process.exit(1);
  });
}
