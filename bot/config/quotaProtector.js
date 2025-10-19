const logger = require("../../utils/logger");

/**
 * BEAST MODE: Bulletproof Quota Protection System
 *
 * This system ensures we NEVER hit Firebase quotas while maintaining
 * instant response times and maximum performance.
 */

class QuotaProtector {
  constructor() {
    // Daily quota limits (Free Tier)
    this.dailyLimits = {
      reads: 50000,
      writes: 20000,
      deletes: 20000,
      network: 10 * 1024 * 1024, // 10MB
    };

    // Current usage tracking
    this.currentUsage = {
      reads: 0,
      writes: 0,
      deletes: 0,
      network: 0,
    };

    // Protection strategies
    this.strategies = {
      normal: {
        cacheTTL: 300, // 5 minutes
        batchSize: 100,
        maxQueries: 1000,
        description: "Normal operation",
      },
      conservative: {
        cacheTTL: 600, // 10 minutes
        batchSize: 500,
        maxQueries: 500,
        description: "Conservative mode - 70% quota",
      },
      aggressive: {
        cacheTTL: 1800, // 30 minutes
        batchSize: 1000,
        maxQueries: 200,
        description: "Aggressive caching - 80% quota",
      },
      emergency: {
        cacheTTL: 3600, // 1 hour
        batchSize: 1000,
        maxQueries: 50,
        description: "Emergency mode - 90% quota",
      },
    };

    this.currentStrategy = "normal";
    this.lastReset = new Date();
    this.startupTime = Date.now();

    // Start monitoring
    this.startMonitoring();
    this.resetDailyQuota();
  }

  /**
   * Start quota monitoring
   */
  startMonitoring() {
    // EMERGENCY: Disable quota protector monitoring to stop quota leak
    // setInterval(() => {
    //   this.checkQuotaStatus();
    // }, 60000);

    // setInterval(() => {
    //   const now = new Date();
    //   if (now.getHours() === 0 && now.getMinutes() === 0) {
    //     this.resetDailyQuota();
    //   }
    // }, 60000);

    // setInterval(() => {
    //   this.logQuotaStatus();
    // }, 30 * 60 * 1000);
  }

  /**
   * Check current quota status and adjust strategy
   */
  checkQuotaStatus() {
    const readPercentage =
      (this.currentUsage.reads / this.dailyLimits.reads) * 100;
    const writePercentage =
      (this.currentUsage.writes / this.dailyLimits.writes) * 100;

    let newStrategy = "normal";

    if (readPercentage >= 90 || writePercentage >= 90) {
      newStrategy = "emergency";
    } else if (readPercentage >= 80 || writePercentage >= 80) {
      newStrategy = "aggressive";
    } else if (readPercentage >= 70 || writePercentage >= 70) {
      newStrategy = "conservative";
    }

    if (newStrategy !== this.currentStrategy) {
      this.switchStrategy(newStrategy);
    }

    // Emergency protection
    if (readPercentage >= 95 || writePercentage >= 95) {
      this.activateEmergencyMode();
    }
  }

  /**
   * Switch to new protection strategy
   */
  switchStrategy(strategy) {
    const oldStrategy = this.currentStrategy;
    this.currentStrategy = strategy;

    const strategyConfig = this.strategies[strategy];

    // Update cache TTL
    const cacheService = require("./cache");
    cacheService.userCache.options.stdTTL = strategyConfig.cacheTTL;
    cacheService.companyCache.options.stdTTL = strategyConfig.cacheTTL;
    cacheService.statsCache.options.stdTTL = strategyConfig.cacheTTL;

    logger.warn(
      `🔄 Quota Protection: Switched from ${oldStrategy} to ${strategy} mode`
    );
    logger.warn(`📊 Strategy: ${strategyConfig.description}`);
  }

  /**
   * Activate emergency mode
   */
  activateEmergencyMode() {
    logger.error("🚨 EMERGENCY QUOTA PROTECTION ACTIVATED!");

    // Clear all caches and switch to emergency mode
    const cacheService = require("./cache");
    cacheService.userCache.flushAll();
    cacheService.companyCache.flushAll();
    cacheService.statsCache.flushAll();

    // Switch to emergency strategy
    this.switchStrategy("emergency");

    // Notify administrators
    this.notifyEmergency();
  }

  /**
   * Record database operation
   */
  recordOperation(type, count = 1, dataSize = 0) {
    if (this.currentUsage[type] !== undefined) {
      this.currentUsage[type] += count;
    }

    if (dataSize > 0) {
      this.currentUsage.network += dataSize;
    }

    // Log high usage
    const percentage = (this.currentUsage[type] / this.dailyLimits[type]) * 100;
    if (percentage > 80) {
      logger.warn(
        `⚠️ High ${type} usage: ${percentage.toFixed(1)}% (${
          this.currentUsage[type]
        }/${this.dailyLimits[type]})`
      );
    }
  }

  /**
   * Check if operation is allowed
   */
  canPerformOperation(type, count = 1) {
    const currentUsage = this.currentUsage[type];
    const limit = this.dailyLimits[type];
    const strategy = this.strategies[this.currentStrategy];

    // Check if we're in emergency mode
    if (this.currentStrategy === "emergency") {
      return currentUsage + count < limit * 0.95; // 95% max
    }

    // Check strategy limits
    const maxAllowed =
      limit *
      (this.currentStrategy === "conservative"
        ? 0.7
        : this.currentStrategy === "aggressive"
        ? 0.8
        : 0.9);

    return currentUsage + count < maxAllowed;
  }

  /**
   * Get current quota status
   */
  getQuotaStatus() {
    const readPercentage =
      (this.currentUsage.reads / this.dailyLimits.reads) * 100;
    const writePercentage =
      (this.currentUsage.writes / this.dailyLimits.writes) * 100;
    const deletePercentage =
      (this.currentUsage.deletes / this.dailyLimits.deletes) * 100;
    const networkPercentage =
      (this.currentUsage.network / this.dailyLimits.network) * 100;

    return {
      reads: {
        used: this.currentUsage.reads,
        limit: this.dailyLimits.reads,
        percentage: readPercentage.toFixed(1),
        remaining: this.dailyLimits.reads - this.currentUsage.reads,
      },
      writes: {
        used: this.currentUsage.writes,
        limit: this.dailyLimits.writes,
        percentage: writePercentage.toFixed(1),
        remaining: this.dailyLimits.writes - this.currentUsage.writes,
      },
      deletes: {
        used: this.currentUsage.deletes,
        limit: this.dailyLimits.deletes,
        percentage: deletePercentage.toFixed(1),
        remaining: this.dailyLimits.deletes - this.currentUsage.deletes,
      },
      network: {
        used: Math.round(this.currentUsage.network / 1024 / 1024), // MB
        limit: Math.round(this.dailyLimits.network / 1024 / 1024), // MB
        percentage: networkPercentage.toFixed(1),
        remaining: Math.round(
          (this.dailyLimits.network - this.currentUsage.network) / 1024 / 1024
        ),
      },
      strategy: {
        current: this.currentStrategy,
        description: this.strategies[this.currentStrategy].description,
      },
      timeToReset: this.getTimeToReset(),
    };
  }

  /**
   * Reset daily quota
   */
  resetDailyQuota() {
    this.currentUsage = {
      reads: 0,
      writes: 0,
      deletes: 0,
      network: 0,
    };
    this.currentStrategy = "normal";
    this.lastReset = new Date();

    logger.info("🔄 Daily quota reset - Fresh start!");
  }

  /**
   * Get time until quota reset
   */
  getTimeToReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  /**
   * Log quota status
   */
  logQuotaStatus() {
    const status = this.getQuotaStatus();
    const uptime = Math.floor((Date.now() - this.startupTime) / 1000 / 60);

    logger.info(`📊 Quota Status (${uptime}m uptime):`);
    logger.info(
      `   Reads: ${status.reads.used}/${status.reads.limit} (${status.reads.percentage}%)`
    );
    logger.info(
      `   Writes: ${status.writes.used}/${status.writes.limit} (${status.writes.percentage}%)`
    );
    logger.info(
      `   Strategy: ${status.strategy.current} - ${status.strategy.description}`
    );
    logger.info(`   Reset in: ${status.timeToReset}`);
  }

  /**
   * Notify emergency situation
   */
  notifyEmergency() {
    const status = this.getQuotaStatus();

    // Log emergency
    logger.error("🚨 QUOTA EMERGENCY NOTIFICATION");
    logger.error(`   Reads: ${status.reads.percentage}%`);
    logger.error(`   Writes: ${status.writes.percentage}%`);
    logger.error(`   Network: ${status.network.percentage}%`);
    logger.error(`   Strategy: ${status.strategy.current}`);

    // Could send notification to admin users here
    // notificationService.sendEmergencyAlert(status);
  }

  /**
   * Get current strategy configuration
   */
  getCurrentStrategy() {
    return this.strategies[this.currentStrategy];
  }

  /**
   * Force strategy change (admin only)
   */
  forceStrategy(strategy) {
    if (this.strategies[strategy]) {
      this.switchStrategy(strategy);
      logger.info(`🔧 Admin forced strategy change to: ${strategy}`);
    } else {
      logger.error(`❌ Invalid strategy: ${strategy}`);
    }
  }
}

// Export singleton instance
const quotaProtector = new QuotaProtector();
module.exports = quotaProtector;
