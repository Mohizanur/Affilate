console.log("Entering handlers/callbackHandlers.js");
const { Markup } = require("telegraf");
console.log("Loaded telegraf in callbackHandlers");
const userService = require("../services/userService");
console.log("Loaded userService in callbackHandlers");
const companyService = require("../services/companyService");
console.log("Loaded companyService in callbackHandlers");
const adminService = require("../services/adminService");
console.log("Loaded adminService in callbackHandlers");
const adminHandlers = require("./adminHandlers");
console.log("Loaded adminHandlers in callbackHandlers");
const logger = require("../../utils/logger");
console.log("Loaded utils/logger in callbackHandlers");
const userHandlers = require("./userHandlers");
console.log("Loaded userHandlers in callbackHandlers");
const companyHandlers = require("./companyHandlers");
console.log("Loaded companyHandlers in callbackHandlers");

class CallbackHandlers {
  async handleCallback(ctx) {
    try {
      // Immediately answer the callback to avoid Telegram timeout errors
      await ctx.answerCbQuery();
      const callbackData = ctx.callbackQuery.data;
      const telegramId = ctx.from.id;

      // Route to appropriate handler based on callback data
      console.log("Callback data received:", callbackData);
      switch (callbackData) {
        // Main menu handlers
        case "main_menu":
          return this.handleMainMenu(ctx);
        case "profile":
          return this.handleProfile(ctx);
        case "companies":
          return this.handleCompanies(ctx);
        case "orders":
          return this.handleOrders(ctx);
        // Added cases for main menu buttons
        case "browse_products":
          return userHandlers.handleBrowseProducts(ctx);
        case "my_referrals":
          return userHandlers.handleMyReferrals(ctx);
        case "balance_withdraw":
          return userHandlers.handleRequestPayout(ctx);
        case "leaderboard":
          return userHandlers.handleLeaderboard(ctx);
        case "request_payout":
          return userHandlers.handleRequestPayout(ctx);
        case "detailed_referral_stats":
          return userHandlers.handleDetailedReferralStats(ctx);
        case "payout_history":
          return userHandlers.handlePayoutHistory(ctx);
        case "my_referral_codes":
          return userHandlers.handleMyReferralCodes(ctx);
        case "fee_calculator":
          return userHandlers.handleFeeCalculator(ctx);
        // Admin handlers
        case "admin_panel":
          return adminHandlers.handleAdminPanel(ctx);
        case "admin_users":
          return adminHandlers.handleUserManagement(ctx);
        case "search_user":
          return adminHandlers.handleSearchUser(ctx);
        case "banned_users":
          return adminHandlers.handleBannedUsers(ctx);
        case "ban_user":
          return adminHandlers.handleBanUser(ctx, ctx.session.selectedUserId);
        case "unban_user":
          return adminHandlers.handleUnbanUser(ctx, ctx.session.selectedUserId);
        case "export_users":
          return adminHandlers.handleExportUsers(ctx);
        case "user_analytics":
          return adminHandlers.handleUserAnalytics(ctx);
        case "admin_companies":
          return adminHandlers.handleCompanyManagement(ctx);
        case "search_company":
          return adminHandlers.handleSearchCompany(ctx);
        case "company_analytics":
          return adminHandlers.handleCompanyAnalytics(ctx);
        case "export_companies":
          return adminHandlers.handleExportCompanies(ctx);
        case "company_settings":
          return adminHandlers.handleCompanySettings(ctx);
        case "admin_orders":
          return adminHandlers.handleOrderManagement(ctx);
        case "pending_orders":
          return adminHandlers.handlePendingOrders(ctx);
        case "approved_orders":
          return adminHandlers.handleApprovedOrders(ctx);
        case "rejected_orders":
          return adminHandlers.handleRejectedOrders(ctx);
        case "admin_analytics":
          return adminHandlers.handleAnalytics(ctx);
        case "admin_settings":
          return adminHandlers.handleSystemSettings(ctx);
        case "admin_logs":
          return adminHandlers.handleSystemLogs(ctx);
        case "admin_backup":
          return adminHandlers.handleBackupSystem(ctx);
        case "admin_broadcast":
          return adminHandlers.handleBroadcast(ctx);
        case "admin_withdrawals":
          return adminHandlers.handleManageWithdrawals(ctx);
        case "company_analytics_summary":
          console.log("Triggering handleCompanyAnalyticsSummary");
          return adminHandlers.handleCompanyAnalyticsSummary(ctx);
        case "admin_add_company":
          return adminHandlers.handleAdminAddCompany(ctx);
        case "admin_remove_company":
          return adminHandlers.handleAdminRemoveCompany(ctx);
        case "admin_list_companies":
          return adminHandlers.handleAdminListCompanies(ctx);
        case "admin_list_users":
          return adminHandlers.handleAdminListUsers(ctx);
        case "platform_analytics_dashboard":
          return adminHandlers.handlePlatformAnalyticsDashboard(ctx);
        case "error_logs":
          return adminHandlers.handleErrorLogs(ctx);
        case "warning_logs":
          return adminHandlers.handleWarningLogs(ctx);
        case "export_logs":
          return adminHandlers.handleExportLogs(ctx);
        case "clear_logs":
          return adminHandlers.handleClearLogs(ctx);
        // Company handlers
        case "register_company":
          return userHandlers.handleRegisterCompany(ctx);
        case "my_companies":
          return userHandlers.handleMyCompanies(ctx);
        case "browse_products":
          return userHandlers.handleBrowseProducts(ctx);
        case "my_referrals":
          return userHandlers.handleMyReferrals(ctx);
        case "balance_withdraw":
          return userHandlers.handleRequestPayout(ctx);
        case "leaderboard":
          return userHandlers.handleLeaderboard(ctx);
        case "user_profile":
          return userHandlers.handleUserProfile(ctx);
        case "view_favorites":
          return userHandlers.handleViewFavorites(ctx);
        case "view_cart":
          return userHandlers.handleViewCart(ctx);
        case "help":
          return userHandlers.handleHelp(ctx);
        case "company_dashboard":
          return userHandlers.handleCompanyDashboard(ctx);
        case "admin_panel":
          return adminHandlers.handleAdminPanel(ctx);
        case "verify_phone":
          return userHandlers.handleVerifyPhone(ctx);
        case "notification_settings":
          return companyHandlers.handleCompanySettings(ctx);
        case "payment_settings":
          return userHandlers.handlePaymentSettings(ctx);
        case "edit_profile":
          return userHandlers.handleEditProfile(ctx);
        case "my_products":
          return userHandlers.handleMyProducts(ctx);

        // Withdrawal handlers
        case "request_withdrawal":
          return this.handleRequestWithdrawal(ctx);
        case "withdrawal_history":
          return this.handleWithdrawalHistory(ctx);

        // Add callback case for 'share_link_' to route to userHandlers.handleShareLink.
        case "share_link":
          return userHandlers.handleShareLink(ctx);

        default:
          // Handle dynamic callbacks
          if (callbackData.startsWith("approve_withdrawal_")) {
            return this.handleApproveWithdrawal(ctx, callbackData);
          } else if (callbackData.startsWith("reject_withdrawal_")) {
            return this.handleRejectWithdrawal(ctx, callbackData);
          } else if (callbackData.startsWith("deny_withdrawal_")) {
            return this.handleRejectWithdrawal(
              ctx,
              callbackData.replace("deny_withdrawal_", "reject_withdrawal_")
            );
          } else if (callbackData.startsWith("company_")) {
            return userHandlers.handleCompanyActionMenu(ctx, callbackData);
          } else if (callbackData.startsWith("order_")) {
            return this.handleOrderAction(ctx, callbackData);
          } else if (callbackData.startsWith("add_product_")) {
            const companyId = callbackData.replace("add_product_", "");
            return userHandlers.handleAddProductStart(ctx, companyId);
          }
          if (callbackData.startsWith("view_product_")) {
            return userHandlers.handleViewProduct(ctx);
          }
          if (callbackData.startsWith("buy_product_")) {
            return userHandlers.handleBuyProduct(ctx);
          }
          if (callbackData.startsWith("get_referral_")) {
            return userHandlers.handleGetReferralCode(ctx);
          }
          if (callbackData.startsWith("favorite_product_")) {
            return userHandlers.handleFavoriteProduct(ctx);
          }
          if (callbackData.startsWith("add_to_cart_")) {
            return userHandlers.handleAddToCart(ctx);
          }
          if (callbackData.startsWith("ref_company_")) {
            const companyId = callbackData.replace("ref_company_", "");
            return userHandlers.handleCompanyReferralDetails(ctx, companyId);
          }
          if (callbackData.startsWith("view_favorites")) {
            return userHandlers.handleViewFavorites(ctx);
          }
          if (callbackData === "view_cart") {
            return userHandlers.handleViewCart(ctx);
          }
          if (callbackData.startsWith("sell_product_")) {
            return userHandlers.handleSellProduct(ctx);
          }
          if (callbackData.startsWith("product_action_")) {
            return userHandlers.handleProductActionMenu(ctx);
          }
          if (callbackData.startsWith("edit_product_field_")) {
            return userHandlers.handleEditProductField(ctx);
          }
          if (callbackData.startsWith("edit_field_")) {
            // Set session and prompt for new value
            const field = callbackData.replace("edit_field_", "");
            ctx.session.editProductStep = field;
            ctx.reply(`Enter new value for ${field}:`);
            return;
          }
          if (callbackData.startsWith("company_action_")) {
            return userHandlers.handleCompanyActionMenu(ctx);
          }
          if (callbackData.startsWith("edit_company_field_")) {
            return userHandlers.handleEditCompanyField(ctx);
          }
          if (callbackData.startsWith("edit_companyfield_")) {
            // Set session and prompt for new value
            const field = callbackData.replace("edit_companyfield_", "");
            ctx.session.editCompanyStep = field;
            ctx.reply(`Enter new value for ${field}:`);
            return;
          }
          // Unban user button (dynamic callback)
          if (callbackData.startsWith("unban_user_")) {
            return adminHandlers.handleUnbanUserCallback(ctx);
          }
          if (callbackData.startsWith("ban_user_")) {
            return adminHandlers.handleBanUserCallback(ctx);
          }
          if (callbackData.startsWith("company_analytics_")) {
            console.log(
              "Triggering handleCompanyAnalyticsCallback with:",
              callbackData
            );
            return adminHandlers.handleCompanyAnalyticsCallback(ctx);
          }
          if (callbackData.startsWith("company_settings_")) {
            return adminHandlers.handleCompanySettingsCallback(ctx);
          }
          if (callbackData.startsWith("approve_payout_")) {
            return adminHandlers.handleApprovePayoutCallback(ctx);
          }
          if (callbackData.startsWith("reject_payout_")) {
            return adminHandlers.handleRejectPayoutCallback(ctx);
          }
          if (callbackData.startsWith("approve_product_")) {
            const productId = callbackData.replace("approve_product_", "");
            return adminHandlers.handleApproveProductCallback(ctx, productId);
          }
          if (callbackData.startsWith("reject_product_")) {
            const productId = callbackData.replace("reject_product_", "");
            return adminHandlers.handleRejectProductCallback(ctx, productId);
          }
          if (callbackData.startsWith("admin_company_")) {
            const companyId = callbackData.replace("admin_company_", "");
            return adminHandlers.handleAdminCompanyDetail(ctx, companyId);
          }
          if (callbackData.startsWith("admin_product_")) {
            const productId = callbackData.replace("admin_product_", "");
            return adminHandlers.handleAdminProductDetail(ctx, productId);
          }
          if (callbackData.startsWith("admin_user_")) {
            const userId = callbackData.replace("admin_user_", "");
            return adminHandlers.handleAdminUserDetail(ctx, userId);
          }
          if (callbackData.startsWith("admin_list_companies_")) {
            const page = callbackData.replace("admin_list_companies_", "");
            return adminHandlers.handleAdminListCompanies(ctx, page);
          }
          if (callbackData.startsWith("admin_list_users_")) {
            const page = callbackData.replace("admin_list_users_", "");
            return adminHandlers.handleAdminListUsers(ctx, page);
          }
          if (callbackData.startsWith("promote_company_")) {
            const userId = callbackData.replace("promote_company_", "");
            return adminHandlers.handlePromoteCompany(ctx, userId);
          }
          if (callbackData.startsWith("demote_company_")) {
            const userId = callbackData.replace("demote_company_", "");
            return adminHandlers.handleDemoteCompany(ctx, userId);
          }
          if (callbackData.startsWith("promote_user_menu")) {
            return adminHandlers.handlePromoteUserMenu(ctx, 1, "");
          }
          if (callbackData.startsWith("promote_user_menu_")) {
            const page = parseInt(
              callbackData.replace("promote_user_menu_", "")
            );
            return adminHandlers.handlePromoteUserMenu(ctx, page, "");
          }
          if (callbackData.startsWith("promote_user_id_")) {
            const userId = callbackData.replace("promote_user_id_", "");
            return adminHandlers.handlePromoteUserId(ctx, userId);
          }
          if (callbackData === "promote_user_search") {
            return adminHandlers.handlePromoteUserSearch(ctx);
          }
          if (callbackData.startsWith("demote_user_id_")) {
            const userId = callbackData.replace("demote_user_id_", "");
            return adminHandlers.handleDemoteUserId(ctx, userId);
          }
          if (callbackData.startsWith("all_users_search")) {
            return adminHandlers.handleAllUsersSearch(ctx);
          }
          if (callbackData.startsWith("all_users_menu_")) {
            const page = parseInt(callbackData.replace("all_users_menu_", ""));
            return adminHandlers.handleAllUsersMenu(ctx, page);
          }
          if (callbackData.startsWith("all_companies_search")) {
            return adminHandlers.handleAllCompaniesSearch(ctx);
          }
          if (callbackData.startsWith("all_companies_menu_")) {
            const page = parseInt(
              callbackData.replace("all_companies_menu_", "")
            );
            return adminHandlers.handleAllCompaniesMenu(ctx, page);
          }
          if (callbackData.startsWith("generate_new_code_")) {
            return userHandlers.handleGenerateNewCode(ctx);
          }
          if (callbackData.startsWith("edit_product_")) {
            return userHandlers.handleEditProduct(ctx);
          }
          if (callbackData.startsWith("change_qty_")) {
            return userHandlers.handleChangeProductQuantity(ctx);
          }
          if (callbackData.startsWith("change_status_")) {
            return userHandlers.handleChangeProductStatus(ctx);
          }
          if (callbackData.startsWith("delete_product_")) {
            return userHandlers.handleDeleteProduct(ctx);
          }
          if (callbackData.startsWith("set_status_instock_")) {
            return userHandlers.handleSetProductStatus(ctx);
          }
          if (callbackData.startsWith("set_status_lowstock_")) {
            return userHandlers.handleSetProductStatus(ctx);
          }
          if (callbackData.startsWith("set_status_outofstock_")) {
            return userHandlers.handleSetProductStatus(ctx);
          }

          if (callbackData === "sale_referral_yes") {
            ctx.session.recordSaleStep = "referral_code";
            return ctx.reply("🔑 Please enter the referral code:");
          }

          if (callbackData === "sale_referral_no") {
            delete ctx.session.recordSaleData.referralCode;
            return userHandlers.processRecordedSale(ctx);
          }

          if (callbackData.startsWith("record_sale_")) {
            return userHandlers.handleRecordSale(ctx);
          }

          if (callbackData.startsWith("share_code_")) {
            return userHandlers.handleShareCode(ctx);
          }

          if (callbackData.startsWith("withdraw_company_")) {
            const companyId = callbackData.replace("withdraw_company_", "");
            return userHandlers.handleWithdrawCompany(ctx, companyId);
          }

          ctx.reply("❌ Unknown action. Please try again.");
      }
      // Text input routing for admin add/remove company steps
      if (ctx.session && ctx.session.adminAddCompanyStep) {
        return adminHandlers.handleAdminAddCompanyStep(ctx);
      }
      if (ctx.session && ctx.session.adminRemoveCompanyStep) {
        return adminHandlers.handleAdminRemoveCompanyStep(ctx);
      }
    } catch (error) {
      logger.error("Error in callback handler:", error);
      ctx.reply("❌ Something went wrong. Please try again.");
    }
  }

  async handleMainMenu(ctx) {
    return require("./userHandlers").handleStart(ctx);
  }

  async handleProfile(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );

      if (!user) {
        return ctx.reply("❌ User not found.");
      }

      const profileMessage = `👤 *Your Profile*

📝 *Name:* ${user.firstName} ${user.lastName || ""}
🆔 *Telegram ID:* ${user.telegramId}
💰 *Balance:* $${(user.coinBalance || 0).toFixed(2)}
🏆 *Role:* ${user.role || "User"}
📅 *Member Since:* ${new Date(user.createdAt.toDate()).toLocaleDateString()}
🔗 *Referral Code:* \`${user.referralCode || "N/A"}\`

${user.referredBy ? `👥 *Referred By:* ${user.referredBy}` : ""}
      `;

      const buttons = [
        [Markup.button.callback("🔙 Back to Menu", "main_menu")],
      ];

      ctx.editMessageText(profileMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in handleProfile:", error);
      ctx.reply("❌ Failed to load profile. Please try again.");
    }
  }

  async handleApproveWithdrawal(ctx, callbackData) {
    try {
      const telegramId = ctx.from.id;
      const withdrawalId = callbackData.replace("approve_withdrawal_", "");
      const withdrawalDoc = await require("../config/database")
        .withdrawals()
        .doc(withdrawalId)
        .get();
      if (!withdrawalDoc.exists) return ctx.reply("❌ Withdrawal not found.");
      const withdrawal = withdrawalDoc.data();
      // Get company info
      const company =
        await require("../services/companyService").getCompanyById(
          withdrawal.companyId
        );
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      // Allow if admin or company owner
      if (
        !user ||
        !(
          user.role === "admin" ||
          user.isAdmin ||
          (company && company.telegramId === telegramId)
        )
      ) {
        return ctx.reply("❌ Access denied.");
      }
      await userService.userService.approveWithdrawal(withdrawalId, telegramId);
      ctx.reply("✅ Withdrawal approved successfully!");
    } catch (error) {
      logger.error("Error approving withdrawal:", error);
      ctx.reply("❌ Failed to approve withdrawal. Please try again.");
    }
  }

  async handleRejectWithdrawal(ctx, callbackData) {
    try {
      const telegramId = ctx.from.id;
      const withdrawalId = callbackData.replace("reject_withdrawal_", "");
      const withdrawalDoc = await require("../config/database")
        .withdrawals()
        .doc(withdrawalId)
        .get();
      if (!withdrawalDoc.exists) return ctx.reply("❌ Withdrawal not found.");
      const withdrawal = withdrawalDoc.data();
      // Get company info
      const company =
        await require("../services/companyService").getCompanyById(
          withdrawal.companyId
        );
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      // Allow if admin or company owner
      if (
        !user ||
        !(
          user.role === "admin" ||
          user.isAdmin ||
          (company && company.telegramId === telegramId)
        )
      ) {
        return ctx.reply("❌ Access denied.");
      }
      await userService.userService.declineWithdrawal(withdrawalId, telegramId);
      ctx.reply("❌ Withdrawal rejected. Funds returned to user.");
    } catch (error) {
      logger.error("Error rejecting withdrawal:", error);
      ctx.reply("❌ Failed to reject withdrawal. Please try again.");
    }
  }

  // Add placeholder methods for other handlers
  async handleCompanies(ctx) {
    const buttons = [
      [
        Markup.button.callback("➕ Register Company", "register_company"),
        Markup.button.callback("🏢 My Companies", "my_companies"),
      ],
      [Markup.button.callback("🔙 Back to Menu", "main_menu")],
    ];

    ctx.editMessageText("🏢 *Company Management*\n\nChoose an option:", {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  async handleOrders(ctx) {
    const buttons = [
      [Markup.button.callback("📦 My Orders", "my_orders")],
      [Markup.button.callback("🔙 Back to Menu", "main_menu")],
    ];

    ctx.editMessageText("📦 *Order Management*\n\nChoose an option:", {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  async handleWithdraw(ctx) {
    const buttons = [
      [
        Markup.button.callback("💸 Request Withdrawal", "request_withdrawal"),
        Markup.button.callback("📋 History", "withdrawal_history"),
      ],
      [Markup.button.callback("🔙 Back to Menu", "main_menu")],
    ];

    ctx.editMessageText("💸 *Withdrawal Management*\n\nChoose an option:", {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  // Placeholder methods for other handlers
  async handleRegisterCompany(ctx) {
    ctx.reply("🏢 Company registration feature coming soon!");
  }

  async handleMyCompanies(ctx) {
    ctx.reply("📋 My companies feature coming soon!");
  }

  async handleCreateOrder(ctx) {
    ctx.reply("➕ Create order feature coming soon!");
  }

  async handleMyOrders(ctx) {
    ctx.reply("📦 My orders feature coming soon!");
  }

  async handleRequestWithdrawal(ctx) {
    ctx.reply("💸 Request withdrawal feature coming soon!");
  }

  async handleWithdrawalHistory(ctx) {
    ctx.reply("📋 Withdrawal history feature coming soon!");
  }

  async handleCompanyAction(ctx, callbackData) {
    if (callbackData.startsWith("company_action_")) {
      return userHandlers.handleCompanyActionMenu(ctx);
    }
  }

  async handleOrderAction(ctx, callbackData) {
    ctx.reply("📦 Order action feature coming soon!");
  }

  setupHandlers(bot) {
    bot.on("callback_query", (ctx) => this.handleCallback(ctx));
    logger.info("Callback handlers setup completed");
  }
}

module.exports = new CallbackHandlers();
console.log("Exiting handlers/callbackHandlers.js");
