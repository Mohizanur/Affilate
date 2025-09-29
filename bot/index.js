const performanceLogger = require("./config/performanceLogger");
require("dotenv").config();

// 🚀 SMART REALISTIC OPTIMIZER INTEGRATION
const smartOptimizer = require("./config/smart-optimizer-integration");

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
        bot.command(commandName, commandHandler);
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

  // BEAST MODE: Enhanced performance monitoring commands
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

  bot.command("quota", async (ctx) => {
    try {
      const quotaProtector = require("./config/quotaProtector");
      const status = quotaProtector.getQuotaStatus();

      let message = "📈 **QUOTA STATUS**\n\n";
      message += `📖 **Reads:** ${status.reads.used}/${status.reads.limit} (${status.reads.percentage}%)\n`;
      message += `✍️ **Writes:** ${status.writes.used}/${status.writes.limit} (${status.writes.percentage}%)\n`;
      message += `🗑️ **Deletes:** ${status.deletes.used}/${status.deletes.limit} (${status.deletes.percentage}%)\n`;
      message += `🌐 **Network:** ${status.network.used}MB/${status.network.limit}MB (${status.network.percentage}%)\n\n`;
      message += `🎯 **Strategy:** ${status.strategy.current}\n`;
      message += `📝 **Mode:** ${status.strategy.description}\n`;
      message += `🔄 **Reset in:** ${status.timeToReset}\n`;

      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
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
  performanceLogger.system("🚀 $1");
  try {
    await databaseService.initialize();
    performanceLogger.system("✅ $1");

    // BEAST MODE: Initialize memory manager for optimal performance
    const memoryManager = require("./config/memoryManager");
    console.log("🧠 Memory Manager initialized for optimal performance");

    // 🚀 Initialize Smart Realistic Optimizer
    console.log("🚀 Initializing Smart Realistic Optimizer...");
    await smartOptimizer.initializeSmartOptimizer();
    console.log("✅ Smart Realistic Optimizer initialized successfully!");
    performanceLogger.system("✅ Smart Realistic Optimizer initialized");

    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("Missing BOT_TOKEN in environment variables.");
    }

    bot = new Telegraf(token, {
      telegram: {
        // BEAST MODE: Optimized for maximum performance while staying under Telegram limits
        timeout: 10000, // Reduced to 10 seconds for ultra-fast responses
        retryAfter: 0.3, // Faster retry for immediate failure detection
        maxRetries: 1, // Single retry for maximum speed
      },
    });

    // Initialize notification service with bot
    const notificationService = new NotificationService(bot);
    setNotificationServiceInstance(notificationService);

    // Add error handlers
    bot.catch((err, ctx) => {
      console.error("❌ Bot error:", err);
    });

    // BEAST MODE: Firestore session storage for scalability
    const FirestoreSession = require("telegraf-session-firestore");
    bot.use(
      new FirestoreSession({
        database: databaseService.getDb(),
        collection: "bot_sessions",
      })
    );

    // Add maintenance mode middleware
    bot.use(async (ctx, next) => {
      try {
        // Skip maintenance check for admin commands
        if (ctx.message?.text?.startsWith("/admin")) {
          return next();
        }

        // Check if maintenance mode is enabled
        const adminService = require("./services/adminService");
        const settings = await adminService.getPlatformSettings();

        if (settings.maintenanceMode) {
          // Check if user is admin
          const userService = require("./services/userService");
          const user = await userService.userService.getUserByTelegramId(
            ctx.from.id
          );

          if (!user || (user.role !== "admin" && !user.isAdmin)) {
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
        // 🚀 BEAST MODE Performance Commands
        { command: "stats", description: "Bot performance statistics" },
        { command: "quota", description: "Firestore quota status" },
        { command: "cache", description: "Cache status and info" },
        { command: "memory", description: "Memory usage and health" },
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
          console.log("🔔 Webhook request received:", req.method, req.url);
          console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
          next();
        },
        bot.webhookCallback()
      );

      // Set webhook URL (will be set after server starts)
      const webhookUrl = `${
        process.env.WEBHOOK_URL ||
        `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
      }${webhookPath}`;
      console.log("🔗 Webhook URL:", webhookUrl);

      // Set webhook after a short delay to ensure server is running
      setTimeout(async () => {
        try {
          await bot.telegram.setWebhook(webhookUrl);
          performanceLogger.system("✅ $1");
        } catch (error) {
          console.error("❌ Failed to set webhook:", error);
        }
      }, 2000);
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
