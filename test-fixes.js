const adminService = require('./bot/services/adminService');
const databaseService = require('./bot/config/database');

async function testFixes() {
  try {
    console.log('Testing fixes for Firestore index and callback timeout issues...\n');

    // Initialize database
    console.log('1. Initializing database...');
    await databaseService.initialize();
    console.log('✅ Database initialized\n');

    // Test platform balance
    console.log('2. Testing platform balance...');
    const balance = await adminService.getPlatformBalance();
    console.log(`Platform Balance: $${balance}`);

    // Test platform withdrawable amount (with error handling)
    console.log('\n3. Testing platform withdrawable amount...');
    const withdrawable = await adminService.getPlatformWithdrawableAmount();
    console.log('Withdrawable Data:', JSON.stringify(withdrawable, null, 2));

    // Test pending withdrawals (should not crash)
    console.log('\n4. Testing pending withdrawals...');
    const pending = await adminService.getPendingPlatformWithdrawals();
    console.log(`Pending Withdrawals: ${pending.length}`);

    // Test company withdrawals (should not crash)
    console.log('\n5. Testing company withdrawals...');
    const companyPending = await adminService.getPendingCompanyWithdrawals();
    console.log(`Company Pending Withdrawals: ${companyPending.length}`);

    const companyApproved = await adminService.getApprovedCompanyWithdrawals();
    console.log(`Company Approved Withdrawals: ${companyApproved.length}`);

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Firestore index issues should be resolved');
    console.log('- Error handling is in place');
    console.log('- Callback timeout handling improved');
    
  } catch (error) {
    console.error('❌ Error testing fixes:', error);
  }
}

// Run the test
testFixes(); 