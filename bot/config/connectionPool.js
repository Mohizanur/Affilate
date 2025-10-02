const logger = require("../../utils/logger");

/**
 * 🚀 ULTRA-FAST CONNECTION POOL SYSTEM
 * 
 * This system provides advanced connection pooling for database operations
 * with intelligent load balancing, connection reuse, and automatic scaling.
 */

class ConnectionPool {
  constructor() {
    this.pools = new Map();
    this.connectionMetrics = new Map();
    this.healthCheckInterval = null;
    this.cleanupInterval = null;
    this.isInitialized = false;
    
    // Performance metrics
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      queuedRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      peakConnections: 0
    };
    
    this.initialize();
  }

  /**
   * Initialize connection pools
   */
  initialize() {
    // Initialize pools for different operations
    this.createPool('users', {
      min: 5,
      max: 50,
      idleTimeout: 30000,
      acquireTimeout: 5000,
      retryAttempts: 3
    });
    
    this.createPool('companies', {
      min: 3,
      max: 30,
      idleTimeout: 30000,
      acquireTimeout: 5000,
      retryAttempts: 3
    });
    
    this.createPool('referrals', {
      min: 5,
      max: 40,
      idleTimeout: 30000,
      acquireTimeout: 5000,
      retryAttempts: 3
    });
    
    this.createPool('analytics', {
      min: 2,
      max: 20,
      idleTimeout: 30000,
      acquireTimeout: 5000,
      retryAttempts: 3
    });
    
    // Start health checks and cleanup
    this.startHealthChecks();
    this.startCleanup();
    
    this.isInitialized = true;
    logger.info("🚀 Connection Pool System initialized");
  }

  /**
   * Create a connection pool
   */
  createPool(name, config) {
    const pool = {
      name,
      config,
      connections: new Set(),
      idleConnections: new Set(),
      activeConnections: new Set(),
      requestQueue: [],
      metrics: {
        totalCreated: 0,
        totalDestroyed: 0,
        totalAcquired: 0,
        totalReleased: 0,
        currentActive: 0,
        currentIdle: 0,
        queuedRequests: 0,
        avgAcquireTime: 0,
        avgResponseTime: 0
      },
      health: {
        status: 'healthy',
        lastHealthCheck: Date.now(),
        consecutiveFailures: 0
      }
    };
    
    this.pools.set(name, pool);
    this.connectionMetrics.set(name, []);
    
    // Pre-create minimum connections
    this.preCreateConnections(name);
  }

  /**
   * Pre-create minimum connections
   */
  async preCreateConnections(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) return;
    
    for (let i = 0; i < pool.config.min; i++) {
      try {
        const connection = await this.createConnection(poolName);
        pool.idleConnections.add(connection);
        pool.metrics.totalCreated++;
      } catch (error) {
        logger.error(`Failed to pre-create connection for pool ${poolName}:`, error);
      }
    }
  }

  /**
   * Create a new connection
   */
  async createConnection(poolName) {
    const connection = {
      id: `${poolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      poolName,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isHealthy: true,
      operationCount: 0
    };
    
    // Initialize connection based on pool type
    switch (poolName) {
      case 'users':
        connection.db = await this.initializeUserConnection();
        break;
      case 'companies':
        connection.db = await this.initializeCompanyConnection();
        break;
      case 'referrals':
        connection.db = await this.initializeReferralConnection();
        break;
      case 'analytics':
        connection.db = await this.initializeAnalyticsConnection();
        break;
      default:
        throw new Error(`Unknown pool type: ${poolName}`);
    }
    
    return connection;
  }

  /**
   * Initialize user connection
   */
  async initializeUserConnection() {
    const databaseService = require("./database");
    return {
      collection: databaseService.users(),
      query: (id) => databaseService.users().doc(id),
      batch: () => databaseService.batch()
    };
  }

  /**
   * Initialize company connection
   */
  async initializeCompanyConnection() {
    const databaseService = require("./database");
    return {
      collection: databaseService.companies(),
      query: (id) => databaseService.companies().doc(id),
      batch: () => databaseService.batch()
    };
  }

  /**
   * Initialize referral connection
   */
  async initializeReferralConnection() {
    const databaseService = require("./database");
    return {
      collection: databaseService.referrals(),
      query: (id) => databaseService.referrals().doc(id),
      batch: () => databaseService.batch()
    };
  }

  /**
   * Initialize analytics connection
   */
  async initializeAnalyticsConnection() {
    const databaseService = require("./database");
    return {
      collection: databaseService.analytics(),
      query: (id) => databaseService.analytics().doc(id),
      batch: () => databaseService.batch()
    };
  }

  /**
   * Acquire connection from pool
   */
  async acquireConnection(poolName) {
    const startTime = process.hrtime.bigint();
    const pool = this.pools.get(poolName);
    
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    try {
      // Try to get idle connection first
      if (pool.idleConnections.size > 0) {
        const connection = pool.idleConnections.values().next().value;
        pool.idleConnections.delete(connection);
        pool.activeConnections.add(connection);
        pool.metrics.currentActive++;
        pool.metrics.currentIdle--;
        pool.metrics.totalAcquired++;
        
        // Update connection metrics
        const acquireTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        this.updateAcquireTime(poolName, acquireTime);
        
        return connection;
      }
      
      // Create new connection if under limit
      if (pool.activeConnections.size < pool.config.max) {
        const connection = await this.createConnection(poolName);
        pool.activeConnections.add(connection);
        pool.metrics.totalCreated++;
        pool.metrics.currentActive++;
        pool.metrics.totalAcquired++;
        
        // Update connection metrics
        const acquireTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        this.updateAcquireTime(poolName, acquireTime);
        
        return connection;
      }
      
      // Queue request if pool is full
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pool.metrics.queuedRequests--;
          reject(new Error(`Connection acquire timeout for pool ${poolName}`));
        }, pool.config.acquireTimeout);
        
        pool.requestQueue.push({
          resolve: (connection) => {
            clearTimeout(timeout);
            pool.metrics.queuedRequests--;
            resolve(connection);
          },
          reject: (error) => {
            clearTimeout(timeout);
            pool.metrics.queuedRequests--;
            reject(error);
          },
          timestamp: Date.now()
        });
        
        pool.metrics.queuedRequests++;
      });
      
    } catch (error) {
      logger.error(`Error acquiring connection from pool ${poolName}:`, error);
      throw error;
    }
  }

  /**
   * Release connection back to pool
   */
  async releaseConnection(connection) {
    const pool = this.pools.get(connection.poolName);
    if (!pool) return;
    
    try {
      // Remove from active connections
      pool.activeConnections.delete(connection);
      pool.metrics.currentActive--;
      
      // Check if connection is still healthy
      if (connection.isHealthy && this.isConnectionHealthy(connection)) {
        // Return to idle pool
        pool.idleConnections.add(connection);
        pool.metrics.currentIdle++;
        connection.lastUsed = Date.now();
      } else {
        // Destroy unhealthy connection
        await this.destroyConnection(connection);
      }
      
      pool.metrics.totalReleased++;
      
      // Process queued requests
      this.processQueuedRequests(pool);
      
    } catch (error) {
      logger.error(`Error releasing connection:`, error);
    }
  }

  /**
   * Execute operation with connection
   */
  async executeWithConnection(poolName, operation) {
    const startTime = process.hrtime.bigint();
    let connection = null;
    
    try {
      connection = await this.acquireConnection(poolName);
      const result = await operation(connection);
      
      // Update metrics
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateResponseTime(poolName, responseTime);
      this.metrics.completedRequests++;
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      logger.error(`Error executing operation with connection:`, error);
      throw error;
    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  /**
   * Process queued requests
   */
  processQueuedRequests(pool) {
    while (pool.requestQueue.length > 0 && 
           (pool.idleConnections.size > 0 || pool.activeConnections.size < pool.config.max)) {
      
      const request = pool.requestQueue.shift();
      
      // Try to acquire connection for queued request
      this.acquireConnection(pool.name)
        .then(connection => request.resolve(connection))
        .catch(error => request.reject(error));
    }
  }

  /**
   * Check if connection is healthy
   */
  isConnectionHealthy(connection) {
    const now = Date.now();
    const age = now - connection.createdAt;
    const idleTime = now - connection.lastUsed;
    
    // Connection is unhealthy if:
    // - Too old (1 hour)
    // - Idle too long (30 minutes)
    // - Too many operations (1000)
    return age < 3600000 && 
           idleTime < 1800000 && 
           connection.operationCount < 1000;
  }

  /**
   * Destroy connection
   */
  async destroyConnection(connection) {
    const pool = this.pools.get(connection.poolName);
    if (pool) {
      pool.metrics.totalDestroyed++;
    }
    
    // Clean up connection resources
    if (connection.db && typeof connection.db.close === 'function') {
      try {
        await connection.db.close();
      } catch (error) {
        logger.error(`Error closing connection:`, error);
      }
    }
  }

  /**
   * Start health checks
   */
  startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health checks on all pools
   */
  async performHealthChecks() {
    for (const [poolName, pool] of this.pools) {
      try {
        await this.checkPoolHealth(pool);
      } catch (error) {
        logger.error(`Health check failed for pool ${poolName}:`, error);
      }
    }
  }

  /**
   * Check individual pool health
   */
  async checkPoolHealth(pool) {
    const healthyConnections = new Set();
    const unhealthyConnections = new Set();
    
    // Check all connections
    for (const connection of pool.activeConnections) {
      if (this.isConnectionHealthy(connection)) {
        healthyConnections.add(connection);
      } else {
        unhealthyConnections.add(connection);
      }
    }
    
    for (const connection of pool.idleConnections) {
      if (this.isConnectionHealthy(connection)) {
        healthyConnections.add(connection);
      } else {
        unhealthyConnections.add(connection);
      }
    }
    
    // Destroy unhealthy connections
    for (const connection of unhealthyConnections) {
      await this.destroyConnection(connection);
      pool.activeConnections.delete(connection);
      pool.idleConnections.delete(connection);
    }
    
    // Update pool health status
    if (unhealthyConnections.size > 0) {
      pool.health.consecutiveFailures++;
      if (pool.health.consecutiveFailures > 3) {
        pool.health.status = 'unhealthy';
      }
    } else {
      pool.health.consecutiveFailures = 0;
      pool.health.status = 'healthy';
    }
    
    pool.health.lastHealthCheck = Date.now();
  }

  /**
   * Start cleanup process
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }

  /**
   * Perform cleanup operations
   */
  performCleanup() {
    // Clean up old metrics
    for (const [poolName, metrics] of this.connectionMetrics) {
      if (metrics.length > 1000) {
        this.connectionMetrics.set(poolName, metrics.slice(-500));
      }
    }
    
    // Update global metrics
    this.updateGlobalMetrics();
  }

  /**
   * Update global metrics
   */
  updateGlobalMetrics() {
    let totalActive = 0;
    let totalQueued = 0;
    
    for (const pool of this.pools.values()) {
      totalActive += pool.metrics.currentActive;
      totalQueued += pool.metrics.queuedRequests;
    }
    
    this.metrics.activeConnections = totalActive;
    this.metrics.queuedRequests = totalQueued;
    this.metrics.peakConnections = Math.max(this.metrics.peakConnections, totalActive);
  }

  /**
   * Update acquire time metrics
   */
  updateAcquireTime(poolName, time) {
    const pool = this.pools.get(poolName);
    if (pool) {
      const current = pool.metrics.avgAcquireTime;
      const count = pool.metrics.totalAcquired;
      pool.metrics.avgAcquireTime = (current * (count - 1) + time) / count;
    }
  }

  /**
   * Update response time metrics
   */
  updateResponseTime(poolName, time) {
    const pool = this.pools.get(poolName);
    if (pool) {
      const current = pool.metrics.avgResponseTime;
      const count = pool.metrics.totalAcquired;
      pool.metrics.avgResponseTime = (current * (count - 1) + time) / count;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    const stats = {};
    
    for (const [poolName, pool] of this.pools) {
      stats[poolName] = {
        config: pool.config,
        metrics: { ...pool.metrics },
        health: { ...pool.health },
        connections: {
          active: pool.activeConnections.size,
          idle: pool.idleConnections.size,
          total: pool.activeConnections.size + pool.idleConnections.size
        },
        queue: {
          length: pool.requestQueue.length
        }
      };
    }
    
    return stats;
  }

  /**
   * Get global statistics
   */
  getGlobalStats() {
    return {
      ...this.metrics,
      pools: Object.keys(this.pools).length,
      totalConnections: Array.from(this.pools.values())
        .reduce((sum, pool) => sum + pool.metrics.currentActive + pool.metrics.currentIdle, 0)
    };
  }

  /**
   * Emergency cleanup
   */
  emergencyCleanup() {
    logger.warn("🚨 Emergency connection pool cleanup");
    
    // Clear all intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Destroy all connections
    for (const pool of this.pools.values()) {
      for (const connection of pool.activeConnections) {
        this.destroyConnection(connection);
      }
      for (const connection of pool.idleConnections) {
        this.destroyConnection(connection);
      }
      pool.activeConnections.clear();
      pool.idleConnections.clear();
      pool.requestQueue = [];
    }
    
    logger.info("🧹 Emergency connection pool cleanup completed");
  }
}

// Export singleton instance
const connectionPool = new ConnectionPool();
module.exports = connectionPool;


