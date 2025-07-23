// scripts/migrate_joined_companies.js
const databaseService = require("../bot/config/database");
require("dotenv").config();

async function migrateJoinedCompanies() {
  await databaseService.initialize();
  const referralsSnap = await databaseService.referrals().get();
  const updates = {};
  let updatedUsers = 0;
  let processedReferrals = 0;
  for (const doc of referralsSnap.docs) {
    const ref = doc.data();
    const userId = ref.referrerTelegramId;
    const companyId = ref.companyId;
    processedReferrals++;
    if (!userId || !companyId) {
      console.log(`Skipping referral (missing userId/companyId):`, ref);
      continue;
    }
    if (!updates[userId]) {
      updates[userId] = new Set();
    }
    updates[userId].add(companyId);
  }
  for (const userId of Object.keys(updates)) {
    const userRef = databaseService.users().doc(userId.toString());
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.log(`User not found: ${userId}`);
      continue;
    }
    const userData = userDoc.data();
    const joinedCompanies = new Set(userData.joinedCompanies || []);
    let changed = false;
    for (const companyId of updates[userId]) {
      if (!joinedCompanies.has(companyId)) {
        joinedCompanies.add(companyId);
        changed = true;
        console.log(`Adding company ${companyId} to user ${userId}`);
      }
    }
    if (changed || joinedCompanies.size === 0) {
      await userRef.update({ joinedCompanies: Array.from(joinedCompanies) });
      updatedUsers++;
      console.log(
        `Updated user ${userId} joinedCompanies:`,
        Array.from(joinedCompanies)
      );
    } else {
      console.log(`No update needed for user ${userId}`);
    }
  }
  console.log(
    `Migration complete. Processed ${processedReferrals} referrals. Updated ${updatedUsers} users.`
  );
}

migrateJoinedCompanies().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
