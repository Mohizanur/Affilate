process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
console.log("Hello from server-test.js");
require("./bot");
console.log("After requiring bot in server-test.js"); 