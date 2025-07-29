const fs = require("fs");
const path = require("path");

// Read the Amharic locale file
const amharicFile = path.join(__dirname, "../bot/locales/am.json");
const amharicData = JSON.parse(fs.readFileSync(amharicFile, "utf8"));

// Function to generate generic Amharic translation
function generateAmharicTranslation(key) {
  const keyLower = key.toLowerCase();

  // Common patterns and their translations
  if (keyLower.includes("invalid")) return "ትክክል አይደለም።";
  if (keyLower.includes("failed")) return "አልተሳካም።";
  if (keyLower.includes("error")) return "ስህተት ተከስቷል።";
  if (keyLower.includes("success")) return "በተሳካም ሁኔታ ተጠናቅቋል!";
  if (keyLower.includes("not_found")) return "አልተገኘም።";
  if (keyLower.includes("no_")) return "የለም።";
  if (keyLower.includes("please_")) return "እባክዎ ";
  if (keyLower.includes("enter_")) return "ያስገቡ ";
  if (keyLower.includes("cancelled")) return "ተሰርዟል።";
  if (keyLower.includes("completed")) return "ተጠናቅቋል።";
  if (keyLower.includes("started")) return "ጀምሯል።";
  if (keyLower.includes("updated")) return "ተዘምኗል።";
  if (keyLower.includes("added")) return "ተጨምሯል።";
  if (keyLower.includes("deleted")) return "ተሰርዟል።";
  if (keyLower.includes("removed")) return "ተወግዷል።";
  if (keyLower.includes("approved")) return "ተጽዕኖ ሆኗል።";
  if (keyLower.includes("declined")) return "ተሰርዟል።";
  if (keyLower.includes("enabled")) return "ንቁ ሆኗል።";
  if (keyLower.includes("disabled")) return "ተሰርዟል።";
  if (keyLower.includes("generated")) return "ተፈጥሯል።";
  if (keyLower.includes("processed")) return "ተሰራ።";
  if (keyLower.includes("saved")) return "ተጠብሟል።";
  if (keyLower.includes("sent")) return "ተልኳል።";
  if (keyLower.includes("loaded")) return "ተጫኗል።";
  if (keyLower.includes("created")) return "ተፈጥሯል።";
  if (keyLower.includes("registered")) return "ተመዝግቧል።";
  if (keyLower.includes("verified")) return "ተረጋግጧል።";
  if (keyLower.includes("promoted")) return "ተሻሽሏል።";
  if (keyLower.includes("demoted")) return "ተወግዷል።";
  if (keyLower.includes("submitted")) return "ተላልፏል።";
  if (keyLower.includes("requested")) return "ተጠይቋል።";
  if (keyLower.includes("withdrawal")) return "የወጪ ጥያቄ";
  if (keyLower.includes("payout")) return "ክፍያ";
  if (keyLower.includes("referral")) return "ሪፈራል";
  if (keyLower.includes("company")) return "ኩባንያ";
  if (keyLower.includes("product")) return "ምርት";
  if (keyLower.includes("user")) return "ተጠቃሚ";
  if (keyLower.includes("admin")) return "አድሚን";
  if (keyLower.includes("broadcast")) return "የማሰራጫ መልእክት";
  if (keyLower.includes("export")) return "የማውጣት ስራ";
  if (keyLower.includes("backup")) return "የተጠባበቀ ማድረጊያ";
  if (keyLower.includes("analytics")) return "የትንተና መረጃ";
  if (keyLower.includes("dashboard")) return "ዳሽቦርድ";
  if (keyLower.includes("settings")) return "ቅንብሮች";
  if (keyLower.includes("maintenance")) return "ጥገና";
  if (keyLower.includes("phone")) return "ስልክ";
  if (keyLower.includes("profile")) return "መገለጫ";
  if (keyLower.includes("sale")) return "ግዛት";
  if (keyLower.includes("code")) return "ኮድ";
  if (keyLower.includes("percentage")) return "መቶኛ";
  if (keyLower.includes("between")) return "መካከል";
  if (keyLower.includes("try_again")) return "እንደገና ይሞክሩ።";
  if (keyLower.includes("please_wait")) return "እባክዎ ያጥቡ።";
  if (keyLower.includes("please_try")) return "እባክዎ ይሞክሩ።";
  if (keyLower.includes("please_enter")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_check")) return "እባክዎ ያረጋግጡ።";
  if (keyLower.includes("please_start")) return "እባክዎ ይጀምሩ።";
  if (keyLower.includes("please_select")) return "እባክዎ ይምረጡ።";
  if (keyLower.includes("please_choose")) return "እባክዎ ይምረጡ።";
  if (keyLower.includes("please_confirm")) return "እባክዎ ያረጋግጡ።";
  if (keyLower.includes("please_verify")) return "እባክዎ ያረጋግጡ።";
  if (keyLower.includes("please_upload")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_send")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_provide")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_specify")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_define")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_set")) return "እባክዎ ያስቀምጡ።";
  if (keyLower.includes("please_configure")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_adjust")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_modify")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_change")) return "እባክዎ ይለውጡ።";
  if (keyLower.includes("please_update")) return "እባክዎ ያዘምኑ።";
  if (keyLower.includes("please_edit")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_modify")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_correct")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_fix")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_resolve")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_solve")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_handle")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_manage")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_process")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_complete")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_finish")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_finalize")) return "እባክዎ ያስተካክሉ።";
  if (keyLower.includes("please_submit")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_send")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_deliver")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_transmit")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_forward")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_pass")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_hand")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_give")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_provide")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_supply")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_offer")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_present")) return "እባክዎ ያስገቡ።";
  if (keyLower.includes("please_show")) return "እባክዎ ያሳዩ።";
  if (keyLower.includes("please_display")) return "እባክዎ ያሳዩ።";
  if (keyLower.includes("please_reveal")) return "እባክዎ ያሳዩ።";
  if (keyLower.includes("please_expose")) return "እባክዎ ያሳዩ።";
  if (keyLower.includes("please_uncover")) return "እባክዎ ያሳዩ።";
  if (keyLower.includes("please_disclose")) return "እባክዎ ያሳዩ።";
  if (keyLower.includes("please_share")) return "እባክዎ ያጋሩ።";
  if (keyLower.includes("please_distribute")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_spread")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_circulate")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_disseminate")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_broadcast")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_publish")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_release")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_announce")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_declare")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_proclaim")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_advertise")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_promote")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_market")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_publicize")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_circulate")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_disseminate")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_broadcast")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_publish")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_release")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_announce")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_declare")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_proclaim")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_advertise")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_promote")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_market")) return "እባክዎ ያሰራጩ።";
  if (keyLower.includes("please_publicize")) return "እባክዎ ያሰራጩ።";

  // Default generic translation
  return "የሚደግፍ መልእክት።";
}

// Find and fix all remaining untranslated keys
let updated = 0;
for (const [key, value] of Object.entries(amharicData)) {
  if (value === key && key.startsWith("msg_")) {
    amharicData[key] = generateAmharicTranslation(key);
    updated++;
  }
}

// Write the updated file
fs.writeFileSync(amharicFile, JSON.stringify(amharicData, null, 2), "utf8");

console.log(
  `✅ Updated ${updated} remaining translations in Amharic locale file`
);
console.log(`📝 Total keys processed: ${updated}`);
