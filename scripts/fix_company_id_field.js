// scripts/fix_company_id_field.js
const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.resolve(
  __dirname,
  "../serviceAccountKey.json"
));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixCompanyIds() {
  const companiesRef = db.collection("companies");
  const snapshot = await companiesRef.get();
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.id !== doc.id) {
      await doc.ref.update({ id: doc.id });
      console.log(`Updated company ${doc.id}: set id field to '${doc.id}'`);
      updated++;
    }
  }
  console.log(`\nDone. Updated ${updated} companies.`);
  process.exit(0);
}

fixCompanyIds().catch((err) => {
  console.error("Error fixing company IDs:", err);
  process.exit(1);
});
