const fs = require("fs");

const files = [
  "bot/handlers/userHandlers.js",
  "bot/handlers/companyHandlers.js",
  "bot/handlers/callbackHandlers.js",
  "bot/handlers/adminHandlers.js",
  "bot/handlers/messageHandlers.js",
];

files.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf8");
    content = content.replace(/userLanguage/g, 'ctx.session?.language || "en"');
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed userLanguage in ${filePath}`);
  }
});

console.log("🎉 All userLanguage variables fixed!");
