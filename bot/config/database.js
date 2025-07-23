const admin = require("firebase-admin");
const logger = require("../../utils/logger");

class DatabaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (this.initialized) {
        return this.db;
      }

      // Initialize Firebase Admin
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri:
          process.env.FIREBASE_AUTH_URI ||
          "https://accounts.google.com/o/oauth2/auth",
        token_uri:
          process.env.FIREBASE_TOKEN_URI ||
          "https://oauth2.googleapis.com/token",
      };

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      }

      this.db = admin.firestore();
      this.initialized = true;

      logger.info("Firebase initialized successfully");
      return this.db;
    } catch (error) {
      logger.error("Firebase initialization failed:", error);
      throw error;
    }
  }

  getDb() {
    if (!this.initialized) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  // Collection references
  users() {
    return this.getDb().collection("users");
  }

  companies() {
    return this.getDb().collection("companies");
  }

  referrals() {
    return this.getDb().collection("referrals");
  }

  withdrawals() {
    return this.getDb().collection("withdrawals");
  }

  analytics() {
    return this.getDb().collection("analytics");
  }

  referralCodes() {
    return this.getDb().collection("referralCodes");
  }

  // Utility methods
  async createUser(userData) {
    try {
      const userRef = this.users().doc(userData.telegramId.toString());
      await userRef.set({
        ...userData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return userRef;
    } catch (error) {
      logger.error("Error creating user:", error);
      throw error;
    }
  }

  async getUser(telegramId) {
    try {
      const userDoc = await this.users().doc(telegramId.toString()).get();
      if (userDoc.exists) {
        return { id: userDoc.id, ...userDoc.data() };
      }
      return null;
    } catch (error) {
      logger.error("Error getting user:", error);
      throw error;
    }
  }

  async updateUser(telegramId, updateData) {
    try {
      const userRef = this.users().doc(telegramId.toString());
      await userRef.update({
        ...updateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return userRef;
    } catch (error) {
      logger.error("Error updating user:", error);
      throw error;
    }
  }

  async createCompany(companyData) {
    try {
      const companyRef = this.companies().doc();
      await companyRef.set({
        ...companyData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return companyRef;
    } catch (error) {
      logger.error("Error creating company:", error);
      throw error;
    }
  }

  async getCompany(companyId) {
    try {
      const companyDoc = await this.companies().doc(companyId).get();
      if (companyDoc.exists) {
        return { id: companyDoc.id, ...companyDoc.data() };
      }
      return null;
    } catch (error) {
      logger.error("Error getting company:", error);
      throw error;
    }
  }

  // Batch operations
  batch() {
    return this.getDb().batch();
  }

  // Transactions
  async runTransaction(callback) {
    return this.getDb().runTransaction(callback);
  }

  // Server timestamp
  serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
  }

  // Array operations
  arrayUnion(...elements) {
    return admin.firestore.FieldValue.arrayUnion(...elements);
  }

  arrayRemove(...elements) {
    return admin.firestore.FieldValue.arrayRemove(...elements);
  }

  // Increment
  increment(value = 1) {
    return admin.firestore.FieldValue.increment(value);
  }
  async getAllUserTelegramIds() {
    try {
      const snapshot = await this.users().get();
      const users = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.telegramId) {
          users.push({ telegramId: data.telegramId });
        }
      });
      return users;
    } catch (error) {
      logger.error("Error fetching all user telegram IDs:", error);
      throw error;
    }
  }
}

// Export singleton instance
const databaseService = new DatabaseService();
module.exports = databaseService;
