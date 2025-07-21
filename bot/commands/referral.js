const userHandlers = require('../handlers/userHandlers');

module.exports = async (ctx) => {
  return userHandlers.handleMyReferrals(ctx);
};
