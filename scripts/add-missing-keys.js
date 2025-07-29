const fs = require("fs");
const path = require("path");

// Read the temp_keys.txt file
const tempKeysPath = path.join(__dirname, "..", "temp_keys.txt");
const tempKeysContent = fs.readFileSync(tempKeysPath, "utf8");

// Parse the keys from temp_keys.txt
const keys = tempKeysContent
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => line.trim());

console.log(`Found ${keys.length} keys to add`);

// Find all locale files
const localesDir = path.join(__dirname, "..", "bot", "locales");
const localeFiles = fs
  .readdirSync(localesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => path.join(localesDir, file));

console.log(`Found ${localeFiles.length} locale files`);

// Process each locale file
localeFiles.forEach((localeFile) => {
  console.log(`Processing ${path.basename(localeFile)}`);

  const localeData = JSON.parse(fs.readFileSync(localeFile, "utf8"));
  let addedCount = 0;

  keys.forEach((key) => {
    if (!localeData[key]) {
      localeData[key] = key; // Use key as default value
      addedCount++;
    }
  });

  if (addedCount > 0) {
    fs.writeFileSync(localeFile, JSON.stringify(localeData, null, 2));
    console.log(
      `Added ${addedCount} missing keys to ${path.basename(localeFile)}`
    );
  } else {
    console.log(`No missing keys in ${path.basename(localeFile)}`);
  }
});

console.log("Done! All missing keys have been added to locale files.");
