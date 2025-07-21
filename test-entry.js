console.log("Hello from test-entry.js");
require("./server.js");
console.log("After requiring server.js");
const databaseService = require('./bot/config/database');
(async () => {
  await databaseService.initialize();
  // Place your test code here, e.g.:
  // const userService = require('./bot/services/userService').userService;
  // userService.getUserByUsername('Omafesrun').then(console.log).catch(console.error);
})(); 