const { Markup } = require("telegraf");

class Keyboards {
  // Main menu keyboard
  static mainMenu() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("🛍️ Browse Products", "browse_products"),
        Markup.button.callback("💰 My Earnings", "my_earnings"),
      ],
      [
        Markup.button.callback("🔗 My Referrals", "my_referrals"),
        Markup.button.callback("🏢 My Company", "my_company"),
      ],
      [
        Markup.button.callback("👤 Profile", "user_profile"),
        Markup.button.callback("📊 Statistics", "statistics"),
      ],
      [
        Markup.button.callback("⚙️ Settings", "settings"),
        Markup.button.callback("❓ Help", "help"),
      ],
    ]);
  }

  // Admin menu keyboard
  static adminMenu() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("📊 Analytics", "admin_analytics"),
        Markup.button.callback("👥 Users", "admin_users"),
      ],
      [
        Markup.button.callback("🏢 Companies", "admin_companies"),
        Markup.button.callback("🛒 Orders", "admin_orders"),
      ],
      [
        Markup.button.callback("💸 Payouts", "admin_payouts"),
        Markup.button.callback("📢 Broadcast", "admin_broadcast"),
      ],
      [
        Markup.button.callback("⚙️ Settings", "admin_settings"),
        Markup.button.callback("🔙 Back to Main", "main_menu"),
      ],
    ]);
  }

  // Company menu keyboard
  static companyMenu() {
    return Markup.keyboard([
      ["📦 My Products", "🛒 Orders"],
      ["📊 Analytics", "⚙️ Settings"],
      ["🔙 Back to Main"],
    ]).resize();
  }

  // Inline keyboards
  static productActions(productId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("🛒 Buy Now", `buy_${productId}`),
        Markup.button.callback("🔗 Get Referral Link", `refer_${productId}`),
      ],
      [
        Markup.button.callback("ℹ️ More Info", `info_${productId}`),
        Markup.button.callback("📞 Contact Seller", `contact_${productId}`),
      ],
    ]);
  }

  static companyActions(companyId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Approve", `approve_company_${companyId}`),
        Markup.button.callback("❌ Reject", `reject_company_${companyId}`),
      ],
      [
        Markup.button.callback(
          "ℹ️ View Details",
          `company_details_${companyId}`
        ),
      ],
    ]);
  }

  static payoutActions(payoutId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Approve", `approve_payout_${payoutId}`),
        Markup.button.callback("❌ Reject", `reject_payout_${payoutId}`),
      ],
      [Markup.button.callback("ℹ️ View Details", `payout_details_${payoutId}`)],
    ]);
  }

  static pagination(currentPage, totalPages, prefix) {
    const buttons = [];

    if (currentPage > 1) {
      buttons.push(
        Markup.button.callback(
          "⬅️ Previous",
          `${prefix}_page_${currentPage - 1}`
        )
      );
    }

    buttons.push(
      Markup.button.callback(`${currentPage}/${totalPages}`, "noop")
    );

    if (currentPage < totalPages) {
      buttons.push(
        Markup.button.callback("Next ➡️", `${prefix}_page_${currentPage + 1}`)
      );
    }

    return Markup.inlineKeyboard([buttons]);
  }

  static confirmAction(action, id) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Confirm", `confirm_${action}_${id}`),
        Markup.button.callback("❌ Cancel", `cancel_${action}_${id}`),
      ],
    ]);
  }

  static backButton(callback) {
    return Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back", callback)],
    ]);
  }

  static yesNoButtons(yesCallback, noCallback) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Yes", yesCallback),
        Markup.button.callback("❌ No", noCallback),
      ],
    ]);
  }

  static categoryButtons(categories) {
    const buttons = categories.map((category) => [
      Markup.button.callback(category.name, `category_${category.id}`),
    ]);

    return Markup.inlineKeyboard(buttons);
  }

  static productList(products, page = 1) {
    const buttons = products.map((product) => [
      Markup.button.callback(
        `${product.title} - $${product.price}`,
        `product_${product.id}`
      ),
    ]);

    // Add navigation buttons if needed
    const navButtons = [];
    if (page > 1) {
      navButtons.push(
        Markup.button.callback("⬅️ Previous", `products_page_${page - 1}`)
      );
    }
    navButtons.push(Markup.button.callback("🔙 Back", "back_to_categories"));

    buttons.push(navButtons);

    return Markup.inlineKeyboard(buttons);
  }

  static referralCodeActions(codeId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("📊 Statistics", `ref_stats_${codeId}`),
        Markup.button.callback("🔗 Share Link", `ref_share_${codeId}`),
      ],
      [
        Markup.button.callback("✏️ Edit", `ref_edit_${codeId}`),
        Markup.button.callback("🗑️ Delete", `ref_delete_${codeId}`),
      ],
    ]);
  }

  static notificationSettings(preferences) {
    const buttons = [
      [
        Markup.button.callback(
          `🛒 Orders: ${preferences.orders ? "✅" : "❌"}`,
          "toggle_notif_orders"
        ),
      ],
      [
        Markup.button.callback(
          `💰 Payouts: ${preferences.payouts ? "✅" : "❌"}`,
          "toggle_notif_payouts"
        ),
      ],
      [
        Markup.button.callback(
          `🔗 Referrals: ${preferences.referrals ? "✅" : "❌"}`,
          "toggle_notif_referrals"
        ),
      ],
      [
        Markup.button.callback(
          `🏢 Company: ${preferences.company ? "✅" : "❌"}`,
          "toggle_notif_company"
        ),
      ],
      [
        Markup.button.callback(
          `🎁 Promotions: ${preferences.promotions ? "✅" : "❌"}`,
          "toggle_notif_promotions"
        ),
      ],
      [Markup.button.callback("💾 Save Settings", "save_notif_settings")],
    ];

    return Markup.inlineKeyboard(buttons);
  }

  static companyStatusFilter() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("⏳ Pending", "filter_companies_pending"),
        Markup.button.callback("✅ Approved", "filter_companies_approved"),
      ],
      [
        Markup.button.callback("❌ Rejected", "filter_companies_rejected"),
        Markup.button.callback("📋 All", "filter_companies_all"),
      ],
    ]);
  }

  static analyticsMenu() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("👥 Users", "analytics_users"),
        Markup.button.callback("🏢 Companies", "analytics_companies"),
      ],
      [
        Markup.button.callback("🛒 Orders", "analytics_orders"),
        Markup.button.callback("💰 Revenue", "analytics_revenue"),
      ],
      [
        Markup.button.callback("📊 Growth", "analytics_growth"),
        Markup.button.callback("🔝 Top Performers", "analytics_top"),
      ],
      [Markup.button.callback("📈 Export Report", "export_analytics")],
    ]);
  }

  static broadcastOptions() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("👥 All Users", "broadcast_all"),
        Markup.button.callback("🔗 Referrers Only", "broadcast_referrers"),
      ],
      [
        Markup.button.callback("🏢 Company Owners", "broadcast_companies"),
        Markup.button.callback("🎯 Custom Group", "broadcast_custom"),
      ],
    ]);
  }

  static productManagement(productId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("✏️ Edit", `edit_product_${productId}`),
        Markup.button.callback("📊 Statistics", `product_stats_${productId}`),
      ],
      [
        Markup.button.callback(
          "🔄 Toggle Status",
          `toggle_product_${productId}`
        ),
        Markup.button.callback("🗑️ Delete", `delete_product_${productId}`),
      ],
    ]);
  }

  static userActions(userId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("👤 View Profile", `user_profile_${userId}`),
        Markup.button.callback("📊 Statistics", `user_stats_${userId}`),
      ],
      [
        Markup.button.callback("🔒 Ban User", `ban_user_${userId}`),
        Markup.button.callback("💬 Send Message", `message_user_${userId}`),
      ],
    ]);
  }

  static timeRangeSelector(prefix) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("📅 Today", `${prefix}_today`),
        Markup.button.callback("📅 This Week", `${prefix}_week`),
      ],
      [
        Markup.button.callback("📅 This Month", `${prefix}_month`),
        Markup.button.callback("📅 This Year", `${prefix}_year`),
      ],
      [Markup.button.callback("📅 Custom Range", `${prefix}_custom`)],
    ]);
  }

  static sortOptions(prefix) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("📅 Date", `${prefix}_sort_date`),
        Markup.button.callback("💰 Amount", `${prefix}_sort_amount`),
      ],
      [
        Markup.button.callback("📊 Status", `${prefix}_sort_status`),
        Markup.button.callback("🔤 Name", `${prefix}_sort_name`),
      ],
    ]);
  }

  static quickActions() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("🔍 Search", "quick_search"),
        Markup.button.callback("📊 Quick Stats", "quick_stats"),
      ],
      [
        Markup.button.callback("🔔 Notifications", "quick_notifications"),
        Markup.button.callback("⚙️ Settings", "quick_settings"),
      ],
    ]);
  }

  static languageSelector() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("🇺🇸 English", "lang_en"),
        Markup.button.callback("🇪🇸 Español", "lang_es"),
      ],
      [
        Markup.button.callback("🇫🇷 Français", "lang_fr"),
        Markup.button.callback("🇩🇪 Deutsch", "lang_de"),
      ],
      [
        Markup.button.callback("🇷🇺 Русский", "lang_ru"),
        Markup.button.callback("🇨🇳 中文", "lang_zh"),
      ],
    ]);
  }

  static supportOptions() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("❓ FAQ", "support_faq"),
        Markup.button.callback("💬 Contact Support", "support_contact"),
      ],
      [
        Markup.button.callback("📖 User Guide", "support_guide"),
        Markup.button.callback("🐛 Report Bug", "support_bug"),
      ],
    ]);
  }

  static removeKeyboard() {
    return Markup.removeKeyboard();
  }

  static forceReply() {
    return Markup.forceReply();
  }

  // Helper method to create custom inline keyboard
  static customInlineKeyboard(buttons) {
    return Markup.inlineKeyboard(buttons);
  }

  // Helper method to create custom keyboard
  static customKeyboard(buttons, options = {}) {
    return Markup.keyboard(buttons).resize(options.resize !== false);
  }
}

module.exports = Keyboards;
