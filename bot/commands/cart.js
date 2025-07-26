const userHandlers = require("../handlers/userHandlers");

module.exports = (ctx) => {
  return userHandlers.handleCart(ctx);
};
