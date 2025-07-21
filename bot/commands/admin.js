const adminHandlers = require('../handlers/adminHandlers');

module.exports = (ctx) => {
  return adminHandlers.handleAdminPanel(ctx);
};
