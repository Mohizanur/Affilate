/**
 * 🧪 TEST SMART CACHING SYSTEM
 * Test the performance improvement from user caching
 */

const smartUserService = require('./bot/services/smartUserService');

async function testCachingPerformance() {
  console.log('🧪 Testing Smart Caching Performance...\n');

  const testUserId = 123456789;
  
  // Test 1: First request (should hit database)
  console.log('📊 Test 1: First request (cache miss)');
  const start1 = Date.now();
  try {
    const user1 = await smartUserService.getUserByTelegramId(testUserId);
    const time1 = Date.now() - start1;
    console.log(`✅ First request completed in ${time1}ms`);
    console.log(`📝 User found: ${user1 ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(`❌ First request failed: ${error.message}`);
  }

  // Test 2: Second request (should hit cache)
  console.log('\n📊 Test 2: Second request (cache hit)');
  const start2 = Date.now();
  try {
    const user2 = await smartUserService.getUserByTelegramId(testUserId);
    const time2 = Date.now() - start2;
    console.log(`✅ Second request completed in ${time2}ms`);
    console.log(`📝 User found: ${user2 ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(`❌ Second request failed: ${error.message}`);
  }

  // Test 3: Third request (should hit cache)
  console.log('\n📊 Test 3: Third request (cache hit)');
  const start3 = Date.now();
  try {
    const user3 = await smartUserService.getUserByTelegramId(testUserId);
    const time3 = Date.now() - start3;
    console.log(`✅ Third request completed in ${time3}ms`);
    console.log(`📝 User found: ${user3 ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(`❌ Third request failed: ${error.message}`);
  }

  // Test 4: Cache statistics
  console.log('\n📊 Test 4: Cache Statistics');
  const stats = smartUserService.getCacheStats();
  console.log('📈 Cache Stats:', JSON.stringify(stats, null, 2));

  // Test 5: Admin check (cached)
  console.log('\n📊 Test 5: Admin check (cached)');
  const start5 = Date.now();
  try {
    const isAdmin = await smartUserService.isAdmin(testUserId);
    const time5 = Date.now() - start5;
    console.log(`✅ Admin check completed in ${time5}ms`);
    console.log(`👑 Is admin: ${isAdmin}`);
  } catch (error) {
    console.log(`❌ Admin check failed: ${error.message}`);
  }

  // Test 6: Verification check (cached)
  console.log('\n📊 Test 6: Verification check (cached)');
  const start6 = Date.now();
  try {
    const isVerified = await smartUserService.isVerified(testUserId);
    const time6 = Date.now() - start6;
    console.log(`✅ Verification check completed in ${time6}ms`);
    console.log(`📱 Is verified: ${isVerified}`);
  } catch (error) {
    console.log(`❌ Verification check failed: ${error.message}`);
  }

  console.log('\n🎯 CACHING PERFORMANCE TEST COMPLETE!');
  console.log('📊 Expected Results:');
  console.log('   • First request: ~100-500ms (database)');
  console.log('   • Subsequent requests: ~1-5ms (cache)');
  console.log('   • Performance improvement: 20-100x faster');
  console.log('   • Quota savings: 80-95% reduction in database reads');
}

// Run the test
testCachingPerformance().catch(console.error);
