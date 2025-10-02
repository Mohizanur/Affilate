const logger = require("../../utils/logger");

/**
 * 🚀 ULTRA-FAST MIDDLEWARE SYSTEM
 * 
 * This middleware system provides microsecond-level request processing
 * with intelligent caching, request deduplication, and parallel processing.
 */

class UltraFastMiddleware {
  constructor() {
    this.requestCache = new Map();
    this.requestDeduplication = new Map();
    this.parallelProcessors = new Map();
    this.middlewareStack = [];
    this.performanceMetrics = {
      totalRequests: 0,
      cachedResponses: 0,
      deduplicatedRequests: 0,
      avgProcessingTime: 0,
      middlewareExecutionTimes: new Map()
    };
    
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize the middleware system
   */
  initialize() {
    // Register core middleware
    this.registerMiddleware('requestDeduplication', this.requestDeduplicationMiddleware.bind(this), 1);
    this.registerMiddleware('responseCache', this.responseCacheMiddleware.bind(this), 2);
    this.registerMiddleware('parallelProcessing', this.parallelProcessingMiddleware.bind(this), 3);
    this.registerMiddleware('performanceTracking', this.performanceTrackingMiddleware.bind(this), 4);
    
    this.isInitialized = true;
    logger.info("🚀 Ultra-Fast Middleware System initialized");
  }

  /**
   * Register middleware with priority
   */
  registerMiddleware(name, middleware, priority = 5) {
    this.middlewareStack.push({ name, middleware, priority });
    this.middlewareStack.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Process request through middleware stack
   */
  async processRequest(ctx, next) {
    const startTime = process.hrtime.bigint();
    const requestId = this.generateRequestId(ctx);
    
    try {
      // Execute middleware stack
      for (const { name, middleware } of this.middlewareStack) {
        const middlewareStart = process.hrtime.bigint();
        
        const result = await middleware(ctx, next);
        if (result === false) {
          // Middleware blocked the request
          return;
        }
        
        const middlewareEnd = process.hrtime.bigint();
        const executionTime = Number(middlewareEnd - middlewareStart) / 1000000;
        
        // Track middleware performance
        if (!this.performanceMetrics.middlewareExecutionTimes.has(name)) {
          this.performanceMetrics.middlewareExecutionTimes.set(name, []);
        }
        this.performanceMetrics.middlewareExecutionTimes.get(name).push(executionTime);
        
        // Keep only last 100 execution times
        const times = this.performanceMetrics.middlewareExecutionTimes.get(name);
        if (times.length > 100) {
          times.shift();
        }
      }
      
      // Continue to next middleware or handler
      if (next) {
        await next();
      }
      
    } catch (error) {
      logger.error(`Error in middleware processing for request ${requestId}:`, error);
      throw error;
    } finally {
      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;
      
      this.performanceMetrics.totalRequests++;
      this.performanceMetrics.avgProcessingTime = 
        (this.performanceMetrics.avgProcessingTime * (this.performanceMetrics.totalRequests - 1) + totalTime) / 
        this.performanceMetrics.totalRequests;
    }
  }

  /**
   * Request deduplication middleware
   */
  async requestDeduplicationMiddleware(ctx, next) {
    const requestKey = this.generateRequestKey(ctx);
    const now = Date.now();
    
    // Check if identical request is already being processed
    if (this.requestDeduplication.has(requestKey)) {
      const existingRequest = this.requestDeduplication.get(requestKey);
      
      // If request is still being processed (within 5 seconds), wait for it
      if (now - existingRequest.startTime < 5000) {
        this.performanceMetrics.deduplicatedRequests++;
        
        // Wait for the existing request to complete
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!this.requestDeduplication.has(requestKey) || 
                this.requestDeduplication.get(requestKey).completed) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 10); // Check every 10ms
        });
      }
    }
    
    // Mark request as being processed
    this.requestDeduplication.set(requestKey, {
      startTime: now,
      completed: false
    });
    
    try {
      await next();
    } finally {
      // Mark request as completed
      const request = this.requestDeduplication.get(requestKey);
      if (request) {
        request.completed = true;
        // Remove after 1 second to allow other requests to see completion
        setTimeout(() => {
          this.requestDeduplication.delete(requestKey);
        }, 1000);
      }
    }
  }

  /**
   * Response cache middleware
   */
  async responseCacheMiddleware(ctx, next) {
    const cacheKey = this.generateCacheKey(ctx);
    const now = Date.now();
    
    // Check cache first
    if (this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey);
      
      // Use cached response if still valid (within 30 seconds)
      if (now - cached.timestamp < 30000) {
        this.performanceMetrics.cachedResponses++;
        
        // Apply cached response
        if (cached.response) {
          ctx.reply(cached.response.text, cached.response.options);
        }
        return false; // Block further processing
      } else {
        // Remove expired cache entry
        this.requestCache.delete(cacheKey);
      }
    }
    
    // Store original reply method
    const originalReply = ctx.reply.bind(ctx);
    let responseData = null;
    
    // Override reply method to capture response
    ctx.reply = (text, options = {}) => {
      responseData = { text, options, timestamp: now };
      return originalReply(text, options);
    };
    
    try {
      await next();
      
      // Cache the response if we captured one
      if (responseData) {
        this.requestCache.set(cacheKey, {
          response: responseData,
          timestamp: now
        });
        
        // Limit cache size
        if (this.requestCache.size > 10000) {
          const oldestKey = this.requestCache.keys().next().value;
          this.requestCache.delete(oldestKey);
        }
      }
    } finally {
      // Restore original reply method
      ctx.reply = originalReply;
    }
  }

  /**
   * Parallel processing middleware
   */
  async parallelProcessingMiddleware(ctx, next) {
    const requestType = this.getRequestType(ctx);
    
    // Check if we can process this request in parallel
    if (this.canProcessInParallel(requestType)) {
      const processor = this.parallelProcessors.get(requestType);
      if (processor) {
        // Process in parallel
        const parallelResult = await processor.process(ctx);
        if (parallelResult) {
          return false; // Block further processing
        }
      }
    }
    
    await next();
  }

  /**
   * Performance tracking middleware
   */
  async performanceTrackingMiddleware(ctx, next) {
    const startTime = process.hrtime.bigint();
    
    try {
      await next();
    } finally {
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;
      
      // Track performance by request type
      const requestType = this.getRequestType(ctx);
      if (!this.performanceMetrics.middlewareExecutionTimes.has(`total:${requestType}`)) {
        this.performanceMetrics.middlewareExecutionTimes.set(`total:${requestType}`, []);
      }
      
      const times = this.performanceMetrics.middlewareExecutionTimes.get(`total:${requestType}`);
      times.push(executionTime);
      
      // Keep only last 100 execution times
      if (times.length > 100) {
        times.shift();
      }
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId(ctx) {
    const userId = ctx.from?.id || 'unknown';
    const messageId = ctx.message?.message_id || 'unknown';
    const timestamp = Date.now();
    return `${userId}_${messageId}_${timestamp}`;
  }

  /**
   * Generate request key for deduplication
   */
  generateRequestKey(ctx) {
    const userId = ctx.from?.id || 'unknown';
    const text = ctx.message?.text || '';
    const callbackData = ctx.callbackQuery?.data || '';
    return `${userId}_${text}_${callbackData}`;
  }

  /**
   * Generate cache key
   */
  generateCacheKey(ctx) {
    const userId = ctx.from?.id || 'unknown';
    const text = ctx.message?.text || '';
    const callbackData = ctx.callbackQuery?.data || '';
    const command = this.extractCommand(text) || this.extractCommand(callbackData);
    return `${userId}_${command}`;
  }

  /**
   * Extract command from text
   */
  extractCommand(text) {
    if (!text) return null;
    const match = text.match(/^\/(\w+)/);
    return match ? match[1] : null;
  }

  /**
   * Get request type for processing optimization
   */
  getRequestType(ctx) {
    if (ctx.message?.text) {
      const command = this.extractCommand(ctx.message.text);
      return command || 'text';
    }
    if (ctx.callbackQuery) {
      return 'callback';
    }
    if (ctx.message?.photo) {
      return 'photo';
    }
    if (ctx.message?.document) {
      return 'document';
    }
    return 'unknown';
  }

  /**
   * Check if request can be processed in parallel
   */
  canProcessInParallel(requestType) {
    const parallelTypes = ['stats', 'leaderboard', 'help', 'start'];
    return parallelTypes.includes(requestType);
  }

  /**
   * Register parallel processor for specific request type
   */
  registerParallelProcessor(requestType, processor) {
    this.parallelProcessors.set(requestType, processor);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = {
      totalRequests: this.performanceMetrics.totalRequests,
      cachedResponses: this.performanceMetrics.cachedResponses,
      deduplicatedRequests: this.performanceMetrics.deduplicatedRequests,
      avgProcessingTime: `${this.performanceMetrics.avgProcessingTime.toFixed(2)}ms`,
      cacheSize: this.requestCache.size,
      deduplicationSize: this.requestDeduplication.size,
      middlewareStats: {}
    };
    
    // Calculate middleware performance stats
    for (const [name, times] of this.performanceMetrics.middlewareExecutionTimes) {
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const max = Math.max(...times);
        const min = Math.min(...times);
        
        stats.middlewareStats[name] = {
          avg: `${avg.toFixed(2)}ms`,
          max: `${max.toFixed(2)}ms`,
          min: `${min.toFixed(2)}ms`,
          samples: times.length
        };
      }
    }
    
    return stats;
  }

  /**
   * Clear caches (admin command)
   */
  clearCaches() {
    this.requestCache.clear();
    this.requestDeduplication.clear();
    logger.info("🧹 Middleware caches cleared");
  }

  /**
   * Emergency cleanup
   */
  emergencyCleanup() {
    logger.warn("🚨 Emergency middleware cleanup");
    
    // Clear all caches
    this.clearCaches();
    
    // Clear performance metrics
    this.performanceMetrics.middlewareExecutionTimes.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    logger.info("🧹 Emergency middleware cleanup completed");
  }
}

// Export singleton instance
const ultraFastMiddleware = new UltraFastMiddleware();
module.exports = ultraFastMiddleware;


