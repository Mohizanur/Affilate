const databaseService = require("../bot/config/database");

async function checkDuplicateAdmins() {
  try {
    console.log("🔍 Checking for duplicate admin registrations...");
    
    await databaseService.initialize();
    
    // Get all users
    const usersSnap = await databaseService.users().get();
    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Find admins
    const admins = users.filter(user => user.isAdmin === true || user.role === 'admin');
    
    console.log(`📊 Found ${admins.length} admin users:`);
    
    // Check for duplicates by telegramId
    const telegramIdCounts = {};
    const duplicateAdmins = [];
    
    admins.forEach(admin => {
      const telegramId = admin.telegramId;
      if (!telegramIdCounts[telegramId]) {
        telegramIdCounts[telegramId] = [];
      }
      telegramIdCounts[telegramId].push(admin);
      
      if (telegramIdCounts[telegramId].length > 1) {
        duplicateAdmins.push({
          telegramId,
          count: telegramIdCounts[telegramId].length,
          admins: telegramIdCounts[telegramId]
        });
      }
    });
    
    if (duplicateAdmins.length > 0) {
      console.log("❌ Found duplicate admin registrations:");
      duplicateAdmins.forEach(dup => {
        console.log(`   Telegram ID: ${dup.telegramId} (${dup.count} registrations)`);
        dup.admins.forEach((admin, index) => {
          console.log(`     ${index + 1}. User ID: ${admin.id}, Created: ${admin.createdAt}`);
        });
      });
      
      console.log("\n🔧 To fix, you can:");
      console.log("1. Delete duplicate admin records from Firebase");
      console.log("2. Keep only the most recent admin registration");
      console.log("3. Update the admin notification system to handle duplicates");
    } else {
      console.log("✅ No duplicate admin registrations found");
    }
    
    // Show unique admin count
    const uniqueAdminIds = Object.keys(telegramIdCounts);
    console.log(`\n📈 Unique admin Telegram IDs: ${uniqueAdminIds.length}`);
    console.log(`📈 Total admin records: ${admins.length}`);
    
    if (uniqueAdminIds.length !== admins.length) {
      console.log("⚠️  There are duplicate admin records that should be cleaned up");
    }
    
  } catch (error) {
    console.error("❌ Error checking duplicate admins:", error);
  }
}

if (require.main === module) {
  checkDuplicateAdmins();
}

module.exports = { checkDuplicateAdmins }; 