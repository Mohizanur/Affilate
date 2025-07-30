console.log("callbackHandlers.js loaded");
console.log("Entering handlers/callbackHandlers.js");
const { Markup } = require("telegraf");
const { t } = require("../../utils/localize");
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

function blockIfBanned(ctx, user) {
  if (user && (user.banned || user.isBanned)) {
    ctx.reply(
      t(
        "msg__you_are_banned_from_using_this_bot",
        {},
        ctx.session?.language || "en"
      )
    );
    return true;
  }
  return false;
}

class CallbackHandlers {
  async handleCallback(ctx) {
    try {
      console.log("TOP OF handleCallback");
      const telegramId = ctx.from.id;

      // Immediately answer the callback to avoid Telegram timeout errors
      await ctx.answerCbQuery();

      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (blockIfBanned(ctx, user)) return;

      const callbackData = ctx.callbackQuery.data;
      // Log callbackData and its char codes
      console.log(
        "Callback data received:",
        callbackData,
        "| char codes:",
        Array.from(callbackData).map((c) => c.charCodeAt(0))
      );
      // Pagination for platform analytics dashboard (must be before switch/case)
      if (callbackData.startsWith("platform_analytics_dashboard_")) {
        const page =
          parseInt(callbackData.replace("platform_analytics_dashboard_", "")) ||
          1;
        return adminHandlers.handlePlatformAnalyticsDashboard(ctx, page);
      }
      // Route to appropriate handler based on callback data
      if (callbackData.startsWith("company_approve_withdrawal_")) {
        const withdrawalId = callbackData.replace(
          "company_approve_withdrawal_",
          ""
        );
        return adminHandlers.handleCompanyApproveWithdrawal(ctx, withdrawalId);
      }
      // Add to Favorites and Add to Cart handlers
      if (callbackData.startsWith("add_favorite_")) {
        const productId = callbackData.replace("add_favorite_", "");
        return userHandlers.handleAddFavorite(ctx, productId);
      }
      if (callbackData.startsWith("add_cart_")) {
        const productId = callbackData.replace("add_cart_", "");
        return userHandlers.handleAddCart(ctx, productId);
      }
      // Handle Unban User dynamic callback
      if (callbackData.startsWith("unban_user_")) {
        const userId = callbackData.replace("unban_user_", "");
        return adminHandlers.handleUnbanUser(ctx, userId);
      }
      // Remove from Favorites and Cart handlers
      if (callbackData.startsWith("remove_favorite_")) {
        const productId = callbackData.replace("remove_favorite_", "");
        return userHandlers.handleRemoveFavorite(ctx, productId);
      }
      if (callbackData.startsWith("remove_cart_")) {
        const productId = callbackData.replace("remove_cart_", "");
        return userHandlers.handleRemoveCart(ctx, productId);
      }
      // At the top of handleCallback or before the switch/case
      if (
        ctx.session &&
        ctx.session.editSetting &&
        ctx.message &&
        ctx.message.text
      ) {
        return adminHandlers.handleUpdateSetting(ctx);
      }
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
          return userHandlers.handleBalance(ctx);
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
          return companyHandlers.handleCompanySettings(ctx);
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

        case "confirm_broadcast":
          return adminHandlers.handleConfirmBroadcast(ctx);
        case "admin_withdrawals":
          return adminHandlers.handleCompanyWithdrawals(ctx);
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
        case "admin_withdrawals":
          return adminHandlers.handleCompanyWithdrawals(ctx);
        case "error_logs":
          return adminHandlers.handleErrorLogs(ctx);
        case "warning_logs":
          return adminHandlers.handleWarningLogs(ctx);
        case "export_logs":
          return adminHandlers.handleExportLogs(ctx);
        case "clear_logs":
          return adminHandlers.handleClearLogs(ctx);
        case "promoted_users":
          return adminHandlers.handlePromotedUsers(ctx);
        case "set_platform_fee":
          return adminHandlers.handleSetPlatformFee(ctx);
        case "edit_platform_fee":
          return adminHandlers.handleEditPlatformFee(ctx);
        case "edit_referral_bonus":
          return adminHandlers.handleEditReferralBonus(ctx);
        case "edit_buyer_bonus":
          return adminHandlers.handleEditBuyerBonus(ctx);
        case "toggle_maintenance":
          return adminHandlers.handleToggleMaintenance(ctx);
        // Company handlers
        case "register_company":
          return userHandlers.handleRegisterCompany(ctx);
        case "my_companies":
          return await userHandlers.handleMyCompanies(ctx);
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
          return userHandlers.handleFavorites(ctx);
        case "view_cart":
          return userHandlers.handleCart(ctx);
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
          return await userHandlers.handleMyProducts(ctx);

        // Language handlers
        case "language_settings":
          return userHandlers.handleLanguageSettings(ctx);
        case "set_language_en":
          return userHandlers.handleSetLanguage(ctx, "en");
        case "set_language_am":
          return userHandlers.handleSetLanguage(ctx, "am");

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
            // Route directly to userService for company withdrawals
            const withdrawalId = callbackData.replace(
              "approve_withdrawal_",
              ""
            );
            try {
              await userService.userService.companyApproveWithdrawal(
                withdrawalId,
                ctx.from.id
              );
              ctx.reply(
                t(
                  "msg__withdrawal_approved_successfully",
                  {},
                  ctx.session?.language || "en"
                )
              );
              if (ctx.callbackQuery) ctx.answerCbQuery();
              return;
            } catch (error) {
              logger.error("Error approving withdrawal:", error);
              ctx.reply(
                t(
                  "msg__failed_to_approve_withdrawal",
                  {},
                  ctx.session?.language || "en"
                )
              );
              if (ctx.callbackQuery) ctx.answerCbQuery();
              return;
            }
          }

          if (callbackData.startsWith("withdraw_company_")) {
            const companyId = callbackData.replace("withdraw_company_", "");
            return adminHandlers.handleCompanyWithdraw(ctx, companyId);
          }
          if (callbackData.startsWith("reject_withdrawal_")) {
            return this.handleRejectWithdrawal(ctx, callbackData);
          } else if (callbackData.startsWith("deny_withdrawal_")) {
            return this.handleRejectWithdrawal(
              ctx,
              callbackData.replace("deny_withdrawal_", "reject_withdrawal_")
            );
          } else if (callbackData.startsWith("company_")) {
            if (callbackData.startsWith("company_action_")) {
              const companyId = callbackData.replace("company_action_", "");
              return userHandlers.handleCompanyActionMenu(ctx, companyId);
            }
            // fallback for other company_ actions
            return userHandlers.handleCompanyActionMenu(ctx, callbackData);
          } else if (callbackData.startsWith("order_")) {
            return this.handleOrderAction(ctx, callbackData);
          } else if (callbackData.startsWith("add_product_")) {
            const companyId = callbackData.replace("add_product_", "");
            return userHandlers.handleAddProductStart(ctx, companyId);
          }
          if (callbackData.startsWith("view_product_")) {
            const productId = callbackData.replace("view_product_", "");
            try {
              return await userHandlers.handleViewProduct(ctx, productId);
            } catch (error) {
              console.error("Error in view_product callback:", error);
              await ctx.reply(
                t(
                  "msg__failed_to_load_product_please_try_again",
                  {},
                  ctx.session?.language || "en"
                )
              );
              return;
            }
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
            let companyId = callbackData.replace("ref_company_", "");
            let page = 1;
            if (companyId.includes("_page_")) {
              const parts = companyId.split("_page_");
              companyId = parts[0];
              page = parseInt(parts[1]) || 1;
            }
            return userHandlers.handleCompanyReferralDetails(
              ctx,
              companyId,
              page
            );
          }
          if (callbackData.startsWith("view_favorites")) {
            return userHandlers.handleFavorites(ctx);
          }
          if (callbackData === "view_cart") {
            return userHandlers.handleCart(ctx);
          }
          if (callbackData.startsWith("sell_product_")) {
            const productId = callbackData.replace("sell_product_", "");
            return userHandlers.handleSellProduct(ctx, productId);
          }
          if (callbackData.startsWith("product_action_")) {
            return userHandlers.handleProductActionMenu(ctx, callbackData);
          }
          if (callbackData.startsWith("edit_product_field_")) {
            return userHandlers.handleEditProductField(ctx);
          }
          if (callbackData.startsWith("edit_field_")) {
            // Set session and prompt for new value
            const field = callbackData.replace("edit_field_", "");
            ctx.session.editProductStep = field;
            ctx.reply(
              t(
                "msg_enter_new_value_for_field",
                {},
                ctx.session?.language || "en"
              )
            );
            return;
          }
          if (callbackData.startsWith("company_action_")) {
            const companyId = callbackData.replace("company_action_", "");
            return userHandlers.handleCompanyActionMenu(ctx, companyId);
          }
          if (callbackData.startsWith("edit_company_field_")) {
            return userHandlers.handleEditCompanyField(ctx);
          }
          if (callbackData.startsWith("edit_companyfield_")) {
            // Set session and prompt for new value
            const field = callbackData.replace("edit_companyfield_", "");
            ctx.session.editCompanyStep = field;
            ctx.reply(
              t(
                "msg_enter_new_value_for_field",
                {},
                ctx.session?.language || "en"
              )
            );
            return;
          }
          // Unban user button (dynamic callback)
          if (callbackData.startsWith("unban_user_")) {
            return adminHandlers.handleUnbanUserCallback(ctx);
          }
          if (callbackData.startsWith("ban_user_")) {
            const userId = callbackData.replace("ban_user_", "");
            return adminHandlers.handleBanUser(ctx, userId);
          }
          if (callbackData.startsWith("demote_user_")) {
            const userId = callbackData.replace("demote_user_", "");
            return adminHandlers.handleDemoteUserId(ctx, userId);
          }
          if (callbackData.startsWith("promote_user_")) {
            const userId = callbackData.replace("promote_user_", "");
            return adminHandlers.handlePromoteUserId(ctx, userId);
          }
          if (callbackData.startsWith("promote_company_manager_")) {
            const userId = callbackData.replace("promote_company_manager_", "");
            return adminHandlers.handlePromoteToCompanyManager(ctx, userId);
          }
          if (callbackData.startsWith("demote_company_manager_")) {
            const userId = callbackData.replace("demote_company_manager_", "");
            return adminHandlers.handleDemoteFromCompanyManager(ctx, userId);
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
          if (callbackData === "admin_export_users") {
            return adminHandlers.handleExportUsers(ctx);
          }
          if (callbackData === "admin_export_companies") {
            return adminHandlers.handleExportCompanies(ctx);
          }
          if (callbackData === "admin_search_companies") {
            return adminHandlers.handleSearchCompany(ctx);
          }
          if (callbackData.startsWith("all_users_menu_")) {
            const parts = callbackData
              .replace("all_users_menu_", "")
              .split("_");
            const page = parseInt(parts[0]) || 1;
            const searchQuery = parts.slice(1).join("_"); // Reconstruct search query
            return adminHandlers.handleAllUsersMenu(ctx, page, searchQuery);
          }
          if (callbackData.startsWith("all_companies_search")) {
            return adminHandlers.handleAllCompaniesSearch(ctx);
          }
          if (callbackData.startsWith("all_companies_menu_")) {
            const page = parseInt(
              callbackData.replace("all_companies_menu_", "")
            );
            return adminHandlers.handleAdminListCompanies(ctx, page);
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
            return ctx.reply(
              t(
                "msg__please_enter_the_referral_code",
                {},
                ctx.session?.language || "en"
              )
            );
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

          if (callbackData.startsWith("request_withdrawal_")) {
            const companyId = callbackData.replace("request_withdrawal_", "");
            return adminHandlers.handleAdminRequestWithdrawal(ctx, companyId);
          }

          if (callbackData.startsWith("confirm_admin_withdrawal_")) {
            const companyId = callbackData.replace(
              "confirm_admin_withdrawal_",
              ""
            );
            return adminHandlers.handleAdminConfirmWithdrawal(ctx, companyId);
          }

          if (callbackData.startsWith("company_approve_withdrawal_")) {
            const withdrawalId = callbackData.replace(
              "company_approve_withdrawal_",
              ""
            );
            console.log(
              "CALLING handleCompanyApproveWithdrawal with withdrawalId:",
              withdrawalId
            );
            return adminHandlers.handleCompanyApproveWithdrawal(
              ctx,
              withdrawalId
            );
          }
          if (callbackData.startsWith("company_deny_withdrawal_")) {
            const withdrawalId = callbackData.replace(
              "company_deny_withdrawal_",
              ""
            );
            return adminHandlers.handleCompanyDenyWithdrawal(ctx, withdrawalId);
          }
          if (callbackData.startsWith("finalize_admin_withdrawal_")) {
            const withdrawalId = callbackData.replace(
              "finalize_admin_withdrawal_",
              ""
            );
            return adminHandlers.handleAdminFinalizeWithdrawal(
              ctx,
              withdrawalId
            );
          }

          if (callbackData.startsWith("browse_products_page_")) {
            const page =
              parseInt(callbackData.replace("browse_products_page_", "")) || 1;
            return userHandlers.handleBrowseProducts(ctx, page);
          }

          if (callbackData.startsWith("my_products_page_")) {
            const page =
              parseInt(callbackData.replace("my_products_page_", "")) || 1;
            return userHandlers.handleMyProducts(ctx, page);
          }

          if (callbackData.startsWith("my_companies_page_")) {
            const page =
              parseInt(callbackData.replace("my_companies_page_", "")) || 1;
            return await userHandlers.handleMyCompanies(ctx, page);
          }

          if (callbackData.startsWith("my_referrals_page_")) {
            const page =
              parseInt(callbackData.replace("my_referrals_page_", "")) || 1;
            return userHandlers.handleMyReferrals(ctx, page);
          }

          if (callbackData.startsWith("leaderboard_page_")) {
            const page =
              parseInt(callbackData.replace("leaderboard_page_", "")) || 1;
            return userHandlers.handleLeaderboard(ctx, page);
          }

          if (callbackData.startsWith("my_referral_codes_page_")) {
            const page =
              parseInt(callbackData.replace("my_referral_codes_page_", "")) ||
              1;
            return userHandlers.handleMyReferralCodes(ctx, page);
          }

          if (callbackData.startsWith("favorites_page_")) {
            const page =
              parseInt(callbackData.replace("favorites_page_", ""), 10) || 1;
            return userHandlers.handleFavorites(ctx, page);
          }
          if (callbackData.startsWith("cart_page_")) {
            const page =
              parseInt(callbackData.replace("cart_page_", ""), 10) || 1;
            return userHandlers.handleCart(ctx, page);
          }

          if (callbackData.startsWith("admin_companies_")) {
            const parts = callbackData
              .replace("admin_companies_", "")
              .split("_");
            const page = parseInt(parts[0]) || 1;
            const searchQuery = parts.slice(1).join("_"); // Reconstruct search query
            return adminHandlers.handleAdminListCompanies(
              ctx,
              page,
              searchQuery
            );
          }

          ctx.reply(
            t(
              "msg__unknown_action_please_try_again",
              {},
              ctx.session?.language || "en"
            )
          );
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
      ctx.reply(
        t(
          "msg__something_went_wrong_please_try_again",
          {},
          ctx.session?.language || "en"
        )
      );
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
        return ctx.reply(
          t("msg__user_not_found", {}, ctx.session?.language || "en")
        );
      }

      const profileMessage = `
`;
    } catch (error) {
      logger.error("Error in profile handler:", error);
      ctx.reply(
        t(
          "msg__something_went_wrong_please_try_again",
          {},
          ctx.session?.language || "en"
        )
      );
    }
  }
}

module.exports = new CallbackHandlers();
