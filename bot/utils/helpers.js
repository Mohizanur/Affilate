const databaseService = require("../config/database");

let cachedSettings = null;
let lastFetch = 0;
const CACHE_DURATION_MS = 30000; // 30 seconds

async function getPlatformSettings() {
  const now = Date.now();
  if (cachedSettings && now - lastFetch < CACHE_DURATION_MS) {
    return cachedSettings;
  }
  const doc = await databaseService
    .getDb()
    .collection("settings")
    .doc("system")
    .get();
  let settings = doc.exists ? doc.data() : {};

  // Map the database field names to the expected field names
  settings.platformFeePercent = settings.platformFeePercentage ?? 1.5;
  settings.referralCommissionPercent =
    settings.referrerCommissionPercentage ?? 2.5;
  settings.referralDiscountPercent = settings.buyerDiscountPercentage ?? 1;

  cachedSettings = settings;
  lastFetch = now;
  return settings;
}

module.exports = {
  getPlatformSettings,
};
