// Top-level error handlers and startup log
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception (global):", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection (global):", reason);
  // Optionally, add more sophisticated logging or alerting here
});
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

// Error Handling
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

console.log("Top of server.js");
console.log("Before startServer()");

async function startServer() {
  try {
    console.log("Inside startServer, before startBot");
    const bot = await startBot(app); // Pass the Express app
    console.log("✅ Bot started successfully");

    // After bot is initialized but before bot.launch()
    if (bot && bot.telegram && bot.telegram.setMyCommands) {
      bot.telegram.setMyCommands([
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
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      if (process.env.RENDER) {
        console.log(`🌐 Render deployment detected`);
        console.log(
          `🔗 External URL: https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
        );
      }
    });
  } catch (err) {
    console.error("Fatal error in startServer:", err); // Added detailed error log
    process.exit(1);
  }
}

startServer();
console.log("After startServer() call");

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
