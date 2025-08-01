// Test script to verify withdrawal system fixes
const adminService = require('./bot/services/adminService');
const databaseService = require('./bot/services/databaseService');

async function testWithdrawalFixes() {
  console.log('🧪 Testing Withdrawal System Fixes...\n');

  try {
    // Test 1: Check platform balance
    console.log('1. Testing Platform Balance...');
    const platformBalance = await adminService.getPlatformBalance();
    console.log(`   Platform Balance: $${platformBalance}`);

    // Test 2: Check platform withdrawable amount
    console.log('\n2. Testing Platform Withdrawable Amount...');
    const platformWithdrawable = await adminService.getPlatformWithdrawableAmount();
    console.log(`   Total Balance: $${platformWithdrawable.totalBalance}`);
    console.log(`   Pending Withdrawals: $${platformWithdrawable.pendingWithdrawals}`);
    console.log(`   Withdrawable: $${platformWithdrawable.withdrawable}`);

    // Test 3: Check company analytics
    console.log('\n3. Testing Company Analytics...');
    const companyAnalytics = await adminService.getCompanyAnalytics();
    console.log(`   Found ${companyAnalytics.length} companies`);
    
    companyAnalytics.forEach((company, index) => {
      console.log(`   Company ${index + 1}: ${company.name}`);
      console.log(`     - Withdrawable: $${company.withdrawable}`);
      console.log(`     - Platform Fees: $${company.platformFees}`);
      console.log(`     - Has Withdrawable: ${company.hasWithdrawable}`);
      console.log(`     - Lifetime Revenue: $${company.lifetimeRevenue}`);
    });

    // Test 4: Check if any companies have withdrawable amounts
    const companiesWithWithdrawable = companyAnalytics.filter(c => c.hasWithdrawable);
    console.log(`\n   Companies with withdrawable amounts: ${companiesWithWithdrawable.length}`);
    companiesWithWithdrawable.forEach(company => {
      console.log(`     - ${company.name}: $${company.withdrawable}`);
    });

    // Test 5: Check platform settings
    console.log('\n4. Testing Platform Settings...');
    const settings = await adminService.getPlatformSettings();
    console.log(`   Platform Fee Percent: ${settings.platformFeePercent}%`);

    // Test 6: Check if platform withdrawal is possible
    console.log('\n5. Testing Platform Withdrawal Availability...');
    if (platformWithdrawable.withdrawable > 0) {
      console.log(`   ✅ Platform withdrawal possible: $${platformWithdrawable.withdrawable}`);
    } else {
      console.log(`   ❌ No platform withdrawal available`);
    }

    console.log('\n✅ Withdrawal system tests completed!');

  } catch (error) {
    console.error('❌ Error testing withdrawal fixes:', error);
  }
}

// Run the test
testWithdrawalFixes();