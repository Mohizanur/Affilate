process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  // Don't exit for network-related errors
  if (err.code === "ETIMEDOUT" || err.code === "ENOTFOUND") {
    console.log("⚠️ Network error detected, continuing...");
    return;
  }
  // For other exceptions, log but don't exit in development
  if (process.env.NODE_ENV !== "production") {
    console.log("⚠️ Uncaught exception logged, continuing in development...");
    return;
  }
  // Only exit in production for non-network errors
  console.error("FATAL ERROR - exiting process");
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
  // Don't exit the process for network-related errors
  if (reason && reason.code === "ETIMEDOUT") {
    console.log("⚠️ Network timeout detected, continuing...");
    return; // Don't let the process exit
  }
  // For other unhandled rejections, log but don't exit
  console.log("⚠️ Unhandled rejection logged, continuing...");
});
// Top-level error handlers and startup log
// Note: More specific error handlers are defined in bot/index.js
console.log("=== server.js starting ===");

require("dotenv").config();
console.log("Loaded dotenv");
const express = require("express");
console.log("Loaded express");
const cors = require("cors");
console.log("Loaded cors");
const helmet = require("helmet");
console.log("Loaded helmet");
const rateLimit = require("express-rate-limit");
console.log("Loaded express-rate-limit");
const { startBot } = require("./bot");
console.log("Loaded ./bot (startBot)");
const apiRoutes = require("./api/routes");
const cron = require("node-cron");
const notificationService = require("./bot/services/notificationService");
const userService = require("./bot/services/userService");
const companyService = require("./bot/services/companyService");

const app = express();
const PORT = process.env.PORT || 3000;

process.on("exit", (code) => {
  console.log("Process exit event with code:", code);
});

console.log("Top of server.js (diagnostic)");

// Keep-alive mechanism for Render free tier
let keepAliveInterval;
if (process.env.RENDER) {
  console.log("🌐 Render environment detected - setting up keep-alive");
  keepAliveInterval = setInterval(() => {
    console.log("💓 Keep-alive ping - preventing spin down");
  }, 14 * 60 * 1000); // Ping every 14 minutes (Render spins down after 15 minutes)
}

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, try again later.",
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.send("✅ Bot API Running");
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Keep-alive endpoint for Render
app.get("/keep-alive", (req, res) => {
  console.log("💓 Keep-alive request received");
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error Handling
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

console.log("Top of server.js");
console.log("Before startServer()");

(async () => {
  try {
    console.log("Inside startServer, before startBot");
    const bot = await startBot(app); // Pass the Express app
    console.log("✅ Bot started successfully");

    // After bot is initialized but before bot.launch()
    if (bot && bot.telegram && bot.telegram.setMyCommands) {
      try {
        await bot.telegram.setMyCommands([
        { command: "start", description: "Start or restart the bot" },
        { command: "browse", description: "Browse products" },
        { command: "referrals", description: "My referrals & codes" },
        { command: "favorites", description: "View your favorite products" },
        { command: "cart", description: "View your cart" },
        { command: "profile", description: "Your profile & settings" },
        { command: "leaderboard", description: "Top referrers" },
        { command: "help", description: "Help & support" },
        { command: "company", description: "Company dashboard (owners)" },
        { command: "admin", description: "Admin panel (admins)" },
        { command: "withdraw", description: "Request a withdrawal" },
        { command: "orders", description: "Your order history" },
        // Add more as needed for your elite UX
      ]);
        console.log("✅ Bot commands set successfully");
      } catch (error) {
        console.log(
          "⚠️ Could not set bot commands (network issue):",
          error.message
        );
        console.log("📝 Bot will work without custom commands");
      }
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      if (process.env.RENDER) {
        console.log(`🌐 Render deployment detected`);
        console.log(
          `🔗 External URL: https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
        );

        // Set up external keep-alive for Render
        const keepAliveUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/keep-alive`;
        console.log(`💓 Setting up external keep-alive to: ${keepAliveUrl}`);

        // Ping the keep-alive endpoint every 14 minutes
        setInterval(async () => {
          try {
            const response = await fetch(keepAliveUrl);
            if (response.ok) {
              console.log("💓 External keep-alive successful");
            } else {
              console.log("⚠️ External keep-alive failed:", response.status);
            }
          } catch (error) {
            console.log("⚠️ External keep-alive error:", error.message);
          }
        }, 14 * 60 * 1000);
      }
    });
  } catch (err) {
    console.error("FATAL ERROR DURING STARTUP:", err);
    process.exit(1);
  }
})();

console.log("After startServer() call");

// Cleanup function for graceful shutdown
function cleanup() {
  console.log("🧹 Cleaning up resources...");
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    console.log("✅ Keep-alive interval cleared");
  }
}

// Graceful shutdown handlers
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, cleaning up...");
  cleanup();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, cleaning up...");
  cleanup();
  process.exit(0);
});

// Scheduled reminders: every day at 9am
cron.schedule("0 9 * * *", async () => {
  // Companies: remind to approve pending purchases
  const companies = await companyService.getAllCompanies();
  for (const company of companies) {
    if (company.telegramId) {
      await notificationService.sendNotification(
        company.telegramId,
        `⏰ Reminder: You have ${company.pendingPurchases.length} pending purchase(s) to approve in your dashboard.`
      );
    }
  }
  // Users: remind to claim rewards (if any logic for unclaimed rewards)
  const users = await userService.getAllUsers();
  for (const user of users) {
    if (user.coinBalance > 0 && user.telegramId) {
      await notificationService.sendNotification(
        user.telegramId,
        `⏰ Reminder: You have rewards to claim! Use /balance to withdraw your earnings.`
      );
    }
  }
});

// Schedule cleanup of expired referral codes daily at 2am
const { exec } = require("child_process");
cron.schedule("0 2 * * *", () => {
  exec(
    "node scripts/cleanup_expired_referral_codes.js",
    (error, stdout, stderr) => {
      if (error) {
        console.error(
          "Error running cleanup_expired_referral_codes.js:",
          error
        );
        return;
      }
      if (stdout)
        console.log("cleanup_expired_referral_codes.js output:", stdout);
      if (stderr)
        console.error(
          "cleanup_expired_referral_codes.js error output:",
          stderr
        );
    }
  );
});
