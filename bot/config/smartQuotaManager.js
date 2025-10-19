/**
 * 🎯 SMART QUOTA MANAGER
 * 
 * Maximizes real-time performance while staying within Firestore free tier limits
 * - 50,000 reads/day = ~34 reads/minute sustainable
 * - Intelligent quota distribution
 * - Real-time when quota available, cached when quota low
 */

const logger = require("../../utils/logger");

class SmartQuotaManager {
  constructor() {
    // Firestore free tier limits (daily)
    this.dailyLimits = {
      reads: 50000,    // 50k reads per day
      writes: 20000,   // 20k writes per day
      deletes: 20000   // 20k deletes per day
    };
    
    // Current usage tracking
    this.usage = {
      reads: 0,
      writes: 0,
      deletes: 0,
      lastReset: new Date().toDateString()
    };
    
    // Smart quota distribution (reads per minute) - Ultra-conservative for free tier
    this.quotaDistribution = {
      // Peak hours (when users are most active) - Reduced for free tier
      peak: 20,      // 20 reads/minute during peak (9 AM - 11 PM)
      normal: 15,    // 15 reads/minute during normal hours
      low: 8,        // 8 reads/minute during low hours (2 AM - 6 AM)
      emergency: 3   // 3 reads/minute when quota is critically low
    };
    
    // Current quota allowance
    this.currentQuotaPerMinute = this.quotaDistribution.normal;
    this.quotaUsedThisMinute = 0;
    this.currentMinute = new Date().getMinutes();
    
    // Real-time vs cached decision making
    this.cacheStrategy = 'smart'; // smart, aggressive, conservative
    
    this.startQuotaMonitoring();
  }

  /**
   * Start intelligent quota monitoring
   */
  startQuotaMonitoring() {
    // EMERGENCY: Disable quota monitoring intervals to stop quota leak
    // setInterval(() => {
    //   this.quotaUsedThisMinute = 0;
    //   this.currentMinute = new Date().getMinutes();
    //   this.adjustQuotaStrategy();
    // }, 60000);
    
    // setInterval(() => {
    //   const today = new Date().toDateString();
    //   if (today !== this.usage.lastReset) {
    //     this.resetDailyUsage();
      }
    }, 3600000); // Check every hour
    
    logger.info("🎯 Smart Quota Manager started - optimizing for real-time performance");
  }

  /**
   * Reset daily usage counters
   */
  resetDailyUsage() {
    this.usage = {
      reads: 0,
      writes: 0,
      deletes: 0,
      lastReset: new Date().toDateString()
    };
    logger.info("🔄 Daily quota usage reset - fresh quota available");
  }

  /**
   * Adjust quota strategy based on time and usage
   */
  adjustQuotaStrategy() {
    const hour = new Date().getHours();
    const dailyUsagePercent = (this.usage.reads / this.dailyLimits.reads) * 100;
    
    // Determine time-based quota allocation
    let timeBasedQuota;
    if (hour >= 9 && hour <= 23) {
      timeBasedQuota = this.quotaDistribution.peak;   // Peak hours
    } else if (hour >= 6 && hour < 9) {
      timeBasedQuota = this.quotaDistribution.normal; // Morning hours
    } else {
      timeBasedQuota = this.quotaDistribution.low;    // Night hours
    }
    
    // Adjust based on daily usage
    if (dailyUsagePercent > 90) {
      this.currentQuotaPerMinute = this.quotaDistribution.emergency;
      this.cacheStrategy = 'aggressive';
      logger.warn(`🚨 Quota critical: ${dailyUsagePercent.toFixed(1)}% used - switching to emergency mode`);
    } else if (dailyUsagePercent > 70) {
      this.currentQuotaPerMinute = Math.min(timeBasedQuota, this.quotaDistribution.normal);
      this.cacheStrategy = 'conservative';
      logger.info(`⚠️ Quota high: ${dailyUsagePercent.toFixed(1)}% used - conservative mode`);
    } else {
      this.currentQuotaPerMinute = timeBasedQuota;
      this.cacheStrategy = 'smart';
    }
    
    logger.info(`🎯 Quota strategy: ${this.currentQuotaPerMinute} reads/min, ${this.cacheStrategy} caching`);
  }

  /**
   * Check if we can make a database read
   */
  canMakeRead(priority = 'normal') {
    // Always allow critical operations
    if (priority === 'critical') {
      return true;
    }
    
    // Check minute quota
    if (this.quotaUsedThisMinute >= this.currentQuotaPerMinute) {
      return false;
    }
    
    // Check daily quota
    const dailyUsagePercent = (this.usage.reads / this.dailyLimits.reads) * 100;
    if (dailyUsagePercent >= 95) {
      return priority === 'high';
    }
    
    return true;
  }

  /**
   * Record a database operation
   */
  recordOperation(type, count = 1) {
    this.usage[type] += count;
    
    if (type === 'reads') {
      this.quotaUsedThisMinute += count;
    }
    
    // Log significant usage
    if (count > 10) {
      logger.info(`📊 Recorded ${count} ${type} - Total today: ${this.usage[type]}`);
    }
  }

  /**
   * Smart database query with quota awareness
   */
  async smartQuery(queryFunction, cacheKey, cacheTTL = 300, priority = 'normal') {
    try {
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug(`💾 Cache hit: ${cacheKey}`);
        return cached;
      }
      
      // Check if we can make a database read
      if (!this.canMakeRead(priority)) {
        logger.info(`🛡️ Quota protection: Using stale cache for ${cacheKey}`);
        return this.getFromStaleCache(cacheKey) || this.getFallbackData(cacheKey);
      }
      
      // Make the database query
      const startTime = Date.now();
      const result = await queryFunction();
      const queryTime = Date.now() - startTime;
      
      // Record the operation
      this.recordOperation('reads', 1);
      
      // Cache the result
      this.setCache(cacheKey, result, cacheTTL);
      
      logger.debug(`🎯 Real-time query: ${cacheKey} (${queryTime}ms, quota: ${this.quotaUsedThisMinute}/${this.currentQuotaPerMinute})`);
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Smart query failed for ${cacheKey}:`, error.message);
      
      // Return cached data on error
      return this.getFromStaleCache(cacheKey) || this.getFallbackData(cacheKey);
    }
  }

  /**
   * Get data from cache
   */
  getFromCache(key) {
    const cacheService = require("./cache");
    return cacheService.get(key);
  }

  /**
   * Get data from stale cache (expired but still useful)
   */
  getFromStaleCache(key) {
    const cacheService = require("./cache");
    return cacheService.getStale(key); // Implement in cache service
  }

  /**
   * Set data in cache
   */
  setCache(key, data, ttl) {
    const cacheService = require("./cache");
    cacheService.set(key, data, ttl);
  }

  /**
   * Get fallback data when no cache available
   */
  getFallbackData(key) {
    const fallbacks = {
      'users:recent': [],
      'companies:active': [],
      'stats:global': { totalUsers: 0, totalCompanies: 0, totalReferrals: 0 },
      'leaderboard:global': []
    };
    
    return fallbacks[key] || null;
  }

  /**
   * Get current quota status
   */
  getQuotaStatus() {
    const dailyUsagePercent = (this.usage.reads / this.dailyLimits.reads) * 100;
    const minuteUsagePercent = (this.quotaUsedThisMinute / this.currentQuotaPerMinute) * 100;
    
    return {
      daily: {
        used: this.usage.reads,
        limit: this.dailyLimits.reads,
        percentage: dailyUsagePercent,
        remaining: this.dailyLimits.reads - this.usage.reads
      },
      minute: {
        used: this.quotaUsedThisMinute,
        limit: this.currentQuotaPerMinute,
        percentage: minuteUsagePercent,
        remaining: this.currentQuotaPerMinute - this.quotaUsedThisMinute
      },
      strategy: this.cacheStrategy,
      canMakeRead: this.canMakeRead(),
      timeToReset: this.getTimeToReset()
    };
  }

  /**
   * Get time until quota resets
   */
  getTimeToReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilReset = tomorrow.getTime() - now.getTime();
    const hoursUntilReset = Math.floor(msUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hoursUntilReset}h ${minutesUntilReset}m`;
  }

  /**
   * Force real-time update (uses quota)
   */
  async forceRealTimeUpdate(queryFunction, cacheKey, priority = 'high') {
    if (!this.canMakeRead(priority)) {
      throw new Error('Quota exhausted - cannot force real-time update');
    }
    
    const result = await queryFunction();
    this.recordOperation('reads', 1);
    this.setCache(cacheKey, result, 300);
    
    logger.info(`🔥 Forced real-time update: ${cacheKey}`);
    return result;
  }

  /**
   * Batch multiple queries efficiently
   */
  async batchQueries(queries, priority = 'normal') {
    const results = {};
    let queriesExecuted = 0;
    
    for (const [key, queryFunction] of Object.entries(queries)) {
      if (!this.canMakeRead(priority) && queriesExecuted > 0) {
        // Use cache for remaining queries
        results[key] = this.getFromCache(key) || this.getFallbackData(key);
        continue;
      }
      
      try {
        results[key] = await queryFunction();
        queriesExecuted++;
        this.recordOperation('reads', 1);
      } catch (error) {
        results[key] = this.getFromCache(key) || this.getFallbackData(key);
      }
    }
    
    logger.info(`📦 Batch queries: ${queriesExecuted}/${Object.keys(queries).length} real-time`);
    return results;
  }
}

// Singleton instance
const smartQuotaManager = new SmartQuotaManager();

module.exports = smartQuotaManager;
