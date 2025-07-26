const { Markup } = require("telegraf");
const userService = require("../services/userService").userService;
const logger = require("../../utils/logger");

const userHandlers = require("../handlers/userHandlers");

module.exports = async (ctx) => {
  console.log("🚀 /start command received from user:", ctx.from.id);
  console.log("📝 User info:", {
    id: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name
  });
  return userHandlers.handleStart(ctx);
};
