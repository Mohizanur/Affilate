const fs = require("fs");
const path = require("path");

const localePath = path.join(__dirname, "../bot/locales/en.json");
const messages = JSON.parse(fs.readFileSync(localePath, "utf8"));

function t(key, vars = {}) {
  let msg = messages[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`{{${k}}}`, "g"), v);
  }
  return msg;
}

module.exports = { t };
