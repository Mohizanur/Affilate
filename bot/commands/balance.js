const userHandlers = require('../handlers/userHandlers');

module.exports = async (ctx) => {
  return userHandlers.handleBalance(ctx);
};
