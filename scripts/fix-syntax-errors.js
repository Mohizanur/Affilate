const fs = require("fs");
const path = require("path");

// Fix userHandlers.js
const userHandlersPath = path.join(
  __dirname,
  "..",
  "bot",
  "handlers",
  "userHandlers.js"
);
let userHandlersContent = fs.readFileSync(userHandlersPath, "utf8");

// Replace all instances of the invalid syntax
userHandlersContent = userHandlersContent.replace(
  /const ctx\.session\?\.language \|\| "en" = ([^;]+);/g,
  "const userLanguage = ctx.session?.language || $1;"
);

// Replace all instances of ctx.session?.language || "en" with userLanguage
userHandlersContent = userHandlersContent.replace(
  /ctx\.session\?\.language \|\| "en"/g,
  "userLanguage"
);

fs.writeFileSync(userHandlersPath, userHandlersContent);
console.log("Fixed userHandlers.js");

// Fix companyHandlers.js
const companyHandlersPath = path.join(
  __dirname,
  "..",
  "bot",
  "handlers",
  "companyHandlers.js"
);
let companyHandlersContent = fs.readFileSync(companyHandlersPath, "utf8");

// Replace all instances of the invalid syntax
companyHandlersContent = companyHandlersContent.replace(
  /const ctx\.session\?\.language \|\| "en" = ([^;]+);/g,
  "const userLanguage = ctx.session?.language || $1;"
);

// Replace all instances of ctx.session?.language || "en" with userLanguage
companyHandlersContent = companyHandlersContent.replace(
  /ctx\.session\?\.language \|\| "en"/g,
  "userLanguage"
);

fs.writeFileSync(companyHandlersPath, companyHandlersContent);
console.log("Fixed companyHandlers.js");

console.log("All syntax errors fixed!");
