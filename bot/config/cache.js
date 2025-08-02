const NodeCache = require("node-cache");
const logger = require("../../utils/logger");

class CacheService {
  constructor() {
    // BEAST MODE: Optimized cache settings for maximum performance
    this.userCache = new NodeCache({
      stdTTL: 1800, // 30 minutes - longer cache for users
      maxKeys: 50000, // Increased for more users
      checkperiod: 600, // Check every 10 minutes
      useClones: false, // Disable cloning for better performance
      deleteOnExpire: true,
    });
    this.companyCache = new NodeCache({
      stdTTL: 3600, // 1 hour - longer cache for companies
      maxKeys: 10000, // Increased for more companies
      checkperiod: 900, // Check every 15 minutes
      useClones: false,
      deleteOnExpire: true,
    });
    this.statsCache = new NodeCache({
      stdTTL: 600, // 10 minutes - longer for stats
      maxKeys: 5000, // Increased for more stats
      checkperiod: 300, // Check every 5 minutes
      useClones: false,
      deleteOnExpire: true,
    });
    this.sessionCache = new NodeCache({
      stdTTL: 3600, // 1 hour - longer sessions
      maxKeys: 100000, // Massive increase for sessions
      checkperiod: 1200, // Check every 20 minutes
      useClones: false,
      deleteOnExpire: true,
    });
    this.rateLimitCache = new NodeCache({
      stdTTL: 120, // 2 minutes - longer rate limit tracking
      maxKeys: 100000, // Massive increase for rate limits
      checkperiod: 60, // Check every minute
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
}

const cacheService = new CacheService();
module.exports = cacheService;
