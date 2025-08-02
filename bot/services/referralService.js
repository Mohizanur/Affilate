const databaseService = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const logger = require("../../utils/logger");
const { getNotificationServiceInstance } = require("./notificationService");
const adminService = require("./adminService");

class ReferralService {
  // Helper: Get user doc and data, throw if not found
  async _getUserOrThrow(telegramId) {
    const userDoc = await databaseService
      .users()
      .doc(telegramId.toString())
      .get();
    if (!userDoc.exists) throw new Error("User not found");
    return { userDoc, userData: userDoc.data() };
  }
  // Helper: Get company doc and data, throw if not found
  async _getCompanyOrThrow(companyId) {
    const companyDoc = await databaseService.companies().doc(companyId).get();
    if (!companyDoc.exists) throw new Error("Company not found");
    return { companyDoc, company: companyDoc.data() };
  }

  // Generate a unique referral code for a user and company (single-use per company)
  async generateReferralCode(companyId, telegramId) {
    try {
      const { userDoc, userData } = await this._getUserOrThrow(telegramId);
      const { companyDoc, company } = await this._getCompanyOrThrow(companyId);
      // Generate new code (single-use)
      const codePrefix = company.codePrefix || "XX";
      const code = `${codePrefix}-${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`;
      // Save code to referralCodes collection
      const refCodeDoc = await databaseService.referralCodes().add({
        code,
        userId: telegramId,
        companyId,
        createdAt: new Date(),
        active: true,
      });
      // Ensure user joinedCompanies is updated
      const joinedCompanies = userData.joinedCompanies || [];
      if (!joinedCompanies.includes(companyId)) {
        joinedCompanies.push(companyId);
        await databaseService
          .users()
          .doc(telegramId.toString())
          .update({ joinedCompanies });
      }
      // await getNotificationServiceInstance().sendNotification(
      //   telegramId,
      //   `🔗 Your new referral code for ${company.name}: ${code}`,
      //   { type: "referral", action: "generate", companyId, code }
      // );
      logger.info(
        `Referral code generated: ${code} for user ${telegramId} and company ${companyId}`
      );
      return code;
    } catch (error) {
      logger.error("Error generating referral code (Firestore):", error);
      throw error;
    }
  }

  generateUniqueCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async getReferralCodeByCode(code) {
    try {
      const snap = await databaseService
        .referralCodes()
        .where("code", "==", code)
        .get();
      if (snap.empty) throw new Error("Referral code not found");
      const refCode = snap.docs[0].data();
      // Attach product, company, user info
      const [productDoc, companyDoc, userDoc] = await Promise.all([
        databaseService
          .getDb()
          .collection("products")
          .doc(refCode.productId)
          .get(),
        databaseService.companies().doc(refCode.companyId).get(),
        databaseService.users().doc(refCode.userId.toString()).get(),
      ]);
      return {
        ...refCode,
        product_title: productDoc.exists ? productDoc.data().title : null,
        price: productDoc.exists ? productDoc.data().price : null,
        company_name: companyDoc.exists ? companyDoc.data().name : null,
        commission_rate: companyDoc.exists
          ? companyDoc.data().commission_rate
          : null,
        first_name: userDoc.exists ? userDoc.data().first_name : null,
        last_name: userDoc.exists ? userDoc.data().last_name : null,
      };
    } catch (error) {
      logger.error("Error getting referral code by code (Firestore):", error);
      throw error;
    }
  }

  async getUserReferralCodes(userId) {
    try {
      const snap = await databaseService
        .referralCodes()
        .where("userId", "==", userId)
        .get();
      const codes = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Attach product, company info
      for (const code of codes) {
        let productDoc = { exists: false },
          companyDoc = { exists: false };
        if (code.productId) {
          productDoc = await databaseService
            .getDb()
            .collection("products")
            .doc(code.productId)
            .get();
        }
        if (code.companyId) {
          companyDoc = await databaseService
            .companies()
            .doc(code.companyId)
            .get();
        }
        code.product_title = productDoc.exists ? productDoc.data().title : null;
        code.price = productDoc.exists ? productDoc.data().price : null;
        code.company_name = companyDoc.exists ? companyDoc.data().name : null;
        code.commission_rate = companyDoc.exists
          ? companyDoc.data().commission_rate
          : null;
      }
      return codes;
    } catch (error) {
      logger.error("Error getting user referral codes (Firestore):", error);
      throw error;
    }
  }

  async createReferral(referralData) {
    try {
      // Remove any undefined fields from referralData
      const cleanData = {};
      for (const key in referralData) {
        if (referralData[key] !== undefined) {
          cleanData[key] = referralData[key];
        }
      }
      // Ensure referrerTelegramId and companyId are set
      if (!cleanData.referrerTelegramId && cleanData.userId) {
        cleanData.referrerTelegramId = cleanData.userId;
      }
      if (!cleanData.companyId && cleanData.company_id) {
        cleanData.companyId = cleanData.company_id;
      }
      const { userId } = cleanData;
      const referralId = cleanData.id || uuidv4();
      cleanData.id = referralId;
      await databaseService.referrals().doc(referralId).set(cleanData);
      // await getNotificationServiceInstance().sendNotification(
      //   userId,
      //   `🎉 You have successfully referred a user!`,
      //   { type: "referral", action: "success", referralId }
      // );
      logger.info(`Referral created: ${referralId} by user ${userId}`);
      return cleanData;
    } catch (error) {
      logger.error("Error creating referral (Firestore):", error);
      throw error;
    }
  }

  async getReferralsByUser(userId) {
    try {
      const snap = await databaseService
        .referrals()
        .where("referrerTelegramId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
      const referrals = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Attach referral code, product, company, order info
      for (const ref of referrals) {
        const [refCodeDoc, orderDoc] = await Promise.all([
          databaseService.referralCodes().doc(ref.referralCodeId).get(),
          databaseService.orders().doc(ref.orderId).get(),
        ]);
        ref.referral_code = refCodeDoc.exists ? refCodeDoc.data().code : null;
        ref.order_status = orderDoc.exists ? orderDoc.data().status : null;
        ref.order_amount = orderDoc.exists ? orderDoc.data().amount : null;
        ref.order_date = orderDoc.exists ? orderDoc.data().createdAt : null;
      }
      return referrals;
    } catch (error) {
      logger.error("Error getting referrals by user (Firestore):", error);
      throw error;
    }
  }

  async getReferralStats(userId) {
    if (!userId) throw new Error("User ID is required for referral stats");
    try {
      // Get dynamic settings for commission rate
      const settings = await adminService.getPlatformSettings();
      const commissionRate = settings.referralCommissionPercent / 100 || 0.025; // Default 2.5%

      // Aggregate stats from referrals
      const referralsSnap = await databaseService
        .referrals()
        .where("referrerTelegramId", "==", userId)
        .get();
      const referrals = referralsSnap.docs.map((doc) => doc.data());
      let totalEarnings = 0;
      let pendingEarnings = 0;
      let thisMonthEarnings = 0;
      let totalReferrals = referrals.length;
      const now = new Date();
      for (const ref of referrals) {
        // Use dynamic commission rate
        const earning = (ref.amount || 0) * commissionRate;
        totalEarnings += earning;
        // This month
        const createdAt =
          ref.createdAt instanceof Date
            ? ref.createdAt
            : ref.createdAt && ref.createdAt.toDate
            ? ref.createdAt.toDate()
            : new Date(ref.createdAt);
        if (
          createdAt.getMonth() === now.getMonth() &&
          createdAt.getFullYear() === now.getFullYear()
        ) {
          thisMonthEarnings += earning;
        }
        // No pending logic without order status
      }
      return {
        totalReferrals,
        totalEarnings,
        pendingEarnings: 0,
        thisMonthEarnings,
      };
    } catch (error) {
      logger.error("Error getting referral stats (Firestore):", error);
      throw error;
    }
  }

  async getTopReferrers(limit = 10) {
    try {
      // Fetch all users
      const usersSnap = await databaseService.users().get();
      const users = usersSnap.docs.map((doc) => ({
        telegramId: doc.id,
        ...doc.data(),
      }));
      // Fetch all referrals
      const referralsSnap = await databaseService.referrals().get();
      const referrals = referralsSnap.docs.map((doc) => doc.data());
      // Map: telegramId -> total referrals
      const referralCountMap = {};
      referrals.forEach((ref) => {
        const userId = ref.userId || ref.telegramId;
        if (!referralCountMap[userId]) referralCountMap[userId] = 0;
        referralCountMap[userId] += 1;
      });
      // Build leaderboard array
      const leaderboard = users.map((u) => ({
        telegramId: u.telegramId,
        firstName: u.firstName || "",
        totalReferrals: referralCountMap[u.telegramId] || 0,
      }));
      leaderboard.sort((a, b) => b.totalReferrals - a.totalReferrals);
      return leaderboard.slice(0, limit);
    } catch (error) {
      logger.error("Error getting top referrers (Firestore):", error);
      throw error;
    }
  }

  // Validate a referral code for a purchase (single-use, deactivate after use)
  async validateReferralCode({ code, companyId, buyerTelegramId, amount }) {
    try {
      // Find code in referralCodes collection
      const snap = await databaseService
        .referralCodes()
        .where("code", "==", code)
        .where("companyId", "==", companyId)
        .where("active", "==", true)
        .get();
      if (snap.empty)
        return {
          valid: false,
          message: "Referral code not found or already used.",
        };
      const refCode = snap.docs[0].data();
      // Prevent self-referral
      if (refCode.userId === buyerTelegramId)
        return { valid: false, message: "You cannot refer yourself." };
      // Deactivate code after use
      await databaseService
        .referralCodes()
        .doc(snap.docs[0].id)
        .update({ active: false, usedBy: buyerTelegramId, usedAt: new Date() });
      // Platform fee logic
      let platformFee = 0;
      let feePercent = 0;
      if (amount && typeof amount === "number") {
        // Fetch platform fee percent from settings
        const settings = await adminService.getPlatformSettings();
        feePercent = settings.platformFeePercent;
        platformFee = amount * (feePercent / 100);

        // Update platform balance instead of admin's coinBalance
        await adminService.updatePlatformBalance(platformFee);
        logger.info(
          `Platform fee added to platform balance: $${platformFee.toFixed(2)}`
        );
      }
      // Update referrer's coinBalance
      if (amount && typeof amount === "number") {
        // Fetch platform settings for all percentages
        const settings = await adminService.getPlatformSettings();
        const refPercent = settings.referralCommissionPercent || 2;
        const buyerPercent = settings.referralDiscountPercent || 1;
        // Referrer reward
        const referrerRef = databaseService
          .users()
          .doc(refCode.userId.toString());
        const referrerDoc = await referrerRef.get();
        if (referrerDoc.exists) {
          const currentBalance = referrerDoc.data().coinBalance || 0;
          const reward = amount * (refPercent / 100);
          await referrerRef.update({ coinBalance: currentBalance + reward });
        }
        // Buyer discount (optional: store as a field or notify buyer)
        const buyerRef = databaseService
          .users()
          .doc(buyerTelegramId.toString());
        const buyerDoc = await buyerRef.get();
        if (buyerDoc.exists) {
          const buyerDiscount = amount * (buyerPercent / 100);
          const buyerBalance = buyerDoc.data().coinBalance || 0;
          await buyerRef.update({ coinBalance: buyerBalance + buyerDiscount });
        }
      }
      // Send notifications with better error handling
      const notificationService = require("./notificationService");
      const { getNotificationServiceInstance } = notificationService;

      try {
        logger.info(`Starting notifications for referral code ${code}`);

        // Get company info for notifications
        const companyService = require("./companyService");
        const company = await companyService.getCompanyById(companyId);
        logger.info(`Company found: ${company?.name || "Unknown"}`);

        // Get notification service instance
        const notificationInstance = getNotificationServiceInstance();
        if (!notificationInstance) {
          logger.error("Notification service instance is null!");
          return {
            valid: true,
            referrerId: refCode.userId,
            code: refCode.code,
          };
        }

        // Get platform settings
        const adminService = require("./adminService");
        const settings = await adminService.getPlatformSettings();

        // Get buyer's username for better notification
        const buyerUserDoc = await databaseService
          .users()
          .doc(buyerTelegramId.toString())
          .get();
        const buyerUsername = buyerUserDoc.exists
          ? buyerUserDoc.data().username ||
            buyerUserDoc.data().first_name ||
            `User ${buyerTelegramId}`
          : `User ${buyerTelegramId}`;
        const buyerDisplayName = buyerUsername.startsWith("@")
          ? buyerUsername
          : `@${buyerUsername}`;

        // Referrer notification is handled in userHandlers.js processSale function
        // to avoid duplicate notifications and ensure correct commission calculation

        // Seller notification is also handled in userHandlers.js processSale function
        // to avoid duplicate notifications and ensure correct buyer username display

        // Note: Admin notifications are handled in userHandlers.js processSale function
        // to avoid double notifications and ensure all sale details are included

        logger.info(
          `All notifications sent successfully for referral code ${code}`
        );
      } catch (notificationError) {
        logger.error("Error sending notifications:", notificationError);
        // Don't fail the referral validation if notifications fail
      }
      logger.info(
        `Referral code ${code} used by ${buyerTelegramId} for company ${companyId}`
      );
      return { valid: true, referrerId: refCode.userId, code: refCode.code };
    } catch (error) {
      logger.error("Error validating referral code:", error);
      throw error;
    }
  }

  async deleteReferralCode(codeId, userId) {
    try {
      const result = await databaseService.query(
        "DELETE FROM referral_codes WHERE id = $1 AND user_id = $2 RETURNING *",
        [codeId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error("Referral code not found or unauthorized");
      }

      await getNotificationServiceInstance().sendNotification(
        userId,
        `❌ Referral code deleted.`,
        { type: "referral", action: "delete", codeId }
      );
      logger.info(`Referral code deleted: ${codeId} by user ${userId}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error deleting referral code:", error);
      throw error;
    }
  }

  async getReferralCodeStats(codeId) {
    try {
      const [clicks, orders, earnings] = await Promise.all([
        databaseService.query(
          "SELECT COUNT(*) FROM referrals WHERE referral_code_id = $1",
          [codeId]
        ),
        databaseService.query(
          `SELECT COUNT(*) FROM referrals r
           JOIN orders o ON r.order_id = o.id
           WHERE r.referral_code_id = $1 AND o.status = 'approved'`,
          [codeId]
        ),
        databaseService.query(
          `SELECT COALESCE(SUM(o.amount * (c.commission_rate / 100)), 0) as total
           FROM referrals r
           JOIN orders o ON r.order_id = o.id
           JOIN referral_codes rc ON r.referral_code_id = rc.id
           JOIN products p ON rc.product_id = p.id
           JOIN companies c ON p.company_id = c.id
           WHERE r.referral_code_id = $1 AND o.status = 'approved'`,
          [codeId]
        ),
      ]);

      return {
        totalClicks: parseInt(clicks.rows[0].count),
        totalOrders: parseInt(orders.rows[0].count),
        totalEarnings: parseFloat(earnings.rows[0].total),
        conversionRate:
          clicks.rows[0].count > 0
            ? (
                (parseInt(orders.rows[0].count) /
                  parseInt(clicks.rows[0].count)) *
                100
              ).toFixed(2)
            : 0,
      };
    } catch (error) {
      logger.error("Error getting referral code stats:", error);
      throw error;
    }
  }

  async getUserReferralStats(userId) {
    try {
      // Get user's referral stats
      const stats = await this.getReferralStats(userId);
      // Get user's referral codes
      const userDoc = await databaseService
        .users()
        .doc(userId.toString())
        .get();
      if (!userDoc.exists) throw new Error("User not found");
      const userData = userDoc.data();
      // Get companies the user has joined
      const joinedCompanies = userData.joinedCompanies || [];
      const referralCodes = userData.referralCodes || {};
      const companyStats = {};
      for (const companyId of joinedCompanies) {
        const companyDoc = await databaseService
          .companies()
          .doc(companyId)
          .get();
        if (companyDoc.exists) {
          const company = companyDoc.data();
          const code = referralCodes[company.codePrefix];
          // Get referrals for this company
          const referralsSnap = await databaseService
            .referrals()
            .where("referrerTelegramId", "==", userId)
            .where("companyId", "==", companyId)
            .get();
          const referrals = referralsSnap.docs.map((doc) => doc.data());
          let earnings = 0;
          const detailedReferrals = [];
          for (const ref of referrals) {
            // Use dynamic commission rate
            const settings = await adminService.getPlatformSettings();
            const commissionRate = settings.referralCommissionPercent / 100;
            earnings += (ref.amount || 0) * commissionRate;
            detailedReferrals.push({
              amount: ref.amount || 0,
              product_title: ref.product_title || ref.productId || "",
              createdAt: ref.createdAt,
              status: ref.status || "",
            });
          }
          // Subtract approved withdrawals for this user and company
          const withdrawalsSnap = await databaseService
            .withdrawals()
            .where("userId", "==", userId)
            .where("companyId", "==", companyId)
            .where("status", "==", "approved")
            .get();
          let withdrawn = 0;
          withdrawalsSnap.forEach((doc) => {
            const w = doc.data();
            withdrawn += w.amount || 0;
          });

          // Also subtract earnings deductions
          const deductionsSnap = await databaseService
            .getDb()
            .collection("earnings_deductions")
            .where("userId", "==", userId)
            .where("companyId", "==", companyId)
            .get();
          let deducted = 0;
          deductionsSnap.forEach((doc) => {
            const d = doc.data();
            deducted += d.amount || 0;
          });

          const withdrawable = Math.max(0, earnings - withdrawn - deducted);
          companyStats[companyId] = {
            count: referrals.length,
            earnings: withdrawable,
            code: code,
            referrals: detailedReferrals,
            companyName: company.name,
          };
        }
      }
      return {
        ...stats,
        companyStats,
      };
    } catch (error) {
      logger.error("Error getting user referral stats:", error);
      throw error;
    }
  }

  // Add referral earnings to a user's coinBalance and return new balance
  async addReferralEarnings(userId, amount) {
    const userRef = databaseService.users().doc(userId.toString());
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const currentBalance = userDoc.data().coinBalance || 0;
      const newBalance = currentBalance + amount;
      await userRef.update({ coinBalance: newBalance });
      return newBalance;
    }
    return null;
  }
}

module.exports = new ReferralService();
