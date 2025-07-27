const fs = require('fs');
const path = require('path');

// Function to clean JSON file by removing duplicates
function cleanJsonFile(filePath) {
  try {
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    console.log(`Original file has ${Object.keys(data).length} keys`);
    
    // Create a new object to store unique keys
    const cleanedData = {};
    const duplicates = [];
    
    // Process each key
    for (const [key, value] of Object.entries(data)) {
      if (cleanedData.hasOwnProperty(key)) {
        // This is a duplicate
        duplicates.push(key);
        console.log(`Duplicate found: "${key}"`);
      } else {
        // This is a new key
        cleanedData[key] = value;
      }
    }
    
    console.log(`\nFound ${duplicates.length} duplicate keys:`);
    duplicates.forEach(dup => console.log(`  - ${dup}`));
    
    console.log(`\nCleaned file has ${Object.keys(cleanedData).length} unique keys`);
    console.log(`Removed ${duplicates.length} duplicates`);
    
    // Write the cleaned data back to file
    const cleanedContent = JSON.stringify(cleanedData, null, 2);
    fs.writeFileSync(filePath, cleanedContent, 'utf8');
    
    console.log(`\n✅ Successfully cleaned ${filePath}`);
    console.log(`📊 Summary:`);
    console.log(`   - Original keys: ${Object.keys(data).length}`);
    console.log(`   - Unique keys: ${Object.keys(cleanedData).length}`);
    console.log(`   - Duplicates removed: ${duplicates.length}`);
    
    return {
      originalCount: Object.keys(data).length,
      uniqueCount: Object.keys(cleanedData).length,
      duplicatesRemoved: duplicates.length,
      duplicates: duplicates
    };
    
  } catch (error) {
    console.error(`❌ Error cleaning file: ${error.message}`);
    return null;
  }
}

// Main execution
function main() {
  const filePath = path.join(__dirname, '..', 'bot', 'locales', 'am.json');
  
  console.log('🧹 Cleaning Amharic localization file...');
  console.log(`📁 File: ${filePath}`);
  console.log('=' .repeat(50));
  
  const result = cleanJsonFile(filePath);
  
  if (result) {
    console.log('\n🎉 Cleaning completed successfully!');
    
    if (result.duplicates.length > 0) {
      console.log('\n📋 List of removed duplicates:');
      result.duplicates.forEach((dup, index) => {
        console.log(`   ${index + 1}. ${dup}`);
      });
    }
  } else {
    console.log('\n❌ Cleaning failed!');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { cleanJsonFile }; 