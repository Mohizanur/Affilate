console.log("Entering services/adminService.js");
const databaseService = require("../config/database");
console.log("Loaded config/database in adminService");
const logger = require("../../utils/logger");
console.log("Loaded utils/logger in adminService");
const userService = require("./userService").userService;
console.log("Loaded userService in adminService");
const companyService = require("./companyService");
console.log("Loaded companyService in adminService");
const referralService = require("./referralService");
console.log("Loaded referralService in adminService");
const notificationService = require("./notificationService");
const Validators = require("../../utils/validators");

// Add caching layer at the top of the file
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

// Cache keys
const CACHE_KEYS = {
  PLATFORM_STATS: "platform_stats",
  COMPANY_ANALYTICS: "company_analytics",
  QUICK_STATS: "quick_stats",
  DASHBOARD_DATA: "dashboard_data",
};

// Helper function to get cached data or fetch and cache
async function getCachedOrFetch(key, fetchFunction, ttl = 300) {
  const cached = cache.get(key);
  if (cached) {
    console.log(`🔍 Cache HIT for ${key}`);
    return cached;
  }

  console.log(`🔍 Cache MISS for ${key}, fetching...`);
  const data = await fetchFunction();
  cache.set(key, data, ttl);
  return data;
}

// Helper function to invalidate cache
function invalidateCache(pattern) {
  const keys = cache.keys();
  keys.forEach((key) => {
    if (key.includes(pattern)) {
      cache.del(key);
      console.log(`🗑️ Invalidated cache: ${key}`);
    }
  });
}

// Helper: Get user doc and data, throw if not found
async function _getUserOrThrow(telegramId) {
  const userDoc = await databaseService
    .users()
    .doc(telegramId.toString())
    .get();
  if (!userDoc.exists) throw new Error("User not found");
  return { userDoc, user: userDoc.data() };
}
// Helper: Get company doc and data, throw if not found
async function _getCompanyOrThrow(companyId) {
  const companyDoc = await databaseService.companies().doc(companyId).get();
  if (!companyDoc.exists) throw new Error("Company not found");
  return { companyDoc, company: companyDoc.data() };
}

class AdminService {
  async getAnalytics() {
    try {
      const [userStats, companyStats, payoutStats, revenueStats, growthStats] =
        await Promise.all([
          this.getUserAnalytics(),
          this.getCompanyAnalytics(),
          this.getPayoutAnalytics(),
          this.getRevenueAnalytics(),
          this.getGrowthAnalytics(),
        ]);

      return {
        users: userStats,
        companies: companyStats,
        payouts: payoutStats,
        revenue: revenueStats,
        growth: growthStats,
        financial: await this.getFinancialMetrics(),
        conversion: await this.getConversionMetrics(),
        topPerformers: await this.getTopPerformers(),
        health: await this.getSystemHealth(),
      };
    } catch (error) {
      logger.error("Error getting analytics:", error);
      throw error;
    }
  }

  async getUserAnalytics() {
    try {
      // Firestore: get all users, phone verified, active in 7d, and referrers
      const usersSnap = await databaseService.users().get();
      const total = usersSnap.size;
      let verified = 0,
        active = 0,
        referrers = 0;
      const now = Date.now();
      
      console.log(`🔍 [DEBUG] Total users found: ${total}`);
      
      usersSnap.forEach((doc) => {
        const u = doc.data();
        // Check both phone_verified and phoneVerified fields
        const isVerified = u.phone_verified || u.phoneVerified;
        if (isVerified) {
          verified++;
          console.log(`✅ [DEBUG] Verified user found: ${doc.id}, phone_verified: ${u.phone_verified}, phoneVerified: ${u.phoneVerified}`);
        }
        if (
          u.last_active &&
          now - new Date(u.last_active).getTime() < 7 * 24 * 60 * 60 * 1000
        )
          active++;
      });
      
      console.log(`📊 [DEBUG] Final counts - Total: ${total}, Verified: ${verified}, Active: ${active}`);
      
      // Count users with at least one referral code
      const refCodesSnap = await databaseService
        .getDb()
        .collection("referral_codes")
        .get();
      const refUserIds = new Set();
      refCodesSnap.forEach((doc) => {
        const rc = doc.data();
        if (rc.user_id) refUserIds.add(rc.user_id);
      });
      referrers = refUserIds.size;
      return { total, verified, active, referrers };
    } catch (error) {
      logger.error("Error getting user analytics:", error);
      throw error;
    }
  }

  async getCompanyAnalytics() {
    try {
      return await getCachedOrFetch(
        CACHE_KEYS.COMPANY_ANALYTICS,
        async () => {
          console.log("🚀 Fetching company analytics with batch processing...");

          const companiesSnap = await databaseService.companies().get();

          // Batch process companies in chunks of 50 for massive scale
          const BATCH_SIZE = 50;
          const companies = companiesSnap.docs;
          const analytics = [];

          for (let i = 0; i < companies.length; i += BATCH_SIZE) {
            const batch = companies.slice(i, i + BATCH_SIZE);
            console.log(
              `🔍 Processing batch ${
                Math.floor(i / BATCH_SIZE) + 1
              }/${Math.ceil(companies.length / BATCH_SIZE)}`
            );

            // Process batch in parallel
            const batchPromises = batch.map(async (doc) => {
              const company = doc.data();
              const companyId = doc.id;

              // Get company's products count - optimized query
              let productCount = 0;
              try {
                const productsSnap = await databaseService
                  .getDb()
                  .collection("products")
                  .where("companyId", "==", companyId)
                  .get();
                productCount = productsSnap.size;
              } catch (error) {
                try {
                  const productsSnap = await databaseService
                    .getDb()
                    .collection("products")
                    .where("company_id", "==", companyId)
                    .get();
                  productCount = productsSnap.size;
                } catch (error2) {
                  // Fallback: count manually if needed
                  const allProductsSnap = await databaseService
                    .getDb()
                    .collection("products")
                    .get();
                  productCount = allProductsSnap.docs.filter((doc) => {
                    const product = doc.data();
                    return (
                      (product.companyId || product.company_id) === companyId
                    );
                  }).length;
                }
              }

              // Calculate platform fees and lifetime revenue in parallel
              const [platformFees, lifetimeRevenue] = await Promise.all([
                this.calculateCompanyPlatformFees(companyId),
                this.calculateCompanyLifetimeRevenue(companyId),
              ]);

              const withdrawable = company.billingBalance || 0;

              return {
                id: companyId,
                name: company.name,
                ownerUsername: company.ownerUsername || company.telegramId,
                platformFees,
                withdrawable,
                lifetimeRevenue,
                productCount,
                hasWithdrawable: withdrawable > 0,
                status: company.status || "pending",
                createdAt: company.createdAt,
              };
            });

            const batchResults = await Promise.all(batchPromises);
            analytics.push(...batchResults);
          }

          return analytics;
        },
        300
      ); // 5 minutes cache for company analytics
    } catch (error) {
      logger.error("Error getting company analytics:", error);
      return [];
    }
  }

  async getPayoutAnalytics() {
    try {
      // Firestore: aggregate payout stats
      const [payoutsSnap, pendingSnap, approvedSnap, rejectedSnap] =
        await Promise.all([
          databaseService.getDb().collection("payouts").get(),
          databaseService
            .getDb()
            .collection("payouts")
            .where("status", "==", "pending")
            .get(),
          databaseService
            .getDb()
            .collection("payouts")
            .where("status", "==", "approved")
            .get(),
          databaseService
            .getDb()
            .collection("payouts")
            .where("status", "==", "rejected")
            .get(),
        ]);
      const total = payoutsSnap.size;
      const pending = pendingSnap.size;
      const approved = approvedSnap.size;
      const rejected = rejectedSnap.size;
      const totalAmount = payoutsSnap.docs.reduce(
        (sum, doc) => sum + (doc.data().amount || 0),
        0
      );
      return { total, pending, approved, rejected, totalAmount };
    } catch (error) {
      logger.error("Error getting payout analytics (Firestore):", error);
      throw error;
    }
  }

  async getRevenueAnalytics() {
    try {
      // Get dynamic settings
      const settings = await this.getPlatformSettings();
      const commissionRate = settings.referralCommissionPercent / 100 || 0.025; // Default 2.5%
      const platformFeeRate = settings.platformFeePercent / 100 || 0.015; // Default 1.5%

      const referralsSnap = await databaseService.referrals().get();
      let totalRevenue = 0;
      let totalCommissions = 0;
      let platformRevenue = 0;

      referralsSnap.forEach((doc) => {
        const referral = doc.data();
        const amount = referral.amount || 0;
        totalRevenue += amount;

        // Calculate commissions using dynamic rate
        const commission = amount * commissionRate;
        totalCommissions += commission;

        // Calculate platform revenue using dynamic rate
        const platformFee = amount * platformFeeRate;
        platformRevenue += platformFee;
      });

      return { totalRevenue, totalCommissions, platformRevenue };
    } catch (error) {
      logger.error("Error getting revenue analytics:", error);
      throw error;
    }
  }

  async getGrowthAnalytics() {
    try {
      const [userGrowth, companyGrowth, revenueGrowth] = await Promise.all([
        this.calculateGrowthRate("users", "created_at"),
        this.calculateGrowthRate("companies", "created_at"),
        this.calculateRevenueGrowthRate(),
      ]);

      return {
        users: userGrowth,
        companies: companyGrowth,
        revenue: revenueGrowth,
      };
    } catch (error) {
      logger.error("Error getting growth analytics:", error);
      throw error;
    }
  }

  async calculateGrowthRate(collection, dateField) {
    try {
      // Firestore: count docs created this month and last month
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const snap = await databaseService.getDb().collection(collection).get();
      let thisMonth = 0,
        lastMonth = 0;
      snap.forEach((doc) => {
        const d = doc.data();
        const created =
          d[dateField] instanceof Date ? d[dateField] : new Date(d[dateField]);
        if (created >= startOfThisMonth) thisMonth++;
        else if (created >= startOfLastMonth && created <= endOfLastMonth)
          lastMonth++;
      });
      const growthRate =
        lastMonth > 0
          ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(2)
          : 0;
      return { thisMonth, lastMonth, growthRate: parseFloat(growthRate) };
    } catch (error) {
      logger.error("Error calculating growth rate (Firestore):", error);
      throw error;
    }
  }

  async calculateRevenueGrowthRate() {
    try {
      // Calculate revenue growth from referrals instead of orders
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const referralsSnap = await databaseService.referrals().get();
      let thisMonth = 0,
        lastMonth = 0;

      referralsSnap.forEach((doc) => {
        const d = doc.data();
        const created =
          d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);
        const amount = d.amount || 0;

        if (created >= startOfThisMonth) thisMonth += amount;
        else if (created >= startOfLastMonth && created <= endOfLastMonth)
          lastMonth += amount;
      });

      const growthRate =
        lastMonth > 0
          ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(2)
          : 0;
      return { thisMonth, lastMonth, growthRate: parseFloat(growthRate) };
    } catch (error) {
      logger.error("Error calculating revenue growth rate:", error);
      throw error;
    }
  }

  async getFinancialMetrics() {
    try {
      // Firestore: aggregate payout metrics only (no orders)
      const payoutsSnap = await databaseService
        .getDb()
        .collection("payouts")
        .where("status", "==", "pending")
        .get();

      const pendingPayouts = payoutsSnap.docs.reduce(
        (sum, doc) => sum + (doc.data().amount || 0),
        0
      );

      return {
        pendingPayouts,
        totalPayouts: 0, // No orders to calculate from
        avgPayoutValue: 0, // No orders to calculate from
      };
    } catch (error) {
      logger.error("Error getting financial metrics:", error);
      return {
        pendingPayouts: 0,
        totalPayouts: 0,
        avgPayoutValue: 0,
      };
    }
  }

  async getConversionMetrics() {
    try {
      // Firestore: calculate conversion rate (orders/unique users)
      const ordersSnap = await databaseService.orders().get();
      const usersSnap = await databaseService.users().get();
      const uniqueUsers = new Set();
      ordersSnap.forEach((doc) => uniqueUsers.add(doc.data().userId));
      const conversionRate =
        usersSnap.size > 0
          ? ((ordersSnap.size / usersSnap.size) * 100).toFixed(2)
          : 0;
      return { conversionRate: parseFloat(conversionRate) };
    } catch (error) {
      logger.error("Error getting conversion metrics (Firestore):", error);
      throw error;
    }
  }

  async getTopPerformers() {
    try {
      const [topReferrers, topCompanies, topProducts] = await Promise.all([
        this.getTopReferrers(),
        this.getTopCompanies(),
        this.getTopProducts(),
      ]);
      return {
        referrers: topReferrers,
        companies: topCompanies,
        products: topProducts,
      };
    } catch (error) {
      logger.error("Error getting top performers (Firestore):", error);
      throw error;
    }
  }

  async getTopReferrers(limit = 5) {
    try {
      // Rank users by referral count only
      const usersSnap = await databaseService.users().get();
      const referralsSnap = await databaseService.referrals().get();
      const referralCountMap = {};
      referralsSnap.docs.forEach((refDoc) => {
        const ref = refDoc.data();
        const userId = ref.userId;
        if (!referralCountMap[userId]) referralCountMap[userId] = 0;
        referralCountMap[userId] += 1;
      });
      const top = usersSnap.docs
        .map((u) => {
          const user = u.data();
          return {
            telegram_id: u.id,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            referral_count: referralCountMap[u.id] || 0,
          };
        })
        .sort((a, b) => b.referral_count - a.referral_count)
        .slice(0, limit);
      return top;
    } catch (error) {
      logger.error("Error getting top referrers (Firestore):", error);
      throw error;
    }
  }

  async getTopCompanies(limit = 5) {
    try {
      // Return top companies by name (alphabetical) as a stub
      const companiesSnap = await databaseService.companies().get();
      const top = companiesSnap.docs
        .map((doc) => {
          const c = doc.data();
          return {
            id: doc.id,
            name: c.name,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limit);
      return top;
    } catch (error) {
      logger.error("Error getting top companies (Firestore):", error);
      throw error;
    }
  }

  async getTopProducts(limit = 5) {
    try {
      // Return top products by title (alphabetical) as a stub
      const productsSnap = await databaseService
        .getDb()
        .collection("products")
        .get();
      const top = productsSnap.docs
        .map((doc) => {
          const p = doc.data();
          return {
            id: doc.id,
            title: p.title,
            company_name: p.company_name || null,
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title))
        .slice(0, limit);
      return top;
    } catch (error) {
      logger.error("Error getting top products (Firestore):", error);
      throw error;
    }
  }

  async getSystemHealth() {
    try {
      const [dbHealth, recentActivity, errorRate] = await Promise.all([
        this.checkDatabaseHealth(),
        this.getRecentActivity(),
        this.getErrorRate(),
      ]);

      return {
        database: dbHealth,
        activity: recentActivity,
        errorRate,
      };
    } catch (error) {
      logger.error("Error getting system health:", error);
      throw error;
    }
  }

  async checkDatabaseHealth() {
    try {
      // Firestore: check if can read users collection
      const start = Date.now();
      await databaseService.users().limit(1).get();
      const responseTime = Date.now() - start;
      return { status: "healthy", responseTime: `${responseTime}ms` };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async getRecentActivity() {
    try {
      // Firestore: count new users and orders in last hour and 24h
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const usersSnap = await databaseService.users().get();
      const ordersSnap = await databaseService.orders().get();
      let lastHour = 0,
        last24h = 0;
      usersSnap.forEach((doc) => {
        const d = doc.data();
        const created =
          d.created_at instanceof Date ? d.created_at : new Date(d.created_at);
        if (created >= oneHourAgo) lastHour++;
        if (created >= oneDayAgo) last24h++;
      });
      ordersSnap.forEach((doc) => {
        const d = doc.data();
        const created =
          d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);
        if (created >= oneHourAgo) lastHour++;
        if (created >= oneDayAgo) last24h++;
      });
      return { lastHour, last24Hours: last24h };
    } catch (error) {
      logger.error("Error getting recent activity (Firestore):", error);
      throw error;
    }
  }

  async getErrorRate() {
    try {
      // Firestore: calculate error rate as rejected orders/payouts
      const ordersSnap = await databaseService.orders().get();
      const payoutsSnap = await databaseService
        .getDb()
        .collection("payouts")
        .get();
      const total = ordersSnap.size + payoutsSnap.size;
      const rejected =
        ordersSnap.docs.filter((doc) => doc.data().status === "rejected")
          .length +
        payoutsSnap.docs.filter((doc) => doc.data().status === "rejected")
          .length;
      const errorRate = total > 0 ? ((rejected / total) * 100).toFixed(2) : 0;
      return { errorRate: parseFloat(errorRate) };
    } catch (error) {
      logger.error("Error getting error rate (Firestore):", error);
      throw error;
    }
  }

  async getDashboardData() {
    try {
      // Force cache invalidation to get fresh data
      this.invalidateDashboardCache();
      
      return await getCachedOrFetch(
        CACHE_KEYS.DASHBOARD_DATA,
        async () => {
          console.log("🚀 Fetching dashboard data with parallel processing...");

          const [
            platformStats,
            companyAnalytics,
            recentUsers,
            systemAlerts,
            quickStats,
          ] = await Promise.all([
            this.getPlatformStats(),
            this.getCompanyAnalytics(),
            userService.getRecentUsers(5),
            this.getSystemAlerts(),
            this.getQuickStats(),
          ]);

          return {
            platformStats,
            companyAnalytics,
            recentUsers,
            systemAlerts,
            quickStats,
          };
        },
        180
      ); // 3 minutes cache for dashboard
    } catch (error) {
      logger.error("Error getting dashboard data:", error);
      throw error;
    }
  }

  async getPendingApprovals() {
    try {
      const withdrawals = await userService.getPendingWithdrawals();

      // Handle case where withdrawals might be undefined
      const safeWithdrawals = withdrawals || [];

      return {
        orders: [], // No orders in this system
        payouts: safeWithdrawals.slice(0, 5),
        counts: {
          orders: 0,
          payouts: safeWithdrawals.length,
        },
      };
    } catch (error) {
      logger.error("Error getting pending approvals:", error);
      return {
        orders: [],
        payouts: [],
        counts: {
          orders: 0,
          payouts: 0,
        },
      };
    }
  }

  async getSystemAlerts() {
    try {
      const alerts = [];
      // High pending payout amount
      const payoutsSnap = await databaseService
        .getDb()
        .collection("payouts")
        .where("status", "==", "pending")
        .get();
      const pendingPayouts = payoutsSnap.docs.reduce(
        (sum, doc) => sum + (doc.data().amount || 0),
        0
      );
      if (pendingPayouts > 1000) {
        alerts.push({
          type: "warning",
          message: `High pending payout amount: $${pendingPayouts}`,
          priority: "medium",
        });
      }
      // No orders in this system, so remove order-related alerts
      return alerts;
    } catch (error) {
      logger.error("Error getting system alerts (Firestore):", error);
      return [];
    }
  }

  async getQuickStats() {
    try {
      const [usersSnap, companiesSnap] = await Promise.all([
        databaseService.users().get(),
        databaseService.companies().get(), // Remove the status filter to count all companies
      ]);

      // Calculate total platform fees from actual transactions - PARALLEL!
      const platformFeesPromises = companiesSnap.docs.map(async (doc) => {
        const company = doc.data();
        const companyId = doc.id;
        const platformFees = await this.calculateCompanyPlatformFees(companyId);
        return {
          platformFees,
          billingBalance: company.billingBalance || 0,
        };
      });

      const results = await Promise.all(platformFeesPromises);

      const totalPlatformFees = results.reduce(
        (sum, result) => sum + result.platformFees,
        0
      );
      const totalWithdrawable = results.reduce(
        (sum, result) => sum + result.billingBalance,
        0
      );

      return {
        totalUsers: usersSnap.size,
        totalCompanies: companiesSnap.size, // This will now show the correct count
        totalPlatformFees,
        totalWithdrawable,
      };
    } catch (error) {
      logger.error("Error getting quick stats:", error);
      return {
        totalUsers: 0,
        totalCompanies: 0,
        totalPlatformFees: 0,
        totalWithdrawable: 0,
      };
    }
  }

  async getSystemStats() {
    try {
      const usersSnap = await databaseService.users().get();
      const companiesSnap = await databaseService.companies().get();
      // Remove all order-related stats
      return {
        totalUsers: usersSnap.size,
        totalCompanies: companiesSnap.size,
        // Remove: totalProducts, totalOrders, totalRevenue, today's orders, revenue, pending orders, etc.
        today: {
          newUsers: usersSnap.docs.filter((doc) => {
            const d = doc.data();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return (
              d.createdAt &&
              new Date(
                d.createdAt._seconds ? d.createdAt._seconds * 1000 : d.createdAt
              ).getTime() >= today.getTime()
            );
          }).length,
        },
        pending: {
          payouts: 0, // You can add real payout stats if needed
          tickets: 0,
        },
      };
    } catch (error) {
      logger.error("Error getting system stats (Firestore):", error);
      throw error;
    }
  }

  // Remove getAllOrders, getPlatformStats, and any other order-related methods

  // STUB: Return placeholder platform settings
  async getPlatformSettings() {
    try {
      const doc = await databaseService
        .getDb()
        .collection("settings")
        .doc("system")
        .get();
      if (!doc.exists) {
        return {
          platformFeePercent: parseFloat(
            process.env.PLATFORM_FEE_PERCENTAGE || "1.5"
          ),
          referralCommissionPercent: parseFloat(
            process.env.REFERRER_COMMISSION_PERCENTAGE || "2.5"
          ),
          referralDiscountPercent: parseFloat(
            process.env.BUYER_DISCOUNT_PERCENTAGE || "1"
          ),
          minWithdrawalAmount: parseFloat(
            process.env.MIN_WITHDRAWAL_AMOUNT || "10"
          ),
          maintenanceMode: false,
          maxReferralUses: 0,
          referralExpiryDays: 0,
        };
      }
      const data = doc.data();
      return {
        platformFeePercent:
          data.platformFeePercentage ||
          parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || "1.5"),
        referralCommissionPercent:
          data.referrerCommissionPercentage ||
          parseFloat(process.env.REFERRER_COMMISSION_PERCENTAGE || "2.5"),
        referralDiscountPercent:
          data.buyerDiscountPercentage ||
          parseFloat(process.env.BUYER_DISCOUNT_PERCENTAGE || "1"),
        minWithdrawalAmount:
          data.minWithdrawalAmount ||
          parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || "10"),
        maintenanceMode: data.maintenanceMode || false,
        maxReferralUses: data.maxReferralUses || 0,
        referralExpiryDays: data.referralExpiryDays || 0,
      };
    } catch (error) {
      logger.error("Error loading platform settings:", error);
      return {
        platformFeePercent: parseFloat(
          process.env.PLATFORM_FEE_PERCENTAGE || "1.5"
        ),
        referralCommissionPercent: parseFloat(
          process.env.REFERRER_COMMISSION_PERCENTAGE || "2.5"
        ),
        referralDiscountPercent: parseFloat(
          process.env.BUYER_DISCOUNT_PERCENTAGE || "1"
        ),
        minWithdrawalAmount: parseFloat(
          process.env.MIN_WITHDRAWAL_AMOUNT || "10"
        ),
        maintenanceMode: false,
        maxReferralUses: 0,
        referralExpiryDays: 0,
      };
    }
  }

  async setPlatformSetting(key, value) {
    try {
      // Map the new field names to the old field names for compatibility
      const fieldMapping = {
        platformFeePercent: "platformFeePercentage",
        referralCommissionPercent: "referrerCommissionPercentage",
        referralDiscountPercent: "buyerDiscountPercentage",
        minWithdrawalAmount: "minWithdrawalAmount",
        maintenanceMode: "maintenanceMode",
      };

      const fieldName = fieldMapping[key] || key;

      await databaseService
        .getDb()
        .collection("settings")
        .doc("system")
        .set({ [fieldName]: value, updatedAt: new Date() }, { merge: true });
      return true;
    } catch (error) {
      logger.error("Error updating platform setting:", error);
      return false;
    }
  }

  // Real implementation: send broadcast to all users
  async sendBroadcast(message, targetType = "all") {
    // Validate message and targetType
    const validation = Validators.validateBroadcastMessage(message, targetType);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }
    const { getBot } = require("../index");
    const bot = getBot();
    const usersSnap = await require("../config/database").users().get();
    let sent = 0,
      failed = 0,
      total = 0;
    let failedUsers = [];
    for (const doc of usersSnap.docs) {
      const user = doc.data();
      if (!user.telegramId) continue;
      total++;
      try {
        await bot.telegram.sendMessage(user.telegramId, message);
        sent++;
      } catch (err) {
        failed++;
        failedUsers.push(user.telegramId);
        console.error(
          `Broadcast failed for user ${user.telegramId}:`,
          err.message
        );
      }
      // Small delay to avoid Telegram rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return { sent, failed, total, failedUsers };
  }

  // Get analytics for a specific company by ID
  async getCompanyAnalyticsById(companyId) {
    if (!companyId || typeof companyId !== "string" || !companyId.trim()) {
      logger.error(
        "getCompanyAnalyticsById called with invalid companyId:",
        companyId
      );
      return null;
    }
    try {
      const doc = await databaseService.companies().doc(companyId).get();
      if (!doc.exists) return null;
      const c = doc.data();
      // Count products, orders, revenue, active referrers
      const productsSnap = await databaseService
        .getDb()
        .collection("products")
        .where("companyId", "==", companyId)
        .get();
      const ordersSnap = await databaseService
        .orders()
        .where("companyId", "==", companyId)
        .get();
      let totalRevenue = 0;
      ordersSnap.forEach((o) => {
        const d = o.data();
        if (d.amount) totalRevenue += d.amount;
      });
      // Count active referrers (users with at least one referral for this company)
      const refCodesSnap = await databaseService
        .getDb()
        .collection("referral_codes")
        .where("company_id", "==", companyId)
        .get();
      const refUserIds = new Set();
      refCodesSnap.forEach((doc) => {
        const rc = doc.data();
        if (rc.user_id) refUserIds.add(rc.user_id);
      });
      return {
        id: doc.id,
        name: c.name,
        email: c.email,
        totalProducts: productsSnap.size,
        totalOrders: ordersSnap.size,
        totalRevenue,
        activeReferrers: refUserIds.size,
        createdAt: c.createdAt,
        status: c.status,
      };
    } catch (error) {
      logger.error("Error in getCompanyAnalyticsById:", error);
      throw error;
    }
  }

  // Get billing summary for all companies
  async getCompanyBillingSummary() {
    try {
      const companiesSnap = await databaseService.companies().get();
      const summary = [];
      companiesSnap.forEach((doc) => {
        const c = doc.data();
        if (c.billingBalance || c.billingIssue) {
          summary.push({
            id: doc.id,
            name: c.name,
            email: c.email,
            billingBalance: c.billingBalance || 0,
            billingIssue: c.billingIssue || null,
          });
        }
      });
      return summary;
    } catch (error) {
      logger.error("Error in getCompanyBillingSummary:", error);
      throw error;
    }
  }

  // Get all companies (for export)
  async getAllCompanies() {
    try {
      const companiesSnap = await databaseService.companies().get();
      return companiesSnap.docs.map((doc) => {
        const c = doc.data();
        return {
          id: doc.id,
          name: c.name,
          email: c.email,
          status: c.status,
          totalProducts: c.totalProducts || 0,
          totalRevenue: c.totalRevenue || 0,
          createdAt: c.createdAt,
        };
      });
    } catch (error) {
      logger.error("Error in getAllCompanies:", error);
      throw error;
    }
  }

  // Get a company by ID
  async getCompanyById(companyId) {
    try {
      const doc = await databaseService.companies().doc(companyId).get();
      if (!doc.exists) return null;
      const c = doc.data();
      return {
        id: doc.id,
        name: c.name,
        email: c.email,
        totalProducts: c.totalProducts || 0,
        commissionRate: c.commissionRate || 0,
        status: c.status,
        createdAt: c.createdAt,
      };
    } catch (error) {
      logger.error("Error in getCompanyById:", error);
      throw error;
    }
  }

  // Proxy: Search companies by query, always include id field
  async searchCompanies(query) {
    try {
      const companiesSnap = await databaseService.companies().get();
      const companies = companiesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const q = query.toLowerCase();
      return companies.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.id && c.id.toLowerCase().includes(q))
      );
    } catch (error) {
      logger.error("Error in searchCompanies:", error);
      throw error;
    }
  }

  // Get all orders by status (pending, approved, rejected)
  async getOrdersByStatus(status) {
    try {
      const ordersSnap = await databaseService
        .orders()
        .where("status", "==", status)
        .orderBy("createdAt", "desc")
        .get();
      return ordersSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          productTitle: d.productTitle || d.product_name || "",
          amount: d.amount || 0,
          status: d.status || "",
          userName: d.userName || d.user_name || "",
          ...d,
        };
      });
    } catch (error) {
      logger.error("Error in getOrdersByStatus:", error);
      throw error;
    }
  }

  // Get all payouts by status (pending, approved, rejected)
  async getPayoutsByStatus(status) {
    try {
      const payoutsSnap = await databaseService
        .withdrawals()
        .where("status", "==", status)
        .orderBy("createdAt", "desc")
        .get();
      return payoutsSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          amount: d.amount || 0,
          status: d.status || "",
          userName: d.userName || d.user_name || "",
          ...d,
        };
      });
    } catch (error) {
      logger.error("Error in getPayoutsByStatus:", error);
      throw error;
    }
  }

  async createCompanyAsAdmin(companyData) {
    try {
      const docRef = await databaseService.companies().add({
        ...companyData,
        status: "approved",
        createdAt: new Date(),
      });
      return { id: docRef.id };
    } catch (error) {
      logger.error("Error creating company as admin:", error);
      throw error;
    }
  }

  async deleteCompany(companyId) {
    try {
      await databaseService.companies().doc(companyId).delete();
      return { id: companyId };
    } catch (error) {
      logger.error("Error deleting company:", error);
      throw error;
    }
  }

  async getSystemLogs() {
    try {
      // Try to read from utils/logger.js if logs are stored there, else return stub
      const fs = require("fs");
      const path = require("path");
      const logPath = path.join(__dirname, "../../logs/app.log");
      if (fs.existsSync(logPath)) {
        const lines = fs
          .readFileSync(logPath, "utf-8")
          .split("\n")
          .filter(Boolean);
        // Parse last 10 log lines as JSON or plain text
        return lines.slice(-10).map((line) => {
          try {
            const obj = JSON.parse(line);
            return {
              level: obj.level || "info",
              message: obj.message || line,
              timestamp: obj.timestamp || Date.now(),
            };
          } catch {
            return { level: "info", message: line, timestamp: Date.now() };
          }
        });
      } else {
        return [
          { level: "info", message: "No logs found.", timestamp: Date.now() },
        ];
      }
    } catch (error) {
      return [
        { level: "error", message: error.message, timestamp: Date.now() },
      ];
    }
  }

  async createBackup() {
    try {
      const usersSnap = await databaseService.users().get();
      const companiesSnap = await databaseService.companies().get();
      const users = usersSnap.docs.map((doc) => doc.data());
      const companies = companiesSnap.docs.map((doc) => doc.data());
      const backup = {
        id: `backup_${Date.now()}`,
        createdAt: new Date(),
        size: Buffer.byteLength(JSON.stringify({ users, companies }), "utf-8"),
        tables: ["users", "companies"],
        users,
        companies,
      };
      // Optionally write to disk
      const fs = require("fs");
      const path = require("path");
      const backupPath = path.join(
        __dirname,
        "../../logs",
        `${backup.id}.json`
      );
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
      return backup;
    } catch (error) {
      return {
        id: null,
        createdAt: new Date(),
        size: 0,
        tables: [],
        error: error.message,
      };
    }
  }

  async getPlatformStats() {
    try {
      return await getCachedOrFetch(
        CACHE_KEYS.PLATFORM_STATS,
        async () => {
          console.log("🚀 Fetching platform stats with batch processing...");

          // Get all companies and calculate platform fees from actual transactions
          const companiesSnap = await databaseService.companies().get();

          // Batch process companies in chunks of 50 for massive scale
          const BATCH_SIZE = 50;
          const companies = companiesSnap.docs;
          const companyStats = [];

          for (let i = 0; i < companies.length; i += BATCH_SIZE) {
            const batch = companies.slice(i, i + BATCH_SIZE);
            console.log(
              `🔍 Processing platform stats batch ${
                Math.floor(i / BATCH_SIZE) + 1
              }/${Math.ceil(companies.length / BATCH_SIZE)}`
            );

            // Process batch in parallel
            const batchPromises = batch.map(async (doc) => {
              const company = doc.data();
              const companyId = doc.id;

              // Calculate actual platform fees from referrals and transactions in parallel
              const [platformFees, lifetimeRevenue] = await Promise.all([
                this.calculateCompanyPlatformFees(companyId),
                this.calculateCompanyLifetimeRevenue(companyId),
              ]);

              const withdrawable = company.billingBalance || 0;

              return {
                id: companyId,
                name: company.name,
                platformFees,
                withdrawable,
                lifetimeRevenue,
                hasWithdrawable: withdrawable > 0,
              };
            });

            const batchResults = await Promise.all(batchPromises);
            companyStats.push(...batchResults);
          }

          // Calculate totals
          const totalPlatformFees = companyStats.reduce(
            (sum, stat) => sum + stat.platformFees,
            0
          );
          const totalWithdrawable = companyStats.reduce(
            (sum, stat) => sum + stat.withdrawable,
            0
          );
          const totalLifetimeRevenue = companyStats.reduce(
            (sum, stat) => sum + stat.lifetimeRevenue,
            0
          );

          return {
            totalPlatformFees,
            totalWithdrawable,
            totalLifetimeRevenue,
            companies: companyStats,
            totalCompanies: companiesSnap.size,
          };
        },
        300
      ); // 5 minutes cache for platform stats
    } catch (error) {
      logger.error("Error getting platform stats:", error);
      return {
        totalPlatformFees: 0,
        totalWithdrawable: 0,
        totalLifetimeRevenue: 0,
        companies: [],
        totalCompanies: 0,
      };
    }
  }

  async calculateCompanyPlatformFees(companyId) {
    try {
      // Calculate platform fees from all referrals for this company
      let referralsSnap;

      try {
        referralsSnap = await databaseService
          .referrals()
          .where("companyId", "==", companyId)
          .get();
      } catch (error) {
        try {
          referralsSnap = await databaseService
            .referrals()
            .where("company_id", "==", companyId)
            .get();
        } catch (error2) {
          referralsSnap = await databaseService.referrals().get();
        }
      }

      let totalPlatformFees = 0;

      for (const doc of referralsSnap.docs) {
        const referral = doc.data();

        // Check if this referral belongs to the company
        const referralCompanyId = referral.companyId || referral.company_id;
        if (referralCompanyId !== companyId) {
          continue;
        }

        // Platform fee is calculated from dynamic settings
        const settings = await this.getPlatformSettings();
        const platformFee =
          (referral.amount || 0) * (settings.platformFeePercent / 100);
        totalPlatformFees += platformFee;
      }

      return totalPlatformFees;
    } catch (error) {
      logger.error("Error calculating company platform fees:", error);
      return 0;
    }
  }

  async calculateCompanyLifetimeRevenue(companyId) {
    try {
      console.log(`💰 [DEBUG] Calculating lifetime revenue for company: ${companyId}`);
      let totalRevenue = 0;

      // Calculate revenue from referrals
      let referralsSnap;
      try {
        referralsSnap = await databaseService
          .referrals()
          .where("companyId", "==", companyId)
          .get();
        console.log(`📊 [DEBUG] Found ${referralsSnap.size} referrals for company ${companyId}`);
      } catch (error) {
        try {
          referralsSnap = await databaseService
            .referrals()
            .where("company_id", "==", companyId)
            .get();
          console.log(`📊 [DEBUG] Found ${referralsSnap.size} referrals using company_id for company ${companyId}`);
        } catch (error2) {
          referralsSnap = await databaseService.referrals().get();
          console.log(`📊 [DEBUG] Found ${referralsSnap.size} total referrals, filtering for company ${companyId}`);
        }
      }

      for (const doc of referralsSnap.docs) {
        const referral = doc.data();
        const referralCompanyId = referral.companyId || referral.company_id;
        if (referralCompanyId === companyId) {
          const amount = referral.amount || 0;
          totalRevenue += amount;
          console.log(`💰 [DEBUG] Added referral revenue: $${amount} for company ${companyId}`);
        }
      }

      // Calculate revenue from sales collection
      try {
        const salesSnap = await databaseService
          .getDb()
          .collection("sales")
          .where("companyId", "==", companyId)
          .where("status", "==", "completed")
          .get();
        
        console.log(`🛒 [DEBUG] Found ${salesSnap.size} completed sales for company ${companyId}`);

        for (const doc of salesSnap.docs) {
          const sale = doc.data();
          const amount = sale.amount || 0;
          totalRevenue += amount;
          console.log(`💰 [DEBUG] Added sale revenue: $${amount} for company ${companyId}`);
        }
      } catch (error) {
        // Try alternative field names
        try {
          const salesSnap = await databaseService
            .getDb()
            .collection("sales")
            .where("company_id", "==", companyId)
            .where("status", "==", "completed")
            .get();
          
          console.log(`🛒 [DEBUG] Found ${salesSnap.size} completed sales using company_id for company ${companyId}`);

          for (const doc of salesSnap.docs) {
            const sale = doc.data();
            const amount = sale.amount || 0;
            totalRevenue += amount;
            console.log(`💰 [DEBUG] Added sale revenue: $${amount} for company ${companyId}`);
          }
        } catch (error2) {
          // If both fail, try without status filter
          try {
            const salesSnap = await databaseService
              .getDb()
              .collection("sales")
              .where("companyId", "==", companyId)
              .get();
            
            console.log(`🛒 [DEBUG] Found ${salesSnap.size} total sales for company ${companyId}`);

            for (const doc of salesSnap.docs) {
              const sale = doc.data();
              if (sale.status === "completed" || !sale.status) {
                const amount = sale.amount || 0;
                totalRevenue += amount;
                console.log(`💰 [DEBUG] Added sale revenue: $${amount} for company ${companyId}`);
              }
            }
          } catch (error3) {
            console.log(`⚠️ [DEBUG] Could not fetch sales for company ${companyId}:`, error3);
          }
        }
      }

      console.log(`💰 [DEBUG] Total lifetime revenue for company ${companyId}: $${totalRevenue}`);
      return totalRevenue;
    } catch (error) {
      logger.error("Error calculating company lifetime revenue:", error);
      return 0;
    }
  }

  async calculateTotalLifetimeWithdrawn() {
    try {
      let totalWithdrawn = 0;

      // Check withdrawals collection for approved withdrawals
      try {
        const withdrawalsSnap = await databaseService
          .getDb()
          .collection("withdrawals")
          .where("status", "==", "approved")
          .get();

        for (const doc of withdrawalsSnap.docs) {
          const withdrawal = doc.data();
          totalWithdrawn += withdrawal.amount || 0;
        }
      } catch (error) {
        // Try alternative status values
        const statuses = ["processed", "completed", "finalized"];
        for (const status of statuses) {
          try {
            const withdrawalsSnap = await databaseService
              .getDb()
              .collection("withdrawals")
              .where("status", "==", status)
              .get();

            for (const doc of withdrawalsSnap.docs) {
              const withdrawal = doc.data();
              totalWithdrawn += withdrawal.amount || 0;
            }
          } catch (statusError) {
            // Continue to next status
          }
        }
      }

      // Also check company withdrawals if available
      try {
        const companyWithdrawalsSnap = await databaseService
          .getDb()
          .collection("company_withdrawals")
          .get();

        for (const doc of companyWithdrawalsSnap.docs) {
          const withdrawal = doc.data();
          if (
            withdrawal.status === "approved" ||
            withdrawal.status === "completed"
          ) {
            totalWithdrawn += withdrawal.amount || 0;
          }
        }
      } catch (error) {
        // Company withdrawals collection not accessible or empty
      }

      return totalWithdrawn;
    } catch (error) {
      logger.error("Error calculating total lifetime withdrawn:", error);
      return 0;
    }
  }

  async getCompanyAnalytics() {
    try {
      const companiesSnap = await databaseService.companies().get();

      const analytics = [];

      for (const doc of companiesSnap.docs) {
        const company = doc.data();
        const companyId = doc.id;

        // Get company's products count - optimized query
        let productCount = 0;
        try {
          const productsSnap = await databaseService
            .getDb()
            .collection("products")
            .where("companyId", "==", companyId)
            .get();
          productCount = productsSnap.size;
        } catch (error) {
          try {
            const productsSnap = await databaseService
              .getDb()
              .collection("products")
              .where("company_id", "==", companyId)
              .get();
            productCount = productsSnap.size;
          } catch (error2) {
            // Fallback: count manually if needed
            const allProductsSnap = await databaseService
              .getDb()
              .collection("products")
              .get();
            productCount = allProductsSnap.docs.filter((doc) => {
              const product = doc.data();
              return (product.companyId || product.company_id) === companyId;
            }).length;
          }
        }

        // Calculate platform fees and lifetime revenue
        const [platformFees, lifetimeRevenue] = await Promise.all([
          this.calculateCompanyPlatformFees(companyId),
          this.calculateCompanyLifetimeRevenue(companyId),
        ]);

        const withdrawable = company.billingBalance || 0;

        analytics.push({
          id: companyId,
          name: company.name,
          ownerUsername: company.ownerUsername || company.telegramId,
          platformFees,
          withdrawable,
          lifetimeRevenue,
          productCount,
          hasWithdrawable: withdrawable > 0,
          status: company.status || "pending",
          createdAt: company.createdAt,
        });
      }

      return analytics;
    } catch (error) {
      logger.error("Error getting company analytics:", error);
      return [];
    }
  }

  async getCompanySalesAndCommission() {
    try {
      const platformSettings = await this.getPlatformSettings();
      const PLATFORM_FEE_PERCENT = platformSettings.platformFeePercent;
      const companiesSnap = await databaseService.companies().get();
      const companies = {};
      companiesSnap.forEach((doc) => {
        const c = doc.data();
        companies[doc.id] = {
          id: doc.id,
          name: c.name,
          commissionRate: PLATFORM_FEE_PERCENT,
          totalSales: 0,
          totalRevenue: 0,
          platformCommissionLifetime: 0, // sum of all sales commissions (lifetime)
          platformCommissionCurrent: c.platformCommission || 0, // current withdrawable
          ownerTelegramId: c.ownerTelegramId,
          telegramId: c.telegramId,
        };
        // Also map by c.id if present and different from doc.id
        if (c.id && c.id !== doc.id) {
          companies[c.id] = companies[doc.id];
        }
      });
      // Aggregate sales and revenue from sales collection
      const salesSnap = await databaseService
        .getDb()
        .collection("sales")
        .where("status", "==", "completed")
        .get();
      // Debug: print all company keys and all sales companyIds
      console.log("[DEBUG] Companies map keys:", Object.keys(companies));
      console.log(
        "[DEBUG] All companies with names:",
        Object.entries(companies).map(([id, company]) => ({
          id,
          name: company.name,
        }))
      );
      const allSalesCompanyIds = [];
      salesSnap.forEach((doc) => {
        const s = doc.data();
        allSalesCompanyIds.push(s.companyId);
      });
      console.log("[DEBUG] Sales companyIds:", allSalesCompanyIds);
      salesSnap.forEach((doc) => {
        const s = doc.data();
        console.log("[DEBUG] Processing sale:", {
          saleId: doc.id,
          companyId: s.companyId,
          status: s.status,
          amount: s.amount,
          fullSaleData: s,
        });
        if (!s.companyId || !companies[s.companyId]) {
          console.log(
            "[DEBUG] Sale skipped - no companyId or company not found"
          );
          return;
        }
        const company = companies[s.companyId];
        console.log("[DEBUG] Company before update:", {
          name: company.name,
          totalSales: company.totalSales,
          totalRevenue: company.totalRevenue,
        });
        company.totalSales += 1;
        company.totalRevenue += s.amount || 0;
        const commission = (s.amount || 0) * (PLATFORM_FEE_PERCENT / 100);
        company.platformCommissionLifetime += commission;
        console.log("[DEBUG] Company after update:", {
          name: company.name,
          totalSales: company.totalSales,
          totalRevenue: company.totalRevenue,
          commissionAdded: commission,
        });
      });
      return Object.values(companies);
    } catch (error) {
      logger.error("Error getting company sales and commission:", error);
      throw error;
    }
  }

  async debugDataStructure() {
    try {
      logger.info("=== DEBUGGING DATA STRUCTURE ===");

      // Check companies
      const companiesSnap = await databaseService.companies().get();
      logger.info(`Found ${companiesSnap.size} companies`);

      for (const doc of companiesSnap.docs) {
        const company = doc.data();
        logger.info(`Company ${doc.id}:`, company);
      }

      // Check referrals
      const referralsSnap = await databaseService.referrals().get();
      logger.info(`Found ${referralsSnap.size} referrals`);

      for (const doc of referralsSnap.docs.slice(0, 5)) {
        // Show first 5
        const referral = doc.data();
        logger.info(`Referral ${doc.id}:`, referral);
      }

      // Check products
      const productsSnap = await databaseService
        .getDb()
        .collection("products")
        .get();
      logger.info(`Found ${productsSnap.size} products`);

      for (const doc of productsSnap.docs.slice(0, 5)) {
        // Show first 5
        const product = doc.data();
        logger.info(`Product ${doc.id}:`, product);
      }

      logger.info("=== END DEBUGGING ===");
    } catch (error) {
      logger.error("Error debugging data structure:", error);
    }
  }

  async getAdminUsers() {
    try {
      const adminSnap = await databaseService
        .users()
        .where("role", "==", "admin")
        .get();

      return adminSnap.docs.map((doc) => ({
        telegramId: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      logger.error("Error getting admin users:", error);
      return [];
    }
  }

  async getPlatformBalance() {
    try {
      const doc = await databaseService
        .getDb()
        .collection("settings")
        .doc("system")
        .get();

      if (!doc.exists) {
        return 0;
      }

      const data = doc.data();
      return data.platformBalance || 0;
    } catch (error) {
      logger.error("Error getting platform balance:", error);
      return 0;
    }
  }

  async updatePlatformBalance(amount) {
    try {
      const currentBalance = await this.getPlatformBalance();
      const newBalance = currentBalance + amount;

      await databaseService.getDb().collection("settings").doc("system").set(
        {
          platformBalance: newBalance,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      logger.info(
        `Platform balance updated: ${currentBalance} + ${amount} = ${newBalance}`
      );
      return newBalance;
    } catch (error) {
      logger.error("Error updating platform balance:", error);
      throw error;
    }
  }

  async getPlatformWithdrawableAmount() {
    try {
      const platformBalance = await this.getPlatformBalance();

      // Try to get pending withdrawals, but don't fail if it errors
      let pendingWithdrawals = [];
      try {
        pendingWithdrawals = await this.getPendingPlatformWithdrawals();
      } catch (error) {
        logger.error(
          "Error getting pending withdrawals, using empty array:",
          error
        );
        pendingWithdrawals = [];
      }

      // Calculate total pending withdrawals
      const totalPending = pendingWithdrawals.reduce((sum, withdrawal) => {
        return sum + (withdrawal.amount || 0);
      }, 0);

      // Withdrawable amount is balance minus pending withdrawals
      const withdrawable = Math.max(0, platformBalance - totalPending);

      return {
        totalBalance: platformBalance,
        pendingWithdrawals: totalPending,
        withdrawable: withdrawable,
      };
    } catch (error) {
      logger.error("Error getting platform withdrawable amount:", error);
      return {
        totalBalance: 0,
        pendingWithdrawals: 0,
        withdrawable: 0,
      };
    }
  }

  async requestPlatformWithdrawal(amount, reason, requestedBy) {
    try {
      const withdrawableData = await this.getPlatformWithdrawableAmount();

      if (amount > withdrawableData.withdrawable) {
        throw new Error(
          `Insufficient withdrawable amount. Available: $${withdrawableData.withdrawable.toFixed(
            2
          )}`
        );
      }

      if (amount <= 0) {
        throw new Error("Withdrawal amount must be greater than 0");
      }

      // Create withdrawal request
      const withdrawalRequest = {
        amount,
        reason,
        requestedBy,
        status: "pending",
        createdAt: new Date(),
        type: "platform",
      };

      const withdrawalRef = await databaseService
        .getDb()
        .collection("platform_withdrawals")
        .add(withdrawalRequest);

      logger.info(
        `Platform withdrawal request created: ${withdrawalRef.id} for $${amount}`
      );

      // Notify admins about the withdrawal request
      const {
        getNotificationServiceInstance,
      } = require("./notificationService");
      const notificationService = getNotificationServiceInstance();

      if (notificationService) {
        const adminUsers = await this.getAdminUsers();
        for (const admin of adminUsers) {
          if (admin.telegramId && admin.telegramId !== requestedBy) {
            await notificationService.sendNotification(
              admin.telegramId,
              `💰 *Platform Withdrawal Request*\n\n` +
                `Amount: *$${amount.toFixed(2)}*\n` +
                `Reason: ${reason}\n` +
                `Requested by: Admin ${requestedBy}\n\n` +
                `Please review and approve this withdrawal request.`,
              {
                type: "platform_withdrawal",
                action: "admin_approval",
                withdrawalId: withdrawalRef.id,
              }
            );
          }
        }
      }

      return withdrawalRef.id;
    } catch (error) {
      logger.error("Error requesting platform withdrawal:", error);
      throw error;
    }
  }

  async getPendingPlatformWithdrawals() {
    try {
      const withdrawalsSnap = await databaseService
        .getDb()
        .collection("platform_withdrawals")
        .where("status", "==", "pending")
        .get();

      // Sort in memory to avoid index requirement
      const withdrawals = withdrawalsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return withdrawals.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Descending order
      });
    } catch (error) {
      logger.error("Error getting pending platform withdrawals:", error);
      return [];
    }
  }

  async approvePlatformWithdrawal(withdrawalId, approvedBy) {
    try {
      const withdrawalRef = databaseService
        .getDb()
        .collection("platform_withdrawals")
        .doc(withdrawalId);

      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) {
        throw new Error("Withdrawal request not found");
      }

      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "pending") {
        throw new Error("Withdrawal request is not pending");
      }

      // Update withdrawal status to approved
      await withdrawalRef.update({
        status: "approved",
        approvedBy,
        approvedAt: new Date(),
      });

      logger.info(
        `Platform withdrawal approved: ${withdrawalId} by ${approvedBy}`
      );

      // Notify the requester
      const {
        getNotificationServiceInstance,
      } = require("./notificationService");
      const notificationService = getNotificationServiceInstance();

      if (notificationService) {
        await notificationService.sendNotification(
          withdrawal.requestedBy,
          `✅ Platform Withdrawal Approved\n\nAmount: $${withdrawal.amount.toFixed(
            2
          )}\nReason: ${withdrawal.reason}\nApproved by: ${approvedBy}`,
          {
            type: "platform_withdrawal",
            action: "approved",
            withdrawalId,
          }
        );
      }

      return true;
    } catch (error) {
      logger.error("Error approving platform withdrawal:", error);
      throw error;
    }
  }

  async denyPlatformWithdrawal(withdrawalId, deniedBy, reason) {
    try {
      const withdrawalRef = databaseService
        .getDb()
        .collection("platform_withdrawals")
        .doc(withdrawalId);

      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) {
        throw new Error("Withdrawal request not found");
      }

      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "pending") {
        throw new Error("Withdrawal request is not pending");
      }

      // Update withdrawal status to denied
      await withdrawalRef.update({
        status: "denied",
        deniedBy,
        deniedAt: new Date(),
        denialReason: reason,
      });

      logger.info(`Platform withdrawal denied: ${withdrawalId} by ${deniedBy}`);

      // Notify the requester
      const {
        getNotificationServiceInstance,
      } = require("./notificationService");
      const notificationService = getNotificationServiceInstance();

      if (notificationService) {
        await notificationService.sendNotification(
          withdrawal.requestedBy,
          `❌ Platform Withdrawal Denied\n\nAmount: $${withdrawal.amount.toFixed(
            2
          )}\nReason: ${
            withdrawal.reason
          }\nDenied by: ${deniedBy}\nDenial reason: ${reason}`,
          {
            type: "platform_withdrawal",
            action: "denied",
            withdrawalId,
          }
        );
      }

      return true;
    } catch (error) {
      logger.error("Error denying platform withdrawal:", error);
      throw error;
    }
  }

  async processPlatformWithdrawal(withdrawalId, processedBy) {
    try {
      const withdrawalRef = databaseService
        .getDb()
        .collection("platform_withdrawals")
        .doc(withdrawalId);

      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) {
        throw new Error("Withdrawal request not found");
      }

      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "approved") {
        throw new Error("Withdrawal request is not approved");
      }

      // Deduct from platform balance
      const currentBalance = await this.getPlatformBalance();
      if (currentBalance < withdrawal.amount) {
        throw new Error("Insufficient platform balance for withdrawal");
      }

      const newBalance = currentBalance - withdrawal.amount;
      await this.updatePlatformBalance(-withdrawal.amount);

      // Update withdrawal status to processed
      await withdrawalRef.update({
        status: "processed",
        processedBy,
        processedAt: new Date(),
        finalBalance: newBalance,
      });

      logger.info(
        `Platform withdrawal processed: ${withdrawalId} - $${withdrawal.amount}`
      );

      // Notify the requester
      const notificationService = require("./notificationService");
      await notificationService.sendNotification(
        withdrawal.requestedBy,
        `💰 Platform Withdrawal Processed\n\nAmount: $${withdrawal.amount.toFixed(
          2
        )}\nReason: ${
          withdrawal.reason
        }\nProcessed by: ${processedBy}\nNew balance: $${newBalance.toFixed(
          2
        )}`,
        {
          type: "platform_withdrawal",
          action: "processed",
          withdrawalId,
        }
      );

      return {
        success: true,
        newBalance,
        withdrawalAmount: withdrawal.amount,
      };
    } catch (error) {
      logger.error("Error processing platform withdrawal:", error);
      throw error;
    }
  }

  async getPlatformWithdrawalHistory(limit = 20) {
    try {
      const withdrawalsSnap = await databaseService
        .getDb()
        .collection("platform_withdrawals")
        .limit(limit)
        .get();

      // Sort in memory to avoid index requirement
      const withdrawals = withdrawalsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return withdrawals.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Descending order
      });
    } catch (error) {
      logger.error("Error getting platform withdrawal history:", error);
      return [];
    }
  }

  async requestCompanyWithdrawal(companyId, amount, reason, requestedBy) {
    try {
      // Get company details
      const company = await companyService.getCompanyById(companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      const withdrawable = company.billingBalance || 0;
      if (withdrawable < amount) {
        throw new Error(
          `Insufficient withdrawable amount. Available: $${withdrawable.toFixed(
            2
          )}`
        );
      }

      if (amount <= 0) {
        throw new Error("Withdrawal amount must be greater than 0");
      }

      // Create withdrawal request
      const withdrawalRequest = {
        companyId,
        companyName: company.name,
        amount,
        reason,
        requestedBy,
        status: "company_pending",
        createdAt: new Date(),
        type: "company_withdrawal",
      };

      const withdrawalRef = await databaseService
        .getDb()
        .collection("company_withdrawal_requests")
        .add(withdrawalRequest);

      logger.info(
        `Company withdrawal request created: ${withdrawalRef.id} for company ${companyId}`
      );

      // Notify company owner
      const {
        getNotificationServiceInstance,
      } = require("./notificationService");
      const notificationService = getNotificationServiceInstance();

      if (notificationService && company.telegramId) {
        // Get admin username
        let adminUsername = "Admin";
        try {
          const userService = require("./userService").userService;
          const adminUser = await userService.getUserByTelegramId(requestedBy);
          if (adminUser && adminUser.username) {
            adminUsername = `Admin @${adminUser.username}`;
          } else if (adminUser && adminUser.firstName) {
            adminUsername = `Admin ${adminUser.firstName}`;
          }
        } catch (error) {
          logger.warn(
            `Could not get admin username for ${requestedBy}:`,
            error
          );
        }

        await notificationService.sendNotification(
          company.telegramId,
          `💰 *Withdrawal Request*\n\n` +
            `Amount: *$${amount.toFixed(2)}*\n` +
            `Reason: ${reason}\n` +
            `Requested by: ${adminUsername}\n\n` +
            `Please approve or deny this withdrawal request.`,
          {
            type: "company_withdrawal",
            action: "company_approval",
            withdrawalId: withdrawalRef.id,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Approve",
                    callback_data: `company_approve_withdrawal_${withdrawalRef.id}`,
                  },
                  {
                    text: "❌ Deny",
                    callback_data: `company_deny_withdrawal_${withdrawalRef.id}`,
                  },
                ],
              ],
            },
          }
        );
      } else {
        logger.warn(
          `Notification service not available or company has no telegramId: ${company.telegramId}`
        );
      }

      return withdrawalRef.id;
    } catch (error) {
      logger.error("Error requesting company withdrawal:", error);
      throw error;
    }
  }

  async getPendingCompanyWithdrawals() {
    try {
      const withdrawalsSnap = await databaseService
        .getDb()
        .collection("company_withdrawal_requests")
        .where("status", "==", "company_pending")
        .get();

      // Sort in memory to avoid index requirement
      const withdrawals = withdrawalsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return withdrawals.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Descending order
      });
    } catch (error) {
      logger.error("Error getting pending company withdrawals:", error);
      return [];
    }
  }

  async getApprovedCompanyWithdrawals() {
    try {
      const withdrawalsSnap = await databaseService
        .getDb()
        .collection("company_withdrawal_requests")
        .where("status", "==", "company_approved")
        .get();

      // Sort in memory to avoid index requirement
      const withdrawals = withdrawalsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return withdrawals.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Descending order
      });
    } catch (error) {
      logger.error("Error getting approved company withdrawals:", error);
      return [];
    }
  }

  async companyApproveWithdrawal(withdrawalId, approvedBy) {
    try {
      const withdrawalRef = databaseService
        .getDb()
        .collection("company_withdrawal_requests")
        .doc(withdrawalId);

      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) {
        throw new Error("Withdrawal request not found");
      }

      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "company_pending") {
        throw new Error("Withdrawal request is not pending");
      }

      // Get the username of the approver
      const userService = require("./userService").userService;
      const approverUser = await userService.getUserByTelegramId(approvedBy);
      const approverUsername = approverUser?.username
        ? `@${approverUser.username}`
        : approvedBy;

      // Update withdrawal status to approved
      await withdrawalRef.update({
        status: "company_approved",
        approvedBy,
        approvedAt: new Date(),
      });

      logger.info(
        `Company withdrawal approved: ${withdrawalId} by ${approvedBy}`
      );

      // Notify admins about the approval
      const admins = await this.getAdminUsers();
      const {
        getNotificationServiceInstance,
      } = require("./notificationService");
      const notificationService = getNotificationServiceInstance();

      // Get unique admin IDs to prevent duplicates
      const uniqueAdminIds = [
        ...new Set(admins.map((admin) => admin.telegramId)),
      ];

      for (const adminId of uniqueAdminIds) {
        if (adminId !== approvedBy) {
          await notificationService.sendNotification(
            adminId,
            `✅ *Company Withdrawal Approved*\n\n` +
              `Company: ${withdrawal.companyName}\n` +
              `Amount: *$${withdrawal.amount.toFixed(2)}*\n` +
              `Reason: ${withdrawal.reason}\n` +
              `Approved by: ${approverUsername}\n\n` +
              `Please confirm receipt and process the withdrawal.`,
            {
              type: "company_withdrawal",
              action: "admin_confirmation",
              withdrawalId,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Confirm Receipt",
                      callback_data: `confirm_company_withdrawal_${withdrawalId}`,
                    },
                    {
                      text: "❌ Reject",
                      callback_data: `reject_company_withdrawal_${withdrawalId}`,
                    },
                  ],
                ],
              },
            }
          );
        }
      }

      return true;
    } catch (error) {
      logger.error("Error approving company withdrawal:", error);
      throw error;
    }
  }

  async companyDenyWithdrawal(withdrawalId, deniedBy, reason) {
    try {
      const withdrawalRef = databaseService
        .getDb()
        .collection("company_withdrawal_requests")
        .doc(withdrawalId);

      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) {
        throw new Error("Withdrawal request not found");
      }

      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "company_pending") {
        throw new Error("Withdrawal request is not pending");
      }

      // Get the username of the denier
      const userService = require("./userService").userService;
      const denierUser = await userService.getUserByTelegramId(deniedBy);
      const denierUsername = denierUser?.username
        ? `@${denierUser.username}`
        : deniedBy;

      // Update withdrawal status to denied
      await withdrawalRef.update({
        status: "company_denied",
        deniedBy,
        deniedAt: new Date(),
        denialReason: reason,
      });

      logger.info(`Company withdrawal denied: ${withdrawalId} by ${deniedBy}`);

      // Notify admins about the denial
      const admins = await this.getAdminUsers();
      const notificationService =
        require("./notificationService").getNotificationServiceInstance();

      // Get unique admin IDs to prevent duplicates
      const uniqueAdminIds = [
        ...new Set(admins.map((admin) => admin.telegramId)),
      ];

      for (const adminId of uniqueAdminIds) {
        await notificationService.sendNotification(
          adminId,
          `❌ *Company Withdrawal Denied*\n\n` +
            `Company: ${withdrawal.companyName}\n` +
            `Amount: *$${withdrawal.amount.toFixed(2)}*\n` +
            `Reason: ${withdrawal.reason}\n` +
            `Denied by: ${denierUsername}\n` +
            `Denial reason: ${reason}`,
          {
            type: "company_withdrawal",
            action: "denied",
            withdrawalId,
            parse_mode: "Markdown",
          }
        );
      }

      return true;
    } catch (error) {
      logger.error("Error denying company withdrawal:", error);
      throw error;
    }
  }

  async adminConfirmWithdrawal(withdrawalId, confirmedBy) {
    try {
      const withdrawalRef = databaseService
        .getDb()
        .collection("company_withdrawal_requests")
        .doc(withdrawalId);

      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) {
        throw new Error("Withdrawal request not found");
      }

      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "company_approved") {
        throw new Error("Withdrawal request is not approved");
      }

      // Update company balance
      const companyRef = databaseService.companies().doc(withdrawal.companyId);
      const companyDoc = await companyRef.get();

      if (!companyDoc.exists) {
        throw new Error("Company not found");
      }

      const company = companyDoc.data();
      const currentBalance = company.billingBalance || 0;

      if (currentBalance < withdrawal.amount) {
        throw new Error("Insufficient company balance for withdrawal");
      }

      const newBalance = currentBalance - withdrawal.amount;
      await companyRef.update({
        billingBalance: newBalance,
        lastWithdrawal: {
          amount: withdrawal.amount,
          date: new Date(),
          processedBy: confirmedBy,
        },
      });

      // Update withdrawal status to processed
      await withdrawalRef.update({
        status: "processed",
        processedBy: confirmedBy,
        processedAt: new Date(),
        finalBalance: newBalance,
      });

      logger.info(
        `Company withdrawal processed: ${withdrawalId} - $${withdrawal.amount}`
      );

      // Notify company owner
      const notificationService =
        require("./notificationService").getNotificationServiceInstance();
      await notificationService.sendNotification(
        company.telegramId,
        `💰 *Withdrawal Processed*\n\n` +
          `Amount: *$${withdrawal.amount.toFixed(2)}*\n` +
          `Reason: ${withdrawal.reason}\n` +
          `Processed by: Admin ${confirmedBy}\n` +
          `New balance: *$${newBalance.toFixed(2)}*\n\n` +
          `The withdrawal has been completed and your balance has been updated.`,
        {
          type: "company_withdrawal",
          action: "processed",
          withdrawalId,
        }
      );

      return {
        success: true,
        newBalance,
        withdrawalAmount: withdrawal.amount,
      };
    } catch (error) {
      logger.error("Error confirming company withdrawal:", error);
      throw error;
    }
  }

  async getCompanyWithdrawalHistory(limit = 20) {
    try {
      const withdrawalsSnap = await databaseService
        .getDb()
        .collection("company_withdrawal_requests")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      return withdrawalsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      logger.error("Error getting company withdrawal history:", error);
      return [];
    }
  }

  async updateCompanyBillingBalance(companyId, amount) {
    try {
      const companyDoc = await databaseService.companies().doc(companyId).get();
      if (!companyDoc.exists) {
        throw new Error("Company not found");
      }

      const company = companyDoc.data();
      const currentBalance = company.billingBalance || 0;
      const newBalance = currentBalance + amount;

      await databaseService.companies().doc(companyId).update({
        billingBalance: newBalance,
        updatedAt: new Date(),
      });

      logger.info(
        `Company ${companyId} billing balance updated: ${currentBalance} + ${amount} = ${newBalance}`
      );
      return newBalance;
    } catch (error) {
      logger.error("Error updating company billing balance:", error);
      throw error;
    }
  }

  // Cache invalidation methods
  invalidateDashboardCache() {
    invalidateCache('dashboard');
    invalidateCache('platform_stats');
    invalidateCache('company_analytics');
    invalidateCache('quick_stats');
    console.log('🗑️ Dashboard cache invalidated');
  }

  invalidateCompanyCache() {
    invalidateCache('company_analytics');
    invalidateCache('platform_stats');
    console.log('🗑️ Company cache invalidated');
  }

  invalidatePlatformCache() {
    invalidateCache('platform_stats');
    invalidateCache('quick_stats');
    console.log('🗑️ Platform cache invalidated');
  }
}

console.log("Exiting services/adminService.js");
module.exports = new AdminService();
