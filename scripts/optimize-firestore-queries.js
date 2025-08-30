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

// Optimized query functions
class OptimizedQueries {
  // Paginated user queries
  static async getUsersPaginated(page = 1, limit = 20, filters = {}) {
    try {
      let query = db.collection('users').orderBy('createdAt', 'desc');
      
      // Apply filters
      if (filters.role) query = query.where('role', '==', filters.role);
      if (filters.isAdmin !== undefined) query = query.where('isAdmin', '==', filters.isAdmin);
      if (filters.isBanned !== undefined) query = query.where('isBanned', '==', filters.isBanned);
      
      // Apply pagination
      query = query.limit(limit).offset((page - 1) * limit);
      
      const snapshot = await query.get();
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      logger.info(`Fetched ${users.length} users (page ${page}, limit ${limit})`);
      return users;
    } catch (error) {
      logger.error('Error fetching users with pagination:', error);
      throw error;
    }
  }

  // Optimized referral queries
  static async getReferralsPaginated(page = 1, limit = 50, filters = {}) {
    try {
      let query = db.collection('referrals').orderBy('createdAt', 'desc');
      
      // Apply filters
      if (filters.userId) query = query.where('userId', '==', filters.userId);
      if (filters.active !== undefined) query = query.where('active', '==', filters.active);
      
      // Apply pagination
      query = query.limit(limit).offset((page - 1) * limit);
      
      const snapshot = await query.get();
      const referrals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      logger.info(`Fetched ${referrals.length} referrals (page ${page}, limit ${limit})`);
      return referrals;
    } catch (error) {
      logger.error('Error fetching referrals with pagination:', error);
      throw error;
    }
  }

  // Optimized company queries
  static async getCompaniesPaginated(page = 1, limit = 20, filters = {}) {
    try {
      let query = db.collection('companies').orderBy('createdAt', 'desc');
      
      // Apply filters
      if (filters.telegramId) query = query.where('telegramId', '==', filters.telegramId);
      if (filters.active !== undefined) query = query.where('active', '==', filters.active);
      
      // Apply pagination
      query = query.limit(limit).offset((page - 1) * limit);
      
      const snapshot = await query.get();
      const companies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      logger.info(`Fetched ${companies.length} companies (page ${page}, limit ${limit})`);
      return companies;
    } catch (error) {
      logger.error('Error fetching companies with pagination:', error);
      throw error;
    }
  }

  // Get user count efficiently
  static async getUserCount() {
    try {
      const snapshot = await db.collection('users').count().get();
      const count = snapshot.data().count;
      logger.info(`Total users: ${count}`);
      return count;
    } catch (error) {
      logger.error('Error getting user count:', error);
      throw error;
    }
  }

  // Get top referrers efficiently
  static async getTopReferrers(limit = 10) {
    try {
      // Use aggregation query if possible, otherwise optimize the existing approach
      const referrals = await db.collection('referrals')
        .select('userId', 'createdAt')
        .where('active', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(1000) // Reasonable limit
        .get();
      
      // Process in memory efficiently
      const referralCounts = {};
      referrals.docs.forEach(doc => {
        const userId = doc.data().userId;
        referralCounts[userId] = (referralCounts[userId] || 0) + 1;
      });
      
      const leaderboard = Object.entries(referralCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      
      logger.info(`Generated top ${leaderboard.length} referrers`);
      return leaderboard;
    } catch (error) {
      logger.error('Error getting top referrers:', error);
      throw error;
    }
  }

  // Batch operations for efficiency
  static async batchUpdateUsers(updates) {
    try {
      const batch = db.batch();
      const updateCount = Object.keys(updates).length;
      
      for (const [telegramId, updateData] of Object.entries(updates)) {
        const userRef = db.collection('users').doc(telegramId.toString());
        batch.update(userRef, {
          ...updateData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      await batch.commit();
      logger.info(`Batch updated ${updateCount} users`);
      return updateCount;
    } catch (error) {
      logger.error('Error in batch user update:', error);
      throw error;
    }
  }
}

// Test the optimized queries
async function testOptimizedQueries() {
  try {
    logger.info('🧪 Testing optimized Firestore queries...');
    
    // Test paginated user queries
    const users = await OptimizedQueries.getUsersPaginated(1, 10);
    logger.info(`✅ Fetched ${users.length} users with pagination`);
    
    // Test user count
    const userCount = await OptimizedQueries.getUserCount();
    logger.info(`✅ User count: ${userCount}`);
    
    // Test top referrers
    const topReferrers = await OptimizedQueries.getTopReferrers(5);
    logger.info(`✅ Top referrers: ${topReferrers.length} found`);
    
    logger.info('✅ All optimized queries tested successfully');
  } catch (error) {
    logger.error('❌ Error testing optimized queries:', error);
  }
}

// Export for use in other modules
module.exports = {
  OptimizedQueries,
  testOptimizedQueries
};

// Run test if called directly
if (require.main === module) {
  testOptimizedQueries().then(() => {
    logger.info('🎉 Firestore optimization test completed');
    process.exit(0);
  }).catch(error => {
    logger.error('💥 Firestore optimization test failed:', error);
    process.exit(1);
  });
}
