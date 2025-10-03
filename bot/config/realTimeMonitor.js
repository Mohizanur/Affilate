const logger = require("../../utils/logger");

/**
 * 🚀 REAL-TIME PERFORMANCE MONITORING SYSTEM
 * 
 * This system provides real-time monitoring of bot performance with
 * microsecond-level precision and intelligent alerting.
 */

class RealTimeMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        perSecond: 0,
        perMinute: 0,
        perHour: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity,
        errorRate: 0,
        successRate: 0
      },
      performance: {
        cpuUsage: 0,
        memoryUsage: 0,
        memoryTrend: 'stable',
        gcFrequency: 0,
        eventLoopLag: 0,
        activeHandles: 0,
        activeRequests: 0
      },
      database: {
        queries: 0,
        avgQueryTime: 0,
        cacheHitRate: 0,
        connectionPoolUsage: 0,
        quotaUsage: 0
      },
      telegram: {
        apiCalls: 0,
        apiErrors: 0,
        rateLimitHits: 0,
        avgApiResponseTime: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        evictions: 0
      }
    };
    
    this.alerts = [];
    this.thresholds = {
      responseTime: 1000, // 1 second
      errorRate: 0.05, // 5%
      memoryUsage: 0.60, // 60% (minimal for free tier)
      cpuUsage: 0.80, // 80%
      cacheHitRate: 0.70 // 70%
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.alertInterval = null;
    this.startTime = Date.now();
    
    this.initialize();
  }

  /**
   * Initialize the monitoring system
   */
  initialize() {
    this.startMonitoring();
    this.startAlerting();
    this.setupEventListeners();
    logger.info("🚀 Real-Time Performance Monitor initialized");
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Monitor every 100ms for real-time data
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 100);
    
    logger.info("📊 Real-time monitoring started");
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.info("📊 Real-time monitoring stopped");
  }

  /**
   * Start alerting system
   */
  startAlerting() {
    // Check for alerts every 5 seconds
    this.alertInterval = setInterval(() => {
      this.checkAlerts();
    }, 5000);
  }

  /**
   * Setup event listeners for performance tracking
   */
  setupEventListeners() {
    // Track process events
    process.on('uncaughtException', (error) => {
      this.recordError('uncaughtException', error);
    });
    
    process.on('unhandledRejection', (reason) => {
      this.recordError('unhandledRejection', reason);
    });
    
    // Track memory usage
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        this.recordError('maxListenersExceeded', warning);
      }
    });
  }

  /**
   * Collect real-time metrics
   */
  collectMetrics() {
    try {
      // Collect system metrics
      this.collectSystemMetrics();
      
      // Collect performance metrics
      this.collectPerformanceMetrics();
      
      // Collect database metrics
      this.collectDatabaseMetrics();
      
      // Collect cache metrics
      this.collectCacheMetrics();
      
      // Update calculated metrics
      this.updateCalculatedMetrics();
      
    } catch (error) {
      logger.error("Error collecting metrics:", error);
    }
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.performance.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
    this.metrics.performance.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    
    // Track memory trend
    this.trackMemoryTrend(memUsage.heapUsed);
    
    // Track event loop lag
    this.trackEventLoopLag();
  }

  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics() {
    // Get active handles and requests
    const handles = process._getActiveHandles();
    const requests = process._getActiveRequests();
    
    this.metrics.performance.activeHandles = handles.length;
    this.metrics.performance.activeRequests = requests.length;
    
    // Track garbage collection
    this.trackGarbageCollection();
  }

  /**
   * Collect database metrics
   */
  collectDatabaseMetrics() {
    try {
      // Get database metrics from connection pool
      const connectionPool = require("./connectionPool");
      const poolStats = connectionPool.getGlobalStats();
      
      this.metrics.database.connectionPoolUsage = 
        poolStats.activeConnections / (poolStats.totalConnections || 1);
      
      // Get quota metrics
      const quotaProtector = require("./quotaProtector");
      const quotaStatus = quotaProtector.getQuotaStatus();
      
      this.metrics.database.quotaUsage = Math.max(
        parseFloat(quotaStatus.reads.percentage) / 100,
        parseFloat(quotaStatus.writes.percentage) / 100
      );
      
    } catch (error) {
      // Database metrics not available
    }
  }

  /**
   * Collect cache metrics
   */
  collectCacheMetrics() {
    try {
      const cacheService = require("./cache");
      const cacheHealth = cacheService.getCacheHealth();
      
      this.metrics.cache.hits = cacheHealth.userCache.hitRate || 0;
      this.metrics.cache.misses = 100 - (cacheHealth.userCache.hitRate || 0);
      this.metrics.cache.hitRate = (cacheHealth.userCache.hitRate || 0) / 100;
      this.metrics.cache.size = cacheHealth.userCache.keys || 0;
      
    } catch (error) {
      // Cache metrics not available
    }
  }

  /**
   * Track memory trend
   */
  trackMemoryTrend(currentMemory) {
    if (!this.memoryHistory) {
      this.memoryHistory = [];
    }
    
    this.memoryHistory.push({
      timestamp: Date.now(),
      memory: currentMemory
    });
    
    // Keep only last 100 readings
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift();
    }
    
    // Calculate trend
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10);
      const older = this.memoryHistory.slice(-20, -10);
      
      if (older.length > 0) {
        const recentAvg = recent.reduce((sum, entry) => sum + entry.memory, 0) / recent.length;
        const olderAvg = older.reduce((sum, entry) => sum + entry.memory, 0) / older.length;
        
        const change = (recentAvg - olderAvg) / olderAvg;
        
        if (change > 0.05) {
          this.metrics.performance.memoryTrend = 'increasing';
        } else if (change < -0.05) {
          this.metrics.performance.memoryTrend = 'decreasing';
        } else {
          this.metrics.performance.memoryTrend = 'stable';
        }
      }
    }
  }

  /**
   * Track event loop lag
   */
  trackEventLoopLag() {
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      this.metrics.performance.eventLoopLag = lag;
    });
  }

  /**
   * Track garbage collection
   */
  trackGarbageCollection() {
    if (global.gc) {
      // Monitor GC frequency
      if (!this.gcHistory) {
        this.gcHistory = [];
      }
      
      // This is a simplified approach - in production you'd use more sophisticated GC monitoring
      this.metrics.performance.gcFrequency = this.gcHistory.length;
    }
  }

  /**
   * Update calculated metrics
   */
  updateCalculatedMetrics() {
    const uptime = Date.now() - this.startTime;
    
    // Calculate rates
    this.metrics.requests.perSecond = this.metrics.requests.total / (uptime / 1000);
    this.metrics.requests.perMinute = this.metrics.requests.total / (uptime / 60000);
    this.metrics.requests.perHour = this.metrics.requests.total / (uptime / 3600000);
    
    // Calculate success/error rates
    if (this.metrics.requests.total > 0) {
      this.metrics.requests.errorRate = this.metrics.requests.errors / this.metrics.requests.total;
      this.metrics.requests.successRate = 1 - this.metrics.requests.errorRate;
    }
  }

  /**
   * Record a request
   */
  recordRequest(responseTime, success = true) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successes = (this.metrics.requests.successes || 0) + 1;
    } else {
      this.metrics.requests.errors = (this.metrics.requests.errors || 0) + 1;
    }
    
    // Update response time metrics
    this.metrics.requests.avgResponseTime = 
      (this.metrics.requests.avgResponseTime * (this.metrics.requests.total - 1) + responseTime) / 
      this.metrics.requests.total;
    
    this.metrics.requests.maxResponseTime = Math.max(this.metrics.requests.maxResponseTime, responseTime);
    this.metrics.requests.minResponseTime = Math.min(this.metrics.requests.minResponseTime, responseTime);
  }

  /**
   * Record an error
   */
  recordError(type, error) {
    this.metrics.requests.errors = (this.metrics.requests.errors || 0) + 1;
    
    // Log error for monitoring
    logger.error(`Monitor recorded error [${type}]:`, error);
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(queryTime, success = true) {
    this.metrics.database.queries++;
    
    this.metrics.database.avgQueryTime = 
      (this.metrics.database.avgQueryTime * (this.metrics.database.queries - 1) + queryTime) / 
      this.metrics.database.queries;
  }

  /**
   * Record Telegram API call
   */
  recordTelegramApiCall(responseTime, success = true) {
    this.metrics.telegram.apiCalls++;
    
    if (!success) {
      this.metrics.telegram.apiErrors++;
    }
    
    this.metrics.telegram.avgApiResponseTime = 
      (this.metrics.telegram.avgApiResponseTime * (this.metrics.telegram.apiCalls - 1) + responseTime) / 
      this.metrics.telegram.apiCalls;
  }

  /**
   * Check for alerts
   */
  checkAlerts() {
    const alerts = [];
    
    // Check response time
    if (this.metrics.requests.avgResponseTime > this.thresholds.responseTime) {
      alerts.push({
        type: 'responseTime',
        severity: 'warning',
        message: `Average response time ${this.metrics.requests.avgResponseTime.toFixed(2)}ms exceeds threshold ${this.thresholds.responseTime}ms`,
        value: this.metrics.requests.avgResponseTime,
        threshold: this.thresholds.responseTime
      });
    }
    
    // Check error rate
    if (this.metrics.requests.errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'errorRate',
        severity: 'critical',
        message: `Error rate ${(this.metrics.requests.errorRate * 100).toFixed(2)}% exceeds threshold ${(this.thresholds.errorRate * 100)}%`,
        value: this.metrics.requests.errorRate,
        threshold: this.thresholds.errorRate
      });
    }
    
    // Check memory usage
    if (this.metrics.performance.memoryUsage > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'memoryUsage',
        severity: 'warning',
        message: `Memory usage ${(this.metrics.performance.memoryUsage * 100).toFixed(2)}% exceeds threshold ${(this.thresholds.memoryUsage * 100)}%`,
        value: this.metrics.performance.memoryUsage,
        threshold: this.thresholds.memoryUsage
      });
    }
    
    // Check cache hit rate
    if (this.metrics.cache.hitRate < this.thresholds.cacheHitRate) {
      alerts.push({
        type: 'cacheHitRate',
        severity: 'warning',
        message: `Cache hit rate ${(this.metrics.cache.hitRate * 100).toFixed(2)}% below threshold ${(this.thresholds.cacheHitRate * 100)}%`,
        value: this.metrics.cache.hitRate,
        threshold: this.thresholds.cacheHitRate
      });
    }
    
    // Process new alerts
    alerts.forEach(alert => {
      if (!this.hasRecentAlert(alert.type)) {
        this.alerts.push({
          ...alert,
          timestamp: Date.now(),
          id: `${alert.type}_${Date.now()}`
        });
        
        this.handleAlert(alert);
      }
    });
    
    // Clean up old alerts
    this.cleanupAlerts();
  }

  /**
   * Check if we have a recent alert of this type
   */
  hasRecentAlert(type) {
    const recentTime = Date.now() - 60000; // 1 minute
    return this.alerts.some(alert => 
      alert.type === type && alert.timestamp > recentTime
    );
  }

  /**
   * Handle alert
   */
  handleAlert(alert) {
    logger.warn(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    // Send notification to admins if critical
    if (alert.severity === 'critical') {
      this.sendCriticalAlert(alert);
    }
  }

  /**
   * Send critical alert to admins
   */
  sendCriticalAlert(alert) {
    try {
      const notificationService = require("../services/notificationService");
      const getNotificationServiceInstance = notificationService.getNotificationServiceInstance;
      
      if (getNotificationServiceInstance) {
        const service = getNotificationServiceInstance();
        if (service && service.sendAdminNotification) {
          service.sendAdminNotification(
            `🚨 CRITICAL ALERT: ${alert.message}`,
            { type: 'critical_alert', alert }
          );
        }
      }
    } catch (error) {
      logger.error("Failed to send critical alert:", error);
    }
  }

  /**
   * Clean up old alerts
   */
  cleanupAlerts() {
    const cutoffTime = Date.now() - 3600000; // 1 hour
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoffTime);
  }

  /**
   * Get real-time metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      alerts: this.alerts.slice(-10), // Last 10 alerts
      thresholds: this.thresholds,
      monitoring: {
        isActive: this.isMonitoring,
        startTime: this.startTime
      }
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const metrics = this.getMetrics();
    
    return {
      status: this.getOverallStatus(),
      responseTime: `${metrics.requests.avgResponseTime.toFixed(2)}ms`,
      errorRate: `${(metrics.requests.errorRate * 100).toFixed(2)}%`,
      memoryUsage: `${(metrics.performance.memoryUsage * 100).toFixed(2)}%`,
      cacheHitRate: `${(metrics.cache.hitRate * 100).toFixed(2)}%`,
      requestsPerSecond: metrics.requests.perSecond.toFixed(2),
      activeAlerts: metrics.alerts.length,
      uptime: Math.floor(metrics.uptime / 1000)
    };
  }

  /**
   * Get overall system status
   */
  getOverallStatus() {
    const criticalAlerts = this.alerts.filter(alert => alert.severity === 'critical');
    const warningAlerts = this.alerts.filter(alert => alert.severity === 'warning');
    
    if (criticalAlerts.length > 0) {
      return 'critical';
    } else if (warningAlerts.length > 2) {
      return 'warning';
    } else if (this.metrics.requests.errorRate > 0.01) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info("📊 Monitoring thresholds updated:", newThresholds);
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        perSecond: 0,
        perMinute: 0,
        perHour: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity,
        errorRate: 0,
        successRate: 0
      },
      performance: {
        cpuUsage: 0,
        memoryUsage: 0,
        memoryTrend: 'stable',
        gcFrequency: 0,
        eventLoopLag: 0,
        activeHandles: 0,
        activeRequests: 0
      },
      database: {
        queries: 0,
        avgQueryTime: 0,
        cacheHitRate: 0,
        connectionPoolUsage: 0,
        quotaUsage: 0
      },
      telegram: {
        apiCalls: 0,
        apiErrors: 0,
        rateLimitHits: 0,
        avgApiResponseTime: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        evictions: 0
      }
    };
    
    this.startTime = Date.now();
    this.alerts = [];
    
    logger.info("📊 Metrics reset");
  }
}

// Export singleton instance
const realTimeMonitor = new RealTimeMonitor();
module.exports = realTimeMonitor;


