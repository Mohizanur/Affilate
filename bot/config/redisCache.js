const Redis = require('redis');
const logger = require("../../utils/logger");

/**
 * 🚀 REDIS DISTRIBUTED CACHE SYSTEM
 * 
 * This system provides distributed caching with Redis for
 * ultra-fast data access across multiple instances.
 */

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000;
    
    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      avgResponseTime: 0,
      totalOperations: 0
    };
    
    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      // Redis configuration
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnClusterDown: 300,
        enableOfflineQueue: false,
        maxLoadingTimeout: 10000
      };

      this.client = Redis.createClient(redisConfig);
      
      // Event handlers
      this.client.on('connect', () => {
        logger.info('🚀 Redis connected successfully');
        this.isConnected = true;
        this.connectionRetries = 0;
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis ready for operations');
      });

      this.client.on('error', (error) => {
        logger.error('❌ Redis error:', error);
        this.isConnected = false;
        this.metrics.errors++;
        this.handleConnectionError();
      });

      this.client.on('end', () => {
        logger.warn('⚠️ Redis connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('🔄 Redis reconnecting...');
      });

      // Connect to Redis
      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      
      logger.info('🚀 Redis Cache System initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.isConnected = false;
      // Fallback to in-memory cache if Redis fails
      this.initializeFallback();
    }
  }

  /**
   * Handle connection errors with retry logic
   */
  async handleConnectionError() {
    if (this.connectionRetries < this.maxRetries) {
      this.connectionRetries++;
      logger.warn(`Retrying Redis connection (${this.connectionRetries}/${this.maxRetries})`);
      
      setTimeout(async () => {
        try {
          await this.client.connect();
        } catch (error) {
          logger.error('Redis reconnection failed:', error);
        }
      }, this.retryDelay * this.connectionRetries);
    } else {
      logger.error('Max Redis connection retries reached, using fallback');
      this.initializeFallback();
    }
  }

  /**
   * Initialize fallback in-memory cache
   */
  initializeFallback() {
    logger.warn('🔄 Initializing fallback in-memory cache');
    this.fallbackCache = new Map();
    this.fallbackTTL = new Map();
    
    // Cleanup expired entries every minute
    setInterval(() => {
      this.cleanupFallbackCache();
    }, 60000);
  }

  /**
   * Clean up expired fallback cache entries
   */
  cleanupFallbackCache() {
    const now = Date.now();
    for (const [key, expiry] of this.fallbackTTL) {
      if (now > expiry) {
        this.fallbackCache.delete(key);
        this.fallbackTTL.delete(key);
      }
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    const startTime = process.hrtime.bigint();
    
    try {
      let result;
      
      if (this.isConnected && this.client) {
        // Use Redis
        result = await this.client.get(key);
        if (result) {
          result = JSON.parse(result);
        }
      } else {
        // Use fallback cache
        const expiry = this.fallbackTTL.get(key);
        if (expiry && Date.now() < expiry) {
          result = this.fallbackCache.get(key);
        } else {
          this.fallbackCache.delete(key);
          this.fallbackTTL.delete(key);
          result = null;
        }
      }
      
      // Update metrics
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateMetrics(result ? 'hit' : 'miss', responseTime);
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = 3600) {
    const startTime = process.hrtime.bigint();
    
    try {
      if (this.isConnected && this.client) {
        // Use Redis
        await this.client.setEx(key, ttl, JSON.stringify(value));
      } else {
        // Use fallback cache
        this.fallbackCache.set(key, value);
        this.fallbackTTL.set(key, Date.now() + (ttl * 1000));
      }
      
      // Update metrics
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateMetrics('set', responseTime);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error setting cache:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key) {
    const startTime = process.hrtime.bigint();
    
    try {
      if (this.isConnected && this.client) {
        // Use Redis
        await this.client.del(key);
      } else {
        // Use fallback cache
        this.fallbackCache.delete(key);
        this.fallbackTTL.delete(key);
      }
      
      // Update metrics
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateMetrics('delete', responseTime);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error deleting from cache:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      if (this.isConnected && this.client) {
        return await this.client.exists(key) > 0;
      } else {
        const expiry = this.fallbackTTL.get(key);
        return expiry && Date.now() < expiry && this.fallbackCache.has(key);
      }
    } catch (error) {
      logger.error('Error checking cache existence:', error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget(keys) {
    const startTime = process.hrtime.bigint();
    
    try {
      let results = [];
      
      if (this.isConnected && this.client) {
        // Use Redis
        const values = await this.client.mGet(keys);
        results = values.map(value => value ? JSON.parse(value) : null);
      } else {
        // Use fallback cache
        results = keys.map(key => {
          const expiry = this.fallbackTTL.get(key);
          if (expiry && Date.now() < expiry) {
            return this.fallbackCache.get(key);
          }
          return null;
        });
      }
      
      // Update metrics
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateMetrics('mget', responseTime);
      
      return results;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error getting multiple keys:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(keyValuePairs, ttl = 3600) {
    const startTime = process.hrtime.bigint();
    
    try {
      if (this.isConnected && this.client) {
        // Use Redis pipeline for better performance
        const pipeline = this.client.multi();
        
        for (const [key, value] of keyValuePairs) {
          pipeline.setEx(key, ttl, JSON.stringify(value));
        }
        
        await pipeline.exec();
      } else {
        // Use fallback cache
        const now = Date.now();
        for (const [key, value] of keyValuePairs) {
          this.fallbackCache.set(key, value);
          this.fallbackTTL.set(key, now + (ttl * 1000));
        }
      }
      
      // Update metrics
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateMetrics('mset', responseTime);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error setting multiple keys:', error);
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key, amount = 1) {
    try {
      if (this.isConnected && this.client) {
        return await this.client.incrBy(key, amount);
      } else {
        const current = this.fallbackCache.get(key) || 0;
        const newValue = current + amount;
        this.fallbackCache.set(key, newValue);
        return newValue;
      }
    } catch (error) {
      logger.error('Error incrementing cache value:', error);
      return null;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key, ttl) {
    try {
      if (this.isConnected && this.client) {
        return await this.client.expire(key, ttl);
      } else {
        this.fallbackTTL.set(key, Date.now() + (ttl * 1000));
        return true;
      }
    } catch (error) {
      logger.error('Error setting expiration:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      let redisStats = {};
      
      if (this.isConnected && this.client) {
        redisStats = await this.client.info('memory');
      }
      
      const hitRate = this.metrics.totalOperations > 0 
        ? (this.metrics.hits / this.metrics.totalOperations * 100).toFixed(2)
        : 0;
      
      return {
        connected: this.isConnected,
        usingFallback: !this.isConnected,
        metrics: {
          ...this.metrics,
          hitRate: `${hitRate}%`,
          avgResponseTime: `${this.metrics.avgResponseTime.toFixed(2)}ms`
        },
        redisStats: redisStats,
        fallbackCacheSize: this.fallbackCache ? this.fallbackCache.size : 0
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        connected: false,
        usingFallback: true,
        error: error.message
      };
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(operation, responseTime) {
    this.metrics.totalOperations++;
    
    if (operation === 'hit') {
      this.metrics.hits++;
    } else if (operation === 'miss') {
      this.metrics.misses++;
    } else if (operation === 'set') {
      this.metrics.sets++;
    } else if (operation === 'delete') {
      this.metrics.deletes++;
    }
    
    // Update average response time
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.totalOperations - 1) + responseTime) / 
      this.metrics.totalOperations;
  }

  /**
   * Clear all cache data
   */
  async flushAll() {
    try {
      if (this.isConnected && this.client) {
        await this.client.flushAll();
      } else {
        this.fallbackCache.clear();
        this.fallbackTTL.clear();
      }
      
      logger.info('🧹 Cache flushed successfully');
      return true;
    } catch (error) {
      logger.error('Error flushing cache:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('🔌 Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (this.isConnected && this.client) {
        await this.client.ping();
        return { status: 'healthy', connected: true };
      } else {
        return { status: 'fallback', connected: false };
      }
    } catch (error) {
      return { status: 'unhealthy', connected: false, error: error.message };
    }
  }
}

// Export singleton instance
const redisCache = new RedisCache();
module.exports = redisCache;


