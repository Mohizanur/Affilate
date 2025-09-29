const NodeCache = require("node-cache");
const logger = require("../../utils/logger");

class CacheService {
  constructor() {
    // BEAST MODE: Multi-layer cache for instant response
    this.userCache = new NodeCache({
      stdTTL: 300, // 5 minutes - optimized for real-time
      maxKeys: 10000, // Optimized size
      checkperiod: 60, // Check every minute
      useClones: false,
      deleteOnExpire: true,
    });
    this.companyCache = new NodeCache({
      stdTTL: 600, // 10 minutes - companies change less frequently
      maxKeys: 5000,
      checkperiod: 120, // Check every 2 minutes
      useClones: false,
      deleteOnExpire: true,
    });
    this.statsCache = new NodeCache({
      stdTTL: 300, // 5 minutes - stats need to be fresh
      maxKeys: 10000, // More stats entries
      checkperiod: 60, // Check every minute
      useClones: false,
      deleteOnExpire: true,
    });
    this.sessionCache = new NodeCache({
      stdTTL: 1800, // 30 minutes - sessions
      maxKeys: 50000, // Many sessions
      checkperiod: 300, // Check every 5 minutes
      useClones: false,
      deleteOnExpire: true,
    });
    this.rateLimitCache = new NodeCache({
      stdTTL: 900, // 15 minutes - rate limiting
      maxKeys: 50000,
      checkperiod: 120, // Check every 2 minutes
      useClones: false,
      deleteOnExpire: true,
    });

    // BEAST MODE: Instant response cache for critical data
    this.instantCache = new NodeCache({
      stdTTL: 60, // 1 minute - ultra-fast access
      maxKeys: 1000,
      checkperiod: 30, // Check every 30 seconds
      useClones: false,
      deleteOnExpire: true,
    });

    // Pre-warm cache with common data patterns
    this._prewarmCache();
  }

  _prewarmCache() {
    // Pre-warm with common patterns for faster access
    const commonStats = {
      totalUsers: 0,
      totalCompanies: 0,
      totalProducts: 0,
      totalOrders: 0,
    };

    this.statsCache.set("stats:global", commonStats);
    this.statsCache.set("stats:recent", commonStats);

    logger.info("Cache pre-warmed for maximum performance");
  }

  getUser(telegramId) {
    const result = this.userCache.get(`user:${telegramId}`);
    if (result) {
      const performanceMonitor = require("./performance");
      performanceMonitor.recordCacheHit();
    } else {
      const performanceMonitor = require("./performance");
      performanceMonitor.recordCacheMiss();
    }
    return result;
  }

  setUser(telegramId, userData) {
    // Optimize for performance: store minimal data in cache
    const cacheData = {
      id: userData.id,
      telegramId: userData.telegramId,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      balance: userData.balance,
      role: userData.role,
      isAdmin: userData.isAdmin,
      canRegisterCompany: userData.canRegisterCompany,
      language: userData.language,
      phone_verified: userData.phone_verified,
      phoneVerified: userData.phoneVerified,
      phone_number: userData.phone_number,
      // Skip heavy data like orders, referrals for cache performance
    };
    return this.userCache.set(`user:${telegramId}`, cacheData);
  }

  getCompany(companyId) {
    const result = this.companyCache.get(`company:${companyId}`);
    if (result) {
      // Record cache hit
      const performanceMonitor = require("./performance");
      performanceMonitor.recordCacheHit();
    } else {
      // Record cache miss
      const performanceMonitor = require("./performance");
      performanceMonitor.recordCacheMiss();
    }
    return result;
  }

  setCompany(companyId, companyData) {
    return this.companyCache.set(`company:${companyId}`, companyData);
  }

  getStats(key) {
    return this.statsCache.get(`stats:${key}`);
  }

  setStats(key, data) {
    return this.statsCache.set(`stats:${key}`, data);
  }

  getSession(userId) {
    return this.sessionCache.get(`session:${userId}`);
  }

  setSession(userId, sessionData) {
    return this.sessionCache.set(`session:${userId}`, sessionData);
  }

  getRateLimit(key) {
    return this.rateLimitCache.get(`rate:${key}`);
  }

  setRateLimit(key, data) {
    return this.rateLimitCache.set(`rate:${key}`, data);
  }

  clearUserCache(telegramId) {
    if (telegramId) {
      this.userCache.del(`user:${telegramId}`);
      this.instantCache.del(`user:${telegramId}`);
    } else {
      this.userCache.flushAll();
      this.instantCache.flushAll();
    }
  }

  // BEAST MODE: Instant response methods
  getInstant(key) {
    const result = this.instantCache.get(key);
    if (result) {
      const performanceMonitor = require("./performance");
      performanceMonitor.recordCacheHit();
    } else {
      const performanceMonitor = require("./performance");
      performanceMonitor.recordCacheMiss();
    }
    return result;
  }

  setInstant(key, data) {
    return this.instantCache.set(key, data);
  }

  // BEAST MODE: Smart cache warming for instant response
  async warmupInstantCache() {
    try {
      // Pre-load critical data for instant access
      const criticalKeys = [
        "stats:global",
        "stats:recent",
        "top_referrers",
        "active_companies",
      ];

      for (const key of criticalKeys) {
        const data = this.statsCache.get(key);
        if (data) {
          this.instantCache.set(key, data);
        }
      }

      logger.info("Instant cache warmed up for maximum performance");
    } catch (error) {
      logger.error("Error warming up instant cache:", error);
    }
  }

  // BEAST MODE: Cache health monitoring
  getCacheHealth() {
    return {
      userCache: {
        keys: this.userCache.keys().length,
        maxKeys: this.userCache.options.maxKeys,
        hitRate:
          (this.userCache.getStats().hits /
            (this.userCache.getStats().hits +
              this.userCache.getStats().misses)) *
          100,
      },
      instantCache: {
        keys: this.instantCache.keys().length,
        maxKeys: this.instantCache.options.maxKeys,
        hitRate:
          (this.instantCache.getStats().hits /
            (this.instantCache.getStats().hits +
              this.instantCache.getStats().misses)) *
          100,
      },
    };
  }
}

const cacheService = new CacheService();
module.exports = cacheService;
