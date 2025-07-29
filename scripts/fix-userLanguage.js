const fs = require('fs');

// Read the file
const filePath = 'bot/handlers/userHandlers.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all userLanguage with ctx.session?.language || 'en'
content = content.replace(/userLanguage/g, 'ctx.session?.language || "en"');

// Write back
fs.writeFileSync(filePath, content);

console.log('✅ Fixed all userLanguage variables in userHandlers.js'); 