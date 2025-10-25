/**
 * 🔍 FIND ALL FIREBASE CALLS
 * 
 * This script scans the entire codebase to find EVERY Firebase operation
 */

const fs = require('fs');
const path = require('path');

const firebasePatterns = [
  /\.collection\(['"]([^'"]+)['"]\)/g,
  /\.doc\(['"]([^'"]+)['"]\)/g,
  /\.get\(\)/g,
  /\.where\([^)]+\)/g,
  /\.orderBy\([^)]+\)/g,
  /\.limit\([^)]+\)/g,
  /\.count\(\)\.get\(\)/g,
  /databaseService\./g,
  /admin\.firestore\(\)/g,
];

function scanDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // Skip node_modules and other non-relevant directories
    if (file === 'node_modules' || file === '.git' || file === 'credentials' || file === 'temp') {
      continue;
    }
    
    if (stat.isDirectory()) {
      scanDirectory(filePath, results);
    } else if (file.endsWith('.js')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(process.cwd(), filePath);
        
        for (const pattern of firebasePatterns) {
          const matches = [...content.matchAll(pattern)];
          if (matches.length > 0) {
            results.push({
              file: relativePath,
              pattern: pattern.toString(),
              matches: matches.length,
              lines: getLinesWithMatches(content, pattern)
            });
          }
        }
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
      }
    }
  }
  
  return results;
}

function getLinesWithMatches(content, pattern) {
  const lines = content.split('\n');
  const matches = [];
  
  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      matches.push({
        lineNumber: index + 1,
        line: line.trim().substring(0, 100)
      });
    }
  });
  
  return matches.slice(0, 5); // Return first 5 matches
}

// Scan bot directory
console.log('🔍 Scanning bot directory for Firebase operations...\n');
const results = scanDirectory('./bot');

// Group by file
const byFile = {};
results.forEach(result => {
  if (!byFile[result.file]) {
    byFile[result.file] = [];
  }
  byFile[result.file].push(result);
});

// Print results
console.log(`📊 Found ${results.length} Firebase operations in ${Object.keys(byFile).length} files\n`);

Object.keys(byFile).sort().forEach(file => {
  const fileResults = byFile[file];
  const totalMatches = fileResults.reduce((sum, r) => sum + r.matches, 0);
  
  console.log(`\n📄 ${file}`);
  console.log(`   Total Firebase operations: ${totalMatches}`);
  
  fileResults.forEach(result => {
    console.log(`   - Pattern: ${result.pattern.split('(')[0]}`);
    console.log(`     Matches: ${result.matches}`);
    
    if (result.lines.length > 0) {
      console.log(`     Examples:`);
      result.lines.forEach(line => {
        console.log(`       Line ${line.lineNumber}: ${line.line}`);
      });
    }
  });
});

// Summary
const byPattern = {};
results.forEach(result => {
  const patternName = result.pattern.split('(')[0];
  if (!byPattern[patternName]) {
    byPattern[patternName] = 0;
  }
  byPattern[patternName] += result.matches;
});

console.log('\n\n📊 SUMMARY BY OPERATION TYPE:\n');
Object.keys(byPattern).sort((a, b) => byPattern[b] - byPattern[a]).forEach(pattern => {
  console.log(`${pattern}: ${byPattern[pattern]}`);
});

// Save to file
const output = {
  scanDate: new Date().toISOString(),
  totalOperations: results.reduce((sum, r) => sum + r.matches, 0),
  files: byFile,
  summary: byPattern
};

fs.writeFileSync('firebase-operations-scan.json', JSON.stringify(output, null, 2));
console.log('\n✅ Full scan saved to firebase-operations-scan.json');
