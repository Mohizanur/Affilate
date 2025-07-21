require('dotenv').config();
const databaseService = require('../bot/config/database');

function generateCodePrefix(name) {
  let prefix = (name || '').replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase();
  if (prefix.length < 2) {
    prefix = 'XX';
  }
  return prefix;
}

(async () => {
  await databaseService.initialize();
  const companiesSnap = await databaseService.companies().get();
  let updated = 0;
  for (const doc of companiesSnap.docs) {
    const data = doc.data();
    if (!data.codePrefix || typeof data.codePrefix !== 'string' || !data.codePrefix.trim()) {
      const newPrefix = generateCodePrefix(data.name);
      await doc.ref.update({ codePrefix: newPrefix });
      console.log(`Updated company ${doc.id} (${data.name}) with codePrefix: ${newPrefix}`);
      updated++;
    }
  }
  console.log(`Done. Updated ${updated} companies.`);
  process.exit(0);
})(); 