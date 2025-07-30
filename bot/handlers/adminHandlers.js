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

// Helper function to escape Markdown characters
function escapeMarkdown(text) {
  if (!text) return text;
  // Convert to string to handle numbers, null, undefined, etc.
  const textStr = String(text);
  return textStr
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`")
    .replace(/>/g, "\\>")
    .replace(/#/g, "\\#")
    .replace(/\+/g, "\\+")
    .replace(/-/g, "\\-")
    .replace(/=/g, "\\=")
    .replace(/\|/g, "\\|")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\./g, "\\.")
    .replace(/!/g, "\\!");
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
      msg += `📱 Name: ${escapeMarkdown(
        user.firstName || user.first_name || "Unknown"
      )} ${escapeMarkdown(user.lastName || user.last_name || "")}
`;
      msg += `🆔 ID: ${escapeMarkdown(user.telegramId || user.id)}
`;
      msg += `👤 Username: @${escapeMarkdown(user.username || "N/A")}
`;
      msg += `📞 Phone: ${escapeMarkdown(
        user.phone_number || user.phone || "N/A"
      )}
`;
      msg += `💰 Balance: $${(user.referralBalance || 0).toFixed(2)}
`;
      msg += `🎯 Role: ${escapeMarkdown(user.role || "user")}
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
            user.role === "admin"
              ? "⬇️ Demote from Admin"
              : "⬆️ Promote to Admin",
            user.role === "admin"
              ? `demote_user_${userId}`
              : `promote_user_${userId}`
          ),
        ],
        [
          Markup.button.callback(
            user.role === "company_manager"
              ? "⬇️ Remove Company Manager"
              : "🏢 Make Company Manager",
            user.role === "company_manager"
              ? `demote_company_manager_${userId}`
              : `promote_company_manager_${userId}`
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
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) {
        return ctx.reply("❌ User not found");
      }

      await userService.userService.updateUser(userId, {
        role: "admin",
        isAdmin: true,
        promotedAt: new Date(),
      });

      ctx.reply(
        `✅ User ${
          user.firstName || user.first_name || userId
        } promoted to Admin`
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user");
    }
  }

  async handlePromoteToCompanyManager(ctx, userId) {
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) {
        return ctx.reply("❌ User not found");
      }

      await userService.userService.updateUser(userId, {
        role: "company_manager",
        canRegisterCompany: true,
        canAddProducts: true,
        promotedAt: new Date(),
      });

      ctx.reply(
        `✅ User ${
          user.firstName || user.first_name || userId
        } promoted to Company Manager`
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error promoting user to company manager:", error);
      ctx.reply("❌ Failed to promote user");
    }
  }

  async handleDemoteFromCompanyManager(ctx, userId) {
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) {
        return ctx.reply("❌ User not found");
      }

      await userService.userService.updateUser(userId, {
        role: "user",
        canRegisterCompany: false,
        canAddProducts: false,
        demotedAt: new Date(),
      });

      ctx.reply(
        `✅ User ${
          user.firstName || user.first_name || userId
        } demoted from Company Manager`
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error demoting company manager:", error);
      ctx.reply("❌ Failed to demote user");
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
      const verifiedUsers = users.filter((u) => u.phoneVerified).length;
      const adminUsers = users.filter((u) => u.role === "admin").length;

      // Create beautiful header with emojis and formatting
      let msg = `👥 *USER ANALYTICS DASHBOARD*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Key Metrics Section with attractive formatting
      msg += `📊 *KEY METRICS*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `👥 Total Users: *${totalUsers.toLocaleString()}*\n`;
      msg += `✅ Active Users: *${activeUsers.toLocaleString()}*\n`;
      msg += `🚫 Banned Users: *${bannedUsers.toLocaleString()}*\n`;
      msg += `💰 Users with Balance: *${usersWithBalance.toLocaleString()}*\n`;
      msg += `📱 Verified Users: *${verifiedUsers.toLocaleString()}*\n`;
      msg += `👑 Admin Users: *${adminUsers.toLocaleString()}*\n\n`;

      // User Status Breakdown
      const unverifiedUsers = totalUsers - verifiedUsers;
      msg += `📈 *USER STATUS BREAKDOWN*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `✅ Active: *${activeUsers}* (${
        totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0
      }%)\n`;
      msg += `🚫 Banned: *${bannedUsers}* (${
        totalUsers > 0 ? ((bannedUsers / totalUsers) * 100).toFixed(1) : 0
      }%)\n`;
      msg += `📱 Verified: *${verifiedUsers}* (${
        totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : 0
      }%)\n`;
      msg += `❓ Unverified: *${unverifiedUsers}* (${
        totalUsers > 0 ? ((unverifiedUsers / totalUsers) * 100).toFixed(1) : 0
      }%)\n\n`;

      // Top Users by Balance (if any)
      if (users.length > 0) {
        const topUsers = users
          .filter((u) => u.referralBalance && u.referralBalance > 0)
          .sort((a, b) => (b.referralBalance || 0) - (a.referralBalance || 0))
          .slice(0, 3);

        if (topUsers.length > 0) {
          msg += `🏆 *TOP USERS BY BALANCE*\n`;
          msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          topUsers.forEach((user, index) => {
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
            const username = user.username || user.firstName || user.telegramId;
            msg += `${medal} *${username}*\n`;
            msg += `   💰 Balance: *$${(
              user.referralBalance || 0
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}*\n`;
            msg += `   📊 Status: *${user.isBanned ? "Banned" : "Active"}*\n\n`;
          });
        }
      }

      const buttons = [
        [Markup.button.callback("🔙 Back to Users", "admin_users")],
        [
          Markup.button.callback(
            "📊 Platform Analytics",
            "platform_analytics_dashboard"
          ),
        ],
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

      // Get company analytics
      const companyAnalytics = await adminService.getCompanyAnalytics();
      const companyAnalytic = companyAnalytics.find((c) => c.id === companyId);

      let msg = `🏢 *Company Details*

`;
      msg += `📝 Name: ${company.name}
`;
      msg += `🆔 ID: ${company.id}
`;
      msg += `👤 Owner: ${
        companyAnalytic?.ownerUsername || company.telegramId || "N/A"
      }
`;
      msg += `📧 Email: ${company.email || "N/A"}
`;
      msg += `📞 Phone: ${company.phone || "N/A"}
`;
      msg += `📋 Description: ${company.description || "N/A"}
`;
      msg += `💰 Platform Fees: $${(company.billingBalance || 0).toFixed(2)}
`;
      msg += `💳 Withdrawable: $${(company.billingBalance || 0).toFixed(2)}
`;
      msg += `📈 Lifetime Revenue: $${(company.billingBalance || 0).toFixed(2)}
`;
      msg += `📦 Products: ${companyAnalytic?.productCount || 0}
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

      // Add withdrawal button if company has withdrawable amount
      if (company.billingBalance && company.billingBalance > 0) {
        buttons.unshift([
          Markup.button.callback(
            `💳 Withdraw $${company.billingBalance.toFixed(2)}`,
            `admin_withdraw_company_${companyId}`
          ),
        ]);
      }

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

      // Get real settings from database
      const settings = await adminService.getPlatformSettings();

      let msg = `⚙️ *System Settings*\n\n`;
      msg += `• Platform Fee: ${settings.platformFeePercent || 1.5}%\n`;
      msg += `• Referral Bonus: ${
        settings.referralCommissionPercent || 2.5
      }%\n`;
      msg += `• Buyer Bonus: ${settings.referralDiscountPercent || 1}%\n`;
      msg += `• Min Withdrawal: $${settings.minWithdrawalAmount || 10}\n`;
      msg += `• Maintenance Mode: ${settings.maintenanceMode ? "ON" : "OFF"}\n`;

      const buttons = [
        [Markup.button.callback("Edit Platform Fee", "edit_platform_fee")],
        [Markup.button.callback("Edit Referral Bonus", "edit_referral_bonus")],
        [Markup.button.callback("Edit Buyer Bonus", "edit_buyer_bonus")],
        [Markup.button.callback("Toggle Maintenance", "toggle_maintenance")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
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
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      ctx.session.editSetting = "platformFeePercent";
      ctx.session.state = "awaiting_platform_fee";

      ctx.reply(
        "💰 *Edit Platform Fee*\n\nPlease enter the new platform fee percentage (e.g., 2.5):",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
          ]),
        }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in edit platform fee:", error);
      ctx.reply("❌ Failed to edit platform fee.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditReferralBonus(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      ctx.session.editSetting = "referralCommissionPercent";
      ctx.session.state = "awaiting_referral_bonus";

      ctx.reply(
        "🎁 *Edit Referral Bonus*\n\nPlease enter the new referral bonus percentage (e.g., 2.5):",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
          ]),
        }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in edit referral bonus:", error);
      ctx.reply("❌ Failed to edit referral bonus.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditBuyerBonus(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      ctx.session.editSetting = "referralDiscountPercent";
      ctx.session.state = "awaiting_buyer_bonus";

      ctx.reply(
        "💸 *Edit Buyer Bonus*\n\nPlease enter the new buyer bonus percentage (e.g., 1.0):",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
          ]),
        }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in edit buyer bonus:", error);
      ctx.reply("❌ Failed to edit buyer bonus.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUpdateSetting(ctx, messageText) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const { editSetting, state } = ctx.session;
      const text = messageText || ctx.message?.text;

      if (!editSetting || !state || !text) {
        return ctx.reply("❌ Invalid setting update request.");
      }

      const value = parseFloat(text);
      if (isNaN(value) || value < 0 || value > 100) {
        return ctx.reply(
          "❌ Please enter a valid percentage between 0 and 100."
        );
      }

      // Update the setting in database
      const success = await adminService.setPlatformSetting(editSetting, value);

      if (success) {
        ctx.reply(`✅ Successfully updated ${editSetting} to ${value}%`);
        // Clear session state
        delete ctx.session.editSetting;
        delete ctx.session.state;
        // Return to settings menu
        return this.handleSystemSettings(ctx);
      } else {
        ctx.reply("❌ Failed to update setting. Please try again.");
      }
    } catch (error) {
      logger.error("Error updating setting:", error);
      ctx.reply("❌ Failed to update setting.");
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      // Get current maintenance mode
      const settings = await adminService.getPlatformSettings();
      const currentMode = settings.maintenanceMode || false;
      const newMode = !currentMode;

      // Update maintenance mode
      const success = await adminService.setPlatformSetting(
        "maintenanceMode",
        newMode
      );

      if (success) {
        ctx.reply(
          `✅ Maintenance mode ${
            newMode ? "enabled" : "disabled"
          } successfully.`,
          {
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
            ]),
          }
        );
      } else {
        ctx.reply("❌ Failed to toggle maintenance mode.");
      }

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePlatformAnalyticsDashboard(ctx, page = 1) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const ITEMS_PER_PAGE = 3;
      const dashboard = await adminService.getDashboardData();
      const { platformStats, companyAnalytics, recentUsers, systemAlerts } =
        dashboard;

      // Calculate total lifetime withdrawn
      const totalLifetimeWithdrawn =
        await adminService.calculateTotalLifetimeWithdrawn();

      // Create beautiful header with emojis and formatting
      let msg = `🎯 *PLATFORM ANALYTICS DASHBOARD*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Key Metrics Section with attractive formatting
      msg += `📊 *KEY METRICS*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `👥 Total Users: *${dashboard.quickStats.totalUsers.toLocaleString()}*\n`;
      msg += `🏢 Total Companies: *${dashboard.quickStats.totalCompanies.toLocaleString()}*\n`;
      msg += `💰 Platform Fees: *$${platformStats.totalPlatformFees.toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}*\n`;
      msg += `💳 Withdrawable: *$${platformStats.totalWithdrawable.toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}*\n`;
      msg += `📈 Lifetime Revenue: *$${platformStats.totalLifetimeRevenue.toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}*\n`;
      msg += `💸 Lifetime Withdrawn: *$${totalLifetimeWithdrawn.toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}*\n\n`;

      // Company Analytics Section with pagination
      if (companyAnalytics && companyAnalytics.length > 0) {
        const totalPages = Math.ceil(companyAnalytics.length / ITEMS_PER_PAGE);
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageCompanies = companyAnalytics.slice(startIndex, endIndex);

        // Sort companies by withdrawable amount (highest first)
        const sortedCompanies = pageCompanies.sort(
          (a, b) => b.withdrawable - a.withdrawable
        );

        msg += `🏢 *COMPANY ANALYTICS* (Page ${page}/${totalPages})\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📄 Showing ${startIndex + 1}-${Math.min(
          endIndex,
          companyAnalytics.length
        )} of ${companyAnalytics.length} companies\n\n`;

        sortedCompanies.forEach((company, index) => {
          const statusEmoji =
            company.status === "active"
              ? "✅"
              : company.status === "pending"
              ? "⏳"
              : "❌";
          const withdrawableEmoji = company.hasWithdrawable ? "💰" : "💸";

          msg += `${statusEmoji} *${company.name}*\n`;
          msg += `   ${withdrawableEmoji} Withdrawable: *$${company.withdrawable.toLocaleString(
            undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}*\n`;
          msg += `   💰 Platform Fees: *$${company.platformFees.toLocaleString(
            undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}*\n`;
          msg += `   📈 Lifetime Revenue: *$${company.lifetimeRevenue.toLocaleString(
            undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}*\n`;
          msg += `   📦 Products: *${company.productCount}*\n`;
          msg += `   👤 Owner: *${company.ownerUsername || "N/A"}*\n\n`;
        });

        // Simplified pagination buttons
        const paginationRows = [];

        // Simple pagination row - use basic button structure
        const mainPaginationRow = [];

        // Previous button
        if (page > 1) {
          mainPaginationRow.push(
            Markup.button.callback(
              "Previous",
              `platform_analytics_dashboard_${page - 1}`
            )
          );
        }

        // Next button
        if (page < totalPages) {
          mainPaginationRow.push(
            Markup.button.callback(
              "Next",
              `platform_analytics_dashboard_${page + 1}`
            )
          );
        }

        if (mainPaginationRow.length > 0) {
          paginationRows.push(mainPaginationRow);
        }

        // Debug logging
        console.log(
          `Pagination Debug: page=${page}, totalPages=${totalPages}, companies=${companyAnalytics.length}`
        );

        // Action buttons
        const actionButtons = [
          [Markup.button.callback("🏢 Company Details", "admin_companies_1")],
          [Markup.button.callback("💰 Withdrawals", "admin_withdrawals")],
          [Markup.button.callback("📊 User Analytics", "user_analytics")],
          [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
        ];

        // Add pagination rows if they have buttons
        console.log(`paginationRows length: ${paginationRows.length}`);
        console.log(
          `actionButtons before adding pagination: ${actionButtons.length} rows`
        );

        if (paginationRows.length > 0) {
          // Try adding pagination as first row
          actionButtons.unshift(...paginationRows);
          console.log(
            `Added pagination rows to actionButtons. New length: ${actionButtons.length} rows`
          );
        } else if (totalPages > 1) {
          // Fallback: if no pagination buttons were created but we have multiple pages,
          // create a simple navigation row
          console.log("Fallback: Creating simple pagination buttons");
          const fallbackRow = [];
          if (page > 1) {
            fallbackRow.push(
              Markup.button.callback(
                "Previous",
                `platform_analytics_dashboard_${page - 1}`
              )
            );
          }
          if (page < totalPages) {
            fallbackRow.push(
              Markup.button.callback(
                "Next",
                `platform_analytics_dashboard_${page + 1}`
              )
            );
          }
          if (fallbackRow.length > 0) {
            actionButtons.unshift(fallbackRow);
          }
        }

        console.log(
          `Final actionButtons structure:`,
          actionButtons.map((row) => row.map((btn) => btn.text))
        );

        // Try sending with different approach
        try {
          console.log(
            `Sending message with ${actionButtons.length} button rows`
          );

          // Create keyboard manually to ensure proper structure
          const keyboard = {
            inline_keyboard: actionButtons.map((row) =>
              row.map((btn) => ({
                text: btn.text,
                callback_data: btn.callback_data,
              }))
            ),
          };

          console.log(`Keyboard structure:`, JSON.stringify(keyboard, null, 2));

          await ctx.reply(msg, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
          console.log(`Message sent successfully`);
        } catch (error) {
          console.error(`Error sending message:`, error);
          // Fallback: send without buttons
          await ctx.reply(msg, { parse_mode: "Markdown" });
        }
      } else {
        // No companies case
        msg += `🏢 *COMPANY ANALYTICS*\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📭 No companies found\n\n`;

        const buttons = [
          [Markup.button.callback("🏢 Company Details", "admin_companies_1")],
          [Markup.button.callback("💰 Withdrawals", "admin_withdrawals")],
          [Markup.button.callback("📊 User Analytics", "user_analytics")],
          [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
        ];

        ctx.reply(msg, {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard(buttons),
        });
      }

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in platform analytics dashboard:", error);
      ctx.reply("❌ Failed to load analytics.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
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

      // Create beautiful header with emojis and formatting
      let msg = `🏢 *COMPANY ANALYTICS SUMMARY*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Key Metrics Section with attractive formatting
      msg += `📊 *KEY METRICS*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🏢 Total Companies: *${totalCompanies.toLocaleString()}*\n`;
      msg += `✅ Active Companies: *${activeCompanies.toLocaleString()}*\n`;
      msg += `⏳ Pending Companies: *${pendingCompanies.toLocaleString()}*\n`;
      msg += `📦 Total Products: *${totalProducts.toLocaleString()}*\n`;
      msg += `💰 Total Balance: *$${totalBalance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}*\n\n`;

      // Company Status Breakdown
      const inactiveCompanies =
        totalCompanies - activeCompanies - pendingCompanies;
      msg += `📈 *STATUS BREAKDOWN*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `✅ Active: *${activeCompanies}* (${
        totalCompanies > 0
          ? ((activeCompanies / totalCompanies) * 100).toFixed(1)
          : 0
      }%)\n`;
      msg += `⏳ Pending: *${pendingCompanies}* (${
        totalCompanies > 0
          ? ((pendingCompanies / totalCompanies) * 100).toFixed(1)
          : 0
      }%)\n`;
      msg += `❌ Inactive: *${inactiveCompanies}* (${
        totalCompanies > 0
          ? ((inactiveCompanies / totalCompanies) * 100).toFixed(1)
          : 0
      }%)\n\n`;

      // Top Companies by Balance (if any)
      if (companies.length > 0) {
        const topCompanies = companies
          .filter((c) => c.billingBalance && c.billingBalance > 0)
          .sort((a, b) => (b.billingBalance || 0) - (a.billingBalance || 0))
          .slice(0, 3);

        if (topCompanies.length > 0) {
          msg += `🏆 *TOP COMPANIES BY BALANCE*\n`;
          msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          topCompanies.forEach((company, index) => {
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
            msg += `${medal} *${company.name}*\n`;
            msg += `   💰 Balance: *$${(
              company.billingBalance || 0
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}*\n`;
            msg += `   📊 Status: *${company.status || "pending"}*\n\n`;
          });
        }
      }

      const buttons = [
        [Markup.button.callback("🔙 Back to Companies", "admin_companies_1")],
        [
          Markup.button.callback(
            "📊 Platform Analytics",
            "platform_analytics_dashboard"
          ),
        ],
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

      ctx.session.broadcastStep = "awaiting_content";

      ctx.reply(
        "📢 *Broadcast Message*\n\nSend any message (text, photo, video, or document) to broadcast to all users:",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Back", "admin_panel")],
          ]),
        }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in broadcast:", error);
      ctx.reply("❌ Failed to start broadcast.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBroadcastContent(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      let broadcastData = {};
      let contentType = "";

      // Detect content type and extract data
      if (ctx.message?.text) {
        // Text message
        contentType = "text";
        broadcastData = {
          type: "text",
          content: ctx.message.text,
        };
      } else if (ctx.message?.photo) {
        // Photo message
        contentType = "photo";
        broadcastData = {
          type: "photo",
          fileId: ctx.message.photo[ctx.message.photo.length - 1].file_id,
          caption: ctx.message.caption || "",
        };
      } else if (ctx.message?.video) {
        // Video message
        contentType = "video";
        broadcastData = {
          type: "video",
          fileId: ctx.message.video.file_id,
          caption: ctx.message.caption || "",
        };
      } else if (ctx.message?.document) {
        // Document message
        contentType = "document";
        broadcastData = {
          type: "document",
          fileId: ctx.message.document.file_id,
          caption: ctx.message.caption || "",
        };
      } else {
        return ctx.reply(
          "❌ Unsupported content type. Please send text, photo, video, or document."
        );
      }

      // Store broadcast data
      ctx.session.broadcastData = broadcastData;
      ctx.session.broadcastStep = "confirm";

      // Create preview message
      let previewText = "";
      switch (contentType) {
        case "text":
          previewText = `📝 *Text Message:*\n\n${broadcastData.content}`;
          break;
        case "photo":
          previewText = `🖼️ *Photo Message:*${
            broadcastData.caption ? `\n\nCaption: ${broadcastData.caption}` : ""
          }`;
          break;
        case "video":
          previewText = `📹 *Video Message:*${
            broadcastData.caption ? `\n\nCaption: ${broadcastData.caption}` : ""
          }`;
          break;
        case "document":
          previewText = `📄 *Document Message:*${
            broadcastData.caption ? `\n\nCaption: ${broadcastData.caption}` : ""
          }`;
          break;
      }

      const buttons = [
        [Markup.button.callback("✅ Send Broadcast", "confirm_broadcast")],
        [Markup.button.callback("❌ Cancel", "admin_broadcast")],
      ];

      ctx.reply(
        `📢 *Broadcast Preview:*\n\n${previewText}\n\nSend this ${contentType} to all users?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error("Error in broadcast content:", error);
      ctx.reply("❌ Failed to process broadcast content.");
    }
  }

  async handleConfirmBroadcast(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const broadcastData = ctx.session.broadcastData;
      if (!broadcastData) {
        return ctx.reply("❌ No broadcast data found. Please try again.");
      }

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
          switch (broadcastData.type) {
            case "text":
              await bot.telegram.sendMessage(
                user.telegramId,
                broadcastData.content
              );
              break;
            case "photo":
              await bot.telegram.sendPhoto(
                user.telegramId,
                broadcastData.fileId,
                {
                  caption: broadcastData.caption || undefined,
                }
              );
              break;
            case "video":
              await bot.telegram.sendVideo(
                user.telegramId,
                broadcastData.fileId,
                {
                  caption: broadcastData.caption || undefined,
                }
              );
              break;
            case "document":
              await bot.telegram.sendDocument(
                user.telegramId,
                broadcastData.fileId,
                {
                  caption: broadcastData.caption || undefined,
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
      delete ctx.session.broadcastStep;
      delete ctx.session.broadcastData;

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

  async handleCompanyWithdrawals(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const companyAnalytics = await adminService.getCompanyAnalytics();
      const companiesWithWithdrawable = companyAnalytics.filter(
        (c) => c.hasWithdrawable
      );

      if (companiesWithWithdrawable.length === 0) {
        return ctx.reply(
          "💳 *Withdrawals*\n\nNo companies have withdrawable amounts at this time.",
          { parse_mode: "Markdown" }
        );
      }

      let msg = `💳 *Company Withdrawals*\n\n`;
      msg += `Companies with withdrawable amounts:\n\n`;

      const buttons = [];

      for (const company of companiesWithWithdrawable) {
        msg += `*${company.name}*\n`;
        msg += `• Withdrawable: $${company.withdrawable.toFixed(2)}\n`;
        msg += `• Platform Cut: $${company.platformFees.toFixed(2)}\n`;
        msg += `• Lifetime Revenue: $${company.lifetimeRevenue.toFixed(2)}\n\n`;

        // Add withdraw button for this company
        buttons.push([
          Markup.button.callback(
            `💰 Withdraw ${company.name} ($${company.withdrawable.toFixed(2)})`,
            `withdraw_company_${company.id}`
          ),
        ]);
      }

      buttons.push([
        Markup.button.callback(
          "🔙 Back to Analytics",
          "platform_analytics_dashboard"
        ),
      ]);

      ctx.reply(msg, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(buttons),
      });

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company withdrawals:", error);
      ctx.reply("❌ Failed to load withdrawal data.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyWithdraw(ctx, companyId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(
          t("msg__access_denied", {}, ctx.session?.language || "en")
        );

      const company = await companyService.getCompanyById(companyId);
      if (!company) {
        return ctx.reply("❌ Company not found.");
      }

      const withdrawable = company.billingBalance || 0;
      if (withdrawable <= 0) {
        return ctx.reply("❌ No withdrawable amount for this company.");
      }

      // Process the withdrawal
      await companyService.processCompanyWithdrawal(companyId, withdrawable);

      ctx.reply(
        `✅ Successfully processed withdrawal of $${withdrawable.toFixed(
          2
        )} for ${company.name}`,
        {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🔙 Back to Withdrawals",
                "admin_withdrawals"
              ),
            ],
          ]),
        }
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error processing company withdrawal:", error);
      ctx.reply("❌ Failed to process withdrawal.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
}

module.exports = new AdminHandlers();
