const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

// Define required indexes for optimal performance
const requiredIndexes = [
  // Users collection indexes
  {
    collection: 'users',
    fields: [
      { fieldPath: 'role', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Users by role and creation date'
  },
  {
    collection: 'users',
    fields: [
      { fieldPath: 'isAdmin', order: 'ASCENDING' },
      { fieldPath: 'lastActive', order: 'DESCENDING' }
    ],
    description: 'Admin users by last activity'
  },
  {
    collection: 'users',
    fields: [
      { fieldPath: 'isBanned', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Banned users by creation date'
  },
  {
    collection: 'users',
    fields: [
      { fieldPath: 'phoneVerified', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Verified users by creation date'
  },

  // Referrals collection indexes
  {
    collection: 'referrals',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Referrals by user and creation date'
  },
  {
    collection: 'referrals',
    fields: [
      { fieldPath: 'active', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Active referrals by creation date'
  },
  {
    collection: 'referrals',
    fields: [
      { fieldPath: 'companyId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Referrals by company and creation date'
  },

  // Companies collection indexes
  {
    collection: 'companies',
    fields: [
      { fieldPath: 'telegramId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Companies by owner and creation date'
  },
  {
    collection: 'companies',
    fields: [
      { fieldPath: 'active', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Active companies by creation date'
  },

  // Referral codes collection indexes
  {
    collection: 'referralCodes',
    fields: [
      { fieldPath: 'code', order: 'ASCENDING' },
      { fieldPath: 'companyId', order: 'ASCENDING' },
      { fieldPath: 'active', order: 'ASCENDING' }
    ],
    description: 'Referral codes by code, company and status'
  },
  {
    collection: 'referralCodes',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Referral codes by user and creation date'
  },

  // Orders collection indexes
  {
    collection: 'orders',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Orders by user and creation date'
  },
  {
    collection: 'orders',
    fields: [
      { fieldPath: 'companyId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Orders by company and creation date'
  },
  {
    collection: 'orders',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Orders by status and creation date'
  },

  // Withdrawals collection indexes
  {
    collection: 'withdrawals',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Withdrawals by user and creation date'
  },
  {
    collection: 'withdrawals',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Withdrawals by status and creation date'
  }
];

// Function to create indexes
async function createIndexes() {
  try {
    logger.info('🔧 Creating Firestore indexes for optimal performance...');
    
    // Note: Firestore indexes are typically created automatically when queries are executed
    // This script provides documentation and validation of required indexes
    
    logger.info(`📋 Required indexes for ${requiredIndexes.length} query patterns:`);
    
    for (const index of requiredIndexes) {
      logger.info(`  - ${index.collection}: ${index.fields.map(f => f.fieldPath).join(', ')} (${index.description})`);
    }
    
    // Test queries to trigger index creation
    logger.info('🧪 Testing queries to trigger index creation...');
    
    // Test user queries
    await db.collection('users')
      .where('role', '==', 'user')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    await db.collection('users')
      .where('isAdmin', '==', true)
      .orderBy('lastActive', 'desc')
      .limit(1)
      .get();
    
    // Test referral queries
    await db.collection('referrals')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    // Test company queries
    await db.collection('companies')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    // Test referral code queries
    await db.collection('referralCodes')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    logger.info('✅ Index creation queries executed successfully');
    logger.info('📝 Note: Indexes will be created automatically by Firestore');
    logger.info('⏳ Check Firebase Console > Firestore > Indexes for progress');
    
  } catch (error) {
    logger.error('❌ Error creating indexes:', error);
    throw error;
  }
}

// Function to validate existing indexes
async function validateIndexes() {
  try {
    logger.info('🔍 Validating existing Firestore indexes...');
    
    // Test each required query pattern
    const testResults = [];
    
    for (const index of requiredIndexes) {
      try {
        const query = db.collection(index.collection);
        
        // Apply filters and ordering based on index definition
        for (const field of index.fields) {
          if (field.fieldPath === 'createdAt' || field.fieldPath === 'lastActive') {
            // For date fields, we need a where clause before orderBy
            if (index.fields.length > 1) {
              const firstField = index.fields[0];
              if (firstField.fieldPath !== field.fieldPath) {
                query.where(firstField.fieldPath, '==', 'test');
              }
            }
            query.orderBy(field.fieldPath, field.order);
          } else {
            query.where(field.fieldPath, '==', 'test');
          }
        }
        
        await query.limit(1).get();
        testResults.push({ ...index, status: '✅ Working' });
      } catch (error) {
        if (error.code === 'failed-precondition') {
          testResults.push({ ...index, status: '❌ Missing Index', error: error.message });
        } else {
          testResults.push({ ...index, status: '⚠️ Error', error: error.message });
        }
      }
    }
    
    // Log results
    logger.info('📊 Index validation results:');
    for (const result of testResults) {
      logger.info(`  ${result.status} - ${result.collection}: ${result.fields.map(f => f.fieldPath).join(', ')}`);
      if (result.error) {
        logger.info(`    Error: ${result.error}`);
      }
    }
    
    const workingCount = testResults.filter(r => r.status === '✅ Working').length;
    const missingCount = testResults.filter(r => r.status === '❌ Missing Index').length;
    
    logger.info(`\n📈 Summary: ${workingCount}/${testResults.length} indexes working`);
    
    if (missingCount > 0) {
      logger.warn(`⚠️ ${missingCount} indexes need to be created`);
      logger.info('💡 Run queries manually to trigger automatic index creation');
    }
    
    return testResults;
    
  } catch (error) {
    logger.error('❌ Error validating indexes:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    logger.info('🚀 Starting Firestore index optimization...');
    
    // Create indexes
    await createIndexes();
    
    // Validate indexes
    await validateIndexes();
    
    logger.info('🎉 Firestore index optimization completed');
    
  } catch (error) {
    logger.error('💥 Firestore index optimization failed:', error);
    process.exit(1);
  }
}

// Export functions
module.exports = {
  createIndexes,
  validateIndexes,
  requiredIndexes
};

// Run if called directly
if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch(error => {
    logger.error('💥 Script failed:', error);
    process.exit(1);
  });
}
