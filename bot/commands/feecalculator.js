module.exports = async (ctx) => {
  const userHandlers = require('../handlers/userHandlers');
  return userHandlers.handleFeeCalculator(ctx);
}; 