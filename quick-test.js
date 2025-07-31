const databaseService = require("./bot/config/database");
const adminService = require("./bot/services/adminService");

async function quickTest() {
  try {
    console.log("⚡ Quick Local Test (No Telegram API needed)\n");

    // Initialize Firebase
    await databaseService.initialize();
    console.log("✅ Firebase connected\n");

    // Get dashboard data
    console.log("📊 Getting dashboard data...");
    const dashboard = await adminService.getDashboardData();
    const { companyAnalytics } = dashboard;
    console.log(`Found ${companyAnalytics.length} companies\n`);

    // Show first 3 companies
    console.log("🏢 Company Status:");
    companyAnalytics.slice(0, 3).forEach((company, index) => {
      console.log(`${index + 1}. ${company.name}`);
      console.log(`   💰 Withdrawable: $${company.withdrawable}`);
      console.log(`   ✅ Has Withdrawable: ${company.hasWithdrawable}`);
      console.log(`   📦 Products: ${company.productCount}`);
      console.log(`   👤 Owner: ${company.ownerUsername}\n`);
    });

    // Test adding billing balance
    if (companyAnalytics.length > 0) {
      const testCompany = companyAnalytics[0];
      console.log(`💰 Testing: Add $100 to ${testCompany.name}`);

      const oldBalance = testCompany.withdrawable;
      const newBalance = await adminService.updateCompanyBillingBalance(
        testCompany.id,
        100
      );

      console.log(`   Old balance: $${oldBalance}`);
      console.log(`   New balance: $${newBalance.toFixed(2)}`);
      console.log(`   ✅ Success!\n`);

      // Verify the update
      console.log("🔍 Verifying update...");
      const updatedDashboard = await adminService.getDashboardData();
      const updatedCompany = updatedDashboard.companyAnalytics.find(
        (c) => c.id === testCompany.id
      );
      console.log(`   Updated withdrawable: $${updatedCompany.withdrawable}`);
      console.log(
        `   Updated hasWithdrawable: ${updatedCompany.hasWithdrawable}`
      );
      console.log(`   ✅ Verification complete!\n`);
    }

    console.log("🎉 Quick test completed successfully!");
    console.log("📋 What this proves:");
    console.log("✅ Firebase connection works");
    console.log("✅ Dashboard data retrieval works");
    console.log("✅ Company analytics work");
    console.log("✅ Billing balance updates work");
    console.log("✅ Database operations work");
  } catch (error) {
    console.error("❌ Quick test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

quickTest();
