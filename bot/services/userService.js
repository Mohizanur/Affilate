console.log("Top of userService.js (from companyHandlers)");
const databaseService = require("../config/database");
console.log(
  "After require databaseService in userService.js (from companyHandlers)"
);
const { v4: uuidv4 } = require("uuid");
console.log("After require uuid in userService.js (from companyHandlers)");
const logger = require("../../utils/logger");
console.log("After require logger in userService.js (from companyHandlers)");
const notificationService = require("./notificationService");
const validator = require("validator"); // For email/phone validation

class UserService {
  // Helper: Get user doc and data, throw if not found
  async _getUserOrThrow(telegramId) {
    const userDoc = await databaseService
      .users()
      .doc(telegramId.toString())
      .get();
    if (!userDoc.exists) throw new Error("User not found");
    return { userDoc, userData: userDoc.data() };
  }

  async createOrUpdateUser(userData) {
    try {
      const { telegramId, firstName, lastName, username } = userData;

      // Use _getUserOrThrow for existence check
      const { userDoc, userData: existingUserData } =
        await this._getUserOrThrow(telegramId);

      if (userDoc.exists) {
        // Always preserve canRegisterCompany if it exists
        const preserve = {};
        if (typeof existingUserData.canRegisterCompany !== "undefined") {
          preserve.canRegisterCompany = existingUserData.canRegisterCompany;
        }
        const updateData = {
          last_active: new Date(),
          ...preserve,
        };
        if (typeof firstName !== "undefined") updateData.first_name = firstName;
        if (typeof lastName !== "undefined") updateData.last_name = lastName;
        if (typeof username !== "undefined")
          updateData.username = username.toLowerCase();
        await databaseService
          .users()
          .doc(telegramId.toString())
          .update(updateData);
        return { id: userDoc.id, ...existingUserData, ...preserve };
      } else {
        // Create new user
        const userId = uuidv4();
        const result = await databaseService
          .users()
          .doc(telegramId.toString())
          .set({
            id: userId,
            telegram_id: telegramId,
            first_name: firstName,
            last_name: lastName,
            username: username ? username.toLowerCase() : undefined,
            created_at: new Date(),
            last_active: new Date(),
          });
        return {
          id: userId,
          telegram_id: telegramId,
          first_name: firstName,
          last_name: lastName,
          username: username,
          created_at: new Date(),
          last_active: new Date(),
        };
      }
    } catch (error) {
      logger.error("Error creating/updating user:", error);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      const { telegramId, firstName, lastName, username, phoneNumber, email } =
        userData;
      if (!telegramId || !firstName)
        throw new Error("Telegram ID and first name are required.");
      if (email && !validator.isEmail(email))
        throw new Error("Invalid email format.");
      if (phoneNumber && !validator.isMobilePhone(phoneNumber + "", "any"))
        throw new Error("Invalid phone number format.");
      const userRef = databaseService.users().doc(telegramId.toString());
      await userRef.set({
        ...userData,
        username: username ? username.toLowerCase() : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info(`User created: ${telegramId}`);
      return { id: userRef.id, ...userData };
    } catch (error) {
      logger.error("Error creating user:", error);
      throw error;
    }
  }

  async getUserByTelegramId(telegramId) {
    try {
      // Use _getUserOrThrow for existence check
      const { userDoc, userData } = await this._getUserOrThrow(telegramId);
      return {
        id: userDoc.id,
        ...userData,
        canRegisterCompany: userData.canRegisterCompany === true,
      };
    } catch (error) {
      logger.error("Error getting user by telegram ID:", error);
      throw error;
    }
  }

  async verifyPhone(telegramId, phoneNumber) {
    try {
      const validator = require("validator");
      // Accept if validator.isMobilePhone passes
      if (!validator.isMobilePhone(phoneNumber + "", "any")) {
        // Fallback: accept if matches E.164 format
        if (!/^\+[1-9]\d{9,14}$/.test(phoneNumber)) {
          throw new Error("Invalid phone number format.");
        } else {
          const logger = require("../../utils/logger");
          logger.warn(
            `verifyPhone: accepted fallback E.164 for ${phoneNumber}`
          );
        }
      }
      // Enforce phone uniqueness
      const existing = await databaseService
        .users()
        .where("phone_number", "==", phoneNumber)
        .get();
      if (!existing.empty) {
        // If the phone is already used by another user, block
        const alreadyUsed = existing.docs.some(
          (doc) => doc.id !== telegramId.toString()
        );
        if (alreadyUsed) {
          throw new Error(
            "This phone number is already registered with another account."
          );
        }
      }
      const userDoc = databaseService.users().doc(telegramId.toString());
      const userData = (await userDoc.get()).data();
      if (!userData) throw new Error("User not found");
      await userDoc.update({
        phone_number: phoneNumber,
        phone_verified: true,
        phone_verified_at: new Date(),
      });
      logger.info(`Phone verified for user: ${telegramId}`);
      return {
        id: userDoc.id,
        ...userData,
        phone_number: phoneNumber,
        phone_verified: true,
        phone_verified_at: new Date(),
      };
    } catch (error) {
      logger.error("Error verifying phone:", error);
      throw error;
    }
  }

  // Add a method to join a company and assign a referral code
  async joinCompany(telegramId, company) {
    try {
      const userRef = databaseService.users().doc(telegramId.toString());
      const userDoc = await userRef.get();
      if (!userDoc.exists) throw new Error("User not found");
      const userData = userDoc.data();
      // Generate unique referral code for this user and company
      const code = `${company.codePrefix}-${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`;
      // Update joinedCompanies and referralCodes
      const joinedCompanies = userData.joinedCompanies || [];
      const referralCodes = userData.referralCodes || {};
      if (!joinedCompanies.includes(company.id))
        joinedCompanies.push(company.id);
      referralCodes[company.codePrefix] = code;
      await userRef.update({
        joinedCompanies,
        referralCodes,
      });
      logger.info(`User ${telegramId} joined company ${company.id}`);
      return code;
    } catch (error) {
      logger.error("Error joining company:", error);
      throw error;
    }
  }

  async getReferralCodes(telegramId) {
    try {
      const userDoc = await this._getUserOrThrow(telegramId);
      return userDoc.userData.referralCodes || {};
    } catch (error) {
      logger.error("Error getting referral codes:", error);
      throw error;
    }
  }

  async getVerifiedReferralCount(telegramId) {
    try {
      const userDoc = await this._getUserOrThrow(telegramId);
      return userDoc.userData.verifiedReferralCount || 0;
    } catch (error) {
      logger.error("Error getting verified referral count:", error);
      throw error;
    }
  }

  async getActiveReferrers() {
    try {
      const users = await databaseService
        .users()
        .where("phone_verified", "==", true)
        .get();
      const usersWithReferralCodes = await databaseService
        .referralCodes()
        .get();

      const activeReferrers = users.docs.filter((userDoc) => {
        const userData = userDoc.data();
        return usersWithReferralCodes.docs.some(
          (rcDoc) => rcDoc.data().user_id === userData.telegram_id
        );
      });

      return activeReferrers.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error("Error getting active referrers:", error);
      throw error;
    }
  }

  async getRecentBuyers() {
    try {
      const users = await databaseService
        .users()
        .orderBy("last_active", "desc")
        .get();
      const recentBuyers = users.docs.filter((userDoc) => {
        const userData = userDoc.data();
        return (
          userData.last_active &&
          userData.last_active > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
      });
      return recentBuyers.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error("Error getting recent buyers:", error);
      throw error;
    }
  }

  // Firestore-based global leaderboard (top by verifiedReferralCount)
  async getGlobalLeaderboard(limit = 10) {
    try {
      const usersSnap = await databaseService
        .users()
        .orderBy("verifiedReferralCount", "desc")
        .limit(limit)
        .get();
      return usersSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          telegramId: d.telegramId,
          firstName: d.firstName,
          verifiedReferralCount: d.verifiedReferralCount || 0,
        };
      });
    } catch (error) {
      logger.error("Error getting global leaderboard:", error);
      throw error;
    }
  }

  // Firestore-based monthly leaderboard (top by referrals this month)
  async getMonthlyLeaderboard(limit = 10) {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const usersSnap = await databaseService
        .users()
        .where("last_active", ">=", startOfMonth)
        .orderBy("verifiedReferralCount", "desc")
        .limit(limit)
        .get();
      return usersSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          telegramId: d.telegramId,
          firstName: d.firstName,
          monthlyReferrals: d.verifiedReferralCount || 0,
        };
      });
    } catch (error) {
      logger.error("Error getting monthly leaderboard:", error);
      throw error;
    }
  }

  // Get user's leaderboard position
  async getUserLeaderboardPosition(telegramId) {
    try {
      const usersSnap = await databaseService
        .users()
        .orderBy("verifiedReferralCount", "desc")
        .get();
      let global = 0;
      let monthly = 0;
      let found = false;
      let foundMonthly = false;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      let i = 1;
      let j = 1;
      usersSnap.forEach((doc) => {
        const d = doc.data();
        if (!found && d.telegramId === telegramId) {
          global = i;
          found = true;
        }
        if (
          !foundMonthly &&
          d.telegramId === telegramId &&
          d.last_active &&
          d.last_active.toDate() >= startOfMonth
        ) {
          monthly = j;
          foundMonthly = true;
        }
        i++;
        if (d.last_active && d.last_active.toDate() >= startOfMonth) j++;
      });
      return { global, monthly };
    } catch (error) {
      logger.error("Error getting user leaderboard position:", error);
      throw error;
    }
  }

  async getUserByUsername(username, ctxFrom = null) {
    try {
      if (!username) return null;
      username = username.trim().replace(/^@/, "").toLowerCase();
      // Always search in lowercase
      let snap = await databaseService
        .users()
        .where("username", "==", username)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      // Do NOT update user info from ctxFrom (prevents accidental overwrites)
      return { telegramId: doc.id, ...doc.data() };
    } catch (error) {
      logger.error("Error in getUserByUsername:", error);
      return null;
    }
  }

  async getAdminTelegramIds() {
    const snap = await databaseService
      .users()
      .where("role", "==", "admin")
      .get();
    const isAdminSnap = await databaseService
      .users()
      .where("isAdmin", "==", true)
      .get();
    const ids = new Set();
    snap.docs.forEach((doc) => ids.add(doc.data().telegramId || doc.id));
    isAdminSnap.docs.forEach((doc) => ids.add(doc.data().telegramId || doc.id));
    return Array.from(ids);
  }

  async addFavorite(telegramId, productId) {
    const userRef = databaseService.users().doc(telegramId.toString());
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new Error("User not found");
    const favorites = userDoc.data().favorites || [];
    if (!favorites.includes(productId)) {
      favorites.push(productId);
      await userRef.update({ favorites });
    }
    return favorites;
  }

  async removeFavorite(telegramId, productId) {
    const userRef = databaseService.users().doc(telegramId.toString());
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new Error("User not found");
    let favorites = userDoc.data().favorites || [];
    favorites = favorites.filter((id) => id !== productId);
    await userRef.update({ favorites });
    return favorites;
  }

  async getFavorites(telegramId) {
    const userDoc = await databaseService
      .users()
      .doc(telegramId.toString())
      .get();
    if (!userDoc.exists) throw new Error("User not found");
    return userDoc.data().favorites || [];
  }

  async addToCart(telegramId, productId) {
    const userRef = databaseService.users().doc(telegramId.toString());
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new Error("User not found");
    const cart = userDoc.data().cart || [];
    if (!cart.includes(productId)) {
      cart.push(productId);
      await userRef.update({ cart });
    }
    return cart;
  }

  async removeFromCart(telegramId, productId) {
    const userRef = databaseService.users().doc(telegramId.toString());
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new Error("User not found");
    let cart = userDoc.data().cart || [];
    cart = cart.filter((id) => id !== productId);
    await userRef.update({ cart });
    return cart;
  }

  async getCart(telegramId) {
    const userDoc = await databaseService
      .users()
      .doc(telegramId.toString())
      .get();
    if (!userDoc.exists) throw new Error("User not found");
    return userDoc.data().cart || [];
  }

  async requestWithdrawal(telegramId, companyId) {
    const referralService = require("./referralService");
    const databaseService = require("../config/database");
    // Get total earned for this company
    const stats = await referralService.getReferralStats(telegramId);
    const companyEarnings =
      stats.companyEarnings && stats.companyEarnings[companyId]
        ? stats.companyEarnings[companyId]
        : 0;
    // Get company min withdrawal
    const companyDoc = await databaseService.companies().doc(companyId).get();
    if (!companyDoc.exists) throw new Error("Company not found");
    const minWithdrawal = companyDoc.data().minWithdrawal || 10;
    if (companyEarnings < minWithdrawal)
      throw new Error(
        `Minimum withdrawal for this company is $${minWithdrawal}. You have $${companyEarnings.toFixed(
          2
        )}.`
      );
    // Create withdrawal request
    const withdrawal = {
      userId: telegramId,
      companyId,
      amount: companyEarnings,
      status: "pending",
      createdAt: new Date(),
    };
    const ref = await databaseService.withdrawals().add(withdrawal);
    // Notify company and admins
    const notificationService = require("./notificationService");
    await notificationService.sendNotification(
      companyDoc.data().telegramId,
      `Withdrawal request from user ${telegramId} for $${companyEarnings.toFixed(
        2
      )}.`,
      { type: "withdrawal", action: "request", withdrawalId: ref.id }
    );
    await notificationService.sendAdminNotification(
      `Withdrawal request from user ${telegramId} for $${companyEarnings.toFixed(
        2
      )} (company: ${companyDoc.data().name}).`,
      { type: "withdrawal", action: "request", withdrawalId: ref.id }
    );
    return withdrawal;
  }

  async approveWithdrawal(withdrawalId, approverTelegramId) {
    const databaseService = require("../config/database");
    const withdrawalRef = databaseService.withdrawals().doc(withdrawalId);
    const withdrawalDoc = await withdrawalRef.get();
    if (!withdrawalDoc.exists) throw new Error("Withdrawal not found");
    await withdrawalRef.update({
      status: "approved",
      approvedBy: approverTelegramId,
      approvedAt: new Date(),
    });
    const withdrawal = withdrawalDoc.data();
    const notificationService = require("./notificationService");
    const getNotificationServiceInstance =
      notificationService.getNotificationServiceInstance || notificationService;
    // Get user and company info for admin message
    const user = await module.exports.userService.getUserByTelegramId(
      withdrawal.userId
    );
    const company = await require("./companyService").getCompanyById(
      withdrawal.companyId
    );
    const userDisplay = user.username
      ? `@${user.username}`
      : `${user.first_name || user.firstName || "User"} ${
          user.last_name || user.lastName || ""
        }`;
    const companyDisplay = company?.name || withdrawal.companyId;
    await getNotificationServiceInstance().sendNotification(
      withdrawal.userId,
      `Your withdrawal request for $${withdrawal.amount.toFixed(
        2
      )} was approved.`,
      { type: "withdrawal", action: "approved", withdrawalId }
    );
    await getNotificationServiceInstance().sendAdminNotification(
      `✅ Withdrawal approved for ${userDisplay} from ${companyDisplay} ($${withdrawal.amount.toFixed(
        2
      )}).`,
      { type: "withdrawal", action: "approved", withdrawalId }
    );
  }

  async declineWithdrawal(withdrawalId, approverTelegramId) {
    const databaseService = require("../config/database");
    const withdrawalRef = databaseService.withdrawals().doc(withdrawalId);
    const withdrawalDoc = await withdrawalRef.get();
    if (!withdrawalDoc.exists) throw new Error("Withdrawal not found");
    await withdrawalRef.update({
      status: "declined",
      declinedBy: approverTelegramId,
      declinedAt: new Date(),
    });
    const withdrawal = withdrawalDoc.data();
    const notificationService = require("./notificationService");
    const getNotificationServiceInstance =
      notificationService.getNotificationServiceInstance || notificationService;
    // Get user and company info for admin message
    const user = await module.exports.userService.getUserByTelegramId(
      withdrawal.userId
    );
    const company = await require("./companyService").getCompanyById(
      withdrawal.companyId
    );
    const userDisplay = user.username
      ? `@${user.username}`
      : `${user.first_name || user.firstName || "User"} ${
          user.last_name || user.lastName || ""
        }`;
    const companyDisplay = company?.name || withdrawal.companyId;
    await getNotificationServiceInstance().sendNotification(
      withdrawal.userId,
      `Your withdrawal request for $${withdrawal.amount.toFixed(
        2
      )} was declined.`,
      { type: "withdrawal", action: "declined", withdrawalId }
    );
    await getNotificationServiceInstance().sendAdminNotification(
      `❌ Withdrawal declined for ${userDisplay} from ${companyDisplay} ($${withdrawal.amount.toFixed(
        2
      )}).`,
      { type: "withdrawal", action: "declined", withdrawalId }
    );
  }

  async updateUser(telegramId, updateData) {
    try {
      const userRef = databaseService.users().doc(telegramId.toString());
      await userRef.update({ ...updateData, updatedAt: new Date() });
      const userDoc = await userRef.get();
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      logger.error("Error updating user:", error);
      throw error;
    }
  }

  async searchUsers(query) {
    try {
      const usersSnap = await databaseService.users().get();
      const q = query.toLowerCase();
      return usersSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (u) =>
            (u.username && u.username.toLowerCase().includes(q)) ||
            (u.phone_number && u.phone_number.toLowerCase().includes(q)) ||
            (u.id && u.id.toLowerCase().includes(q))
        );
    } catch (error) {
      logger.error("Error searching users:", error);
      throw error;
    }
  }
}

async function getAllUsers() {
  const usersSnap = await databaseService.users().get();
  return usersSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      ...d,
      canRegisterCompany: d.canRegisterCompany === true,
    };
  });
}

const userService = new UserService();

UserService.prototype.getAdminTelegramIds =
  UserService.prototype.getAdminTelegramIds;

module.exports = {
  userService,
  getAllUsers,
};
console.log("End of userService.js (from companyHandlers)");
