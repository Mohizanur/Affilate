const fs = require("fs");
const path = require("path");

// Load all locale files
const locales = {};
const localesDir = path.join(__dirname, "../bot/locales");

try {
  const localeFiles = fs.readdirSync(localesDir);
  localeFiles.forEach((file) => {
    if (file.endsWith(".json")) {
      const localeCode = file.replace(".json", "");
      const localePath = path.join(localesDir, file);
      locales[localeCode] = JSON.parse(fs.readFileSync(localePath, "utf8"));
    }
  });
} catch (error) {
  console.error("Error loading locales:", error);
}

// Default to English if no locale is specified
const defaultLocale = "en";

function t(key, vars = {}, locale = defaultLocale) {
  // Get messages for the specified locale, fallback to default
  const messages = locales[locale] || locales[defaultLocale] || {};
  let msg = messages[key] || key;

  // Replace variables
  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`{{${k}}}`, "g"), v);
  }

  return msg;
}

// Get available locales
function getAvailableLocales() {
  return Object.keys(locales);
}

// Check if a locale exists
function hasLocale(locale) {
  return locales.hasOwnProperty(locale);
}

module.exports = { t, getAvailableLocales, hasLocale };
