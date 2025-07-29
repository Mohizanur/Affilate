const fs = require('fs');
const path = require('path');

// Read the Amharic locale file
const amharicFile = path.join(__dirname, '../bot/locales/am.json');
const amharicData = JSON.parse(fs.readFileSync(amharicFile, 'utf8'));

// Common Amharic translations for frequently used keys
const translations = {
  "msg_answer_yes_no": "እባክዎ 'አዎ' ወይም 'አይ' ይመልሱ።",
  "msg_ask_referral_code": "የሪፈራል ኮድ አለዎት? (አዎ/አይ)",
  "msg_enter_referral_code": "የሪፈራል ኮድዎን ያስገቡ:",
  "msg__buyer_not_found_please_enter_a_valid_telegram": "ገዛተኛ አልተገኘም። እባክዎ ትክክለኛ የተሌግራም የተጠቃሚ ስም ያስገቡ።",
  "msg__could_not_validate_referral_code_missing_comp": "የሪፈራል ኮድ ማረጋገጫ አልተሳካም። የኩባንያ መረጃ አለመገኘት።",
  "msg_no_favorites_yet": "እስካሁን ምንም የሚያሻዎት ምርት የለም።",
  "msg_no_detailed_referral_history": "ዝርዝራዊ የሪፈራል ታሪክ የለም።",
  "msg_no_product_specified": "ምርት አልተገለጸም።",
  "msg_no_recent_activity": "የቅርብ ጊዜ እንቅስቃሴ የለም።",
  "msg_no_referral_data": "የሪፈራል መረጃ የለም።",
  "msg_no_stock_available": "የሚገኝ ክምችት የለም።",
  "msg_please_enter_the_new_platform_fee_percentage_e": "እባክዎ አዲሱን የመድረኳ ክፍያ መቶኛ ያስገቡ:",
  "msg_product_added_cart": "ምርቱ ወደ ካርት ተጨምሯል።",
  "msg_product_removed_cart": "ምርቱ ከካርት ተወግዷል።",
  "msg_product_added_favorites": "ምርቱ ወደ የሚያሻዎት ተጨምሯል።",
  "msg_product_removed_favorites": "ምርቱ ከየሚያሻዎት ተወግዷል።",
  "msg_usage_removefavorite": "እባክዎ ከየሚያሻዎት ለማውጣት የሚፈልጉትን ምርት ይምረጡ:",
  "msg_usage_removecart": "እባክዎ ከካርት ለማውጣት የሚፈልጉትን ምርት ይምረጡ:",
  "msg_usage_requestwithdrawal_companyid": "እባክዎ የወጪ ጥያቄ ለማቅረብ የሚፈልጉትን ኩባንያ ይምረጡ:",
  "msg_no_companies_yet": "እስካሁን ምንም ኩባንያ የለዎትም።",
  "msg_failed_load_companies": "ኩባንያዎችዎን ለመጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg_no_companies_or_products": "❌ ምንም ኩባንያ ወይም እቃ አያዙም።",
  "msg_no_products_yet": "❌ እስካሁን ምንም እቃ አልጨመሩም።",
  "msg_failed_load_products": "ምርቶችዎን ለመጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg_product_not_found": "ምርቱ አልተገኘም።",
  "msg_company_inactive": "ኩባንያው አይሰራም።",
  "msg_no_description": "መግለጫ የለም።",
  "msg_unknown": "ያልታወቀ።",
  "msg_product_details": "የምርት ዝርዝሮች",
  "msg_product_contact_owner": "ከባለቤቱ ጋር ያግኙ",
  "msg_product_sell": "ለመሸጥ",
  "msg_product_edit": "ለመስተካከል",
  "msg_product_delete": "ለመሰረዝ",
  "msg_added_to_favorites": "ወደ የሚያሻዎት ተጨምሯል",
  "msg_added_to_cart": "ወደ ካርት ተጨምሯል",
  "msg_removed_from_cart": "ከካርት ተወግዷል",
  "msg_cart_empty": "ካርትዎ ባዶ ነው።",
  "msg_failed_join_company": "ኩባንያውን መቀላቀል አልተሳካም።",
  "msg_profile_title": "የግል መገለጫ",
  "msg_profile_info": "የግል መረጃዎ",
  "msg_phone_verified": "ስልክ የተረጋገጠ ነው",
  "msg_phone_not_verified": "ስልክ አልተረጋገጠም",
  "msg_failed_load_profile": "መገለጫውን ለመጫን አልተሳካም።",
  "msg_no_orders_yet": "እስካሁን ምንም ግዢው የለም። ግዢውን ይጀምሩ! 🛍️ እቃዎችን ለማግኘት /browse ይጠቀሙ።",
  "msg_used_code": "🎯 የተጠቀሙት ኮድ: {{code}}",
  "msg_reward_applied": "🎉 ሽልማት/ቅናሽ ተግብሯል!",
  "msg_proof_uploaded": "📄 ማረጋገጫ ተልኳል",
  "msg_share_code_instructions": "📤 ይህን መልእክት ከጓደኛዎች ጋር ያጋሩ:\n\n",
  "msg_failed_generate_share": "የመጋራት መልእክት ማዘጋጀት አልተሳካም።",
  "help": "🆘 የሚደግፍ መልእክት",
  "msg_failed_load_help": "የሚደግፍ መልእክት ለመጫን አልተሳካም።",
  "msg_enter_a_purchase_amount_to_calculate_fees_and_": "ክፍያዎችን እና ሽልማቶችን ለማስላት የግዢው መጠን ያስገቡ:",
  "msg__something_went_wrong": "የሆነ ነገር ተሳሳተ።",
  "msg__failed_to_load_menu": "ምናሌ ለመጫን አልተሳካም።",
  "msg_privacy_policy": "የግል መረጃ ፖሊሲ",
  "msg_terms_of_service": "የአገልግሎት ውሎች",
  "msg_operation_cancelled": "ድርጊቱ ተሰርዟል።",
  "msg_not_set": "አልተዘጋጀም።",
  "msg_no_payment_details": "የክፍያ ዝርዝሮች የሉም።",
  "msg_configured": "የተዘጋጀ።",
  "msg__failed_to_load_payment_settings": "የክፍያ ቅንብሮች ለመጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg__failed_to_set_payment_method": "የክፍያ ዘዴ ማዘጋጀት አልተሳካም።",
  "msg__payment_method_updated_successfully": "የክፍያ ዘዴ በተሳካም ሁኔታ ተዘምኗል!",
  "msg__failed_to_update_payment_method_please_try_ag": "የክፍያ ዘዴ ማዘመን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg__failed_to_load_notification_settings": "የማሳወቂያ ቅንብሮች ለመጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg__typecharat0touppercase_typeslice1_notificatio": "{{type.charAt(0).toUpperCase() + type.slice(1)}} ማሳወቂያዎች",
  "msg__failed_to_update_notification_setting": "የማሳወቂያ ቅንብር ማዘመን አልተሳካም።",
  "msg__failed_to_load_detailed_stats_please_try_agai": "ዝርዝራዊ ስታትስቲክስ ለመጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg_not_eligible_register_company": "❌ ኩባንያ ለመመዝገብ ተስማሚ አይደለም። እባክዎ አድሚን ያግኙ።",
  "msg_failed_start_registration": "የመመዝገብ ሂደት መጀመር አልተሳካም።",
  "msg_enter_company_name": "የኩባንያ ስም ያስገቡ:",
  "msg_enter_company_description": "የኩባንያ መግለጫ ያስገቡ:",
  "msg_enter_company_website": "የኩባንያ ድህረ ገጽ ያስገቡ:",
  "msg_enter_company_phone": "የኩባንያ ስልክ ያስገቡ:",
  "msg_enter_company_email": "የኩባንያ ኢሜይል ያስገቡ:",
  "msg_enter_company_address": "የኩባንያ አድራሻ ያስገቡ:",
  "msg_enter_company_location": "የኩባንያ አካባቢ ያስገቡ:",
  "msg_enter_company_offer": "የኩባንያ ቅናሽ ያስገቡ:",
  "msg_enter_valid_email": "እባክዎ ትክክለኛ ኢሜይል ያስገቡ:",
  "msg_company_created": "ኩባንያው ተፈጥሯል!",
  "msg_invalid_registration_step": "የመመዝገብ ደረጃ ትክክል አይደለም።",
  "msg_failed_register_company": "ኩባንያውን መመዝገብ አልተሳካም።",
  "msg_agreement_accepted": "ስምምነቱ ተቀብሏል!",
  "msg_must_accept_agreement": "ስምምነቱን መቀበል አለብዎት።",
  "msg_select_field_edit": "ለመስተካከል የሚፈልጉትን መስክ ይምረጡ:",
  "msg_failed_load_company_actions": "የኩባንያ ድርጊቶች ለመጫን አልተሳካም።",
  "msg__company_not_found": "ኩባንያው አልተገኘም።",
  "msg__failed_to_load_edit_options": "የማስተካከያ አማራጮች ለመጫን አልተሳካም።",
  "msg__invalid_edit_session": "የማስተካከያ ክፍለ ጊዜ ትክክል አይደለም።",
  "msg__company_updated_successfully": "ኩባንያው በተሳካም ሁኔታ ተዘምኗል!",
  "msg_failed_update_company": "ኩባንያውን ማዘመን አልተሳካም።",
  "msg_enter_product_title": "የምርት ስም ያስገቡ:",
  "msg_enter_product_description": "የምርት መግለጫ ያስገቡ:",
  "msg_enter_product_price": "የምርት ዋጋ ያስገቡ:",
  "msg_enter_product_quantity": "የምርት ብዛት ያስገቡ:",
  "msg_enter_product_category": "የምርት መደብ ያስገቡ:",
  "msg_enter_product_status_instock_outofstock_lowsto": "የምርት ሁኔታ ያስገቡ (instock/outofstock/lowstock):",
  "msg_invalid_quantity": "ብዛቱ ትክክል አይደለም።",
  "msg_invalid_status": "ሁኔታው ትክክል አይደለም።",
  "msg_product_created": "ምርቱ ተፈጥሯል!",
  "msg_invalid_product_step": "የምርት ደረጃ ትክክል አይደለም።",
  "msg_failed_add_product": "ምርቱን መጨመር አልተሳካም።",
  "msg__product_favorite_status_updated": "የምርት የሚያሻዎት ሁኔታ ተዘምኗል!",
  "msg__you_have_no_favorite_products": "የሚያሻዎት ምርቶች የሉዎትም።",
  "msg__you_have_no_valid_favorite_products": "ትክክለኛ የሚያሻዎት ምርቶች የሉዎትም።",
  "msg__your_cart_is_empty": "ካርትዎ ባዶ ነው።",
  "msg__you_have_no_valid_products_in_your_cart": "ትክክለኛ ምርቶች በካርትዎ ውስጥ የሉዎትም።",
  "msg__you_have_no_referral_codes_yet_make_a_purchas": "እስካሁን የሪፈራል ኮዶች የሉዎትም። ሽልማት ለማግኘት ግዛት ያድርጉ!",
  "msg__failed_to_load_your_referral_codes": "የሪፈራል ኮዶችዎን ለመጫን አልተሳካም።",
  "msg_withdrawal_request_submitted_company_and_admin": "የወጪ ጥያቄዎ ወደ ኩባንያ ባለቤት እና አድሚን ተልኳል።",
  "msg__emessage": "❌ ስህተት: {{error}}",
  "msg__failed_to_load_language_settings_please_try_a": "የቋንቋ ቅንብሮች ለመጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg__failed_to_change_language_please_try_again": "ቋንቋ መለወጥ አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg__you_are_banned_from_using_this_bot": "እርስዎ ከዚህ ቦት አጠቃቀም የተከለከሉ ናቸው።",
  "msg__withdrawal_approved_and_processed_by_the_comp": "የወጪ ጥያቄዎ ተጽዕኖ እና በኩባንያው ተሰራ።",
  "msg__errmessage": "❌ ስህተት: {{error}}",
  "msg__failed_to_load_product_please_try_again": "ምርቱን ለመጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  "msg_enter_new_value_for_field": "ለመስክው አዲስ እሴት ያስገቡ:",
  "msg__please_enter_the_referral_code": "እባክዎ የሪፈራል ኮድውን ያስገቡ:",
  "msg__unknown_action_please_try_again": "ያልታወቀ ድርጊት። እባክዎ እንደገና ይሞክሩ።",
  "msg__something_went_wrong_please_try_again": "የሆነ ነገር ተሳሳተ። እባክዎ እንደገና ይሞክሩ።",
  "msg__user_not_found": "ተጠቃሚው አልተገኘም።"
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
fs.writeFileSync(amharicFile, JSON.stringify(amharicData, null, 2), 'utf8');

console.log(`✅ Updated ${updated} translations in Amharic locale file`);
console.log('📝 Fixed keys:');
for (const [key, translation] of Object.entries(translations)) {
  if (amharicData[key] === translation) {
    console.log(`  - ${key}: "${translation}"`);
  }
} 