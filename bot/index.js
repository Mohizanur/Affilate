require('dotenv').config();
console.log("Loaded bot/index.js");
console.log(
  "Loaded BOT_TOKEN:",
  (process.env.BOT_TOKEN || "").slice(0, 8) + "..."
);
const { Telegraf } = require("telegraf");
console.log("Loaded telegraf");
const LocalSession = require("telegraf-session-local");
console.log("Loaded telegraf-session-local");
const databaseService = require("./config/database");
console.log("Loaded config/database");
const logger = require("../utils/logger");
console.log("Loaded utils/logger");
const fs = require("fs");
const path = require("path");

// Handler imports
const userHandlers = require("./handlers/userHandlers");
console.log("Loaded handlers/userHandlers");
const companyHandlers = require("./handlers/companyHandlers");
console.log("Loaded handlers/companyHandlers");
const adminHandlers = require("./handlers/adminHandlers");
console.log("Loaded handlers/adminHandlers");
const callbackHandlers = require("./handlers/callbackHandlers");
console.log("Loaded handlers/callbackHandlers");
const MessageHandlers = require("./handlers/messageHandlers");
const messageHandlers = new MessageHandlers();
console.log("Loaded handlers/messageHandlers");

// ✅ ADD THESE IMPORTS
const adminService = require("./services/adminService");
console.log("Loaded services/adminService");
const userService = require("./services/userService");
console.log("Loaded services/userService");
const {
  NotificationService,
  setNotificationServiceInstance,
} = require("./services/notificationService");
console.log("Loaded services/notificationService");

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
        console.log(`✅ /${commandName} command handler registered`);
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
  console.log(`✅ /referrals command alias registered`);
  bot.command("browse", require("./commands/products"));
  console.log(`✅ /browse command alias registered for /products`);

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
      console.log(`✅ ${name} handlers registered`);
    } catch (error) {
      console.error(`❌ Error registering ${name} handlers:`, error.message);
    }
  });

  // Register the main text handler for all text messages
  bot.on("text", (ctx) => messageHandlers.handleTextMessage(ctx));
  // Register handler for contact messages (phone number sharing)
  bot.on("contact", (ctx) => userHandlers.handlePhoneContact(ctx));
  // Register handler for callback queries (inline keyboard button presses)
  bot.on("callback_query", (ctx) => callbackHandlers.handleCallback(ctx));
}

async function startBot(app) {
  console.log("🚀 startBot() triggered");
  try {
    console.log("🟡 Initializing Firebase...");
    await databaseService.initialize();
    console.log("✅ Firebase initialized");

    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("Missing BOT_TOKEN in environment variables.");
    }
    console.log("BOT_TOKEN loaded, length:", token.length);

    console.log("🤖 Initializing Telegraf bot...");
    bot = new Telegraf(token, {
      telegram: {
        // Add timeout and retry configuration
        timeout: 30000, // 30 seconds timeout
        retryAfter: 1, // Retry after 1 second
        maxRetries: 3, // Maximum 3 retries
      },
    });

    // Initialize notification service with bot
    const notificationService = new NotificationService(bot);
    setNotificationServiceInstance(notificationService);

    // Add error handlers
    bot.catch((err, ctx) => {
      console.error("❌ Bot error:", err);
    });

    bot.use(
      new LocalSession({ database: "./temp/session_db.json" }).middleware()
    );

    console.log("📦 Registering bot handlers...");
    try {
      console.log("Before registerHandlers");
      registerHandlers(bot);
      console.log("After registerHandlers");
    } catch (e) {
      console.error("Error in registerHandlers:", e);
      throw e;
    }

    // Test bot connection first with better error handling
    console.log("Before bot.telegram.getMe()");
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
      console.log("⚠️ Continuing in development mode without API test...");
      console.log("📝 You can still test the bot functionality locally");
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
      ];

      try {
        await bot.telegram.setMyCommands(commands);
        console.log("✅ Bot commands set successfully");
      } catch (error) {
        console.log(
          "⚠️ Could not set bot commands (network issue):",
          error.message
        );
        console.log("📝 Bot will work without custom commands");
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
          console.log("✅ Webhook set successfully");
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
        console.log("📝 Setting up webhook mode for local testing...");
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
      console.log("✅ Webhook endpoint configured for local development");
    }

    console.log("🚀 Bot initialization complete");
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
  process.exit(1);
});

// Graceful shutdown
process.once("SIGINT", async () => {
  console.log("🛑 Received SIGINT, stopping bot...");
  if (bot) {
    try {
      if (isBotLaunched) {
        await bot.stop("SIGINT");
        console.log("✅ Bot stopped successfully (long polling mode)");
      } else {
        // In webhook mode, just delete the webhook
        await bot.telegram.deleteWebhook();
        console.log("✅ Webhook deleted successfully");
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
        console.log("✅ Bot stopped successfully (long polling mode)");
      } else {
        // In webhook mode, just delete the webhook
        await bot.telegram.deleteWebhook();
        console.log("✅ Webhook deleted successfully");
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
