// 🔍 Quick script to check what's causing database reads
// Run this to see real-time database usage

const admin = require('firebase-admin');

// Initialize with your credentials
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

console.log('🔍 Checking Firestore usage patterns...\n');

async function checkUsage() {
  try {
    // Count documents in each collection
    const collections = ['users', 'companies', 'referrals', 'orders', 'products', 'referralCodes', 'withdrawals'];
    
    console.log('📊 Collection Sizes:');
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).count().get();
      console.log(`   ${collectionName}: ${snapshot.data().count} documents`);
    }
    
    console.log('\n📈 Recent Activity (last 24 hours):');
    
    // Check recent users
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUsers = await db.collection('users')
      .where('last_active', '>=', yesterday)
      .count()
      .get();
    console.log(`   Active users (24h): ${recentUsers.data().count}`);
    
    // Check recent referrals
    const recentReferrals = await db.collection('referrals')
      .where('createdAt', '>=', yesterday)
      .count()
      .get();
    console.log(`   New referrals (24h): ${recentReferrals.data().count}`);
    
    // Check recent orders
    const recentOrders = await db.collection('orders')
      .where('createdAt', '>=', yesterday)
      .count()
      .get();
    console.log(`   New orders (24h): ${recentOrders.data().count}`);
    
    console.log('\n✅ Check complete!');
    console.log('\n💡 Based on this data:');
    console.log(`   - If you have 100+ users and they're all active = high reads are NORMAL`);
    console.log(`   - If you have <10 users = indexes might still be building`);
    console.log(`   - Check Firebase Console for exact query patterns`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsage();

