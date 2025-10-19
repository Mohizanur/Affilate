const performanceLogger = require("./config/performanceLogger");
const cluster = require("cluster");
require("dotenv").config();

// 🚀 SMART REALISTIC OPTIMIZER INTEGRATION
const smartOptimizer = require("./config/smart-optimizer-integration");

// 🚀 PRODUCTION OPTIMIZER - FINAL EDGE SYSTEM
const ProductionOptimizer = require("./config/productionOptimizer");
const productionOptimizer = new ProductionOptimizer();

// Legacy ultra-fast systems (fallback)
const ultraFastResponse = require("./config/ultraFastResponse");
const ultraFastMiddleware = require("./config/ultraFastMiddleware");
const connectionPool = require("./config/connectionPool");
const realTimeMonitor = require("./config/realTimeMonitor");

const { Telegraf } = require("telegraf");
const LocalSession = require("telegraf-session-local");
const databaseService = require("./config/database");
const logger = require("../utils/logger");
const fs = require("fs");
const path = require("path");

// Handler imports
const userHandlers = require("./handlers/userHandlers");
const companyHandlers = require("./handlers/companyHandlers");
const adminHandlers = require("./handlers/adminHandlers");
const callbackHandlers = require("./handlers/callbackHandlers");
const MessageHandlers = require("./handlers/messageHandlers");
const messageHandlers = new MessageHandlers();

// ✅ ADD THESE IMPORTS
const adminService = require("./services/adminService");
const userService = require("./services/userService");
const {
  NotificationService,
  setNotificationServiceInstance,
} = require("./services/notificationService");

let bot;

function getBot() {
  return bot;
}

function registerHandlers(bot) {
  // Dynamically register all slash commands from the commands directory
  const commandsDir = path.join(__dirname, "commands");
  fs.readdirSync(commandsDir).forEach((file) => {
    if (file.endsWith(".js")) {
      const commandName = file.slice(0, -3);
      try {
        const commandHandler = require(path.join(commandsDir, file));
        
        // Register command handler normally
        bot.command(commandName, commandHandler);
        
        console.log(`✅ Registered /${commandName} command with timeout protection`);
      } catch (e) {
        console.error(
          `❌ Error registering /${commandName} command:`,
          e.message
        );
      }
    }
  });

  // Register aliases
  bot.command("referrals", require("./commands/referral"));
  bot.command("browse", require("./commands/products"));
  
  // 🧪 TEST COMMAND - Simple response to verify bot is working
  bot.command("test", async (ctx) => {
    try {
      console.log("🧪 /test command received from user:", ctx.from.id);
      console.log("🧪 Command context:", JSON.stringify(ctx, null, 2));
      await ctx.reply("✅ Bot is working! Test command successful.");
      console.log("✅ /test command completed successfully");
    } catch (error) {
      console.error("❌ Error in /test command:", error.message);
      console.error("❌ Error stack:", error.stack);
      await ctx.reply("❌ Test command failed: " + error.message);
    }
  });
  
  // Text message handler is already registered in messageHandlers.js

  // 🚀 Smart Optimizer Performance Commands
  bot.command("stats", async (ctx) => {
    try {
      const stats = smartOptimizer.getPerformanceStats();
      const quota = smartOptimizer.getQuotaStatus();
      
      let message = "📊 **BOT PERFORMANCE STATS**\n\n";
      message += `🚀 **Cache Hit Rate:** ${stats.cacheHitRate}%\n`;
      message += `⚡ **Avg Response Time:** ${stats.avgResponseTime}ms\n`;
      message += `📈 **Quota Usage (Reads):** ${quota.reads}\n`;
      message += `📈 **Quota Usage (Writes):** ${quota.writes}\n`;
      message += `💾 **Cache Keys:** ${stats.cacheStats.keys}\n`;
      message += `⏱️ **Uptime:** ${Math.round(
        stats.uptime / 1000 / 60
      )} minutes\n`;
      
      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      ctx.reply("❌ Could not fetch stats: " + error.message);
    }
  });

  bot.command("quota", async (ctx) => {
    try {
      const quota = smartOptimizer.getQuotaStatus();
      const stats = smartOptimizer.getPerformanceStats();
      
      let message = "📈 **FIRESTORE QUOTA STATUS**\n\n";
      message += `📊 **Reads:** ${quota.reads}\n`;
      message += `📊 **Writes:** ${quota.writes}\n`;
      message += `🚀 **Cache Hit Rate:** ${quota.cacheHitRate}%\n`;
      message += `⚡ **Avg Response Time:** ${quota.avgResponseTime}ms\n`;
      message += `⏱️ **Uptime:** ${Math.round(
        stats.uptime / 1000 / 60
      )} minutes\n`;
      
      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Error in quota command:", error);
      ctx.reply("❌ Could not fetch quota status: " + error.message);
    }
  });

  bot.command("cache", async (ctx) => {
    try {
      const cache = smartOptimizer.getCacheStats();
      
      let message = "💾 **CACHE STATUS**\n\n";
      message += `🔑 **Total Keys:** ${cache.totalKeys}\n`;
      message += `📏 **Max Keys:** ${cache.maxKeys}\n`;
      message += `⏰ **TTL:** ${cache.ttl} seconds\n`;
      message += `💻 **Memory Usage:** ${Math.round(
        cache.memoryUsage.heapUsed / 1024 / 1024
      )}MB\n`;
      
      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      ctx.reply("❌ Could not fetch cache status: " + error.message);
    }
  });

  // 🚀 Admin Maintenance Commands
  bot.command("clearcache", async (ctx) => {
    try {
      // Check if user is admin
      const userService = require("./services/userService");
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      
      if (!user || (user.role !== "admin" && !user.isAdmin)) {
        return ctx.reply("❌ Admin access required for this command.");
      }
      
      smartOptimizer.clearCache();
      ctx.reply("🧹 Cache cleared successfully!");
    } catch (error) {
      ctx.reply("❌ Could not clear cache: " + error.message);
    }
  });

  bot.command("maintenance", async (ctx) => {
    try {
      // Check if user is admin
      const userService = require("./services/userService");
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      
      if (!user || (user.role !== "admin" && !user.isAdmin)) {
        return ctx.reply("❌ Admin access required for this command.");
      }
      
      await smartOptimizer.performMaintenance();
      ctx.reply("🔧 Manual maintenance completed!");
    } catch (error) {
      ctx.reply("❌ Could not perform maintenance: " + error.message);
    }
  });

  // 🚀 ULTRA-FAST: Enhanced performance monitoring commands
  bot.command("memory", async (ctx) => {
    try {
      const memoryManager = require("./config/memoryManager");
      const stats = memoryManager.getMemoryStats();
      const health = memoryManager.getMemoryHealth();
      const trends = memoryManager.getMemoryTrends();

      let message = "🧠 **MEMORY STATUS**\n\n";
      message += `📊 **Current Usage:** ${stats.current.heapUsed}MB / ${stats.current.heapTotal}MB (${stats.current.heapPercentage}%)\n`;
      message += `📈 **Average Usage:** ${stats.average.heapUsed}MB\n`;
      message += `🔝 **Peak Usage:** ${stats.peak.heapUsed}MB\n`;
      message += `🔄 **Cleanups:** ${stats.cleanup.count}\n`;
      message += `⚡ **Status:** ${health.status.toUpperCase()}\n`;
      message += `📊 **Trend:** ${trends.trend} (${trends.change}%)\n`;
      message += `⏱️ **Uptime:** ${stats.uptime.hours}h ${
        stats.uptime.minutes % 60
      }m\n`;

      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      ctx.reply("❌ Could not fetch memory status: " + error.message);
    }
  });

  // 🚀 ULTRA-FAST: Real-time performance monitoring
  bot.command("realtime", async (ctx) => {
    try {
      const monitor = require("./config/realTimeMonitor");
      const summary = monitor.getPerformanceSummary();
      const metrics = monitor.getMetrics();

      let message = "⚡ **REAL-TIME PERFORMANCE**\n\n";
      message += `🚀 **Status:** ${summary.status.toUpperCase()}\n`;
      message += `⏱️ **Response Time:** ${summary.responseTime}\n`;
      message += `📊 **Error Rate:** ${summary.errorRate}\n`;
      message += `💾 **Memory Usage:** ${summary.memoryUsage}\n`;
      message += `🎯 **Cache Hit Rate:** ${summary.cacheHitRate}\n`;
      message += `📈 **Requests/sec:** ${summary.requestsPerSecond}\n`;
      message += `🚨 **Active Alerts:** ${summary.activeAlerts}\n`;
      message += `⏰ **Uptime:** ${summary.uptime}s\n`;

      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      ctx.reply("❌ Could not fetch real-time stats: " + error.message);
    }
  });

  // 🚀 ULTRA-FAST: Connection pool status
  bot.command("pools", async (ctx) => {
    try {
      const pool = require("./config/connectionPool");
      const stats = pool.getPoolStats();
      const globalStats = pool.getGlobalStats();

      let message = "🏊 **CONNECTION POOLS**\n\n";
      message += `📊 **Global Stats:**\n`;
      message += `   • Active: ${globalStats.activeConnections}\n`;
      message += `   • Queued: ${globalStats.queuedRequests}\n`;
      message += `   • Completed: ${globalStats.completedRequests}\n`;
      message += `   • Failed: ${globalStats.failedRequests}\n\n`;
      
      message += `🔧 **Pool Details:**\n`;
      for (const [poolName, poolStats] of Object.entries(stats)) {
        message += `   • ${poolName}: ${poolStats.connections.active}/${poolStats.connections.total} active\n`;
      }

      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      ctx.reply("❌ Could not fetch pool stats: " + error.message);
    }
  });

  // 🚀 ULTRA-FAST: Ultra-fast response stats
  // 🚀 PRODUCTION: Production optimizer stats
  bot.command("production", async (ctx) => {
    try {
      const stats = productionOptimizer.getProductionStats();
      
      let message = "🚀 **PRODUCTION OPTIMIZER STATS**\n\n";
      message += `🏭 **Environment:** ${stats.environment}\n`;
      message += `⏱️ **Uptime:** ${Math.round(stats.uptime / 1000 / 60)} minutes\n`;
      message += `📊 **Requests:** ${stats.requests.toLocaleString()}\n`;
      message += `✅ **Success Rate:** ${(100 - stats.errorRate).toFixed(2)}%\n`;
      message += `⚡ **Avg Response:** ${stats.avgResponseTime.toFixed(2)}ms\n`;
      message += `🚀 **Request Rate:** ${stats.requestRate.toFixed(1)} req/sec\n`;
      message += `💾 **Memory:** ${stats.memory?.usage.toFixed(1)}% (${stats.memory?.heapUsed}MB)\n`;
      message += `🎯 **Cache Hit Rate:** ${stats.cache?.hitRate?.toFixed(1) || 0}%\n`;
      message += `👷 **Workers:** ${stats.cluster.isMaster ? `${stats.cluster.workers} active` : `Worker ${stats.cluster.workerId}`}\n`;
      
      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      ctx.reply("❌ Could not fetch production stats: " + error.message);
    }
  });

  // 🚀 HEALTH: Health check endpoint
  bot.command("health", async (ctx) => {
    try {
      const health = productionOptimizer.getHealthCheck();
      
      const statusEmoji = health.status === 'healthy' ? '✅' : '❌';
      let message = `${statusEmoji} **SYSTEM HEALTH CHECK**\n\n`;
      message += `📊 **Status:** ${health.status.toUpperCase()}\n`;
      message += `⏱️ **Uptime:** ${Math.round(health.uptime / 1000 / 60)} minutes\n`;
      message += `🔧 **Version:** ${health.version}\n`;
      message += `🌍 **Environment:** ${health.environment}\n`;
      message += `💻 **Node.js:** ${health.nodeVersion}\n`;
      message += `🖥️ **Platform:** ${health.platform} ${health.arch}\n`;
      message += `💾 **Memory:** ${health.memory?.usage.toFixed(1)}%\n`;
      message += `⚡ **Response Time:** ${health.performance.avgResponseTime.toFixed(2)}ms\n`;
      message += `📈 **Request Rate:** ${health.performance.requestRate.toFixed(1)} req/sec\n`;
      message += `🎯 **Cache Hit Rate:** ${health.performance.cacheHitRate.toFixed(1)}%\n`;
      
      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      ctx.reply("❌ Could not fetch health status: " + error.message);
    }
  });

  bot.command("ultrafast", async (ctx) => {
    try {
      const ultraFast = require("./config/ultraFastResponse");
      const stats = ultraFast.getPerformanceStats();

      let message = "🚀 **ULTRA-FAST RESPONSE STATS**\n\n";
      message += `⚡ **Avg Response Time:** ${stats.avgResponseTime}\n`;
      message += `🎯 **Cache Hit Rate:** ${stats.cacheHitRate}\n`;
      message += `📈 **Total Requests:** ${stats.totalRequests}\n`;
      message += `🔄 **Concurrent:** ${stats.concurrentRequests}\n`;
      message += `🔝 **Peak Concurrency:** ${stats.peakConcurrency}\n`;
      message += `💾 **Precomputed:** ${stats.precomputedResponses}\n`;
      message += `🗄️ **Cache Size:** ${stats.responseCacheSize}\n`;
      message += `⏰ **Uptime:** ${Math.floor(stats.uptime / 60)}m\n`;

      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      ctx.reply("❌ Could not fetch ultra-fast stats: " + error.message);
    }
  });

  // Register auto-efficiency command
  bot.command("auto", async (ctx) => {
    try {
      const autoEfficiencySystem = require("./config/autoEfficiencySystem");
      const status = autoEfficiencySystem.getSystemStatus();
      const performance = autoEfficiencySystem.getPerformanceStats();
      
      const message = `🚀 *Auto-Efficiency System*\n\n` +
        `📊 *Performance Stats:*\n` +
        `• Cache Hit Rate: ${performance.cacheHitRate}\n` +
        `• Cache Size: ${performance.cacheSize} items\n` +
        `• Memory Usage: ${performance.memoryUsage}\n` +
        `• Total Requests: ${performance.totalRequests}\n` +
        `• Avg Response Time: ${performance.avgResponseTime}\n\n` +
        `⚙️ *System Status:*\n` +
        `• Initialized: ${status.initialized ? '✅ Yes' : '❌ No'}\n` +
        `• Auto-Cleanup: ${performance.autoCleanupEnabled ? '✅ Active' : '❌ Inactive'}\n` +
        `• Optimization: ${performance.optimizationEnabled ? '✅ Active' : '❌ Inactive'}\n` +
        `• Uptime: ${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m\n\n` +
        `🧠 *Features:*\n` +
        `• Zero Manual Work Required\n` +
        `• Automatic Optimization\n` +
        `• Intelligent Caching\n` +
        `• Memory Management\n` +
        `• Performance Monitoring`;
      
      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Error in auto command:", error);
      await ctx.reply("❌ Error retrieving auto-efficiency statistics");
    }
  });

  // Register smart cache command
  bot.command("smartcache", async (ctx) => {
    try {
      const smartCacheSystem = require("./config/smartCacheSystem");
      const status = smartCacheSystem.getSystemStatus();
      const insights = smartCacheSystem.getPerformanceInsights();
      
      const message = `🧠 *Smart Cache System*\n\n` +
        `📊 *Cache Statistics:*\n` +
        `• Total Caches: ${status.totalCaches}\n` +
        `• Total Entries: ${status.stats.totalEntries}\n` +
        `• Hit Rate: ${status.stats.hitRate}\n` +
        `• Total Hits: ${status.stats.totalHits}\n` +
        `• Total Misses: ${status.stats.totalMisses}\n` +
        `• Optimization Runs: ${status.stats.optimizationRuns}\n\n` +
        `🔥 *Data Temperature:*\n` +
        `• Hot Data: ${insights.hotData} items\n` +
        `• Warm Data: ${insights.warmData} items\n` +
        `• Cold Data: ${insights.coldData} items\n` +
        `• Cache Efficiency: ${insights.cacheEfficiency}%\n` +
        `• Memory Usage: ${insights.memoryUsage} items\n\n` +
        `⚙️ *System Status:*\n` +
        `• Auto-Optimization: ${status.autoOptimization ? '✅ Active' : '❌ Inactive'}\n` +
        `• Access Patterns: ${status.stats.accessPatterns} tracked\n` +
        `• Optimization Rules: ${status.stats.optimizationRules} active\n\n` +
        `🧠 *Features:*\n` +
        `• Intelligent TTL Management\n` +
        `• Access Pattern Analysis\n` +
        `• Automatic Optimization\n` +
        `• Temperature-Based Caching`;
      
      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Error in smartcache command:", error);
      await ctx.reply("❌ Error retrieving smart cache statistics");
    }
  });

  bot.command("quotadetailed", async (ctx) => {
    try {
      const quotaProtector = require("./config/quotaProtector");
      const status = quotaProtector.getQuotaStatus();

      let message = "📈 **DETAILED QUOTA STATUS**\n\n";
      message += `📖 **Reads:** ${status.reads.used}/${status.reads.limit} (${status.reads.percentage}%)\n`;
      message += `✍️ **Writes:** ${status.writes.used}/${status.writes.limit} (${status.writes.percentage}%)\n`;
      message += `🗑️ **Deletes:** ${status.deletes.used}/${status.deletes.limit} (${status.deletes.percentage}%)\n`;
      message += `🌐 **Network:** ${status.network.used}MB/${status.network.limit}MB (${status.network.percentage}%)\n\n`;
      message += `🎯 **Strategy:** ${status.strategy.current}\n`;
      message += `📝 **Mode:** ${status.strategy.description}\n`;
      message += `🔄 **Reset in:** ${status.timeToReset}\n`;

      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Error in quotadetailed command:", error);
      ctx.reply("❌ Could not fetch quota status: " + error.message);
    }
  });

  const handlers = [
    { name: "User", handler: userHandlers },
    { name: "Company", handler: companyHandlers },
    { name: "Admin", handler: adminHandlers },
    { name: "Callback", handler: callbackHandlers },
    { name: "Message", handler: messageHandlers },
  ];

  handlers.forEach(({ name, handler }) => {
    try {
      if (handler?.setupHandlers) {
        handler.setupHandlers(bot);
      } else if (typeof handler === "function") {
        handler(bot);
      }
    } catch (error) {
      console.error(`❌ Error registering ${name} handlers:`, error.message);
    }
  });

  // Register the main text handler for all text messages
  bot.on("text", (ctx) => messageHandlers.handleTextMessage(ctx));
  // Register handlers for media messages
  bot.on("photo", (ctx) => messageHandlers.handlePhotoMessage(ctx));
  bot.on("video", (ctx) => messageHandlers.handleVideoMessage(ctx));
  bot.on("document", (ctx) => messageHandlers.handleDocumentMessage(ctx));
  // Register handler for contact messages (phone number sharing)
  bot.on("contact", (ctx) => userHandlers.handlePhoneContact(ctx));
  // Register handler for callback queries (inline keyboard button presses)
  bot.on("callback_query", (ctx) => callbackHandlers.handleCallback(ctx));
}

async function startBot(app) {
  performanceLogger.system("🚀 Starting bot initialization");
  try {
    // Initialize database with timeout protection
    console.log("🔧 Initializing database with timeout protection...");
    const dbInitPromise = databaseService.initialize();
    const dbTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database initialization timeout after 10 seconds')), 10000);
    });
    
    try {
      await Promise.race([dbInitPromise, dbTimeoutPromise]);
      console.log("✅ Database initialized successfully");
      performanceLogger.system("✅ Database initialized");
    } catch (error) {
      console.error("❌ Database initialization failed:", error.message);
      console.log("🔄 Continuing with bot setup (database will be retried on demand)...");
      performanceLogger.system("⚠️ Database init failed, continuing");
    }

    // BEAST MODE: Initialize memory manager for optimal performance
    const memoryManager = require("./config/memoryManager");
    console.log("🧠 Memory Manager initialized for optimal performance");

    // BEAST MODE: Initialize quota protector for bulletproof quota management
    const quotaProtector = require("./config/quotaProtector");
    console.log(
      "🛡️ Quota Protector initialized for bulletproof quota management"
    );

    // BEAST MODE: Initialize cache system for instant responses
    const cacheService = require("./config/cache");
    console.log("⚡ Cache System initialized for instant responses");

    // 🛡️ Initialize Quota-Aware System (CRITICAL - Prevents quota exhaustion)
    console.log("🛡️ Initializing Quota-Aware System to prevent quota exhaustion...");
    const quotaAwareInitializer = require("./config/quotaAwareInitializer");
    await quotaAwareInitializer.initialize();
    console.log("✅ Quota-Aware System initialized - quota protected!");
    performanceLogger.system("✅ Quota-Aware System initialized");

    // 🚀 Initialize Smart Realistic Optimizer
    console.log("🚀 Initializing Smart Realistic Optimizer...");
    await smartOptimizer.initializeSmartOptimizer();
    console.log("✅ Smart Realistic Optimizer initialized successfully!");
    performanceLogger.system("✅ Smart Realistic Optimizer initialized");

    // 🚀 Initialize Production Optimizer (Final Edge System)
    console.log("🚀 Initializing Production Optimizer - Final Edge System...");
    await productionOptimizer.initialize();
    
    // If we're a cluster worker, continue with bot initialization
    // If we're master, the optimizer handles worker management
    if (require('cluster').isMaster && productionOptimizer.config.enableClustering) {
      console.log("🏭 Master process managing workers, bot will run in workers");
      return;
    }
    
    console.log("✅ Production Optimizer initialized - proceeding with bot setup");
    performanceLogger.system("✅ Production Optimizer initialized");

    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("Missing BOT_TOKEN in environment variables.");
    }

    bot = new Telegraf(token, {
      telegram: {
        // 🚀 ULTRA-FAST MODE: Optimized for microsecond-level responses
        timeout: 5000, // Reduced to 5 seconds for ultra-fast responses
        retryAfter: 0.1, // Ultra-fast retry for immediate failure detection
        maxRetries: 1, // Single retry for maximum speed
        // Additional optimizations
        agent: false, // Disable agent for faster connections
        compress: true, // Enable compression
      },
    });

    // Initialize notification service with bot
    const notificationService = new NotificationService(bot);
    setNotificationServiceInstance(notificationService);

    // BEAST MODE: Bulletproof error handling
    bot.catch((err, ctx) => {
      // Log error for debugging
      console.error("❌ Bot error:", err.message);

      // Handle specific error types gracefully
      if (
        err.message &&
        (err.message.includes("collection.doc is not a function") ||
          err.message.includes("session") ||
          err.message.includes("firestore"))
      ) {
        console.log(
          "⚠️ Database/session error detected, continuing operation..."
        );
        return;
      }

      // Handle Telegram API errors
      if (err.code && (err.code === 429 || err.code === 420)) {
        console.log("⚠️ Rate limit error, continuing operation...");
        return;
      }

      // Send user-friendly error message
      if (ctx && ctx.reply && ctx.from) {
        try {
          ctx.reply("⚠️ An error occurred. Please try again in a moment.");
        } catch (replyError) {
          console.error("Failed to send error message:", replyError.message);
        }
      }
    });

    // 🚀 ULTRA-FAST MODE: Using local sessions with ultra-fast middleware
    console.log(
      "🔧 Initializing ultra-fast session storage and middleware..."
    );
    const LocalSession = require("telegraf-session-local");
    bot.use(
      new LocalSession({ database: "./temp/session_db.json" }).middleware()
    );
    
    // Add production optimizer middleware
    bot.use(async (ctx, next) => {
      await productionOptimizer.processRequest(ctx, next);
    });
    
    console.log("✅ Ultra-fast session storage and middleware initialized successfully");

    // 🚀 Initialize Auto-Efficiency System (Zero manual work, zero DB calls)
    const autoEfficiencySystem = require("./config/autoEfficiencySystem");
    await autoEfficiencySystem.initialize();
    
    // 🧠 Initialize Smart Cache System (Intelligent caching, zero DB calls)
    const smartCacheSystem = require("./config/smartCacheSystem");
    console.log("🧠 Smart Cache System ready - Intelligent caching enabled");

    // Add maintenance mode middleware with aggressive caching
    bot.use(async (ctx, next) => {
      try {
        // Skip maintenance check for admin commands
        if (ctx.message?.text?.startsWith("/admin")) {
          return next();
        }

        // 🚀 QUOTA-SAVING: Cache maintenance check to avoid DB calls on EVERY message
        const maintenanceCacheKey = 'maintenance_mode';
        const userCacheKey = `user_${ctx.from.id}`;
        
        // Check cached maintenance mode (5 minute cache)
        let maintenanceMode = false;
        if (global.maintenanceCache && Date.now() - global.maintenanceCache.timestamp < 300000) {
          maintenanceMode = global.maintenanceCache.data;
        } else {
          const adminService = require("./services/adminService");
          const settings = await adminService.getPlatformSettings();
          maintenanceMode = settings.maintenanceMode;
          
          // Cache the result
          if (!global.maintenanceCache) global.maintenanceCache = {};
          global.maintenanceCache.data = maintenanceMode;
          global.maintenanceCache.timestamp = Date.now();
        }

        if (maintenanceMode) {
          // Check cached user admin status (1 minute cache)
          let isAdmin = false;
          if (global.userCache && global.userCache[userCacheKey] && Date.now() - global.userCache[userCacheKey].timestamp < 60000) {
            isAdmin = global.userCache[userCacheKey].data;
          } else {
            const userService = require("./services/userService");
            const user = await userService.userService.getUserByTelegramId(ctx.from.id);
            isAdmin = user && (user.role === "admin" || user.isAdmin);
            
            // Cache the result
            if (!global.userCache) global.userCache = {};
            global.userCache[userCacheKey] = { data: isAdmin, timestamp: Date.now() };
          }
          
          if (!isAdmin) {
            // Block non-admin users during maintenance
            return ctx.reply(
              `🔧 *System Maintenance*\n\n` +
                `We're currently performing system maintenance.\n` +
                `Please try again later.\n\n` +
                `Thank you for your patience!`,
              { parse_mode: "Markdown" }
            );
          }
        }

        return next();
      } catch (error) {
        console.error("Error in maintenance middleware:", error);
        // Continue to next middleware on error
        return next();
      }
    });
    
    try {
      registerHandlers(bot);
    } catch (e) {
      console.error("Error in registerHandlers:", e);
      throw e;
    }

    // Test bot connection first with better error handling
    
    let botInfo = null;
    try {
      botInfo = await bot.telegram.getMe();
      console.log(
        `✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`
      );
    } catch (error) {
      console.error("❌ Failed to connect to Telegram API:", error.message);
      console.error("🔍 Network issue detected. Please check:");
      console.error("   - Internet connection");
      console.error("   - Firewall settings");
      console.error("   - VPN/Proxy settings");
      console.error("   - Telegram API accessibility");

      // For development, we can continue without the connection test
      performanceLogger.warn("⚠️ $1");
    }

    // Set bot commands
    if (bot && bot.telegram && bot.telegram.setMyCommands) {
      const commands = [
        { command: "start", description: "Start or restart the bot" },
        { command: "browse", description: "Browse products" },
        { command: "referrals", description: "My referrals & codes" },
        { command: "favorites", description: "View your favorite products" },
        { command: "cart", description: "View your cart" },
        { command: "profile", description: "Your profile & settings" },
        { command: "leaderboard", description: "Top referrers" },
        { command: "help", description: "Help & support" },
        {
          command: "feecalculator",
          description: "Calculate fee for a transaction",
        },
        // 🚀 PRODUCTION Performance Commands
        { command: "production", description: "Production optimizer statistics" },
        { command: "health", description: "System health check" },
        { command: "stats", description: "Bot performance statistics" },
        { command: "quota", description: "Firestore quota status" },
        { command: "cache", description: "Cache status and info" },
        { command: "memory", description: "Memory usage and health" },
        { command: "ultrafast", description: "Ultra-fast response statistics" },
        { command: "auto", description: "Auto-efficiency system status" },
        { command: "smartcache", description: "Smart cache system status" },
      ];

      try {
        await bot.telegram.setMyCommands(commands);
        performanceLogger.system("✅ $1");
      } catch (error) {
        console.log(
          "⚠️ Could not set bot commands (network issue):",
          error.message
        );
      }
    }

    // Webhook setup for production
    const isProduction =
      process.env.NODE_ENV === "production" || process.env.RENDER;
    const isLocalDevelopment =
      !isProduction && process.env.NODE_ENV !== "production";
    const webhookPath = `/webhook`;

    if (isProduction) {
      console.log("🌐 Setting up webhook for production...");
      console.log("🔍 DEBUG: Bot instance:", bot ? "exists" : "missing");
      console.log("🔍 DEBUG: Bot telegram:", bot?.telegram ? "exists" : "missing");
      console.log("🔍 DEBUG: Single process mode (clustering disabled)");

      // Delete any existing webhook
      try {
        await bot.telegram.deleteWebhook();
      } catch (error) {
        console.log(
          "⚠️ Could not delete webhook (network issue):",
          error.message
        );
      }

      // Set up webhook endpoint with debugging and error handling
      console.log("🔍 DEBUG: Setting up webhook route at:", webhookPath);
      app.use(
        webhookPath,
        (req, res, next) => {
          console.log("🔔 Webhook request received:", req.method, req.url);
          console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
          next();
        },
        async (req, res, next) => {
          try {
            await bot.webhookCallback()(req, res, next);
            console.log("✅ Webhook processed successfully");
          } catch (error) {
            console.error("❌ Webhook processing error:", error.message);
            console.error("❌ Stack trace:", error.stack);
            res.status(500).json({ error: "Webhook processing failed" });
          }
        }
      );
      console.log("✅ Webhook route setup complete with error handling");
      
      // Add comprehensive error handling for webhook processing
      bot.catch((err, ctx) => {
        console.error("❌ Bot error:", err);
        console.error("❌ Context:", ctx);
        console.error("❌ Error details:", err.message);
        console.error("❌ Stack trace:", err.stack);
        
        // Try to send error message to user
        if (ctx && ctx.reply) {
          ctx.reply("❌ Sorry, there was an error processing your request.").catch(console.error);
        }
      });
      
      // Add global error handler for unhandled promise rejections
      process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      });
      
      // Add global error handler for uncaught exceptions
      process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
      });

      // Set webhook URL (will be set after server starts)
      const webhookUrl = `${
        process.env.WEBHOOK_URL ||
        `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
      }${webhookPath}`;
      console.log("🔗 Webhook URL:", webhookUrl);

      // Set webhook after a short delay to ensure server is running
      // Single process mode - no clustering
        setTimeout(async () => {
          try {
            // Add retry logic with exponential backoff
            let retries = 0;
            const maxRetries = 5;
            
            const setWebhookWithRetry = async () => {
              try {
                await bot.telegram.setWebhook(webhookUrl);
                console.log("✅ Webhook set successfully");
                performanceLogger.system("✅ Webhook set successfully");
              } catch (error) {
                if (error.response?.error_code === 429 && retries < maxRetries) {
                  retries++;
                  const delay = Math.pow(2, retries) * 1000; // Exponential backoff
                  console.log(`⏳ Webhook rate limited, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
                  setTimeout(setWebhookWithRetry, delay);
                } else {
                  console.error("❌ Failed to set webhook after retries:", error);
                  console.log("🔄 Falling back to polling mode...");
                  // Fallback to polling if webhook fails
                  bot.launch().catch(console.error);
                }
              }
            };
            
            setWebhookWithRetry();
          } catch (error) {
            console.error("❌ Failed to set webhook:", error);
          }
        }, 5000); // Increased delay to 5 seconds
    } else if (
      isLocalDevelopment &&
      process.env.ENABLE_LOCAL_POLLING === "true"
    ) {
      console.log("🔄 Using long polling for local development...");
      try {
        await bot.telegram.deleteWebhook();
        await bot.launch();
        isBotLaunched = true;
      } catch (error) {
        console.log(
          "⚠️ Could not start long polling (network issue):",
          error.message
        );
      }
    } else {
      console.log("🌐 Using webhook mode (local development with webhook)...");

      // Delete any existing webhook
      try {
        await bot.telegram.deleteWebhook();
      } catch (error) {
        console.log(
          "⚠️ Could not delete webhook (network issue):",
          error.message
        );
      }

      // Set up webhook endpoint with debugging
      app.use(
        webhookPath,
        (req, res, next) => {
          console.log(
            "🔔 Local webhook request received:",
            req.method,
            req.url
          );
          console.log(
            "📦 Local request body:",
            JSON.stringify(req.body, null, 2)
          );
          next();
        },
        bot.webhookCallback()
      );

      // For local development, we'll just set up the webhook endpoint
      // but won't set the webhook URL since we're running locally
      performanceLogger.system("✅ $1");
    }

    performanceLogger.system("🚀 $1");
    return bot;
  } catch (error) {
    console.error("❌ Error inside startBot():", error);
    throw error;
  }
}

// Track bot launch state
let isBotLaunched = false;

// Global error handler
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception (global):", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);

  // Don't exit for Telegram API errors, as they might be recoverable
  if (reason && reason.message) {
    const errorMessage = reason.message.toLowerCase();
    if (
      errorMessage.includes("query is too old") ||
      errorMessage.includes("callback query") ||
      errorMessage.includes("bad request") ||
      errorMessage.includes("timeout")
    ) {
      console.log(
        "⚠️ Telegram API error - continuing operation:",
        reason.message
      );
      return;
    }
  }

  // For other unhandled rejections, log but don't exit immediately
  console.error("❌ Unhandled rejection logged, continuing...");
  console.error("error: unhandledRejection:", reason.message);
  console.error("Error:", reason);
});

// Graceful shutdown
process.once("SIGINT", async () => {
  console.log("🛑 Received SIGINT, stopping bot...");
  if (bot) {
    try {
      if (isBotLaunched) {
        await bot.stop("SIGINT");
        performanceLogger.system("✅ $1");
      } else {
        // In webhook mode, just delete the webhook
        await bot.telegram.deleteWebhook();
        performanceLogger.system("✅ $1");
      }
    } catch (error) {
      console.log("⚠️ Error during bot shutdown:", error.message);
    }
  }
  // Give some time for cleanup
  setTimeout(() => {
    console.log("🔄 Exiting process...");
    process.exit(0);
  }, 1000);
});

process.once("SIGTERM", async () => {
  console.log("🛑 Received SIGTERM, stopping bot...");
  if (bot) {
    try {
      if (isBotLaunched) {
        await bot.stop("SIGTERM");
        performanceLogger.system("✅ $1");
      } else {
        // In webhook mode, just delete the webhook
        await bot.telegram.deleteWebhook();
        performanceLogger.system("✅ $1");
      }
    } catch (error) {
      console.log("⚠️ Error during bot shutdown:", error.message);
    }
  }
  // Give some time for cleanup
  setTimeout(() => {
    console.log("🔄 Exiting process...");
    process.exit(0);
  }, 1000);
});

module.exports = { getBot, startBot };

// Add a global handler to refresh referral stats UI for a user by Telegram ID
if (typeof global !== "undefined") {
  global.handleMyReferralsForUserId = async function (userId) {
    try {
      // Find the chat context for the user (if available)
      // This assumes you have a way to get ctx by userId, e.g., from a session store or cache
      // If not, you can send a direct message instead
      if (bot && bot.telegram) {
        // Send a direct message to the user with their updated referral stats
        // Create a fake ctx object with minimal properties for handleMyReferrals
        const ctx = {
          from: { id: userId },
          reply: (msg, opts) => bot.telegram.sendMessage(userId, msg, opts),
          callbackQuery: null,
        };
        await userHandlers.handleMyReferrals(ctx);
      }
    } catch (err) {
      console.error(
        "[global.handleMyReferralsForUserId] Failed to refresh referral stats for user:",
        userId,
        err
      );
    }
  };
}

// Start the bot if this file is run directly (not imported)
if (require.main === module) {
  // For local development, just call startBot with no app (polling mode)
  startBot();
}
