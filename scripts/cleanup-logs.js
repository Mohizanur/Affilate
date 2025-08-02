const fs = require("fs");
const path = require("path");

// Patterns to remove (excessive logging)
const patternsToRemove = [
  // Debug console.log statements
  /console\.log\(\[DEBUG\].*?\);?\s*/g,
  /console\.log\(`\[DEBUG\].*?`.*?\);?\s*/g,
  /console\.log\(`🔍.*?`.*?\);?\s*/g,
  /console\.log\(`Triggering.*?`.*?\);?\s*/g,
  /console\.log\(`CALLING.*?`.*?\);?\s*/g,
  /console\.log\(`🔍.*?`.*?\);?\s*/g,

  // Verbose info logs
  /console\.log\(`.*?loaded.*?`.*?\);?\s*/g,
  /console\.log\(`Loaded.*?`.*?\);?\s*/g,
  /console\.log\(`Entering.*?`.*?\);?\s*/g,
  /console\.log\(`Exiting.*?`.*?\);?\s*/g,
  /console\.log\(`TOP OF.*?`.*?\);?\s*/g,
  /console\.log\(`Callback data received:.*?`.*?\);?\s*/g,
  /console\.log\(`Callback query already answered.*?`.*?\);?\s*/g,
  /console\.log\(`Checking if user is banned:.*?`.*?\);?\s*/g,
  /console\.log\(`User is banned.*?`.*?\);?\s*/g,
  /console\.log\(`User not found.*?`.*?\);?\s*/g,
  /console\.log\(`User telegramId:.*?`.*?\);?\s*/g,
  /console\.log\(`User stats:.*?`.*?\);?\s*/g,
  /console\.log\(`Min payout:.*?`.*?\);?\s*/g,
  /console\.log\(`Company stats.*?`.*?\);?\s*/g,
  /console\.log\(`No company stats.*?`.*?\);?\s*/g,
  /console\.log\(`User not eligible.*?`.*?\);?\s*/g,
  /console\.log\(`User is eligible.*?`.*?\);?\s*/g,
  /console\.log\(`handleWithdrawCompany.*?`.*?\);?\s*/g,
  /console\.log\(`Company ID extracted:.*?`.*?\);?\s*/g,
  /console\.log\(`Company lookup result:.*?`.*?\);?\s*/g,
  /console\.log\(`No company found.*?`.*?\);?\s*/g,
  /console\.log\(`Session data:.*?`.*?\);?\s*/g,
  /console\.log\(`Withdrawal ID:.*?`.*?\);?\s*/g,
  /console\.log\(`Calling.*?`.*?\);?\s*/g,
  /console\.log\(`Error in.*?`.*?\);?\s*/g,
  /console\.log\(`adminService keys:.*?`.*?\);?\s*/g,
  /console\.log\(`🔍 Getting dashboard.*?`.*?\);?\s*/g,
  /console\.log\(`🔍 Got.*?`.*?\);?\s*/g,
  /console\.log\(`🔍 Adding.*?`.*?\);?\s*/g,
  /console\.log\(`Dashboard refresh.*?`.*?\);?\s*/g,
  /console\.log\(`callbackHandlers\.js loaded`\);?\s*/g,
  /console\.log\(`Deny withdrawal step.*?`.*?\);?\s*/g,
  /console\.log\(`denyWithdrawalId:.*?`.*?\);?\s*/g,
  /console\.log\(`handleCompanyDenyWithdrawal.*?`.*?\);?\s*/g,
  /console\.log\(`Error in handleCompanyDenyWithdrawal:.*?`.*?\);?\s*/g,
  /console\.log\(`Error in handleCompanyDenyWithdrawalReason:.*?`.*?\);?\s*/g,

  // Startup logs
  /console\.log\(`=== server\.js starting ===`\);?\s*/g,
  /console\.log\(`Loaded dotenv`\);?\s*/g,
  /console\.log\(`Loaded express`\);?\s*/g,
  /console\.log\(`Loaded cors`\);?\s*/g,
  /console\.log\(`Loaded helmet`\);?\s*/g,
  /console\.log\(`Loaded express-rate-limit`\);?\s*/g,
  /console\.log\(`Loaded \.\/bot \(startBot\)`\);?\s*/g,
  /console\.log\(`Loaded BOT_TOKEN:.*?`.*?\);?\s*/g,
  /console\.log\(`BOT_TOKEN loaded, length:.*?`.*?\);?\s*/g,
  /console\.log\(`🤖 Initializing Telegraf bot\.\.\.`\);?\s*/g,
  /console\.log\(`🟡 Initializing Firebase\.\.\.`\);?\s*/g,
  /console\.log\(`Top of server\.js \(diagnostic\)`\);?\s*/g,
  /console\.log\(`Inside startServer, before startBot`\);?\s*/g,
  /console\.log\(`Entering utils\/logger\.js`\);?\s*/g,
  /console\.log\(`Exiting utils\/logger\.js`\);?\s*/g,
];

// Files to process
const filesToProcess = [
  "server.js",
  "bot/index.js",
  "bot/handlers/userHandlers.js",
  "bot/handlers/companyHandlers.js",
  "bot/handlers/adminHandlers.js",
  "bot/handlers/callbackHandlers.js",
  "bot/handlers/messageHandlers.js",
  "utils/logger.js",
  "bot/config/performanceLogger.js",
];

function cleanupFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, "utf8");
    const originalContent = content;

    // Remove excessive console.log statements
    patternsToRemove.forEach((pattern) => {
      content = content.replace(pattern, "");
    });

    // Remove empty lines that might be left
    content = content.replace(/\n\s*\n\s*\n/g, "\n\n");

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`✅ Cleaned: ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

function main() {
  console.log("🧹 Starting log cleanup...");

  filesToProcess.forEach((file) => {
    cleanupFile(file);
  });

  console.log("✅ Log cleanup completed!");
  console.log("📝 Removed excessive debug and info console.log statements");
  console.log("🔒 Preserved all bot functionality and error logging");
}

if (require.main === module) {
  main();
}

module.exports = { cleanupFile, patternsToRemove };
