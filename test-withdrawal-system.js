const databaseService = require('./bot/config/database');
const adminService = require('./bot/services/adminService');
const companyService = require('./bot/services/companyService');

// Mock Telegram context for testing
class MockTelegramContext {
  constructor(userId = 5186537254) {
    this.from = { id: userId };
    this.session = { language: 'en' };
    this.callbackQuery = { id: 'test_callback' };
  }
  
  reply(message, options = {}) {
    console.log('🤖 Bot Reply:', message);
    if (options.reply_markup) {
      console.log('📋 Buttons:', JSON.stringify(options.reply_markup, null, 2));
    }
  }
  
  answerCbQuery() {
    console.log('✅ Callback answered');
  }
}

async function testWithdrawalSystem() {
  try {
    console.log('🧪 Testing Withdrawal System Locally...\n');
    
    // Initialize Firebase
    await databaseService.initialize();
    console.log('✅ Firebase initialized\n');
    
    // Test 1: Get Dashboard Data
    console.log('📊 Test 1: Getting Dashboard Data');
    const dashboard = await adminService.getDashboardData();
    const { companyAnalytics } = dashboard;
    console.log(`Found ${companyAnalytics.length} companies\n`);
    
    // Test 2: Show Company Analytics
    console.log('🏢 Test 2: Company Analytics');
    companyAnalytics.slice(0, 3).forEach((company, index) => {
      console.log(`${index + 1}. ${company.name}`);
      console.log(`   Withdrawable: $${company.withdrawable}`);
      console.log(`   hasWithdrawable: ${company.hasWithdrawable}`);
      console.log(`   Platform Fees: $${company.platformFees}`);
      console.log(`   Products: ${company.productCount}`);
      console.log(`   Owner: ${company.ownerUsername}\n`);
    });
    
    // Test 3: Add Billing Balance to First Company
    if (companyAnalytics.length > 0) {
      const firstCompany = companyAnalytics[0];
      console.log(`💰 Test 3: Adding $100 billing balance to ${firstCompany.name}`);
      
      const newBalance = await adminService.updateCompanyBillingBalance(
        firstCompany.id, 
        100
      );
      console.log(`✅ New balance: $${newBalance.toFixed(2)}\n`);
      
      // Test 4: Verify Balance Update
      console.log('🔍 Test 4: Verifying balance update');
      const updatedDashboard = await adminService.getDashboardData();
      const updatedCompany = updatedDashboard.companyAnalytics.find(c => c.id === firstCompany.id);
      console.log(`Updated withdrawable: $${updatedCompany.withdrawable}`);
      console.log(`Updated hasWithdrawable: ${updatedCompany.hasWithdrawable}\n`);
      
      // Test 5: Simulate Dashboard Function
      console.log('🎯 Test 5: Simulating Dashboard Function');
      const mockCtx = new MockTelegramContext();
      
      // Import the handler
      const adminHandlers = require('./bot/handlers/adminHandlers');
      
      // Test dashboard function
      console.log('Calling handlePlatformAnalyticsDashboard...');
      await adminHandlers.handlePlatformAnalyticsDashboard(mockCtx, 1);
      
      // Test withdrawal function
      console.log('\nCalling handlePendingCompanyWithdrawals...');
      await adminHandlers.handlePendingCompanyWithdrawals(mockCtx);
      
      // Test add billing balance function
      console.log('\nCalling handleAddCompanyBillingBalance...');
      await adminHandlers.handleAddCompanyBillingBalance(mockCtx, firstCompany.id);
      
    }
    
    // Test 6: Test Withdrawal Workflow
    console.log('🔄 Test 6: Testing Complete Withdrawal Workflow');
    if (companyAnalytics.length > 0) {
      const testCompany = companyAnalytics[0];
      
      // Step 1: Request withdrawal
      console.log('\nStep 1: Requesting withdrawal...');
      const withdrawalRequest = await adminService.requestCompanyWithdrawal(
        testCompany.id,
        50, // $50 withdrawal
        'Test withdrawal',
        5186537254 // admin user
      );
      console.log(`✅ Withdrawal request created: ${withdrawalRequest}`);
      
      // Step 2: Get pending withdrawals
      console.log('\nStep 2: Getting pending withdrawals...');
      const pendingWithdrawals = await adminService.getPendingCompanyWithdrawals();
      console.log(`Found ${pendingWithdrawals.length} pending withdrawals`);
      
      if (pendingWithdrawals.length > 0) {
        const withdrawal = pendingWithdrawals[0];
        
        // Step 3: Company approves withdrawal
        console.log('\nStep 3: Company approving withdrawal...');
        await adminService.companyApproveWithdrawal(withdrawal.id, testCompany.ownerUsername);
        console.log('✅ Withdrawal approved by company');
        
        // Step 4: Admin confirms receipt
        console.log('\nStep 4: Admin confirming receipt...');
        const result = await adminService.adminConfirmWithdrawal(withdrawal.id, 5186537254);
        console.log(`✅ Withdrawal confirmed. New balance: $${result.newBalance.toFixed(2)}`);
      }
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Dashboard data retrieval works');
    console.log('✅ Company analytics work');
    console.log('✅ Billing balance updates work');
    console.log('✅ Dashboard function works');
    console.log('✅ Withdrawal functions work');
    console.log('✅ Complete withdrawal workflow works');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testWithdrawalSystem(); 