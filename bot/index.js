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
const messageHandlers = require("./handlers/messageHandlers");
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

  // ✅ ADD BROADCAST MESSAGE HANDLER
  bot.on("text", async (ctx) => {
    try {
      // This handler should be removed and logic moved to messageHandlers.js
    } catch (error) {
      logger.error("Error handling broadcast message:", error);
      ctx.reply("❌ Something went wrong. Please try again.");
    }
  });
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
    bot = new Telegraf(token);

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

    // Test bot connection first
    console.log("Before bot.telegram.getMe()");
    const botInfo = await bot.telegram.getMe();
    console.log(
      `✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`
    );

    console.log("Before bot.telegram.deleteWebhook()");
    await bot.telegram.deleteWebhook();
    console.log("After bot.telegram.deleteWebhook()");

    // Set bot commands before launching
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
        { command: "withdraw", description: "Request a withdrawal" },
        {
          command: "feecalculator",
          description: "Calculate fee for a transaction",
        },
        { command: "company", description: "Company dashboard (owners)" },
        { command: "admin", description: "Admin panel (admins)" },
      ];

      await bot.telegram.setMyCommands(commands);
    }

    // Launch bot
    console.log("Before bot.launch()");
    await bot.launch();
    console.log("After bot.launch()");

    console.log("🚀 Bot initialization complete");
    return bot;
  } catch (error) {
    console.error("❌ Error inside startBot():", error);
    throw error;
  }
}

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("🛑 Received SIGINT, stopping bot...");
  if (bot) {
    bot.stop("SIGINT");
  }
  process.exit(0);
});

process.once("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, stopping bot...");
  if (bot) {
    bot.stop("SIGTERM");
  }
  process.exit(0);
});

module.exports = { getBot, startBot };
