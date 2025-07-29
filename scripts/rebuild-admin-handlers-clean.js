const fs = require("fs");
const path = require("path");

const adminHandlersPath = path.join(
  __dirname,
  "../bot/handlers/adminHandlers.js"
);

console.log("🔧 Rebuilding admin handlers with clean syntax...");

try {
  // Create a clean admin handlers file
  const cleanContent = `const { Markup } = require("telegraf");
console.log("Loaded telegraf in adminHandlers");
const adminService = require("../services/adminService");
console.log("adminService keys:", Object.keys(adminService));
console.log("Loaded services/adminService in adminHandlers");
const userService = require("../services/userService");
console.log("Loaded services/userService in adminHandlers");
const companyService = require("../services/companyService");
console.log("Loaded services/companyService in adminHandlers");
const logger = require("../../utils/logger");
console.log("Loaded utils/logger in adminHandlers");
const referralService = require("../services/referralService");
console.log("Loaded services/referralService in adminHandlers");
const productService = require("../services/productService");
console.log("Loaded services/productService in adminHandlers");
const { t } = require("../../utils/localize");

// Add at the top:
function toDateSafe(x) {
  if (!x) return null;
  if (typeof x.toDate === "function") return x.toDate();
  if (typeof x === "string" || typeof x === "number") return new Date(x);
  return x instanceof Date ? x : null;
}

class AdminHandlers {
  constructor() {
    this.adminIds = process.env.ADMIN_IDS
      ? process.env.ADMIN_IDS.split(",").map((id) => parseInt(id))
      : [];
  }

  // Deprecated: use isAdminAsync everywhere
  isAdmin(telegramId) {
    return false;
  }

  async isAdminAsync(telegramId) {
    if (this.adminIds.includes(telegramId)) return true;
    try {
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      return user && (user.role === "admin" || user.isAdmin === true);
    } catch {
      return false;
    }
  }

  async handleAdminPanel(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      const stats = await adminService.getSystemStats();

      const message = \`
🔧 *Admin Panel*

📊 System Overview:
• Total Users: \${stats.totalUsers}
• Total Companies: \${stats.totalCompanies}

📈 Today's Activity:
• New Users: \${stats.today.newUsers}

⚠️ Pending Actions:
• Pending Payouts: \${stats.pending.payouts}
• Support Tickets: \${stats.pending.tickets}
      \`;

      const buttons = [
        [
          Markup.button.callback("👥 Users", "admin_users"),
          Markup.button.callback("🏢 Companies", "admin_companies"),
        ],
        [
          Markup.button.callback(
            "📊 Platform Analytics",
            "platform_analytics_dashboard"
          ),
        ],
        [
          Markup.button.callback("⚙️ System Settings", "admin_settings"),
        ],
        [
          Markup.button.callback("📢 Broadcast", "admin_broadcast"),
          Markup.button.callback("💾 Backup", "admin_backup"),
        ],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in admin panel:", error);
      ctx.reply(t("msg__failed_to_load_admin_panel", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAllUsersMenu(ctx, page = 1) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      const users = await userService.getAllUsers();
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage) || 1;
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      
      let msg = \`👥 *All Users (Page \${page}/\${totalPages})*\n\n\`;
      msg += \`📊 Total Users: \${users.length}\n\n\`;
      
      const buttons = [];
      users.slice(start, end).forEach((user, index) => {
        const username = user.username || user.firstName || user.first_name || 'Unknown';
        const status = user.isBanned ? '🚫 Banned' : '✅ Active';
        msg += \`\${start + index + 1}. \${username}\n\`;
        msg += \`   ID: \${user.telegramId || user.id}\n\`;
        msg += \`   Status: \${status}\n\`;
        msg += \`   Balance: $\${(user.referralBalance || 0).toFixed(2)}\n\n\`;
        
        buttons.push([
          Markup.button.callback(
            \`\${username}\`,
            \`admin_user_\${user.telegramId || user.id}\`
          ),
        ]);
      });
      
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback(
            "⬅️ Previous",
            \`all_users_menu_\${page - 1}\`
          )
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback(
            "➡️ Next",
            \`all_users_menu_\${page + 1}\`
          )
        );
      if (navButtons.length) buttons.push(navButtons);
      
      buttons.push([
        Markup.button.callback("🔍 Search Users", "all_users_search"),
        Markup.button.callback("📤 Export Users", "admin_export_users"),
      ]);
      buttons.push([Markup.button.callback("🔙 Back to Admin", "admin_panel")]);
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in all users menu:", error);
      ctx.reply(t("msg__failed_to_load_users", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      const user = await userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply(t("msg__user_not_found", {}, ctx.session?.language || "en"));
      
      let msg = \`👤 *User Details*\n\n\`;
      msg += \`📱 Name: \${user.firstName || user.first_name || 'Unknown'} \${user.lastName || user.last_name || ''}\n\`;
      msg += \`🆔 ID: \${user.telegramId || user.id}\n\`;
      msg += \`👤 Username: @\${user.username || 'N/A'}\n\`;
      msg += \`📞 Phone: \${user.phone_number || user.phone || 'N/A'}\n\`;
      msg += \`💰 Balance: $\${(user.referralBalance || 0).toFixed(2)}\n\`;
      msg += \`🎯 Role: \${user.role || 'user'}\n\`;
      msg += \`📅 Joined: \${toDateSafe(user.createdAt) ? toDateSafe(user.createdAt).toLocaleDateString() : 'N/A'}\n\`;
      msg += \`🏢 Can Register Company: \${user.canRegisterCompany ? '✅ Yes' : '❌ No'}\n\`;
      msg += \`🚫 Banned: \${user.isBanned ? '✅ Yes' : '❌ No'}\n\`;
      
      const buttons = [
        [
          Markup.button.callback(
            user.isBanned ? "🔓 Unban User" : "🚫 Ban User",
            user.isBanned ? \`unban_user_\${userId}\` : \`ban_user_\${userId}\`
          ),
        ],
        [
          Markup.button.callback(
            user.canRegisterCompany ? "⬇️ Demote User" : "⬆️ Promote User",
            user.canRegisterCompany ? \`demote_user_id_\${userId}\` : \`promote_user_id_\${userId}\`
          ),
        ],
        [Markup.button.callback("🔙 Back to Users", "all_users_menu_1")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply(t("msg__failed_to_load_user_details", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      await userService.userService.updateUser(userId, { isBanned: true });
      ctx.reply(t("msg__user_banned_successfully", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply(t("msg__failed_to_ban_user", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      await userService.userService.updateUser(userId, { isBanned: false });
      ctx.reply(t("msg__user_unbanned_successfully", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply(t("msg__failed_to_unban_user", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePromoteUserId(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply(t("msg__user_promoted", {}, ctx.session?.language || "en"));
      setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply(t("msg__failed_to_promote_user", {}, ctx.session?.language || "en"));
    }
  }

  async handleDemoteUserId(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply(t("msg__user_demoted", {}, ctx.session?.language || "en"));
      setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply(t("msg__failed_to_demote_user", {}, ctx.session?.language || "en"));
    }
  }

  async handleUserManagement(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      let msg = \`👥 *User Management*\n\n\`;
      msg += \`Manage all users on the platform.\n\n\`;
      msg += \`Features:\n\`;
      msg += \`• View all users\`;
      msg += \`• Search users\`;
      msg += \`• Ban/unban users\`;
      msg += \`• Promote/demote users\`;
      msg += \`• User analytics\`;
      
      const buttons = [
        [Markup.button.callback("👥 All Users", "all_users_menu_1")],
        [Markup.button.callback("🔍 Search Users", "all_users_search")],
        [Markup.button.callback("🚫 Banned Users", "banned_users")],
        [Markup.button.callback("📊 User Analytics", "user_analytics")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in user management:", error);
      ctx.reply(t("msg__failed_to_load_user_management", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBannedUsers(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      const users = await userService.getAllUsers();
      const bannedUsers = users.filter(u => u.isBanned);
      
      let msg = \`🚫 *Banned Users*\n\n\`;
      msg += \`📊 Total Banned: \${bannedUsers.length}\n\n\`;
      
      if (bannedUsers.length === 0) {
        msg += "No banned users found.";
      } else {
        bannedUsers.slice(0, 10).forEach((user, index) => {
          const username = user.username || user.firstName || user.first_name || 'Unknown';
          msg += \`\${index + 1}. \${username}\n\`;
          msg += \`   ID: \${user.telegramId || user.id}\n\n\`;
        });
      }
      
      const buttons = [
        [Markup.button.callback("🔙 Back to Users", "admin_users")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in banned users:", error);
      ctx.reply(t("msg__failed_to_load_banned_users", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUserAnalytics(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      const users = await userService.getAllUsers();
      const totalUsers = users.length;
      const activeUsers = users.filter(u => !u.isBanned).length;
      const bannedUsers = users.filter(u => u.isBanned).length;
      const usersWithBalance = users.filter(u => (u.referralBalance || 0) > 0).length;
      
      let msg = \`📊 *User Analytics*\n\n\`;
      msg += \`👥 Total Users: \${totalUsers}\n\`;
      msg += \`✅ Active Users: \${activeUsers}\n\`;
      msg += \`🚫 Banned Users: \${bannedUsers}\n\`;
      msg += \`💰 Users with Balance: \${usersWithBalance}\n\`;
      
      const buttons = [
        [Markup.button.callback("🔙 Back to Users", "admin_users")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in user analytics:", error);
      ctx.reply(t("msg__failed_to_load_user_analytics", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAllUsersSearch(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      ctx.session.searchType = "user";
      ctx.session.waitingForSearch = true;
      
      ctx.reply(t("msg__enter_user_id_username_or_phone_number_to_sea", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting user search:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Add other essential methods as stubs
  async handleAdminListCompanies(ctx, page = 1) {
    ctx.reply('Not implemented: handleAdminListCompanies');
  }

  async handleAdminCompanyDetail(ctx, companyId) {
    ctx.reply('Not implemented: handleAdminCompanyDetail');
  }

  async handleCompanyManagement(ctx) {
    ctx.reply('Not implemented: handleCompanyManagement');
  }

  async handleSearchCompany(ctx) {
    ctx.reply('Not implemented: handleSearchCompany');
  }

  async handleCompanyAnalytics(ctx) {
    ctx.reply('Not implemented: handleCompanyAnalytics');
  }

  async handleOrderManagement(ctx) {
    ctx.reply('Not implemented: handleOrderManagement');
  }

  async handlePendingOrders(ctx) {
    ctx.reply('Not implemented: handlePendingOrders');
  }

  async handleApprovedOrders(ctx) {
    ctx.reply('Not implemented: handleApprovedOrders');
  }

  async handleRejectedOrders(ctx) {
    ctx.reply('Not implemented: handleRejectedOrders');
  }

  async handleAnalytics(ctx) {
    ctx.reply('Not implemented: handleAnalytics');
  }

  async handleSystemLogs(ctx) {
    ctx.reply('Not implemented: handleSystemLogs');
  }

  async handleManageWithdrawals(ctx) {
    ctx.reply('Not implemented: handleManageWithdrawals');
  }

  async handleAdminListUsers(ctx, page = 1) {
    return this.handleAllUsersMenu(ctx, page);
  }

  async handleErrorLogs(ctx) {
    ctx.reply('Not implemented: handleErrorLogs');
  }

  async handleWarningLogs(ctx) {
    ctx.reply('Not implemented: handleWarningLogs');
  }

  async handleExportLogs(ctx) {
    ctx.reply('Not implemented: handleExportLogs');
  }

  async handleClearLogs(ctx) {
    ctx.reply('Not implemented: handleClearLogs');
  }

  async handlePromotedUsers(ctx) {
    ctx.reply('Not implemented: handlePromotedUsers');
  }

  async handleUnbanUserCallback(ctx) {
    ctx.reply('Not implemented: handleUnbanUserCallback');
  }

  async handleBanUserCallback(ctx) {
    ctx.reply('Not implemented: handleBanUserCallback');
  }

  async handleCompanyAnalyticsCallback(ctx) {
    ctx.reply('Not implemented: handleCompanyAnalyticsCallback');
  }

  async handleCompanySettingsCallback(ctx) {
    ctx.reply('Not implemented: handleCompanySettingsCallback');
  }

  async handleApprovePayoutCallback(ctx) {
    ctx.reply('Not implemented: handleApprovePayoutCallback');
  }

  async handleRejectPayoutCallback(ctx) {
    ctx.reply('Not implemented: handleRejectPayoutCallback');
  }

  async handleApproveProductCallback(ctx, productId) {
    ctx.reply('Not implemented: handleApproveProductCallback');
  }

  async handleRejectProductCallback(ctx, productId) {
    ctx.reply('Not implemented: handleRejectProductCallback');
  }

  async handlePromoteCompany(ctx, userId) {
    ctx.reply('Not implemented: handlePromoteCompany');
  }

  async handleDemoteCompany(ctx, userId) {
    ctx.reply('Not implemented: handleDemoteCompany');
  }

  async handleAllCompaniesSearch(ctx) {
    ctx.reply('Not implemented: handleAllCompaniesSearch');
  }

  async handlePromoteUserMenu(ctx, page = 1, search = "") {
    ctx.reply('Not implemented: handlePromoteUserMenu');
  }

  async handlePromoteUserSearch(ctx) {
    ctx.reply('Not implemented: handlePromoteUserSearch');
  }

  async handlePromoteUserSearchInput(ctx, messageText) {
    ctx.reply('Not implemented: handlePromoteUserSearchInput');
  }

  async handleSearchQuery(ctx) {
    ctx.reply('Not implemented: handleSearchQuery');
  }

  async handleSearchUser(ctx) {
    ctx.reply('Not implemented: handleSearchUser');
  }

  async handleSystemSettings(ctx) {
    ctx.reply('Not implemented: handleSystemSettings');
  }

  async handleEditPlatformFee(ctx) {
    ctx.reply('Not implemented: handleEditPlatformFee');
  }

  async handleEditReferralBonus(ctx) {
    ctx.reply('Not implemented: handleEditReferralBonus');
  }

  async handleEditBuyerBonus(ctx) {
    ctx.reply('Not implemented: handleEditBuyerBonus');
  }

  async handleUpdateSetting(ctx) {
    ctx.reply('Not implemented: handleUpdateSetting');
  }

  async handleSetPlatformFee(ctx) {
    ctx.reply('Not implemented: handleSetPlatformFee');
  }

  async handlePlatformFeeInput(ctx) {
    ctx.reply('Not implemented: handlePlatformFeeInput');
  }

  async handlePlatformAnalyticsDashboard(ctx, page = 1) {
    ctx.reply('Not implemented: handlePlatformAnalyticsDashboard');
  }

  async handleMaintenanceMode(ctx) {
    ctx.reply('Not implemented: handleMaintenanceMode');
  }

  async handleToggleMaintenance(ctx) {
    ctx.reply('Not implemented: handleToggleMaintenance');
  }

  async handleExportData(ctx) {
    ctx.reply('Not implemented: handleExportData');
  }

  async handleCompanyAnalyticsSummary(ctx) {
    ctx.reply('Not implemented: handleCompanyAnalyticsSummary');
  }

  async handleBackupSystem(ctx) {
    ctx.reply('Not implemented: handleBackupSystem');
  }

  async handleCompanyApproveWithdrawal(ctx, withdrawalId) {
    ctx.reply('Not implemented: handleCompanyApproveWithdrawal');
  }

  async handleCompanyDenyWithdrawal(ctx, withdrawalId) {
    ctx.reply('Not implemented: handleCompanyDenyWithdrawal');
  }

  async handleAdminFinalizeWithdrawal(ctx, withdrawalId) {
    ctx.reply('Not implemented: handleAdminFinalizeWithdrawal');
  }

  async handleExportUsers(ctx) {
    ctx.reply('Not implemented: handleExportUsers');
  }

  async handleExportCompanies(ctx) {
    ctx.reply('Not implemented: handleExportCompanies');
  }

  async handleAdminRequestWithdrawal(ctx, companyId) {
    ctx.reply('Not implemented: handleAdminRequestWithdrawal');
  }

  async handleAdminConfirmWithdrawal(ctx, companyId) {
    ctx.reply('Not implemented: handleAdminConfirmWithdrawal');
  }

  async handleBroadcast(ctx) {
    ctx.reply('Not implemented: handleBroadcast');
  }

  async handleBroadcastType(ctx) {
    ctx.reply('Not implemented: handleBroadcastType');
  }

  async handleBroadcastMessage(ctx, messageText) {
    ctx.reply('Not implemented: handleBroadcastMessage');
  }

  async handleBroadcastMedia(ctx) {
    ctx.reply('Not implemented: handleBroadcastMedia');
  }

  async handlePayoutManagement(ctx) {
    ctx.reply('Not implemented: handlePayoutManagement');
  }

  async handlePendingPayouts(ctx) {
    ctx.reply('Not implemented: handlePendingPayouts');
  }

  async handleApprovePayout(ctx, payoutId) {
    ctx.reply('Not implemented: handleApprovePayout');
  }

  async handleRejectPayout(ctx, payoutId) {
    ctx.reply('Not implemented: handleRejectPayout');
  }

  async handleAdminAddCompany(ctx) {
    ctx.reply('Not implemented: handleAdminAddCompany');
  }

  async handleAdminAddCompanyStep(ctx) {
    ctx.reply('Not implemented: handleAdminAddCompanyStep');
  }

  async handleAdminRemoveCompany(ctx) {
    ctx.reply('Not implemented: handleAdminRemoveCompany');
  }

  async handleAdminRemoveCompanyStep(ctx) {
    ctx.reply('Not implemented: handleAdminRemoveCompanyStep');
  }
}

module.exports = new AdminHandlers();`;

  // Write the clean content
  fs.writeFileSync(adminHandlersPath, cleanContent, "utf8");

  console.log("✅ Rebuilt admin handlers with clean syntax");
  console.log("🔄 Restart your bot to see the changes");
} catch (error) {
  console.error("❌ Error rebuilding admin handlers:", error.message);
  process.exit(1);
}
