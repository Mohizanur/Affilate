const { Markup } = require("telegraf");
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
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );
      const stats = await adminService.getSystemStats();

      const message = `
🔧 *Admin Panel*

📊 System Overview:
• Total Users: ${stats.totalUsers}
• Total Companies: ${stats.totalCompanies}

📈 Today's Activity:
• New Users: ${stats.today.newUsers}

⚠️ Pending Actions:
• Pending Payouts: ${stats.pending.payouts}
• Support Tickets: ${stats.pending.tickets}
      `;

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
        [Markup.button.callback("⚙️ System Settings", "admin_settings")],
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
      ctx.reply(
        t("msg__failed_to_load_admin_panel", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAllUsersMenu(ctx, page = 1) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const users = await userService.getAllUsers();
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage) || 1;
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;

      let msg = `👥 *All Users (Page ${page}/${totalPages})*

`;
      msg += `📊 Total Users: ${users.length}

`;

      const buttons = [];
      users.slice(start, end).forEach((user, index) => {
        const username =
          user.username || user.firstName || user.first_name || "Unknown";
        const status = user.isBanned ? "🚫 Banned" : "✅ Active";
        msg += `${start + index + 1}. ${username}
`;
        msg += `   ID: ${user.telegramId || user.id}
`;
        msg += `   Status: ${status}
`;
        msg += `   Balance: $${(user.referralBalance || 0).toFixed(2)}

`;

        buttons.push([
          Markup.button.callback(
            `${username}`,
            `admin_user_${user.telegramId || user.id}`
          ),
        ]);
      });

      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `all_users_menu_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`)
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
      ctx.reply(
        t("msg__failed_to_load_users", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user)
        return ctx.reply(
          t("msg__user_not_found", {}, ctx.session?.language || "en")
        );

      let msg = `👤 *User Details*

`;
      msg += `📱 Name: ${user.firstName || user.first_name || "Unknown"} ${
        user.lastName || user.last_name || ""
      }
`;
      msg += `🆔 ID: ${user.telegramId || user.id}
`;
      msg += `👤 Username: @${user.username || "N/A"}
`;
      msg += `📞 Phone: ${user.phone_number || user.phone || "N/A"}
`;
      msg += `💰 Balance: $${(user.referralBalance || 0).toFixed(2)}
`;
      msg += `🎯 Role: ${user.role || "user"}
`;
      msg += `📅 Joined: ${
        toDateSafe(user.createdAt)
          ? toDateSafe(user.createdAt).toLocaleDateString()
          : "N/A"
      }
`;
      msg += `🏢 Can Register Company: ${
        user.canRegisterCompany ? "✅ Yes" : "❌ No"
      }
`;
      msg += `🚫 Banned: ${user.isBanned ? "✅ Yes" : "❌ No"}
`;

      const buttons = [
        [
          Markup.button.callback(
            user.isBanned ? "🔓 Unban User" : "🚫 Ban User",
            user.isBanned ? `unban_user_${userId}` : `ban_user_${userId}`
          ),
        ],
        [
          Markup.button.callback(
            user.canRegisterCompany ? "⬇️ Demote User" : "⬆️ Promote User",
            user.canRegisterCompany
              ? `demote_user_${userId}`
              : `promote_user_${userId}`
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
      ctx.reply(
        t("msg__failed_to_load_user_details", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      await userService.userService.updateUser(userId, { isBanned: true });
      ctx.reply(
        t("msg__user_banned_successfully", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply(
        t("msg__failed_to_ban_user", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      await userService.userService.updateUser(userId, { isBanned: false });
      ctx.reply(
        t("msg__user_unbanned_successfully", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply(
        t("msg__failed_to_unban_user", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePromoteUserId(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      await userService.userService.updateUser(userId, {
        role: "admin",
        canRegisterCompany: true,
      });
      ctx.reply(t("msg__user_promoted", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply(
        t("msg__failed_to_promote_user", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleDemoteUserId(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      await userService.userService.updateUser(userId, {
        role: "user",
        canRegisterCompany: false,
        isCompanyOwner: false,
        companyId: null,
      });
      ctx.reply(t("msg__user_demoted", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply(
        t("msg__failed_to_demote_user", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUserManagement(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      let msg = `👥 *User Management*

`;
      msg += `Manage all users on the platform.

`;
      msg += `Features:
`;
      msg += `• View all users`;
      msg += `• Search users`;
      msg += `• Ban/unban users`;
      msg += `• Promote/demote users`;
      msg += `• User analytics`;

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
      ctx.reply(
        t(
          "msg__failed_to_load_user_management",
          {},
          ctx.session?.language || "en"
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBannedUsers(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const users = await userService.getAllUsers();
      const bannedUsers = users.filter((u) => u.isBanned);

      let msg = `🚫 *Banned Users*

`;
      msg += `📊 Total Banned: ${bannedUsers.length}

`;

      if (bannedUsers.length === 0) {
        msg += "No banned users found.";
      } else {
        bannedUsers.slice(0, 10).forEach((user, index) => {
          const username =
            user.username || user.firstName || user.first_name || "Unknown";
          msg += `${index + 1}. ${username}
`;
          msg += `   ID: ${user.telegramId || user.id}

`;
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
      ctx.reply(
        t("msg__failed_to_load_banned_users", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUserAnalytics(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const users = await userService.getAllUsers();
      const totalUsers = users.length;
      const activeUsers = users.filter((u) => !u.isBanned).length;
      const bannedUsers = users.filter((u) => u.isBanned).length;
      const usersWithBalance = users.filter(
        (u) => (u.referralBalance || 0) > 0
      ).length;

      let msg = `📊 *User Analytics*

`;
      msg += `👥 Total Users: ${totalUsers}
`;
      msg += `✅ Active Users: ${activeUsers}
`;
      msg += `🚫 Banned Users: ${bannedUsers}
`;
      msg += `💰 Users with Balance: ${usersWithBalance}
`;

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
      ctx.reply(
        t(
          "msg__failed_to_load_user_analytics",
          {},
          ctx.session?.language || "en"
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAllUsersSearch(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      ctx.session.searchType = "user";
      ctx.session.waitingForSearch = true;

      ctx.reply(
        t(
          "msg__enter_user_id_username_or_phone_number_to_sea",
          {},
          ctx.session?.language || "en"
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting user search:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Company Management Methods
  async handleAdminListCompanies(ctx, page = 1) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const companies = await companyService.getAllCompanies();
      const perPage = 10;
      const totalPages = Math.ceil(companies.length / perPage) || 1;
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;

      let msg = `🏢 *All Companies (Page ${page}/${totalPages})*

`;
      msg += `📊 Total Companies: ${companies.length}

`;

      const buttons = [];
      for (const [index, company] of companies.slice(start, end).entries()) {
        // Accurate product count
        let productCount = 0;
        try {
          const products = await productService.getProductsByCompany(
            company.id
          );
          productCount = products.length;
        } catch (e) {
          productCount = 0;
        }

        // Get owner username
        let ownerUsername = "N/A";
        if (company.telegramId) {
          try {
            const owner = await userService.userService.getUserByTelegramId(
              company.telegramId
            );
            ownerUsername =
              owner?.username || owner?.firstName || `@${company.telegramId}`;
          } catch (e) {
            ownerUsername = `@${company.telegramId}`;
          }
        }

        const status = company.status || "active";
        const statusEmoji =
          status === "active" ? "✅" : status === "pending" ? "⏳" : "❌";
        msg += `${start + index + 1}. ${statusEmoji} *${company.name}*
`;
        msg += `   Owner: ${ownerUsername}
`;
        msg += `   Status: ${status}
`;
        msg += `   Products: ${productCount}

`;

        buttons.push([
          Markup.button.callback(
            `${company.name}`,
            `admin_company_${company.id}`
          ),
        ]);
      }

      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_companies_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_companies_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);

      buttons.push([
        Markup.button.callback("🔍 Search Companies", "admin_search_companies"),
        Markup.button.callback("📤 Export Companies", "admin_export_companies"),
      ]);
      buttons.push([Markup.button.callback("🔙 Back to Admin", "admin_panel")]);

      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in admin list companies:", error);
      ctx.reply(
        t("msg__failed_to_load_companies", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminCompanyDetail(ctx, companyId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const company = await companyService.getCompanyById(companyId);
      if (!company)
        return ctx.reply(
          t("msg__company_not_found", {}, ctx.session?.language || "en")
        );

      let msg = `🏢 *Company Details*

`;
      msg += `📝 Name: ${company.name}
`;
      msg += `🆔 ID: ${company.id}
`;
      msg += `👤 Owner ID: ${company.telegramId || "N/A"}
`;
      msg += `📧 Email: ${company.email || "N/A"}
`;
      msg += `📞 Phone: ${company.phone || "N/A"}
`;
      msg += `📋 Description: ${company.description || "N/A"}
`;
      msg += `💰 Balance: $${(company.billingBalance || 0).toFixed(2)}
`;
      msg += `📦 Products: ${company.products?.length || 0}
`;
      msg += `🎯 Status: ${company.status || "active"}
`;
      msg += `📅 Created: ${
        toDateSafe(company.createdAt)
          ? toDateSafe(company.createdAt).toLocaleDateString()
          : "N/A"
      }
`;

      const buttons = [
        [Markup.button.callback("🔙 Back to Companies", "admin_companies_1")],
      ];

      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing company detail:", error);
      ctx.reply(
        t(
          "msg__failed_to_load_company_details",
          {},
          ctx.session?.language || "en"
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyManagement(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      let msg = `🏢 *Company Management*

`;
      msg += `Manage all companies on the platform.

`;
      msg += `Features:
`;
      msg += `• View all companies
`;
      msg += `• Search companies
`;
      msg += `• Company analytics
`;
      msg += `• Company settings
`;
      msg += `• Product management
      `;

      const buttons = [
        [Markup.button.callback("🏢 All Companies", "admin_companies_1")],
        [
          Markup.button.callback(
            "🔍 Search Companies",
            "admin_search_companies"
          ),
        ],
        [
          Markup.button.callback(
            "📊 Company Analytics",
            "company_analytics_summary"
          ),
        ],
        [Markup.button.callback("➕ Add Company", "admin_add_company")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];

      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company management:", error);
      ctx.reply(
        t(
          "msg__failed_to_load_company_management",
          {},
          ctx.session?.language || "en"
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSearchCompany(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      ctx.session.searchType = "company";
      ctx.session.waitingForSearch = true;

      ctx.reply(
        t(
          "msg__enter_company_name_or_id_to_search",
          {},
          ctx.session?.language || "en"
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting company search:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalytics(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const companies = await companyService.getAllCompanies();
      const totalCompanies = companies.length;
      const activeCompanies = companies.filter(
        (c) => c.status === "active"
      ).length;
      const pendingCompanies = companies.filter(
        (c) => c.status === "pending"
      ).length;
      const totalProducts = companies.reduce(
        (sum, c) => sum + (c.products?.length || 0),
        0
      );

      let msg = `📊 *Company Analytics*

`;
      msg += `🏢 Total Companies: ${totalCompanies}
`;
      msg += `✅ Active Companies: ${activeCompanies}
`;
      msg += `⏳ Pending Companies: ${pendingCompanies}
`;
      msg += `📦 Total Products: ${totalProducts}
`;

      const buttons = [
        [Markup.button.callback("🔙 Back to Companies", "admin_companies_1")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];

      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics:", error);
      ctx.reply(
        t(
          "msg__failed_to_load_company_analytics",
          {},
          ctx.session?.language || "en"
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleOrderManagement(ctx) {
    ctx.reply("Not implemented: handleOrderManagement");
  }

  async handlePendingOrders(ctx) {
    ctx.reply("Not implemented: handlePendingOrders");
  }

  async handleApprovedOrders(ctx) {
    ctx.reply("Not implemented: handleApprovedOrders");
  }

  async handleRejectedOrders(ctx) {
    ctx.reply("Not implemented: handleRejectedOrders");
  }

  async handleAnalytics(ctx) {
    ctx.reply("Not implemented: handleAnalytics");
  }

  async handleSystemLogs(ctx) {
    ctx.reply("Not implemented: handleSystemLogs");
  }

  async handleManageWithdrawals(ctx) {
    ctx.reply("Not implemented: handleManageWithdrawals");
  }

  async handleAdminListUsers(ctx, page = 1) {
    return this.handleAllUsersMenu(ctx, page);
  }

  async handleErrorLogs(ctx) {
    ctx.reply("Not implemented: handleErrorLogs");
  }

  async handleWarningLogs(ctx) {
    ctx.reply("Not implemented: handleWarningLogs");
  }

  async handleExportLogs(ctx) {
    ctx.reply("Not implemented: handleExportLogs");
  }

  async handleClearLogs(ctx) {
    ctx.reply("Not implemented: handleClearLogs");
  }

  async handlePromotedUsers(ctx) {
    ctx.reply("Not implemented: handlePromotedUsers");
  }

  async handleUnbanUserCallback(ctx) {
    ctx.reply("Not implemented: handleUnbanUserCallback");
  }

  async handleBanUserCallback(ctx) {
    ctx.reply("Not implemented: handleBanUserCallback");
  }

  async handleCompanyAnalyticsCallback(ctx) {
    ctx.reply("Not implemented: handleCompanyAnalyticsCallback");
  }

  async handleCompanySettingsCallback(ctx) {
    ctx.reply("Not implemented: handleCompanySettingsCallback");
  }

  async handleApprovePayoutCallback(ctx) {
    ctx.reply("Not implemented: handleApprovePayoutCallback");
  }

  async handleRejectPayoutCallback(ctx) {
    ctx.reply("Not implemented: handleRejectPayoutCallback");
  }

  async handleApproveProductCallback(ctx, productId) {
    ctx.reply("Not implemented: handleApproveProductCallback");
  }

  async handleRejectProductCallback(ctx, productId) {
    ctx.reply("Not implemented: handleRejectProductCallback");
  }

  async handlePromoteCompany(ctx, userId) {
    ctx.reply("Not implemented: handlePromoteCompany");
  }

  async handleDemoteCompany(ctx, userId) {
    ctx.reply("Not implemented: handleDemoteCompany");
  }

  async handleAllCompaniesSearch(ctx) {
    ctx.reply("Not implemented: handleAllCompaniesSearch");
  }

  async handlePromoteUserMenu(ctx, page = 1, search = "") {
    ctx.reply("Not implemented: handlePromoteUserMenu");
  }

  async handlePromoteUserSearch(ctx) {
    ctx.reply("Not implemented: handlePromoteUserSearch");
  }

  async handlePromoteUserSearchInput(ctx, messageText) {
    ctx.reply("Not implemented: handlePromoteUserSearchInput");
  }

  async handleSearchQuery(ctx) {
    ctx.reply("Not implemented: handleSearchQuery");
  }

  async handleSearchUser(ctx) {
    ctx.reply("Not implemented: handleSearchUser");
  }

  async handleSystemSettings(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );
      // Example settings, replace with real fetch if available
      const settings = {
        platformFee: 5,
        referralBonus: 2,
        buyerBonus: 1,
        language: "en",
        maintenance: false,
      };
      let msg = `⚙️ *System Settings*\n\n`;
      msg += `• Platform Fee: ${settings.platformFee}%\n`;
      msg += `• Referral Bonus: ${settings.referralBonus}%\n`;
      msg += `• Buyer Bonus: ${settings.buyerBonus}%\n`;
      msg += `• Language: ${settings.language}\n`;
      msg += `• Maintenance Mode: ${settings.maintenance ? "ON" : "OFF"}\n`;
      const buttons = [
        [Markup.button.callback("Edit Platform Fee", "edit_platform_fee")],
        [Markup.button.callback("Edit Referral Bonus", "edit_referral_bonus")],
        [Markup.button.callback("Edit Buyer Bonus", "edit_buyer_bonus")],
        [Markup.button.callback("Toggle Maintenance", "toggle_maintenance")],
      ];
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in system settings:", error);
      ctx.reply("❌ Failed to load system settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditPlatformFee(ctx) {
    ctx.reply("Not implemented: handleEditPlatformFee");
  }

  async handleEditReferralBonus(ctx) {
    ctx.reply("Not implemented: handleEditReferralBonus");
  }

  async handleEditBuyerBonus(ctx) {
    ctx.reply("Not implemented: handleEditBuyerBonus");
  }

  async handleUpdateSetting(ctx) {
    ctx.reply("Not implemented: handleUpdateSetting");
  }

  async handleSetPlatformFee(ctx) {
    ctx.reply("Not implemented: handleSetPlatformFee");
  }

  async handlePlatformFeeInput(ctx) {
    ctx.reply("Not implemented: handlePlatformFeeInput");
  }

  async handlePlatformAnalyticsDashboard(ctx, page = 1) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );
      const analytics = await adminService.getAnalytics();
      const dashboard = await adminService.getDashboardData();
      let msg = `📊 *Platform Analytics*

`;
      msg += `👥 *Users:* ${analytics.users.total}\n`;
      msg += `🏢 *Companies:* ${analytics.companies.total}\n`;
      msg += `📦 *Orders:* ${analytics.orders.total}\n`;
      msg += `💰 *Revenue:* $${analytics.revenue.total?.toFixed(2) || 0}\n`;
      msg += `📈 *Active Users (7d):* ${analytics.users.active}\n`;
      msg += `⭐ *Referrers:* ${analytics.users.referrers}\n`;
      msg += `\n*Recent Users:*\n`;
      dashboard.recentUsers?.forEach((u) => {
        msg += `• ${u.username || u.first_name || u.id} (${u.id})\n`;
      });
      msg += `\n*System Alerts:*\n`;
      dashboard.systemAlerts?.forEach((a) => {
        msg += `• [${a.priority}] ${a.message}\n`;
      });
      ctx.reply(msg, { parse_mode: "Markdown" });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in platform analytics dashboard:", error);
      ctx.reply("❌ Failed to load analytics.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    ctx.reply("Not implemented: handleMaintenanceMode");
  }

  async handleToggleMaintenance(ctx) {
    ctx.reply("Not implemented: handleToggleMaintenance");
  }

  async handleExportData(ctx) {
    ctx.reply("Not implemented: handleExportData");
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const companies = await companyService.getAllCompanies();
      const totalCompanies = companies.length;
      const activeCompanies = companies.filter(
        (c) => c.status === "active"
      ).length;
      const pendingCompanies = companies.filter(
        (c) => c.status === "pending"
      ).length;

      // Accurate total products count
      let totalProducts = 0;
      for (const company of companies) {
        try {
          const products = await productService.getProductsByCompany(
            company.id
          );
          totalProducts += products.length;
        } catch (e) {
          // Continue if error
        }
      }

      const totalBalance = companies.reduce(
        (sum, c) => sum + (c.billingBalance || 0),
        0
      );

      let msg = `📊 *Company Analytics Summary*

`;
      msg += `🏢 Total Companies: ${totalCompanies}
`;
      msg += `✅ Active Companies: ${activeCompanies}
`;
      msg += `⏳ Pending Companies: ${pendingCompanies}
`;
      msg += `📦 Total Products: ${totalProducts}
`;
      msg += `💰 Total Balance: $${totalBalance.toFixed(2)}
`;

      const buttons = [
        [Markup.button.callback("🔙 Back to Companies", "admin_companies_1")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];

      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply(
        t(
          "msg__failed_to_load_company_analytics",
          {},
          ctx.session?.language || "en"
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      ctx.reply("📊 Generating PDF backup...");

      const users = await userService.getAllUsers();
      const companies = await companyService.getAllCompanies();

      // Create PDF
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument();
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);

          // Send PDF as document
          await ctx.replyWithDocument({
            source: pdfBuffer,
            filename: `backup_${new Date().toISOString().split("T")[0]}.pdf`,
            caption: `📊 System Backup Report\n\n📅 Generated: ${new Date().toLocaleString()}\n👥 Users: ${
              users.length
            }\n🏢 Companies: ${companies.length}`,
          });

          if (ctx.callbackQuery) ctx.answerCbQuery();
        } catch (error) {
          logger.error("Error sending PDF:", error);
          ctx.reply("❌ Failed to send PDF backup.");
          if (ctx.callbackQuery) ctx.answerCbQuery();
        }
      });

      // Add content to PDF
      doc.fontSize(20).text("System Backup Report", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown(2);

      // Users section
      doc.fontSize(16).text("Users", { underline: true });
      doc.moveDown();
      if (users.length === 0) {
        doc.fontSize(10).text("No users found.");
      } else {
        users.forEach((user, index) => {
          doc
            .fontSize(10)
            .text(
              `${index + 1}. ${user.firstName || "N/A"} ${
                user.lastName || "N/A"
              }`
            );
          doc
            .fontSize(8)
            .text(
              `   ID: ${user.id} | Phone: ${user.phone || "N/A"} | Balance: ${
                user.coinBalance || 0
              }`
            );
          doc
            .fontSize(8)
            .text(
              `   Role: ${user.role || "user"} | Created: ${
                user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "N/A"
              }`
            );
          doc.moveDown(0.5);
        });
      }

      doc.moveDown(2);

      // Companies section
      doc.fontSize(16).text("Companies", { underline: true });
      doc.moveDown();
      if (companies.length === 0) {
        doc.fontSize(10).text("No companies found.");
      } else {
        companies.forEach((company, index) => {
          doc.fontSize(10).text(`${index + 1}. ${company.name || "N/A"}`);
          doc
            .fontSize(8)
            .text(
              `   ID: ${company.id} | Email: ${
                company.email || "N/A"
              } | Website: ${company.website || "N/A"}`
            );
          doc
            .fontSize(8)
            .text(`   Description: ${company.description || "N/A"}`);
          doc
            .fontSize(8)
            .text(
              `   Created: ${
                company.createdAt
                  ? new Date(company.createdAt).toLocaleDateString()
                  : "N/A"
              }`
            );
          doc.moveDown(0.5);
        });
      }

      // Add summary
      doc.moveDown(2);
      doc.fontSize(14).text("Summary", { underline: true });
      doc.moveDown();
      doc.fontSize(10).text(`Total Users: ${users.length}`);
      doc.fontSize(10).text(`Total Companies: ${companies.length}`);
      doc.fontSize(10).text(`Backup Date: ${new Date().toLocaleString()}`);

      doc.end();
    } catch (error) {
      logger.error("Error in backup system:", error);
      ctx.reply("❌ Failed to export data.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyApproveWithdrawal(ctx, withdrawalId) {
    ctx.reply("Not implemented: handleCompanyApproveWithdrawal");
  }

  async handleCompanyDenyWithdrawal(ctx, withdrawalId) {
    ctx.reply("Not implemented: handleCompanyDenyWithdrawal");
  }

  async handleAdminFinalizeWithdrawal(ctx, withdrawalId) {
    ctx.reply("Not implemented: handleAdminFinalizeWithdrawal");
  }

  async handleExportUsers(ctx) {
    ctx.reply("Not implemented: handleExportUsers");
  }

  async handleExportCompanies(ctx) {
    ctx.reply("Not implemented: handleExportCompanies");
  }

  async handleAdminRequestWithdrawal(ctx, companyId) {
    ctx.reply("Not implemented: handleAdminRequestWithdrawal");
  }

  async handleAdminConfirmWithdrawal(ctx, companyId) {
    ctx.reply("Not implemented: handleAdminConfirmWithdrawal");
  }

  async handleBroadcast(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const buttons = [
        [Markup.button.callback("📝 Text Message", "broadcast_text")],
        [Markup.button.callback("🖼️ Photo", "broadcast_photo")],
        [Markup.button.callback("📹 Video", "broadcast_video")],
        [Markup.button.callback("📄 Document", "broadcast_document")],
        [Markup.button.callback("🔙 Back", "admin_panel")],
      ];

      ctx.reply(
        "📢 *Broadcast Message*\n\nSelect the type of message to send:",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in broadcast:", error);
      ctx.reply("❌ Failed to start broadcast.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBroadcastType(ctx) {
    try {
      const callbackData = ctx.callbackQuery?.data;
      if (!callbackData) return;

      const type = callbackData.replace("broadcast_", "");
      ctx.session.broadcastType = type;
      ctx.session.broadcastStep = "awaiting_content";

      let message = "";
      switch (type) {
        case "text":
          message = "📝 Enter the text message to broadcast:";
          break;
        case "photo":
          message = "🖼️ Send the photo to broadcast (with optional caption):";
          break;
        case "video":
          message = "📹 Send the video to broadcast (with optional caption):";
          break;
        case "document":
          message =
            "📄 Send the document to broadcast (with optional caption):";
          break;
        default:
          message = "❌ Invalid broadcast type.";
      }

      const buttons = [[Markup.button.callback("🔙 Back", "admin_broadcast")]];

      ctx.reply(message, {
        ...Markup.inlineKeyboard(buttons),
      });
      ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in broadcast type selection:", error);
      ctx.reply("❌ Failed to set broadcast type.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBroadcastMessage(ctx, messageText) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      if (!messageText || messageText.trim().length === 0) {
        return ctx.reply("❌ Message cannot be empty. Please try again.");
      }

      ctx.session.broadcastMessage = messageText;
      ctx.session.broadcastStep = "confirm";

      const buttons = [
        [Markup.button.callback("✅ Send Broadcast", "confirm_broadcast")],
        [Markup.button.callback("❌ Cancel", "admin_broadcast")],
      ];

      ctx.reply(
        `📢 *Broadcast Preview:*\n\n${messageText}\n\nSend this message to all users?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error("Error in broadcast message:", error);
      ctx.reply("❌ Failed to process broadcast message.");
    }
  }

  async handleBroadcastMedia(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const type = ctx.session.broadcastType;
      let mediaData = {};

      switch (type) {
        case "photo":
          if (!ctx.message?.photo) {
            return ctx.reply("❌ Please send a photo.");
          }
          mediaData = {
            type: "photo",
            fileId: ctx.message.photo[ctx.message.photo.length - 1].file_id,
            caption: ctx.message.caption || "",
          };
          break;
        case "video":
          if (!ctx.message?.video) {
            return ctx.reply("❌ Please send a video.");
          }
          mediaData = {
            type: "video",
            fileId: ctx.message.video.file_id,
            caption: ctx.message.caption || "",
          };
          break;
        case "document":
          if (!ctx.message?.document) {
            return ctx.reply("❌ Please send a document.");
          }
          mediaData = {
            type: "document",
            fileId: ctx.message.document.file_id,
            caption: ctx.message.caption || "",
          };
          break;
        default:
          return ctx.reply("❌ Invalid media type.");
      }

      ctx.session.broadcastMedia = mediaData;
      ctx.session.broadcastStep = "confirm";

      const buttons = [
        [Markup.button.callback("✅ Send Broadcast", "confirm_broadcast")],
        [Markup.button.callback("❌ Cancel", "admin_broadcast")],
      ];

      const previewText = mediaData.caption
        ? `\n\nCaption: ${mediaData.caption}`
        : "";
      ctx.reply(
        `📢 *Broadcast Preview:*\n\nType: ${type.toUpperCase()}${previewText}\n\nSend this ${type} to all users?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error("Error in broadcast media:", error);
      ctx.reply("❌ Failed to process broadcast media.");
    }
  }

  async handleConfirmBroadcast(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const type = ctx.session.broadcastType;
      const { getBot } = require("../index");
      const bot = getBot();

      // Get all users
      const usersSnap = await require("../config/database").users().get();
      let sent = 0,
        failed = 0,
        total = 0;
      const failedUsers = [];

      ctx.reply("📤 Starting broadcast...");

      for (const doc of usersSnap.docs) {
        const user = doc.data();
        if (!user.telegramId) continue;
        total++;

        try {
          switch (type) {
            case "text":
              await bot.telegram.sendMessage(
                user.telegramId,
                ctx.session.broadcastMessage
              );
              break;
            case "photo":
              await bot.telegram.sendPhoto(
                user.telegramId,
                ctx.session.broadcastMedia.fileId,
                {
                  caption: ctx.session.broadcastMedia.caption || undefined,
                }
              );
              break;
            case "video":
              await bot.telegram.sendVideo(
                user.telegramId,
                ctx.session.broadcastMedia.fileId,
                {
                  caption: ctx.session.broadcastMedia.caption || undefined,
                }
              );
              break;
            case "document":
              await bot.telegram.sendDocument(
                user.telegramId,
                ctx.session.broadcastMedia.fileId,
                {
                  caption: ctx.session.broadcastMedia.caption || undefined,
                }
              );
              break;
          }
          sent++;
        } catch (err) {
          failed++;
          failedUsers.push(user.telegramId);
          console.error(
            `Broadcast failed for user ${user.telegramId}:`,
            err.message
          );
        }

        // Small delay to avoid Telegram rate limits
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Clear session
      delete ctx.session.broadcastType;
      delete ctx.session.broadcastStep;
      delete ctx.session.broadcastMessage;
      delete ctx.session.broadcastMedia;

      const resultMessage = `📢 *Broadcast Complete*\n\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n📊 Total: ${total}`;

      if (failedUsers.length > 0) {
        resultMessage += `\n\nFailed users: ${failedUsers
          .slice(0, 10)
          .join(", ")}${failedUsers.length > 10 ? "..." : ""}`;
      }

      const buttons = [
        [Markup.button.callback("🔙 Back to Admin Panel", "admin_panel")],
      ];

      ctx.reply(resultMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in confirm broadcast:", error);
      ctx.reply("❌ Failed to send broadcast.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePayoutManagement(ctx) {
    ctx.reply("Not implemented: handlePayoutManagement");
  }

  async handlePendingPayouts(ctx) {
    ctx.reply("Not implemented: handlePendingPayouts");
  }

  async handleApprovePayout(ctx, payoutId) {
    ctx.reply("Not implemented: handleApprovePayout");
  }

  async handleRejectPayout(ctx, payoutId) {
    ctx.reply("Not implemented: handleRejectPayout");
  }

  async handleAdminAddCompany(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      ctx.session.addingCompany = true;
      ctx.session.companyData = {};

      ctx.reply(
        t("msg__enter_company_name", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting company addition:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminAddCompanyStep(ctx) {
    ctx.reply("Not implemented: handleAdminAddCompanyStep");
  }

  async handleAdminRemoveCompany(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      ctx.session.removingCompany = true;

      ctx.reply(
        t("msg__enter_company_id_to_remove", {}, ctx.session?.language || "en")
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting company removal:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminRemoveCompanyStep(ctx) {
    ctx.reply("Not implemented: handleAdminRemoveCompanyStep");
  }
}

module.exports = new AdminHandlers();
