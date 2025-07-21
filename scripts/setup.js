const admin = require("firebase-admin");
const logger = require("../utils/logger");

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

async function setupDatabase() {
  try {
    logger.info("🔧 Setting up database...");

    // Create indexes
    logger.info("📊 Creating database indexes...");

    // Create collections with initial documents
    const collections = [
      "users",
      "companies",
      "referralCodes",
      "orders",
      "withdrawals",
      "analytics",
    ];

    for (const collection of collections) {
      const ref = db.collection(collection);
      const snapshot = await ref.limit(1).get();

      if (snapshot.empty) {
        // Create initial document to establish collection
        await ref.doc("_init").set({
          created: admin.firestore.FieldValue.serverTimestamp(),
          purpose: "Collection initialization",
        });
        logger.info(`✅ Created collection: ${collection}`);
      } else {
        logger.info(`📁 Collection already exists: ${collection}`);
      }
    }

    // Create admin users from environment variable
    if (process.env.ADMIN_TELEGRAM_IDS) {
      const adminIds = process.env.ADMIN_TELEGRAM_IDS.split(",").map((id) =>
        parseInt(id.trim())
      );

      for (const adminId of adminIds) {
        const userRef = db.collection("users").doc(adminId.toString());
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          await userRef.set({
            telegramId: adminId,
            role: "admin",
            firstName: "Admin",
            lastName: "User",
            coinBalance: 0,
            referralCount: 0,
            phoneVerified: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActive: admin.firestore.FieldValue.serverTimestamp(),
          });
          logger.info(`✅ Created admin user: ${adminId}`);
        } else {
          // Update existing user to admin
          await userRef.update({
            role: "admin",
            lastActive: admin.firestore.FieldValue.serverTimestamp(),
          });
          logger.info(`🔄 Updated user to admin: ${adminId}`);
        }
      }
    }

    // Create system settings document
    const settingsRef = db.collection("settings").doc("system");
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists) {
      await settingsRef.set({
        referrerCommissionPercentage:
          parseFloat(process.env.REFERRER_COMMISSION_PERCENTAGE) || 10,
        buyerDiscountPercentage:
          parseFloat(process.env.BUYER_DISCOUNT_PERCENTAGE) || 5,
        platformFeePercentage:
          parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 2,
        minWithdrawalAmount:
          parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT) || 10,
        systemActive: true,
        maintenanceMode: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info("✅ Created system settings");
    }

    logger.info("🎉 Database setup completed successfully!");
  } catch (error) {
    logger.error("❌ Database setup failed:", error);
    throw error;
  }
}

async function setupBot() {
  try {
    logger.info("🤖 Setting up bot configuration...");

    // Validate bot token
    if (!process.env.BOT_TOKEN) {
      throw new Error("BOT_TOKEN is required");
    }

    // Test bot token by making a simple API call
    const axios = require("axios");
    const response = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getMe`
    );

    if (response.data.ok) {
      logger.info(`✅ Bot token valid: @${response.data.result.username}`);
    } else {
      throw new Error("Invalid bot token");
    }

    logger.info("🎉 Bot setup completed successfully!");
  } catch (error) {
    logger.error("❌ Bot setup failed:", error);
    throw error;
  }
}

async function validateEnvironment() {
  logger.info("🔍 Validating environment variables...");

  const required = [
    "BOT_TOKEN",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_CLIENT_EMAIL",
    "REFERRER_COMMISSION_PERCENTAGE",
    "BUYER_DISCOUNT_PERCENTAGE",
    "MIN_WITHDRAWAL_AMOUNT",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(
      `❌ Missing required environment variables: ${missing.join(", ")}`
    );
    throw new Error("Missing required environment variables");
  }

  logger.info("✅ All required environment variables are set");
}

async function main() {
  try {
    logger.info("🚀 Starting setup process...");

    await validateEnvironment();
    await setupDatabase();
    await setupBot();

    logger.info("🎉 Setup completed successfully!");
    logger.info("🚀 You can now start the bot with: npm start");

    process.exit(0);
  } catch (error) {
    logger.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}

module.exports = { setupDatabase, setupBot, validateEnvironment };
