const { Markup } = require("telegraf");
const userService = require("../services/userService").userService;
const logger = require("../../utils/logger");

const userHandlers = require('../handlers/userHandlers');

module.exports = async (ctx) => {
  return userHandlers.handleStart(ctx);
};
