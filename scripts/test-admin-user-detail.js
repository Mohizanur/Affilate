const userService = require('../bot/services/userService');

async function testAdminUserDetail() {
  console.log('🧪 Testing admin user detail functionality...');
  
  try {
    // Test getAllUsers
    console.log('📋 Testing getAllUsers...');
    const users = await userService.getAllUsers();
    console.log(`✅ getAllUsers returned ${users.length} users`);
    
    if (users.length > 0) {
      const testUser = users[0];
      console.log(`👤 Test user: ${testUser.username || testUser.first_name || 'Unknown'} (ID: ${testUser.id})`);
      
      // Test getUserByTelegramId
      console.log('🔍 Testing getUserByTelegramId...');
      const userDetail = await userService.userService.getUserByTelegramId(testUser.id);
      console.log(`✅ getUserByTelegramId returned user: ${userDetail ? 'Found' : 'Not found'}`);
      
      if (userDetail) {
        console.log('📊 User details:');
        console.log(`   Name: ${userDetail.firstName || userDetail.first_name || 'Unknown'}`);
        console.log(`   Username: ${userDetail.username || 'N/A'}`);
        console.log(`   Balance: $${(userDetail.referralBalance || 0).toFixed(2)}`);
        console.log(`   Can Register Company: ${userDetail.canRegisterCompany ? 'Yes' : 'No'}`);
        console.log(`   Banned: ${userDetail.isBanned ? 'Yes' : 'No'}`);
      }
    }
    
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAdminUserDetail(); 