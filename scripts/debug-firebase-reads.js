/**
 * 🔍 FIREBASE READS DEBUGGER
 * 
 * This script traces EVERY Firebase operation to find what's making database calls
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  // Try different possible paths
  let serviceAccount;
  try {
    serviceAccount = require('../credentials/firebase-service-account.json');
  } catch (e1) {
    try {
      serviceAccount = require('./credentials/firebase-service-account.json');
    } catch (e2) {
      // Use environment variables as fallback
      admin.initializeApp();
    }
  }
  
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  // Don't exit, try to continue with default credentials
}

const db = admin.firestore();

// Track all operations
let operationCount = 0;
let operations = [];

// Patch Firestore operations to log everything
const originalGet = db.collection.prototype.get;
const originalWhere = db.collection.prototype.where;
const originalOrderBy = db.collection.prototype.orderBy;
const originalLimit = db.collection.prototype.limit;
const originalDoc = db.collection.prototype.doc;
const originalCount = db.collection.prototype.count;

// Track query chain
let currentQuery = null;
let queryStack = [];

db.collection.prototype.get = function() {
  operationCount++;
  const collectionName = this._queryOptions?.parentPath?.split('/')[1] || 'unknown';
  const timestamp = new Date().toISOString();
  const stackTrace = new Error().stack.split('\n').slice(2, 10).join('\n');
  
  operations.push({
    type: 'READ',
    collection: collectionName,
    timestamp,
    stackTrace
  });
  
  console.log(`\n🔴 READ #${operationCount} on collection: ${collectionName}`);
  console.log(`📍 Stack trace:\n${stackTrace}`);
  
  return originalGet.apply(this, arguments);
};

db.collection.prototype.doc = function(docPath) {
  const doc = originalDoc.apply(this, arguments);
  const collectionName = this._queryOptions?.parentPath?.split('/')[1] || 'unknown';
  
  // Patch doc.get() too
  const originalDocGet = doc.get;
  doc.get = function() {
    operationCount++;
    const timestamp = new Date().toISOString();
    const stackTrace = new Error().stack.split('\n').slice(2, 10).join('\n');
    
    operations.push({
      type: 'READ',
      collection: collectionName,
      doc: docPath,
      timestamp,
      stackTrace
    });
    
    console.log(`\n🔴 READ #${operationCount} on doc: ${collectionName}/${docPath}`);
    console.log(`📍 Stack trace:\n${stackTrace}`);
    
    return originalDocGet.apply(this, arguments);
  };
  
  return doc;
};

db.collection.prototype.count = function() {
  const countQuery = originalCount.apply(this, arguments);
  const originalCountGet = countQuery.get.bind(countQuery);
  
  countQuery.get = function() {
    operationCount++;
    const collectionName = this._queryOptions?.parentPath?.split('/')[1] || 'unknown';
    const timestamp = new Date().toISOString();
    const stackTrace = new Error().stack.split('\n').slice(2, 10).join('\n');
    
    operations.push({
      type: 'COUNT',
      collection: collectionName,
      timestamp,
      stackTrace
    });
    
    console.log(`\n🟡 COUNT #${operationCount} on collection: ${collectionName}`);
    console.log(`📍 Stack trace:\n${stackTrace}`);
    
    return originalCountGet.apply(this, arguments);
  };
  
  return countQuery;
};

// Print summary
process.on('SIGINT', () => {
  console.log('\n\n📊 SUMMARY OF OPERATIONS:');
  console.log(`Total operations: ${operationCount}`);
  console.log('\nOperations by collection:');
  
  const byCollection = {};
  operations.forEach(op => {
    if (!byCollection[op.collection]) {
      byCollection[op.collection] = [];
    }
    byCollection[op.collection].push(op);
  });
  
  Object.keys(byCollection).forEach(collection => {
    console.log(`\n${collection}: ${byCollection[collection].length} operations`);
    byCollection[collection].forEach((op, i) => {
      console.log(`  ${i + 1}. ${op.type} at ${op.timestamp}`);
    });
  });
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('firebase-operations-log.json', JSON.stringify(operations, null, 2));
  console.log('\n✅ Full log saved to firebase-operations-log.json');
  
  process.exit(0);
});

console.log('🔍 Firebase Reads Debugger started!');
console.log('Monitoring all Firebase operations...');
console.log('Press Ctrl+C to stop and see summary\n');

// Keep the script running
setInterval(() => {
  console.log(`⏰ Still running... ${operationCount} operations detected so far`);
}, 60000); // Log every minute
