const databaseService = require("./bot/config/database");

async function addBillingBalance() {
  try {
    console.log("🔧 Adding billing balance to test company...");

    // Initialize Firebase
    await databaseService.initialize();
    console.log("✅ Firebase initialized");

    // Get all companies
    const companiesSnap = await databaseService.companies().get();
    console.log(`📊 Found ${companiesSnap.size} companies`);

    if (companiesSnap.size === 0) {
      console.log("❌ No companies found");
      return;
    }

    // Show all companies
    console.log("\n📋 Available companies:");
    companiesSnap.docs.forEach((doc, index) => {
      const company = doc.data();
      console.log(`${index + 1}. ${company.name} (ID: ${doc.id})`);
      console.log(`   Current billingBalance: $${company.billingBalance || 0}`);
      console.log(`   Owner: ${company.ownerUsername || company.telegramId}`);
      console.log("");
    });

    // Add billing balance to the first company for testing
    const firstCompany = companiesSnap.docs[0];
    const companyId = firstCompany.id;
    const companyData = firstCompany.data();

    console.log(`💰 Adding $100.00 billing balance to: ${companyData.name}`);

    // Update the company's billing balance
    await databaseService
      .companies()
      .doc(companyId)
      .update({
        billingBalance: (companyData.billingBalance || 0) + 100,
      });

    console.log("✅ Billing balance updated successfully!");
    console.log(
      `📊 New billing balance: $${(companyData.billingBalance || 0) + 100}`
    );
    console.log("\n🎯 Now you can test the withdrawal system:");
    console.log("1. Go to the Platform Analytics Dashboard");
    console.log("2. Look for the withdrawal button for this company");
    console.log('3. Click "💰 Company Withdrawals" to see pending requests');
  } catch (error) {
    console.error("❌ Error adding billing balance:", error);
  }
}

addBillingBalance();
