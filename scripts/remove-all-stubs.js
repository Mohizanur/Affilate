const fs = require("fs");
const path = require("path");

const adminHandlersPath = path.join(
  __dirname,
  "../bot/handlers/adminHandlers.js"
);

console.log("🗑️ Removing all stub methods from admin handlers...");

try {
  // Read the admin handlers file
  let content = fs.readFileSync(adminHandlersPath, "utf8");

  // Find all stub methods (methods that contain "Not implemented")
  const stubRegex =
    /async\s+(\w+)\s*\([^)]*\)\s*\{\s*ctx\.reply\('Not implemented:[^']*'\);\s*\}/g;

  let removedCount = 0;
  let cleanedContent = content;
  let match;

  while ((match = stubRegex.exec(content)) !== null) {
    const methodName = match[1];
    console.log(`🗑️ Removing stub: ${methodName}`);
    cleanedContent = cleanedContent.replace(match[0], "");
    removedCount++;
  }

  // Clean up extra whitespace and empty lines
  cleanedContent = cleanedContent
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Remove multiple empty lines
    .replace(/\n\s*\n\s*}/g, "\n}"); // Clean up before closing brace

  // Write the cleaned content back
  fs.writeFileSync(adminHandlersPath, cleanedContent, "utf8");

  console.log(`✅ Cleanup complete! Removed ${removedCount} stub method(s)`);
  console.log("🔄 Restart your bot to see the changes");
} catch (error) {
  console.error("❌ Error during cleanup:", error.message);
  process.exit(1);
}
