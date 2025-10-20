const databaseService = require("../config/database");

let cachedSettings = null;
let lastFetch = 0;
const CACHE_DURATION_MS = 30000; // 30 seconds

async function getPlatformSettings() {
  // 🚨 EMERGENCY: Return static settings to stop quota bleeding
  // This function was making 1,800+ database calls per hour!
  return {
    platformFeePercent: 1.5,
    referralCommissionPercent: 2.5,
    referralDiscountPercent: 1,
    maintenanceMode: false,
    platformFeePercentage: 1.5,
    referrerCommissionPercentage: 2.5,
    buyerDiscountPercentage: 1
  };
}

module.exports = {
  getPlatformSettings,
};
