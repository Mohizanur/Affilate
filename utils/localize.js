const fs = require("fs");
const path = require("path");

// Load all locale files
const localesPath = path.join(__dirname, "../bot/locales");
const messages = {};

// Load all JSON files from locales directory
try {
  const localeFiles = fs
    .readdirSync(localesPath)
    .filter((file) => file.endsWith(".json"));
  localeFiles.forEach((file) => {
    const locale = file.replace(".json", "");
    const localePath = path.join(localesPath, file);
    messages[locale] = JSON.parse(fs.readFileSync(localePath, "utf8"));
  });
} catch (error) {
  console.error("Error loading locale files:", error);
  // Fallback to English
  const enPath = path.join(localesPath, "en.json");
  messages.en = JSON.parse(fs.readFileSync(enPath, "utf8"));
}

function t(key, vars = {}, locale = "en") {
  const localeMessages = messages[locale] || {};
  let msg = localeMessages[key];

  // If message not found in requested locale, try English fallback
  if (!msg && locale !== "en" && messages.en) {
    msg = messages.en[key];
  }

  // If still not found, use the key as fallback
  if (!msg) {
    msg = key;
  }

  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`{{${k}}}`, "g"), v);
  }
  return msg;
}

// Get available languages
function getAvailableLanguages() {
  return Object.keys(messages);
}

// Check if a language is supported
function isLanguageSupported(locale) {
  return Object.keys(messages).includes(locale);
}

module.exports = { t, getAvailableLanguages, isLanguageSupported };
