const logger = require("../../utils/logger");

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      responseTimes: {},
      cacheHits: 0,
      cacheMisses: 0,
      dbQueries: 0,
      errors: 0,
      // BEAST MODE: Additional metrics for maximum performance tracking
      telegramApiCalls: 0,
      telegramApiErrors: 0,
      concurrentRequests: 0,
      maxConcurrentRequests: 0,
      memoryUsage: [],
      cpuUsage: [],
    };

    this.startTime = Date.now();
    this.requestCount = 0;

    // Track concurrent requests
    this.activeRequests = new Set();

    // EMERGENCY: Disable memory monitoring to stop quota leak
    // setInterval(() => {
    //   const memUsage = process.memoryUsage();
    //   this.metrics.memoryUsage.push({
    //     timestamp: Date.now(),
    //     heapUsed: memUsage.heapUsed,
    //     heapTotal: memUsage.heapTotal,
    //     external: memUsage.external,
    //     rss: memUsage.rss,
    //   });

    //   // Keep only last 100 memory readings
    //   if (this.metrics.memoryUsage.length > 100) {
    //     this.metrics.memoryUsage.shift();
    //   }
    // }, 300000); // DISABLED to stop quota leak
  }

  // Track function execution time
  async trackExecution(name, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordResponseTime(name, duration);
      return result;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  // Record response time for a specific operation
  recordResponseTime(operation, duration) {
    if (!this.metrics.responseTimes[operation]) {
      this.metrics.responseTimes[operation] = {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0,
      };
    }

    const stats = this.metrics.responseTimes[operation];
    stats.count++;
    stats.totalTime += duration;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.avgTime = stats.totalTime / stats.count;
  }

  // Record cache hit/miss
  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  // Record database query
  recordDbQuery() {
    this.metrics.dbQueries++;
  }
  recordError() {
    this.metrics.errors++;
  }

  // BEAST MODE: Additional tracking methods
  recordTelegramApiCall() {
    this.metrics.telegramApiCalls++;
  }
  recordTelegramApiError() {
    this.metrics.telegramApiErrors++;
  }

  startRequest() {
    this.requestCount++;
    this.activeRequests.add(this.requestCount);
    this.metrics.concurrentRequests = this.activeRequests.size;
    if (this.metrics.concurrentRequests > this.metrics.maxConcurrentRequests) {
      this.metrics.maxConcurrentRequests = this.metrics.concurrentRequests;
    }
  }

  endRequest(requestId) {
    this.activeRequests.delete(requestId);
    this.metrics.concurrentRequests = this.activeRequests.size;
  }

  // Get performance statistics
  getStats() {
    const uptime = Date.now() - this.startTime;
    const avgResponseTimes = {};

    for (const [operation, times] of Object.entries(
      this.metrics.responseTimes
    )) {
      if (times.length > 0) {
        avgResponseTimes[operation] =
          times.reduce((a, b) => a + b, 0) / times.length;
      }
    }

    // BEAST MODE: Enhanced stats with new metrics
    const cacheHitRate =
      this.metrics.cacheHits + this.metrics.cacheMisses > 0
        ? (
            (this.metrics.cacheHits /
              (this.metrics.cacheHits + this.metrics.cacheMisses)) *
            100
          ).toFixed(2)
        : 0;

    const telegramApiSuccessRate =
      this.metrics.telegramApiCalls > 0
        ? (
            ((this.metrics.telegramApiCalls - this.metrics.telegramApiErrors) /
              this.metrics.telegramApiCalls) *
            100
          ).toFixed(2)
        : 0;

    const currentMemory =
      this.metrics.memoryUsage.length > 0
        ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
        : null;

    return {
      uptime: Math.floor(uptime / 1000),
      avgResponseTimes,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      cacheHitRate: `${cacheHitRate}%`,
      dbQueries: this.metrics.dbQueries,
      errors: this.metrics.errors,
      // BEAST MODE: New metrics
      telegramApiCalls: this.metrics.telegramApiCalls,
      telegramApiErrors: this.metrics.telegramApiErrors,
      telegramApiSuccessRate: `${telegramApiSuccessRate}%`,
      concurrentRequests: this.metrics.concurrentRequests,
      maxConcurrentRequests: this.metrics.maxConcurrentRequests,
      currentMemory: currentMemory
        ? {
            heapUsed: Math.round(currentMemory.heapUsed / 1024 / 1024) + "MB",
            heapTotal: Math.round(currentMemory.heapTotal / 1024 / 1024) + "MB",
            external: Math.round(currentMemory.external / 1024 / 1024) + "MB",
            rss: Math.round(currentMemory.rss / 1024 / 1024) + "MB",
          }
        : null,
    };
  }

  // Log performance report
  logPerformanceReport() {
    try {
      const stats = this.getStats();
      logger.info("Performance Report:", {
        uptime: `${stats.uptime}s`,
        cacheHitRate: stats.cacheHitRate,
        dbQueries: stats.dbQueries,
        errors: stats.errors,
        avgResponseTimes: stats.avgResponseTimes,
      });
    } catch (error) {
      logger.error("Error generating performance report:", error);
    }
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();

// Log performance every 5 minutes
setInterval(() => {
  performanceMonitor.logPerformanceReport();
}, 5 * 60 * 1000);

module.exports = performanceMonitor;
