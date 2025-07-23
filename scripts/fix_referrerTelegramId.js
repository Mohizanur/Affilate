// scripts/fix_referrerTelegramId.js
const databaseService = require("../bot/config/database");
require("dotenv").config();

async function fixReferrerTelegramId() {
  await databaseService.initialize();
  const referralsSnap = await databaseService.referrals().get();
  let updatedCount = 0;
  let skippedCount = 0;
  for (const doc of referralsSnap.docs) {
    const ref = doc.data();
    // Only update if referrerTelegramId is missing and userId exists
    if (!ref.referrerTelegramId && ref.userId) {
      await doc.ref.update({ referrerTelegramId: ref.userId });
      updatedCount++;
      console.log(
        `Updated referral ${doc.id}: set referrerTelegramId = ${ref.userId}`
      );
    } else {
      skippedCount++;
    }
  }
  console.log(
    `Migration complete. Updated ${updatedCount} referrals. Skipped ${skippedCount} referrals.`
  );
}

fixReferrerTelegramId().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
