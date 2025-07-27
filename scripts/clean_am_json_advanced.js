const fs = require('fs');
const path = require('path');

// Function to clean JSON file by removing duplicates
function cleanJsonFileAdvanced(filePath) {
  try {
    // Read the file as string first to preserve formatting
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse the JSON
    const data = JSON.parse(fileContent);
    
    console.log(`Original file has ${Object.keys(data).length} keys`);
    
    // Create a new object to store unique keys
    const cleanedData = {};
    const duplicates = [];
    const seenKeys = new Set();
    
    // Process each key
    for (const [key, value] of Object.entries(data)) {
      if (seenKeys.has(key)) {
        // This is a duplicate
        duplicates.push(key);
        console.log(`Duplicate found: "${key}"`);
      } else {
        // This is a new key
        cleanedData[key] = value;
        seenKeys.add(key);
      }
    }
    
    console.log(`\nFound ${duplicates.length} duplicate keys:`);
    duplicates.forEach(dup => console.log(`  - ${dup}`));
    
    console.log(`\nCleaned file has ${Object.keys(cleanedData).length} unique keys`);
    console.log(`Removed ${duplicates.length} duplicates`);
    
    // Write the cleaned data back to file with proper formatting
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

// Function to analyze the file and find all duplicates
function analyzeDuplicates(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    const keyCounts = {};
    const duplicates = [];
    
    // Count occurrences of each key
    for (const key of Object.keys(data)) {
      keyCounts[key] = (keyCounts[key] || 0) + 1;
    }
    
    // Find keys that appear more than once
    for (const [key, count] of Object.entries(keyCounts)) {
      if (count > 1) {
        duplicates.push({ key, count });
      }
    }
    
    console.log(`\n🔍 Analysis Results:`);
    console.log(`Total keys in file: ${Object.keys(data).length}`);
    console.log(`Unique keys: ${Object.keys(keyCounts).length}`);
    console.log(`Duplicate keys found: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      console.log(`\n📋 Duplicate keys:`);
      duplicates.forEach(({ key, count }) => {
        console.log(`  - "${key}" appears ${count} times`);
      });
    }
    
    return duplicates;
    
  } catch (error) {
    console.error(`❌ Error analyzing file: ${error.message}`);
    return [];
  }
}

// Main execution
function main() {
  const filePath = path.join(__dirname, '..', 'bot', 'locales', 'am.json');
  
  console.log('🔍 Analyzing Amharic localization file...');
  console.log(`📁 File: ${filePath}`);
  console.log('=' .repeat(50));
  
  // First analyze the file
  const duplicates = analyzeDuplicates(filePath);
  
  if (duplicates.length > 0) {
    console.log('\n🧹 Cleaning file...');
    console.log('=' .repeat(50));
    
    const result = cleanJsonFileAdvanced(filePath);
    
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
  } else {
    console.log('\n✅ No duplicates found! File is already clean.');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { cleanJsonFileAdvanced, analyzeDuplicates }; 