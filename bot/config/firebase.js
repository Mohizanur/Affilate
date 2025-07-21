const admin = require("firebase-admin");
const logger = require("../../utils/logger");

let db = null;

const initializeFirebase = async () => {
  try {
    if (db) return db;

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
        process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
    };

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }

    db = admin.firestore();
    logger.info("Firebase initialized successfully");
    return db;
  } catch (error) {
    logger.error("Firebase initialization failed:", error);
    throw error;
  }
};

// Initialize immediately
// initializeFirebase();

module.exports = { db, initializeFirebase };
