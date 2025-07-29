const fs = require("fs");
const path = require("path");

const adminHandlersPath = path.join(
  __dirname,
  "../bot/handlers/adminHandlers.js"
);

console.log("🧹 Cleaning up admin handlers...");

try {
  // Read the admin handlers file
  let content = fs.readFileSync(adminHandlersPath, "utf8");

  // Find all method definitions in the AdminHandlers class
  const classMatch = content.match(/class AdminHandlers \{([\s\S]*?)\n\}/);

  if (!classMatch) {
    console.log("❌ Could not find AdminHandlers class");
    process.exit(1);
  }

  const classBody = classMatch[1];

  // Find all method definitions
  const methodRegex = /async\s+(\w+)\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g;
  const methods = [];
  let match;

  while ((match = methodRegex.exec(classBody)) !== null) {
    const methodName = match[1];
    const methodBody = match[0];

    // Check if this is a stub (contains "Not implemented")
    const isStub = methodBody.includes("Not implemented");

    methods.push({
      name: methodName,
      body: methodBody,
      isStub: isStub,
      fullMatch: match[0],
    });
  }

  // Group methods by name
  const methodGroups = {};
  methods.forEach((method) => {
    if (!methodGroups[method.name]) {
      methodGroups[method.name] = [];
    }
    methodGroups[method.name].push(method);
  });

  // Find duplicates and remove stubs
  let cleanedContent = content;
  let removedCount = 0;

  Object.entries(methodGroups).forEach(([methodName, methodList]) => {
    if (methodList.length > 1) {
      console.log(
        `📋 Found ${methodList.length} implementations of ${methodName}:`
      );

      const stubs = methodList.filter((m) => m.isStub);
      const realMethods = methodList.filter((m) => !m.isStub);

      if (stubs.length > 0 && realMethods.length > 0) {
        console.log(
          `  ✅ Keeping real implementation, removing ${stubs.length} stub(s)`
        );

        // Remove all stubs for this method
        stubs.forEach((stub) => {
          cleanedContent = cleanedContent.replace(stub.fullMatch, "");
          removedCount++;
        });
      } else if (stubs.length > 1) {
        console.log(`  🗑️  Multiple stubs found, keeping only one`);

        // Keep only the first stub, remove the rest
        for (let i = 1; i < stubs.length; i++) {
          cleanedContent = cleanedContent.replace(stubs[i].fullMatch, "");
          removedCount++;
        }
      } else {
        console.log(`  ℹ️  No duplicates to clean`);
      }
    }
  });

  // Clean up extra whitespace and empty lines
  cleanedContent = cleanedContent
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Remove multiple empty lines
    .replace(/\n\s*\n\s*}/g, "\n}"); // Clean up before closing brace

  // Write the cleaned content back
  fs.writeFileSync(adminHandlersPath, cleanedContent, "utf8");

  console.log(`✅ Cleanup complete! Removed ${removedCount} duplicate stub(s)`);
  console.log("🔄 Restart your bot to see the changes");
} catch (error) {
  console.error("❌ Error during cleanup:", error.message);
  process.exit(1);
}
