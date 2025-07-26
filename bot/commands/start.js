const { Markup } = require("telegraf");
const userService = require("../services/userService").userService;
const logger = require("../../utils/logger");

const userHandlers = require("../handlers/userHandlers");

module.exports = async (ctx) => {
  console.log("🚀 /start command received from user:", ctx.from.id);
  console.log("📝 Context:", JSON.stringify(ctx, null, 2));
  return userHandlers.handleStart(ctx);
};
