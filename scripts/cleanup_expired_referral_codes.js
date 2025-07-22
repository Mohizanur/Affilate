const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

async function cleanupExpiredReferralCodes() {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const expiredCodesSnap = await db
    .collection("referralCodes")
    .where("active", "==", false)
    .get();
  const expired = expiredCodesSnap.docs.filter((doc) => {
    const data = doc.data();
    return data.usedAt && now - data.usedAt.toDate().getTime() > THIRTY_DAYS_MS;
  });
  if (!expired.length) {
    console.log("No expired referral codes to clean up.");
    return;
  }
  // Export to CSV
  const csvPath = path.join(__dirname, "expired_referral_codes.csv");
  const csvHeader = "code,usedBy,usedAt\n";
  const csvRows = expired.map((doc) => {
    const d = doc.data();
    return `${d.code},${d.usedBy || ""},${
      d.usedAt ? d.usedAt.toDate().toISOString() : ""
    }`;
  });
  fs.writeFileSync(csvPath, csvHeader + csvRows.join("\n"));
  // Optionally delete or move to archive
  for (const doc of expired) {
    await db.collection("referralCodes").doc(doc.id).delete();
  }
  console.log(
    `Archived and deleted ${expired.length} expired referral codes. CSV saved to ${csvPath}`
  );
}

cleanupExpiredReferralCodes().catch(console.error);
