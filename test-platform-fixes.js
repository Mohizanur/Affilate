const adminService = require('./bot/services/adminService');
const databaseService = require('./bot/services/databaseService');

async function testPlatformFixes() {
  console.log('🧪 Testing Platform Analytics and Withdrawal Fixes\n');

  try {
    // Test 1: Check platform balance
    console.log('1. Testing Platform Balance...');
    const platformBalance = await adminService.getPlatformBalance();
    console.log(`   Platform Balance: $${platformBalance.toFixed(2)}`);

    // Test 2: Check platform withdrawable amount
    console.log('\n2. Testing Platform Withdrawable Amount...');
    const platformWithdrawable = await adminService.getPlatformWithdrawableAmount();
    console.log(`   Total Balance: $${platformWithdrawable.totalBalance.toFixed(2)}`);
    console.log(`   Pending Withdrawals: $${platformWithdrawable.pendingWithdrawals.toFixed(2)}`);
    console.log(`   Withdrawable: $${platformWithdrawable.withdrawable.toFixed(2)}`);

    // Test 3: Check company analytics
    console.log('\n3. Testing Company Analytics...');
    const companyAnalytics = await adminService.getCompanyAnalytics();
    console.log(`   Found ${companyAnalytics.length} companies`);

    companyAnalytics.forEach((company, index) => {
      console.log(`\n   Company ${index + 1}: ${company.name}`);
      console.log(`     Lifetime Revenue: $${company.lifetimeRevenue.toFixed(2)}`);
      console.log(`     Platform Fees: $${company.platformFees.toFixed(2)}`);
      console.log(`     Withdrawable: $${company.withdrawable.toFixed(2)}`);
      console.log(`     Has Withdrawable: ${company.hasWithdrawable}`);
    });

    // Test 4: Check platform stats
    console.log('\n4. Testing Platform Stats...');
    const platformStats = await adminService.getPlatformStats();
    console.log(`   Total Platform Fees: $${platformStats.totalPlatformFees.toFixed(2)}`);
    console.log(`   Total Lifetime Revenue: $${platformStats.totalLifetimeRevenue.toFixed(2)}`);

    // Test 5: Simulate a sale to test platform fee calculation
    console.log('\n5. Testing Platform Fee Calculation...');
    const testAmount = 100;
    const settings = await adminService.getPlatformSettings();
    const platformFeePercent = settings.platformFeePercent || 2.5;
    const expectedFee = testAmount * (platformFeePercent / 100);
    console.log(`   Test Sale Amount: $${testAmount.toFixed(2)}`);
    console.log(`   Platform Fee Percent: ${platformFeePercent}%`);
    console.log(`   Expected Platform Fee: $${expectedFee.toFixed(2)}`);

    // Test 6: Check if platform withdrawal button would show
    console.log('\n6. Testing Platform Withdrawal Button Logic...');
    if (platformWithdrawable.withdrawable > 0) {
      console.log(`   ✅ Would show platform withdrawal button for $${platformWithdrawable.withdrawable.toFixed(2)}`);
    } else {
      console.log('   ❌ No withdrawable amount, no withdrawal button');
    }

    // Test 7: Check company withdrawal buttons
    console.log('\n7. Testing Company Withdrawal Buttons...');
    const companiesWithWithdrawable = companyAnalytics.filter(c => c.hasWithdrawable);
    console.log(`   Companies with withdrawable amounts: ${companiesWithWithdrawable.length}`);
    
    companiesWithWithdrawable.forEach((company, index) => {
      console.log(`   Company ${index + 1}: ${company.name} - $${company.withdrawable.toFixed(2)}`);
    });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Run the test
testPlatformFixes();