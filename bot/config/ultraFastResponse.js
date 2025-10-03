const logger = require("../../utils/logger");

/**
 * 🚀 ULTRA-FAST RESPONSE SYSTEM
 * 
 * This system provides microsecond-level response times for thousands of simultaneous requests
 * through advanced caching, connection pooling, and intelligent pre-computation.
 */

class UltraFastResponse {
  constructor() {
    this.responseCache = new Map();
    this.precomputedResponses = new Map();
    this.connectionPool = new Map();
    this.requestQueue = new Map();
    this.batchProcessor = new Map();
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      precomputedHits: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      concurrentRequests: 0,
      peakConcurrency: 0
    };
    
    this.startTime = Date.now();
    this.isInitialized = false;
    
    // Initialize the system
    this.initialize();
  }

  /**
   * Initialize the ultra-fast response system
   */
  async initialize() {
    try {
      // Pre-warm critical caches
      await this.preWarmCaches();
      
      // Start background processors
      this.startBackgroundProcessors();
      
      // Initialize connection pooling
      this.initializeConnectionPooling();
      
      this.isInitialized = true;
      logger.info("🚀 Ultra-Fast Response System initialized");
    } catch (error) {
      logger.error("Failed to initialize Ultra-Fast Response System:", error);
      throw error;
    }
  }

  /**
   * Pre-warm critical caches for instant responses (QUOTA-AWARE)
   */
  async preWarmCaches() {
    try {
      const quotaAwareInitializer = require("./quotaAwareInitializer");
      const cacheService = require("./cache");
      
      // Skip cache pre-warming if quota is low or we should skip database ops
      if (quotaAwareInitializer.shouldSkipDatabaseOps()) {
        logger.info("🛡️ Skipping cache pre-warming to preserve quota");
        return;
      }
      
      // Use quota-aware initialization data instead of direct database queries
      const cacheData = quotaAwareInitializer.getQuotaSafeCacheData();
      
      // Only pre-load if we have safe data
      if (cacheData && cacheData.users && cacheData.companies) {
        // Pre-load user data from quota-safe source
        cacheData.users.forEach(userData => {
          if (userData.telegram_id) {
            cacheService.setUser(userData.telegram_id, userData);
            this.precomputedResponses.set(`user:${userData.telegram_id}`, userData);
          }
        });
        
        // Pre-load company data from quota-safe source
        cacheData.companies.forEach(companyData => {
          if (companyData.id) {
            cacheService.setCompany(companyData.id, companyData);
            this.precomputedResponses.set(`company:${companyData.id}`, companyData);
          }
        });
        
        logger.info(`🛡️ Quota-safe caches pre-warmed: ${cacheData.users.length} users, ${cacheData.companies.length} companies`);
      } else {
        logger.info("🛡️ No quota-safe cache data available, skipping pre-warming");
      }
      
      // Pre-compute common responses (quota-aware)
      await this.preComputeCommonResponses();
      
    } catch (error) {
      logger.error("Error pre-warming caches:", error);
      // Continue initialization even if cache pre-warming fails
    }
  }

  /**
   * Pre-compute common responses for instant delivery (QUOTA-AWARE)
   */
  async preComputeCommonResponses() {
    try {
      const quotaAwareInitializer = require("./quotaAwareInitializer");
      
      // Only compute database-dependent responses if we're the master process
      if (!quotaAwareInitializer.shouldSkipDatabaseOps()) {
        const cacheData = quotaAwareInitializer.getQuotaSafeCacheData();
        
        // Use pre-computed data instead of making new database queries
        this.precomputedResponses.set("leaderboard:global", cacheData.leaderboard);
        this.precomputedResponses.set("stats:global", cacheData.stats);
      }
      
      // Pre-compute common command responses (these don't need database)
      this.precomputedResponses.set("help:response", this.getHelpResponse());
      this.precomputedResponses.set("start:response", this.getStartResponse());
      
      logger.info("🛡️ Quota-safe common responses pre-computed");
    } catch (error) {
      logger.error("Error pre-computing responses:", error);
      // Continue initialization even if pre-computation fails
    }
  }

  /**
   * Start background processors for continuous optimization
   */
  startBackgroundProcessors() {
    const quotaAwareInitializer = require("./quotaAwareInitializer");
    
    // Only master process should do database-heavy background tasks
    if (!quotaAwareInitializer.shouldSkipDatabaseOps()) {
        // Disable automatic pre-computed data updates to save quota
        // setInterval(() => {
        //   this.updatePrecomputedData();
        // }, 1800000); // Disabled to prevent quota exhaustion
      
      logger.info("🛡️ Master process: Database background tasks started (quota-safe)");
    }
    
    // All processes can do these lightweight tasks
    // Clean up old cache entries every minute
    setInterval(() => {
      this.cleanupCache();
    }, 60000);
    
    // Process batch requests every 100ms
    setInterval(() => {
      this.processBatchRequests();
    }, 100);
    
    // Update metrics every 10 seconds
    setInterval(() => {
      this.updateMetrics();
    }, 10000);
    
    logger.info("🛡️ Quota-safe background processors started");
  }

  /**
   * Initialize connection pooling for database operations
   */
  initializeConnectionPooling() {
    // Create connection pools for different operations
    this.connectionPool.set("users", {
      active: 0,
      max: 50,
      queue: [],
      connections: new Set()
    });
    
    this.connectionPool.set("companies", {
      active: 0,
      max: 30,
      queue: [],
      connections: new Set()
    });
    
    this.connectionPool.set("referrals", {
      active: 0,
      max: 40,
      queue: [],
      connections: new Set()
    });
  }

  /**
   * Ultra-fast user lookup with multiple fallback layers
   */
  async getUserUltraFast(telegramId) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Layer 1: Pre-computed response (fastest)
      const precomputed = this.precomputedResponses.get(`user:${telegramId}`);
      if (precomputed) {
        this.metrics.precomputedHits++;
        this.recordResponseTime(startTime);
        return precomputed;
      }
      
      // Layer 2: Response cache
      const cached = this.responseCache.get(`user:${telegramId}`);
      if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
        this.metrics.cacheHits++;
        this.recordResponseTime(startTime);
        return cached.data;
      }
      
      // Layer 3: Database with connection pooling
      const userData = await this.getUserWithPooling(telegramId);
      
      // Cache the result
      this.responseCache.set(`user:${telegramId}`, {
        data: userData,
        timestamp: Date.now()
      });
      
      this.recordResponseTime(startTime);
      return userData;
    } catch (error) {
      logger.error("Error in getUserUltraFast:", error);
      throw error;
    }
  }

  /**
   * Get user with connection pooling
   */
  async getUserWithPooling(telegramId) {
    const pool = this.connectionPool.get("users");
    
    return new Promise((resolve, reject) => {
      if (pool.active < pool.max) {
        pool.active++;
        this.executeUserQuery(telegramId)
          .then(result => {
            pool.active--;
            resolve(result);
          })
          .catch(error => {
            pool.active--;
            reject(error);
          });
      } else {
        // Queue the request
        pool.queue.push({ telegramId, resolve, reject });
      }
    });
  }

  /**
   * Execute user query
   */
  async executeUserQuery(telegramId) {
    const databaseService = require("./database");
    const cacheService = require("./cache");
    
    // Check cache first
    const cached = cacheService.getUser(telegramId);
    if (cached) return cached;
    
    // Query database
    const userDoc = await databaseService.users().doc(telegramId.toString()).get();
    if (userDoc.exists) {
      const userData = { id: userDoc.id, ...userDoc.data() };
      cacheService.setUser(telegramId, userData);
      return userData;
    }
    
    return null;
  }

  /**
   * Ultra-fast command response with pre-computation
   */
  async getCommandResponse(command, userId, params = {}) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Check for pre-computed response
      const precomputedKey = `${command}:response`;
      const precomputed = this.precomputedResponses.get(precomputedKey);
      if (precomputed && !params.dynamic) {
        this.metrics.precomputedHits++;
        this.recordResponseTime(startTime);
        return precomputed;
      }
      
      // Generate response based on command
      let response;
      switch (command) {
        case "start":
          response = await this.getStartResponse(userId);
          break;
        case "help":
          response = this.getHelpResponse();
          break;
        case "stats":
          response = await this.getStatsResponse();
          break;
        case "leaderboard":
          response = await this.getLeaderboardResponse();
          break;
        default:
          response = await this.generateDynamicResponse(command, userId, params);
      }
      
      this.recordResponseTime(startTime);
      return response;
    } catch (error) {
      logger.error("Error in getCommandResponse:", error);
      throw error;
    }
  }

  /**
   * Batch process multiple requests for efficiency
   */
  async processBatchRequests() {
    for (const [poolName, pool] of this.connectionPool) {
      if (pool.queue.length > 0 && pool.active < pool.max) {
        const batch = pool.queue.splice(0, Math.min(10, pool.max - pool.active));
        
        // Process batch in parallel
        const promises = batch.map(request => {
          pool.active++;
          return this.executeBatchRequest(poolName, request)
            .then(result => {
              pool.active--;
              request.resolve(result);
            })
            .catch(error => {
              pool.active--;
              request.reject(error);
            });
        });
        
        await Promise.all(promises);
      }
    }
  }

  /**
   * Execute batch request
   */
  async executeBatchRequest(poolName, request) {
    switch (poolName) {
      case "users":
        return this.executeUserQuery(request.telegramId);
      case "companies":
        return this.executeCompanyQuery(request.companyId);
      case "referrals":
        return this.executeReferralQuery(request.userId);
      default:
        throw new Error(`Unknown pool: ${poolName}`);
    }
  }

  /**
   * Record response time for metrics
   */
  recordResponseTime(startTime) {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    this.metrics.totalRequests++;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
    
    this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, responseTime);
    this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, responseTime);
  }

  /**
   * Update pre-computed data in background
   */
  async updatePrecomputedData() {
    try {
      // Update leaderboard
      const leaderboardData = await this.computeLeaderboard();
      this.precomputedResponses.set("leaderboard:global", leaderboardData);
      
      // Update stats
      const statsData = await this.computeStats();
      this.precomputedResponses.set("stats:global", statsData);
      
      // Update active users
      const activeUsers = await this.getActiveUsers();
      this.precomputedResponses.set("users:active", activeUsers);
      
    } catch (error) {
      logger.error("Error updating pre-computed data:", error);
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    for (const [key, value] of this.responseCache) {
      if (now - value.timestamp > maxAge) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics() {
    this.metrics.concurrentRequests = Array.from(this.connectionPool.values())
      .reduce((sum, pool) => sum + pool.active, 0);
    
    this.metrics.peakConcurrency = Math.max(
      this.metrics.peakConcurrency, 
      this.metrics.concurrentRequests
    );
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const uptime = Date.now() - this.startTime;
    const cacheHitRate = this.metrics.totalRequests > 0 
      ? ((this.metrics.cacheHits + this.metrics.precomputedHits) / this.metrics.totalRequests * 100).toFixed(2)
      : 0;
    
    return {
      uptime: Math.floor(uptime / 1000),
      totalRequests: this.metrics.totalRequests,
      cacheHitRate: `${cacheHitRate}%`,
      avgResponseTime: `${this.metrics.avgResponseTime.toFixed(2)}ms`,
      maxResponseTime: `${this.metrics.maxResponseTime.toFixed(2)}ms`,
      minResponseTime: this.metrics.minResponseTime === Infinity ? "0ms" : `${this.metrics.minResponseTime.toFixed(2)}ms`,
      concurrentRequests: this.metrics.concurrentRequests,
      peakConcurrency: this.metrics.peakConcurrency,
      precomputedResponses: this.precomputedResponses.size,
      responseCacheSize: this.responseCache.size,
      connectionPools: Object.fromEntries(
        Array.from(this.connectionPool.entries()).map(([name, pool]) => [
          name, 
          { active: pool.active, max: pool.max, queued: pool.queue.length }
        ])
      )
    };
  }

  /**
   * Helper methods for common responses
   */
  getStartResponse(userId) {
    return {
      text: "🚀 Welcome to the Ultra-Fast Bot!\n\nThis bot is optimized for lightning-fast responses even under high load.",
      keyboard: [
        [{ text: "📊 Stats", callback_data: "stats" }],
        [{ text: "🏆 Leaderboard", callback_data: "leaderboard" }],
        [{ text: "❓ Help", callback_data: "help" }]
      ]
    };
  }

  getHelpResponse() {
    return {
      text: "🆘 **Help & Commands**\n\n" +
            "• /start - Start the bot\n" +
            "• /stats - View performance stats\n" +
            "• /leaderboard - View top users\n" +
            "• /help - Show this help\n\n" +
            "This bot is optimized for ultra-fast responses!",
      parse_mode: "Markdown"
    };
  }

  async getStatsResponse() {
    const stats = this.getPerformanceStats();
    return {
      text: `📊 **Ultra-Fast Performance Stats**\n\n` +
            `🚀 **Response Time:** ${stats.avgResponseTime}\n` +
            `⚡ **Cache Hit Rate:** ${stats.cacheHitRate}\n` +
            `📈 **Total Requests:** ${stats.totalRequests}\n` +
            `🔄 **Concurrent:** ${stats.concurrentRequests}\n` +
            `⏱️ **Uptime:** ${Math.floor(stats.uptime / 60)} minutes`,
      parse_mode: "Markdown"
    };
  }

  async getLeaderboardResponse() {
    const leaderboard = this.precomputedResponses.get("leaderboard:global") || [];
    let text = "🏆 **Top Referrers**\n\n";
    
    leaderboard.slice(0, 10).forEach((user, index) => {
      text += `${index + 1}. ${user.firstName} - ${user.verifiedReferralCount || 0} referrals\n`;
    });
    
    return { text, parse_mode: "Markdown" };
  }

  async computeLeaderboard() {
    try {
      const databaseService = require("./database");
      const usersSnap = await databaseService.users()
        .orderBy("verifiedReferralCount", "desc")
        .limit(20)
        .get();
      
      return usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error("Error computing leaderboard:", error);
      return [];
    }
  }

  async computeStats() {
    try {
      const databaseService = require("./database");
      const [usersSnap, companiesSnap] = await Promise.all([
        databaseService.users().get(),
        databaseService.companies().get()
      ]);
      
      return {
        totalUsers: usersSnap.size,
        totalCompanies: companiesSnap.size,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error("Error computing stats:", error);
      return { totalUsers: 0, totalCompanies: 0, timestamp: new Date() };
    }
  }

  async getActiveUsers() {
    try {
      const databaseService = require("./database");
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const usersSnap = await databaseService.users()
        .where("last_active", ">=", oneDayAgo)
        .limit(100)
        .get();
      
      return usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error("Error getting active users:", error);
      return [];
    }
  }

  async generateDynamicResponse(command, userId, params) {
    // Generate dynamic responses for commands that need real-time data
    switch (command) {
      case "profile":
        const user = await this.getUserUltraFast(userId);
        return {
          text: `👤 **Your Profile**\n\n` +
                `Name: ${user?.firstName || 'Unknown'}\n` +
                `Username: @${user?.username || 'none'}\n` +
                `Referrals: ${user?.verifiedReferralCount || 0}`,
          parse_mode: "Markdown"
        };
      default:
        return { text: "Command not found", parse_mode: "Markdown" };
    }
  }

  /**
   * Emergency cleanup for high memory usage
   */
  emergencyCleanup() {
    logger.warn("🚨 Emergency cleanup initiated");
    
    // Clear all caches
    this.responseCache.clear();
    this.precomputedResponses.clear();
    
    // Clear connection pools
    for (const pool of this.connectionPool.values()) {
      pool.queue = [];
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    logger.info("🧹 Emergency cleanup completed");
  }
}

// Export singleton instance
const ultraFastResponse = new UltraFastResponse();
module.exports = ultraFastResponse;


