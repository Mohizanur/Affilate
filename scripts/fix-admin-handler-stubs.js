const fs = require("fs");
const path = require("path");

const adminHandlersPath = path.join(
  __dirname,
  "../bot/handlers/adminHandlers.js"
);
let src = fs.readFileSync(adminHandlersPath, "utf8");

// Find the AdminHandlers class
const classStart = src.indexOf("class AdminHandlers");
if (classStart === -1) {
  console.error("❌ AdminHandlers class not found!");
  process.exit(1);
}

// Find the end of the class (last closing })
const classEnd = src.lastIndexOf("}");
if (classEnd === -1) {
  console.error("❌ Could not find end of AdminHandlers class!");
  process.exit(1);
}

// Find all top-level async handleX(ctx) { ... } stubs at the end of the file
const stubRegex =
  /\n\s*async (handle\w+)\s*\(ctx\) \{[^}]+Not implemented: \1[^}]+\}/g;
let stubs = [];
let match;
while ((match = stubRegex.exec(src)) !== null) {
  stubs.push(match[0]);
}

if (stubs.length === 0) {
  console.log("✅ No top-level admin handler stubs to move.");
  process.exit(0);
}

console.log(
  "🛠️ Moving stubs into AdminHandlers class:",
  stubs.map((s) => s.match(/handle\w+/)[0])
);

// Remove stubs from the end of the file
let newSrc = src;
for (const stub of stubs) {
  newSrc = newSrc.replace(stub, "");
}

// Insert stubs just before the last closing } of the class
const beforeClassEnd = newSrc.lastIndexOf("}", classEnd - 1);
const insertPos = beforeClassEnd;
const stubsText = "\n" + stubs.join("\n") + "\n";
newSrc = newSrc.slice(0, insertPos) + stubsText + newSrc.slice(insertPos);

fs.writeFileSync(adminHandlersPath, newSrc, "utf8");
console.log("✅ Moved all admin handler stubs into the class.");
