const fs = require("fs");
const path = require("path");

// Files to process
const handlerFiles = [
  "bot/handlers/userHandlers.js",
  "bot/handlers/companyHandlers.js",
  "bot/handlers/callbackHandlers.js",
  "bot/handlers/adminHandlers.js",
  "bot/handlers/messageHandlers.js",
];

// Load existing locale file
const localePath = "bot/locales/en.json";
let localeData = {};

try {
  const localeContent = fs.readFileSync(localePath, "utf8");
  localeData = JSON.parse(localeContent);
} catch (error) {
  console.log("Creating new locale file...");
}

// Track new keys added
const newKeys = {};

function generateKey(message) {
  // Clean the message for key generation
  let key = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .trim();

  // Ensure it starts with msg_
  if (!key.startsWith("msg_")) {
    key = "msg_" + key;
  }

  // Truncate if too long
  if (key.length > 50) {
    key = key.substring(0, 50);
  }

  return key;
}

function processFile(filePath) {
  console.log(`Processing ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Pattern 1: ctx.reply("message")
  const pattern1 = /ctx\.reply\s*\(\s*["']([^"']+)["']\s*\)/g;
  content = content.replace(pattern1, (match, message) => {
    const key = generateKey(message);
    newKeys[key] = message;
    modified = true;
    return `ctx.reply(t("${key}", {}, ctx.session?.language || "en"))`;
  });

  // Pattern 2: ctx.reply('message')
  const pattern2 = /ctx\.reply\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  content = content.replace(pattern2, (match, message) => {
    const key = generateKey(message);
    newKeys[key] = message;
    modified = true;
    return `ctx.reply(t("${key}", {}, ctx.session?.language || "en"))`;
  });

  // Pattern 3: ctx.reply(`message`)
  const pattern3 = /ctx\.reply\s*\(\s*`([^`]+)`\s*\)/g;
  content = content.replace(pattern3, (match, message) => {
    const key = generateKey(message);
    newKeys[key] = message;
    modified = true;
    return `ctx.reply(t("${key}", {}, ctx.session?.language || "en"))`;
  });

  // Pattern 4: ctx.reply("message", options)
  const pattern4 = /ctx\.reply\s*\(\s*["']([^"']+)["']\s*,\s*([^)]+)\)/g;
  content = content.replace(pattern4, (match, message, options) => {
    const key = generateKey(message);
    newKeys[key] = message;
    modified = true;
    return `ctx.reply(t("${key}", {}, ctx.session?.language || "en"), ${options})`;
  });

  // Pattern 5: ctx.reply('message', options)
  const pattern5 = /ctx\.reply\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\)/g;
  content = content.replace(pattern5, (match, message, options) => {
    const key = generateKey(message);
    newKeys[key] = message;
    modified = true;
    return `ctx.reply(t("${key}", {}, ctx.session?.language || "en"), ${options})`;
  });

  // Pattern 6: ctx.reply(`message`, options)
  const pattern6 = /ctx\.reply\s*\(\s*`([^`]+)`\s*,\s*([^)]+)\)/g;
  content = content.replace(pattern6, (match, message, options) => {
    const key = generateKey(message);
    newKeys[key] = message;
    modified = true;
    return `ctx.reply(t("${key}", {}, ctx.session?.language || "en"), ${options})`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✓ Updated ${filePath}`);
  } else {
    console.log(`- No changes needed in ${filePath}`);
  }
}

// Process all files
console.log("Starting localization automation...\n");

handlerFiles.forEach(processFile);

// Add new keys to locale file
if (Object.keys(newKeys).length > 0) {
  console.log("\nAdding new keys to locale file...");

  Object.keys(newKeys).forEach((key) => {
    if (!localeData[key]) {
      localeData[key] = newKeys[key];
      console.log(`+ Added: ${key} = "${newKeys[key]}"`);
    }
  });

  // Write updated locale file
  const updatedLocaleContent = JSON.stringify(localeData, null, 2);
  fs.writeFileSync(localePath, updatedLocaleContent, "utf8");
  console.log(`\n✓ Updated ${localePath}`);
}

console.log("\nLocalization automation complete!");
console.log(`Total new keys added: ${Object.keys(newKeys).length}`);
