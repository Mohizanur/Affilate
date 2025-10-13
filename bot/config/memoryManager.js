const logger = require("../../utils/logger");

/**
 * BEAST MODE: Advanced Memory Management System
 *
 * This system ensures optimal memory usage with automatic cleanup,
 * preventing memory leaks and maintaining peak performance.
 */

class MemoryManager {
  constructor() {
    // 🔧 RENDER FIX: More lenient for 512MB free tier
    this.memoryThreshold = 0.85; // 85% (was 55% - too aggressive for Render)
    this.cleanupInterval = 120000; // 2 minutes (was 30s)
    this.forceGCInterval = 600000; // 10 minutes (was 5m)
    this.startupTime = Date.now();

    this.memoryHistory = [];
    this.cleanupCount = 0;
    this.lastCleanup = null;

    // Start monitoring only if not disabled
    if (process.env.DISABLE_HEAVY_MONITORING !== 'true') {
      this.startMonitoring();
    } else {
      console.log('🛡️ Heavy memory monitoring disabled for Render free tier');
    }
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    // EMERGENCY: Disable memory monitoring to stop quota leak
    // setInterval(() => {
    //   this.monitorMemory();
    // }, this.cleanupInterval);

    // setInterval(() => {
    //   this.forceGarbageCollection();
    // }, this.forceGCInterval);

    // setInterval(() => {
    //   this.logMemoryStatus();
    // }, 15 * 60 * 1000); // DISABLED to stop quota leak
  }

  /**
   * Monitor current memory usage
   */
  monitorMemory() {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    const heapPercentage = heapUsed / heapTotal;

    // Store memory history
    this.memoryHistory.push({
      timestamp: Date.now(),
      heapUsed,
      heapTotal,
      heapPercentage,
      rss: memUsage.rss,
      external: memUsage.external,
    });

    // Keep only last 100 readings
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift();
    }

    // Check if cleanup is needed
    if (heapPercentage > this.memoryThreshold) {
      this.performCleanup();
    }
  }

  /**
   * Perform memory cleanup
   */
  performCleanup() {
    try {
      const beforeCleanup = process.memoryUsage();

      // Clear cache if needed
      const cacheService = require("./cache");
      const cacheHealth = cacheService.getCacheHealth();

      // Clean up user cache if it's getting large
      if (cacheHealth.userCache.keys > 8000) {
        const userCacheKeys = cacheService.userCache.keys();
        const keysToRemove = userCacheKeys.slice(0, 1000); // Remove oldest 1000 keys
        keysToRemove.forEach((key) => cacheService.userCache.del(key));
        logger.info(`🧹 Cleaned up ${keysToRemove.length} user cache entries`);
      }

      // Clean up stats cache if it's getting large
      if (cacheHealth.instantCache.keys > 800) {
        cacheService.instantCache.flushAll();
        logger.info("🧹 Flushed instant cache");
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear memory history if it's getting large
      if (this.memoryHistory.length > 50) {
        this.memoryHistory = this.memoryHistory.slice(-25);
      }

      const afterCleanup = process.memoryUsage();
      const freedMemory = beforeCleanup.heapUsed - afterCleanup.heapUsed;

      this.cleanupCount++;
      this.lastCleanup = new Date();

      logger.info(
        `🧹 Memory cleanup #${this.cleanupCount}: Freed ${Math.round(
          freedMemory / 1024 / 1024
        )}MB`
      );
    } catch (error) {
      logger.error("Error during memory cleanup:", error);
    }
  }

  /**
   * Force garbage collection
   */
  forceGarbageCollection() {
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      global.gc();
      const afterGC = process.memoryUsage();
      const freedMemory = beforeGC.heapUsed - afterGC.heapUsed;

      logger.info(
        `🗑️ Forced GC: Freed ${Math.round(freedMemory / 1024 / 1024)}MB`
      );
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    const current = process.memoryUsage();
    const uptime = Date.now() - this.startupTime;

    // Calculate average memory usage
    const avgHeapUsed =
      this.memoryHistory.length > 0
        ? this.memoryHistory.reduce((sum, entry) => sum + entry.heapUsed, 0) /
          this.memoryHistory.length
        : 0;

    // Calculate peak memory usage
    const peakHeapUsed =
      this.memoryHistory.length > 0
        ? Math.max(...this.memoryHistory.map((entry) => entry.heapUsed))
        : 0;

    return {
      current: {
        heapUsed: Math.round(current.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(current.heapTotal / 1024 / 1024), // MB
        heapPercentage: ((current.heapUsed / current.heapTotal) * 100).toFixed(
          1
        ),
        rss: Math.round(current.rss / 1024 / 1024), // MB
        external: Math.round(current.external / 1024 / 1024), // MB
      },
      average: {
        heapUsed: Math.round(avgHeapUsed / 1024 / 1024), // MB
      },
      peak: {
        heapUsed: Math.round(peakHeapUsed / 1024 / 1024), // MB
      },
      uptime: {
        minutes: Math.round(uptime / 1000 / 60),
        hours: Math.round(uptime / 1000 / 60 / 60),
      },
      cleanup: {
        count: this.cleanupCount,
        lastCleanup: this.lastCleanup,
        threshold: `${(this.memoryThreshold * 100).toFixed(0)}%`,
      },
    };
  }

  /**
   * Log memory status
   */
  logMemoryStatus() {
    const stats = this.getMemoryStats();

    logger.info(`💾 Memory Status (${stats.uptime.minutes}m uptime):`);
    logger.info(
      `   Current: ${stats.current.heapUsed}MB / ${stats.current.heapTotal}MB (${stats.current.heapPercentage}%)`
    );
    logger.info(`   Average: ${stats.average.heapUsed}MB`);
    logger.info(`   Peak: ${stats.peak.heapUsed}MB`);
    logger.info(
      `   Cleanups: ${stats.cleanup.count} (threshold: ${stats.cleanup.threshold})`
    );
  }

  /**
   * Get memory health status
   */
  getMemoryHealth() {
    const current = process.memoryUsage();
    const heapPercentage = (current.heapUsed / current.heapTotal) * 100;

    let status = "healthy";
    if (heapPercentage > 90) {
      status = "critical";
    } else if (heapPercentage > 80) {
      status = "warning";
    } else if (heapPercentage > 70) {
      status = "moderate";
    }

    return {
      status,
      heapPercentage: heapPercentage.toFixed(1),
      recommendation: this.getRecommendation(status),
    };
  }

  /**
   * Get recommendation based on memory status
   */
  getRecommendation(status) {
    switch (status) {
      case "critical":
        return "Immediate cleanup required - memory usage critical";
      case "warning":
        return "Monitor closely - cleanup may be needed soon";
      case "moderate":
        return "Memory usage is moderate - continue monitoring";
      default:
        return "Memory usage is healthy";
    }
  }

  /**
   * Force immediate cleanup (admin command)
   */
  forceCleanup() {
    logger.info("🔧 Admin forced memory cleanup");
    this.performCleanup();
    return this.getMemoryStats();
  }

  /**
   * Adjust memory threshold (admin command)
   */
  setMemoryThreshold(threshold) {
    if (threshold >= 0.5 && threshold <= 0.95) {
      this.memoryThreshold = threshold;
      logger.info(
        `🔧 Memory threshold adjusted to ${(threshold * 100).toFixed(0)}%`
      );
      return true;
    }
    return false;
  }

  /**
   * Get memory trends
   */
  getMemoryTrends() {
    if (this.memoryHistory.length < 2) {
      return { trend: "stable", change: 0 };
    }

    const recent = this.memoryHistory.slice(-10);
    const older = this.memoryHistory.slice(-20, -10);

    if (recent.length === 0 || older.length === 0) {
      return { trend: "stable", change: 0 };
    }

    const recentAvg =
      recent.reduce((sum, entry) => sum + entry.heapUsed, 0) / recent.length;
    const olderAvg =
      older.reduce((sum, entry) => sum + entry.heapUsed, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    let trend = "stable";
    if (change > 5) trend = "increasing";
    else if (change < -5) trend = "decreasing";

    return { trend, change: change.toFixed(1) };
  }
}

// Export singleton instance
const memoryManager = new MemoryManager();
module.exports = memoryManager;
