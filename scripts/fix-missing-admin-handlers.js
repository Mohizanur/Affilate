const fs = require('fs');
const path = require('path');

const adminHandlersPath = path.join(__dirname, '../bot/handlers/adminHandlers.js');
const callbackHandlersPath = path.join(__dirname, '../bot/handlers/callbackHandlers.js');

const adminHandlersSrc = fs.readFileSync(adminHandlersPath, 'utf8');
const callbackHandlersSrc = fs.readFileSync(callbackHandlersPath, 'utf8');

// Find all adminHandlers.functionName references in callbackHandlers.js
const adminHandlerCalls = Array.from(callbackHandlersSrc.matchAll(/adminHandlers\.(handle\w+)/g)).map(m => m[1]);
const uniqueHandlerCalls = Array.from(new Set(adminHandlerCalls));

// Find all function definitions in adminHandlers.js
const definedHandlers = Array.from(adminHandlersSrc.matchAll(/async (handle\w+)\s*\(/g)).map(m => m[1]);

// Find missing handlers
const missingHandlers = uniqueHandlerCalls.filter(fn => !definedHandlers.includes(fn));

if (missingHandlers.length === 0) {
  console.log('✅ No missing admin handler functions!');
  process.exit(0);
}

console.log('🛠️ Adding stubs for missing admin handler functions:', missingHandlers);

// Add stubs at the end of the file
let newSrc = adminHandlersSrc.trim();
for (const fn of missingHandlers) {
  newSrc += `\n\n  async ${fn}(ctx) {\n    ctx.reply('Not implemented: ${fn}');\n  }`;
}
newSrc += '\n';

fs.writeFileSync(adminHandlersPath, newSrc, 'utf8');
console.log('✅ Added stubs for missing admin handler functions.'); 