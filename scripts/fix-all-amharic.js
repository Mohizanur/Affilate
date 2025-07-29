const fs = require("fs");
const path = require("path");

// Read the Amharic locale file
const amharicFile = path.join(__dirname, "../bot/locales/am.json");
const amharicData = JSON.parse(fs.readFileSync(amharicFile, "utf8"));

// Comprehensive translations for all remaining keys
const translations = {
  // Admin messages
  msg__access_denied: "ፈቃድ የለዎትም።",
  msg__add_cancelled: "መጨመር ተሰርዟል።",
  msg__add_new_companynnenter_company_name: "አዲስ ኩባንያ ያክሉ\n\nየኩባንያ ስም ያስገቡ:",
  msg__are_you_sure_you_want_to_delete_companiesidxn:
    "ኩባንያውን መሰረዝ እርስዎ እርግጠኛ ናቸው?",
  msg__backup_failed_please_try_again: "የተጠባበቀ ማድረጊያ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__broadcast_failed_validationerrormessage:
    "የማሰራጫ መልእክት አልተሳካም። ስህተት: {{error}}",
  msg__buyer_not_found_please_check_the_username_and:
    "ገዛተኛ አልተገኘም። የተጠቃሚ ስም እና መረጃውን ያረጋግጡ።",
  msg__company_added_successfully: "ኩባንያው በተሳካም ሁኔታ ተጨምሯል!",
  msg__company_approval_recorded_admins_have_been_no:
    "የኩባንያ ማጽደቂያ ተመዝግቧል። አድሚኖች ተልኳል።",
  msg__company_deleted_successfully: "ኩባንያው በተሳካም ሁኔታ ተሰርዟል!",
  msg__company_name_must_be_between_:
    "የኩባንያ ስም በ {{min}} እና {{max}} ቁጥሮች መካከል መሆን አለበት።",
  msg__company_name_savednnnow_please_provide_a_brie:
    "የኩባንያ ስም ተጠብሟል\n\nአሁን አጭር መግለጫ ያስገቡ:",
  msg__company_owner_not_found_cannot_send_approval_:
    "የኩባንያ ባለቤት አልተገኘም። ማጽደቂያ መላክ አይቻልም።",
  msg__company_profile_updated_successfully: "የኩባንያ መገለጫ በተሳካም ሁኔታ ተዘምኗል!",
  msg__company_registered_and_active_you_can_now_add:
    "ኩባንያው ተመዝግቧል እና ንቁ ነው። አሁን ምርቶች ማክል ይችላሉ!",
  msg__company_registration_cancelled: "የኩባንያ መመዝገብ ተሰርዟል።",
  msg__company_registrationnnplease_enter_your_compa:
    "የኩባንያ መመዝገብ\n\nእባክዎ የኩባንያዎን ስም ያስገቡ:",
  msg__creating_system_backup_please_wait:
    "የስርዓት የተጠባበቀ ማድረጊያ ይፈጥራል። እባክዎ ያጥቡ።",
  msg__delete_cancelled: "መሰረዝ ተሰርዟል።",
  msg__description_must_be_between_:
    "መግለጫው በ {{min}} እና {{max}} ቁጥሮች መካከል መሆን አለበት።",
  msg__description_savednnplease_provide_your_compan:
    "መግለጫው ተጠብሟል\n\nእባክዎ የኩባንያዎን ድህረ ገጽ ያስገቡ:",
  msg__edit_cancelled: "ማስተካከያ ተሰርዟል።",
  msg__edit_company_profilenncurrent_name_companynam:
    "የኩባንያ መገለጫ ማስተካከያ\n\nአሁን ያለው ስም: {{companyName}}\n\nአዲሱን ስም ያስገቡ:",
  msg__edit_companynncurrent_name_companynamennenter:
    "የኩባንያ ማስተካከያ\n\nአሁን ያለው ስም: {{companyName}}\n\nአዲሱን ስም ያስገቡ:",
  msg__edit_productnncurrent_title_producttitlennent:
    "የምርት ማስተካከያ\n\nአሁን ያለው ስም: {{productTitle}}\n\nአዲሱን ስም ያስገቡ:",
  msg__enter_company_name_or_id_to_remove: "ለመሰረዝ የኩባንያ ስም ወይም መለያ ያስገቡ:",
  msg__enter_product_name_or_keyword_to_search:
    "ለመፈለግ የምርት ስም ወይም ቁልፍ ቃል ያስገቡ:",
  msg__enter_user_id_username_or_phone_number_to_sea:
    "ለመፈለግ የተጠቃሚ መለያ፣ የተጠቃሚ ስም ወይም ስልክ ያስገቡ:",
  msg__enter_username_phone_or_id_to_search:
    "ለመፈለግ የተጠቃሚ ስም፣ ስልክ ወይም መለያ ያስገቡ:",
  msg__errormessage: "❌ ስህተት: {{error}}",
  msg__export_completednn_summaryn_records_exportdat:
    "የማውጣት ስራ ተጠናቅቋል\n\nየማጠቃለያ\n{{records}} መዝገቦች ተወጥረዋል",
  msg__export_failed_please_try_again: "የማውጣት ስራ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_add_company_please_try_again:
    "ኩባንያውን መጨመር አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_approve_payout: "የክፍያ ማጽደቂያ አልተሳካም።",
  msg__failed_to_approve_withdrawal_please_try_again:
    "የወጪ ጥያቄ ማጽደቂያ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_complete_sale: "ግዛት ማጠናቀቅ አልተሳካም።",
  msg__failed_to_decline_withdrawal_please_try_again:
    "የወጪ ጥያቄ መተው አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_delete_company: "ኩባንያውን መሰረዝ አልተሳካም።",
  msg__failed_to_delete_product: "ምርቱን መሰረዝ አልተሳካም።",
  msg__failed_to_delete_product_please_try_again:
    "ምርቱን መሰረዝ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_edit_company_profile_please_try_aga:
    "የኩባንያ መገለጫ ማስተካከያ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_edit_product_please_try_again:
    "ምርቱን ማስተካከያ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_export_companies_please_try_again:
    "ኩባንያዎችን ማውጣት አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_export_users_please_try_again:
    "ተጠቃሚዎችን ማውጣት አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_finalize_withdrawal: "የወጪ ጥያቄ ማጠናቀቅ አልተሳካም።",
  msg__failed_to_generate_referral_code_please_try_a:
    "የሪፈራል ኮድ ማዘጋጀት አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_list_companies: "ኩባንያዎችን ማስረዳት አልተሳካም።",
  msg__failed_to_load_admin_panel: "የአስተዳደር ፓነል መጫን አልተሳካም።",
  msg__failed_to_load_analytics_please_try_again:
    "የትንተና መረጃ መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_load_company_actions: "የኩባንያ ድርጊቶች መጫን አልተሳካም።",
  msg__failed_to_load_company_analytics_summary:
    "የኩባንያ የትንተና ማጠቃለያ መጫን አልተሳካም።",
  msg__failed_to_load_company_details: "የኩባንያ ዝርዝሮች መጫን አልተሳካም።",
  msg__failed_to_load_company_for_editing: "ለማስተካከያ የኩባንያ መጫን አልተሳካም።",
  msg__failed_to_load_company_management: "የኩባንያ አስተዳደር መጫን አልተሳካም።",
  msg__failed_to_load_dashboard_please_try_again:
    "ዳሽቦርድ መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_load_maintenance_settings: "የጥገና ቅንብሮች መጫን አልተሳካም።",
  msg__failed_to_load_payout_history_please_try_agai:
    "የክፍያ ታሪክ መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_load_payout_management: "የክፍያ አስተዳደር መጫን አልተሳካም።",
  msg__failed_to_load_payout_options_please_try_agai:
    "የክፍያ አማራጮች መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_load_pending_payouts: "የበገር ክፍያዎች መጫን አልተሳካም።",
  msg__failed_to_load_platform_analytics_dashboard:
    "የመድረኳ የትንተና ዳሽቦርድ መጫን አልተሳካም።",
  msg__failed_to_load_product_details: "የምርት ዝርዝሮች መጫን አልተሳካም።",
  msg__failed_to_load_product_for_editing: "ለማስተካከያ የምርት መጫን አልተሳካም።",
  msg__failed_to_load_products_please_try_again:
    "ምርቶችን መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_load_referral_data_please_try_again:
    "የሪፈራል መረጃ መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_load_settings_please_try_again:
    "ቅንብሮችን መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_load_user_management: "የተጠቃሚ አስተዳደር መጫን አልተሳካም።",
  msg__failed_to_process_company_approval: "የኩባንያ ማጽደቂያ ማስኬድ አልተሳካም።",
  msg__failed_to_process_denial: "መተው ማስኬድ አልተሳካም።",
  msg__failed_to_process_referral_code_please_try_ag:
    "የሪፈራል ኮድ ማስኬድ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_process_sale: "ግዛት ማስኬድ አልተሳካም።",
  msg__failed_to_process_sale_please_try_again:
    "ግዛት ማስኬድ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_process_withdrawal_request: "የወጪ ጥያቄ ማስኬድ አልተሳካም።",
  msg__failed_to_register_company_please_try_again:
    "ኩባንያውን መመዝገብ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_reject_payout: "የክፍያ መተው አልተሳካም።",
  msg__failed_to_remove_company_please_try_again:
    "ኩባንያውን መሰረዝ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_request_withdrawal: "የወጪ ጥያቄ ማቅረብ አልተሳካም።",
  msg__failed_to_save_withdrawal_details_please_try_:
    "የወጪ ጥያቄ ዝርዝሮች ማስቀመጥ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_send_broadcast: "የማሰራጫ መልእክት መላክ አልተሳካም።",
  msg__failed_to_send_media_broadcast: "የሚዲያ የማሰራጫ መልእክት መላክ አልተሳካም።",
  msg__failed_to_send_pdf_please_try_again: "PDF መላክ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_start_add_company: "ኩባንያ መጨመር መጀመር አልተሳካም።",
  msg__failed_to_start_broadcast: "የማሰራጫ መልእክት መጀመር አልተሳካም።",
  msg__failed_to_start_delete: "መሰረዝ መጀመር አልተሳካም።",
  msg__failed_to_start_edit: "ማስተካከያ መጀመር አልተሳካም።",
  msg__failed_to_start_phone_verification: "የስልክ ማረጋገጫ መጀመር አልተሳካም።",
  msg__failed_to_start_product_creation: "የምርት ፈጠራ መጀመር አልተሳካም።",
  msg__failed_to_start_profile_edit: "የመገለጫ ማስተካከያ መጀመር አልተሳካም።",
  msg__failed_to_start_remove_company: "ኩባንያ መሰረዝ መጀመር አልተሳካም።",
  msg__failed_to_start_sell_flow: "የመሸጫ ሂደት መጀመር አልተሳካም።",
  msg__failed_to_start_withdrawal_request: "የወጪ ጥያቄ መጀመር አልተሳካም።",
  msg__failed_to_submit_registration_please_try_agai:
    "መመዝገብ ማቅረብ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_toggle_maintenance_mode: "የጥገና ሁኔታ መቀያየር አልተሳካም።",
  msg__failed_to_update_product: "ምርቱን ማዘመን አልተሳካም።",
  msg__failed_to_upload_proof_please_try_again:
    "ማረጋገጫ መላክ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  msg__failed_to_verify_phone: "ስልክ ማረጋገጫ አልተሳካም።",
  msg__generating_company_export_please_wait: "የኩባንያ የማውጣት ስራ ይፈጥራል። እባክዎ ያጥቡ።",
  msg__generating_export_this_may_take_a_moment:
    "የማውጣት ስራ ይፈጥራል። ይህ ለጥቂት ጊዜ ሊወስድ ይችላል።",
  msg__generating_user_export_please_wait: "የተጠቃሚ የማውጣት ስራ ይፈጥራል። እባክዎ ያጥቡ።",
  msg__invalid_referral_code: "የሪፈራል ኮድ ትክክል አይደለም።",
  msg__maintenance_mode_enabled: "የጥገና ሁኔታ ንቁ ሆኗል።",
  msg__maintenance_mode_disabled: "የጥገና ሁኔታ ተሰርዟል።",
  msg__no_companies_found: "ምንም ኩባንያ አልተገኘም።",
  msg__no_products_found: "ምንም ምርት አልተገኘም።",
  msg__no_users_found: "ምንም ተጠቃሚ አልተገኘም።",
  msg__operation_cancelled: "ድርጊቱ ተሰርዟል።",
  msg__phone_verification_started: "የስልክ ማረጋገጫ ጀምሯል።",
  msg__phone_verification_completed: "የስልክ ማረጋገጫ ተጠናቅቋል።",
  msg__product_added_successfully: "ምርቱ በተሳካም ሁኔታ ተጨምሯል!",
  msg__product_deleted_successfully: "ምርቱ በተሳካም ሁኔታ ተሰርዟል!",
  msg__product_updated_successfully: "ምርቱ በተሳካም ሁኔታ ተዘምኗል!",
  msg__referral_code_generated_successfully: "የሪፈራል ኮድ በተሳካም ሁኔታ ተፈጥሯል!",
  msg__sale_completed_successfully: "ግዛት በተሳካም ሁኔታ ተጠናቅቋል!",
  msg__user_promoted_to_admin: "ተጠቃሚው ወደ አድሚን ተሻሽሏል!",
  msg__user_demoted_from_admin: "ተጠቃሚው ከአድሚን ተወግዷል!",
  msg__withdrawal_approved_successfully: "የወጪ ጥያቄ በተሳካም ሁኔታ ተጽዕኖ ሆኗል!",
  msg__withdrawal_declined_successfully: "የወጪ ጥያቄ በተሳካም ሁኔታ ተሰርዟል!",
  msg__withdrawal_request_submitted_successfully: "የወጪ ጥያቄ በተሳካም ሁኔታ ተላልፏል!",
};

// Update the Amharic data with translations
let updated = 0;
for (const [key, translation] of Object.entries(translations)) {
  if (amharicData[key] === key) {
    amharicData[key] = translation;
    updated++;
  }
}

// Write the updated file
fs.writeFileSync(amharicFile, JSON.stringify(amharicData, null, 2), "utf8");

console.log(`✅ Updated ${updated} translations in Amharic locale file`);
console.log(`📝 Total keys processed: ${Object.keys(translations).length}`);
