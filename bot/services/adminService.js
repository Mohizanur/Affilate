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
      usersSnap.forEach((doc) => {
        const u = doc.data();
        if (u.phone_verified) verified++;
        if (
          u.last_active &&
          now - new Date(u.last_active).getTime() < 7 * 24 * 60 * 60 * 1000
        )
          active++;
      });
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
      const companiesSnap = await databaseService.companies().get();
      logger.info(`Found ${companiesSnap.size} companies in database`);

      const analytics = [];

      for (const doc of companiesSnap.docs) {
        const company = doc.data();
        const companyId = doc.id;

        logger.info(`Processing company: ${company.name} (ID: ${companyId})`);
        logger.info(`Company data:`, company);

        // Get company's products count - check for different field names
        let productsSnap;
        try {
          productsSnap = await databaseService
            .getDb()
            .collection("products")
            .where("companyId", "==", companyId)
            .get();
          logger.info(
            `Found ${productsSnap.size} products with companyId field`
          );
        } catch (error) {
          try {
            productsSnap = await databaseService
              .getDb()
              .collection("products")
              .where("company_id", "==", companyId)
              .get();
            logger.info(
              `Found ${productsSnap.size} products with company_id field`
            );
          } catch (error2) {
            // If both fail, get all products and filter
            productsSnap = await databaseService
              .getDb()
              .collection("products")
              .get();
            logger.info(
              `Got all ${productsSnap.size} products, will filter manually`
            );
          }
        }

        // Filter products that belong to this company
        let productCount = 0;
        for (const productDoc of productsSnap.docs) {
          const product = productDoc.data();
          const productCompanyId = product.companyId || product.company_id;
          logger.info(
            `Product ${productDoc.id}: companyId=${
              product.companyId
            }, company_id=${product.company_id}, matches=${
              productCompanyId === companyId
            }`
          );
          if (productCompanyId === companyId) {
            productCount++;
          }
        }

        // Calculate actual platform fees and lifetime revenue
        const platformFees = await this.calculateCompanyPlatformFees(companyId);
        const lifetimeRevenue = await this.calculateCompanyLifetimeRevenue(
          companyId
        );
        const withdrawable = company.billingBalance || 0;

        logger.info(`Company ${company.name} results:`);
        logger.info(`- Product count: ${productCount}`);
        logger.info(`- Platform fees: $${platformFees.toFixed(2)}`);
        logger.info(`- Lifetime revenue: $${lifetimeRevenue.toFixed(2)}`);
        logger.info(`- Withdrawable: $${withdrawable.toFixed(2)}`);

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

        logger.info(
          `Company ${
            company.name
          } (${companyId}): ${productCount} products, $${platformFees.toFixed(
            2
          )} platform fees, $${lifetimeRevenue.toFixed(2)} lifetime revenue`
        );
      }

      logger.info(`Total companies processed: ${analytics.length}`);
      return analytics;
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
      // Calculate revenue from referrals instead of orders
      const referralsSnap = await databaseService.referrals().get();
      let totalRevenue = 0;
      let totalCommissions = 0;
      let platformRevenue = 0;

      referralsSnap.forEach((doc) => {
        const referral = doc.data();
        const amount = referral.amount || 0;
        totalRevenue += amount;

        // Calculate commissions (assuming 2.5% commission rate)
        const commission = amount * 0.025;
        totalCommissions += commission;

        // Calculate platform revenue (1.5% platform fee)
        const platformFee = amount * 0.015;
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
      const [platformStats, companyAnalytics, recentUsers, systemAlerts] =
        await Promise.all([
          this.getPlatformStats(),
          this.getCompanyAnalytics(),
          userService.getRecentUsers(5),
          this.getSystemAlerts(),
        ]);

      return {
        platformStats,
        companyAnalytics,
        recentUsers,
        systemAlerts,
        quickStats: await this.getQuickStats(),
      };
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
        databaseService.companies().where("status", "==", "approved").get(),
      ]);

      // Calculate total platform fees from actual transactions
      let totalPlatformFees = 0;
      let totalWithdrawable = 0;

      for (const doc of companiesSnap.docs) {
        const company = doc.data();
        const companyId = doc.id;

        // Calculate actual platform fees for this company
        const platformFees = await this.calculateCompanyPlatformFees(companyId);
        totalPlatformFees += platformFees;
        totalWithdrawable += company.billingBalance || 0;
      }

      const totalUsers = usersSnap.size;
      const totalCompanies = companiesSnap.size;
      return {
        totalUsers,
        totalCompanies,
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
        .doc("platform")
        .get();
      if (!doc.exists) {
        return {
          platformFeePercent: parseFloat(
            process.env.PLATFORM_FEE_PERCENTAGE || "1.5"
          ),
          referralCommissionPercent: 10,
          referralDiscountPercent: 5,
          minWithdrawalAmount: 10,
          maxReferralUses: 0,
          referralExpiryDays: 0,
        };
      }
      return doc.data();
    } catch (error) {
      logger.error("Error loading platform settings:", error);
      return {
        platformFeePercent: parseFloat(
          process.env.PLATFORM_FEE_PERCENTAGE || "1.5"
        ),
        referralCommissionPercent: 10,
        referralDiscountPercent: 5,
        minWithdrawalAmount: 10,
        maxReferralUses: 0,
        referralExpiryDays: 0,
      };
    }
  }

  async setPlatformSetting(key, value) {
    try {
      await databaseService
        .getDb()
        .collection("settings")
        .doc("platform")
        .set({ [key]: value }, { merge: true });
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
      // Get all companies and calculate platform fees from actual transactions
      const companiesSnap = await databaseService.companies().get();
      let totalPlatformFees = 0;
      let totalWithdrawable = 0;
      let totalLifetimeRevenue = 0;

      const companyStats = [];

      logger.info(
        `Processing ${companiesSnap.size} companies for platform stats`
      );

      for (const doc of companiesSnap.docs) {
        const company = doc.data();
        const companyId = doc.id;

        // Calculate actual platform fees from referrals and transactions
        const platformFees = await this.calculateCompanyPlatformFees(companyId);
        const withdrawable = company.billingBalance || 0;
        const lifetimeRevenue = await this.calculateCompanyLifetimeRevenue(
          companyId
        );

        totalPlatformFees += platformFees;
        totalWithdrawable += withdrawable;
        totalLifetimeRevenue += lifetimeRevenue;

        companyStats.push({
          id: companyId,
          name: company.name,
          platformFees,
          withdrawable,
          lifetimeRevenue,
          hasWithdrawable: withdrawable > 0,
        });

        logger.info(
          `Company ${company.name}: Platform fees=$${platformFees.toFixed(
            2
          )}, Revenue=$${lifetimeRevenue.toFixed(
            2
          )}, Withdrawable=$${withdrawable.toFixed(2)}`
        );
      }

      logger.info(
        `Total platform stats: Fees=$${totalPlatformFees.toFixed(
          2
        )}, Revenue=$${totalLifetimeRevenue.toFixed(
          2
        )}, Withdrawable=$${totalWithdrawable.toFixed(2)}`
      );

      return {
        totalPlatformFees,
        totalWithdrawable,
        totalLifetimeRevenue,
        companies: companyStats,
        totalCompanies: companiesSnap.size,
      };
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
      logger.info(`Calculating platform fees for company ${companyId}...`);

      // Calculate platform fees from referrals for this company
      // Check for different possible field names
      let referralsSnap;

      try {
        // First try with companyId field
        logger.info(`Trying to find referrals with companyId = ${companyId}`);
        referralsSnap = await databaseService
          .referrals()
          .where("companyId", "==", companyId)
          .get();
        logger.info(
          `Found ${referralsSnap.size} referrals with companyId field`
        );
      } catch (error) {
        try {
          // Try with company_id field
          logger.info(
            `Trying to find referrals with company_id = ${companyId}`
          );
          referralsSnap = await databaseService
            .referrals()
            .where("company_id", "==", companyId)
            .get();
          logger.info(
            `Found ${referralsSnap.size} referrals with company_id field`
          );
        } catch (error2) {
          // If both fail, get all referrals and filter
          logger.info(`Getting all referrals to filter manually`);
          referralsSnap = await databaseService.referrals().get();
          logger.info(`Total referrals found: ${referralsSnap.size}`);
        }
      }

      let totalPlatformFees = 0;

      for (const doc of referralsSnap.docs) {
        const referral = doc.data();
        logger.info(`Referral ${doc.id}:`, referral);

        // Check if this referral belongs to the company
        const referralCompanyId = referral.companyId || referral.company_id;
        logger.info(
          `Referral companyId: ${referral.companyId}, company_id: ${
            referral.company_id
          }, matches: ${referralCompanyId === companyId}`
        );

        if (referralCompanyId !== companyId) {
          logger.info(
            `Skipping referral - doesn't belong to company ${companyId}`
          );
          continue;
        }

        // Platform fee is typically 1.5% of the transaction amount
        const platformFee = (referral.amount || 0) * 0.015; // 1.5% platform fee
        totalPlatformFees += platformFee;

        logger.info(
          `Referral amount: $${
            referral.amount || 0
          }, platform fee: $${platformFee.toFixed(2)}`
        );
      }

      logger.info(
        `Calculated platform fees for company ${companyId}: $${totalPlatformFees.toFixed(
          2
        )}`
      );
      return totalPlatformFees;
    } catch (error) {
      logger.error("Error calculating company platform fees:", error);
      return 0;
    }
  }

  async calculateCompanyLifetimeRevenue(companyId) {
    try {
      logger.info(`Calculating lifetime revenue for company ${companyId}...`);

      // Calculate lifetime revenue from all referrals for this company
      // Check for different possible field names
      let referralsSnap;

      try {
        // First try with companyId field
        logger.info(`Trying to find referrals with companyId = ${companyId}`);
        referralsSnap = await databaseService
          .referrals()
          .where("companyId", "==", companyId)
          .get();
        logger.info(
          `Found ${referralsSnap.size} referrals with companyId field`
        );
      } catch (error) {
        try {
          // Try with company_id field
          logger.info(
            `Trying to find referrals with company_id = ${companyId}`
          );
          referralsSnap = await databaseService
            .referrals()
            .where("company_id", "==", companyId)
            .get();
          logger.info(
            `Found ${referralsSnap.size} referrals with company_id field`
          );
        } catch (error2) {
          // If both fail, get all referrals and filter
          logger.info(`Getting all referrals to filter manually`);
          referralsSnap = await databaseService.referrals().get();
          logger.info(`Total referrals found: ${referralsSnap.size}`);
        }
      }

      let totalRevenue = 0;

      for (const doc of referralsSnap.docs) {
        const referral = doc.data();
        logger.info(`Referral ${doc.id}:`, referral);

        // Check if this referral belongs to the company
        const referralCompanyId = referral.companyId || referral.company_id;
        logger.info(
          `Referral companyId: ${referral.companyId}, company_id: ${
            referral.company_id
          }, matches: ${referralCompanyId === companyId}`
        );

        if (referralCompanyId !== companyId) {
          logger.info(
            `Skipping referral - doesn't belong to company ${companyId}`
          );
          continue;
        }

        totalRevenue += referral.amount || 0;
        logger.info(
          `Referral amount: $${
            referral.amount || 0
          }, total so far: $${totalRevenue.toFixed(2)}`
        );
      }

      logger.info(
        `Calculated lifetime revenue for company ${companyId}: $${totalRevenue.toFixed(
          2
        )}`
      );
      return totalRevenue;
    } catch (error) {
      logger.error("Error calculating company lifetime revenue:", error);
      return 0;
    }
  }

  async calculateTotalLifetimeWithdrawn() {
    try {
      let totalWithdrawn = 0;

      // Check the withdrawals collection (where actual withdrawals are stored)
      try {
        logger.info(
          `Checking withdrawals collection for approved withdrawals...`
        );

        // Get approved withdrawals from the withdrawals collection
        const withdrawalsSnap = await databaseService
          .withdrawals()
          .where("status", "==", "approved")
          .get();

        logger.info(`Found ${withdrawalsSnap.size} approved withdrawals`);

        for (const doc of withdrawalsSnap.docs) {
          const withdrawal = doc.data();
          const amount = withdrawal.amount || 0;
          totalWithdrawn += amount;

          logger.info(
            `Approved withdrawal: $${amount.toFixed(2)} for user ${
              withdrawal.userId
            }`
          );
        }

        // Also check for any other statuses that might indicate completed withdrawals
        const otherStatuses = ["processed", "completed", "finalized"];

        for (const status of otherStatuses) {
          try {
            const otherWithdrawalsSnap = await databaseService
              .withdrawals()
              .where("status", "==", status)
              .get();

            logger.info(
              `Found ${otherWithdrawalsSnap.size} withdrawals with status '${status}'`
            );

            for (const doc of otherWithdrawalsSnap.docs) {
              const withdrawal = doc.data();
              const amount = withdrawal.amount || 0;
              totalWithdrawn += amount;

              logger.info(`Withdrawal (${status}): $${amount.toFixed(2)}`);
            }
          } catch (error) {
            logger.info(`No withdrawals with status '${status}'`);
          }
        }
      } catch (error) {
        logger.error("Error accessing withdrawals collection:", error);
      }

      // Also check company_withdrawals collection if it exists
      try {
        const companyWithdrawalsSnap = await databaseService
          .getDb()
          .collection("company_withdrawals")
          .where("status", "==", "processed")
          .get();

        logger.info(`Found ${companyWithdrawalsSnap.size} company withdrawals`);

        for (const doc of companyWithdrawalsSnap.docs) {
          const withdrawal = doc.data();
          const amount = withdrawal.amount || 0;
          totalWithdrawn += amount;

          logger.info(`Company withdrawal: $${amount.toFixed(2)}`);
        }
      } catch (error) {
        logger.info("Company withdrawals collection not accessible or empty");
      }

      logger.info(
        `Total lifetime withdrawn from companies: $${totalWithdrawn.toFixed(2)}`
      );
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

        // Get company's products count
        const productsSnap = await databaseService
          .getDb()
          .collection("products")
          .where("companyId", "==", companyId)
          .get();

        analytics.push({
          id: companyId,
          name: company.name,
          ownerUsername: company.ownerUsername || company.telegramId,
          platformFees: company.billingBalance || 0,
          withdrawable: company.billingBalance || 0,
          lifetimeRevenue: company.billingBalance || 0,
          productCount: productsSnap.size,
          hasWithdrawable: (company.billingBalance || 0) > 0,
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
}

console.log("Exiting services/adminService.js");
module.exports = new AdminService();
