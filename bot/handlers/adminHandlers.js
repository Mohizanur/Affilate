console.log("Entering handlers/adminHandlers.js");
const { Markup } = require("telegraf");
console.log("Loaded telegraf in adminHandlers");
const adminService = require("../services/adminService");
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
const orderService = require("../services/orderService");
console.log("Loaded services/orderService in adminHandlers");

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

  isAdmin(telegramId) {
    if (this.adminIds.includes(telegramId)) return true;
    // Check Firestore user record for role or isAdmin
    // This is async, so fallback to sync for now, but main handlers already check user.role/isAdmin
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
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
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
          // Removed Orders and Withdrawals buttons
        ],
        [
          Markup.button.callback(
            "📊 Platform Analytics",
            "platform_analytics_dashboard"
          ),
        ],
        [
          Markup.button.callback("⚙️ System Settings", "admin_settings"),
          // Removed System Logs button
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
      ctx.reply("❌ Failed to load admin panel.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListCompanies(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const companies = await companyService.getAllCompanies();
      if (!companies.length) return ctx.reply("No companies found.");
      const perPage = 10;
      const totalPages = Math.ceil(companies.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `🏢 *All Companies:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      companies.slice(start, end).forEach((company) => {
        msg += `• ${company.name} ${company.statusBadge || ""} (${
          company.id
        })\n`;
        buttons.push([
          Markup.button.callback(
            `${company.name} ${company.statusBadge || ""}`,
            `admin_company_${company.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback(
            "⬅️ Previous",
            `admin_list_companies_${page - 1}`
          )
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_companies_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing companies:", error);
      ctx.reply("❌ Failed to list companies.");
    }
  }

  async handleAdminCompanyDetail(ctx, companyId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const company = await companyService.getCompanyById(companyId);
      if (!company) return ctx.reply("❌ Company not found.");
      let msg = `🏢 *${company.name}* ${company.statusBadge || ""}\n`;
      msg += `ID: ${company.id}\n`;
      msg += `Owner: ${company.ownerName || company.owner || "N/A"}\n`;
      msg += `Email: ${company.email || "N/A"}\n`;
      msg += `Phone: ${company.phone || "N/A"}\n`;
      msg += `Status: ${company.status || "N/A"}\n`;
      msg += `Created: ${
        toDateSafe(company.createdAt)
          ? toDateSafe(company.createdAt).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Updated: ${
        toDateSafe(company.updatedAt)
          ? toDateSafe(company.updatedAt).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Description: ${company.description || "N/A"}\n`;
      // List products
      const products = await companyService.getCompanyProducts(company.id);
      if (products.length) {
        msg += `\n*Products:*\n`;
      }
      const buttons = [];
      products.forEach((product) => {
        msg += `• ${product.title} ($${product.price})\n`;
        buttons.push([
          Markup.button.callback(product.title, `admin_product_${product.id}`),
        ]);
      });
      // No approve/reject buttons
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing company detail:", error);
      ctx.reply("❌ Failed to load company details.");
    }
  }

  async handleAdminProductDetail(ctx, productId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const product = await productService.getProductById(productId);
      if (!product) return ctx.reply("❌ Product not found.");
      let msg = `🛒 *${product.title}*\n`;
      msg += `ID: ${product.id}\n`;
      msg += `Company: ${product.companyId}\n`;
      msg += `Price: $${product.price}\n`;
      msg += `Category: ${product.category || "N/A"}\n`;
      msg += `Description: ${product.description || "N/A"}\n`;
      msg += `Status: ${product.status || "N/A"}\n`;
      msg += `Created: ${
        toDateSafe(product.createdAt)
          ? toDateSafe(product.createdAt).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Updated: ${
        toDateSafe(product.updatedAt)
          ? toDateSafe(product.updatedAt).toLocaleString()
          : "N/A"
      }\n`;
      // Back button to company detail
      const buttons = [
        [
          Markup.button.callback(
            "🔙 Back to Company",
            `admin_company_${product.companyId}`
          ),
        ],
      ];
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing product detail:", error);
      ctx.reply("❌ Failed to load product details.");
    }
  }

  async handleUserManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      // List all users
      const users = await userService.getAllUsers();
      let msg = `👥 *User Management*\n\nTotal Users: ${users.length}\n`;
      const buttons = [
        [Markup.button.callback("🔍 Search User", "search_user")],
        [Markup.button.callback("🚫 Banned Users", "banned_users")],
        [Markup.button.callback("📤 Export Users", "export_users")],
        [Markup.button.callback("⬆️ Promote User", "promote_user_menu")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
        [Markup.button.callback("👥 All Users", "all_users_menu_1")],
      ];
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in user management:", error);
      ctx.reply("❌ Failed to load user management.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePromoteUserMenu(ctx, page = 1, search = "") {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    const perPage = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number && u.phone_number.includes(search)) ||
          (u.id && u.id.toString().includes(search))
      );
    }
    const totalPages = Math.ceil(users.length / perPage) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * perPage;
    const end = start + perPage;
    let msg = `⬆️ *Promote User to Company Registration*\n\nPage ${page}/${totalPages}\n`;
    users.slice(start, end).forEach((user, i) => {
      msg += `\n${start + i + 1}. ${
        user.first_name || user.username || user.id
      } (@${user.username || "-"}) - ${user.phone_number || "-"} ${
        user.canRegisterCompany ? "🟢" : "🔴"
      }`;
    });
    const buttons = users
      .slice(start, end)
      .map((user) => [
        Markup.button.callback(
          user.canRegisterCompany
            ? `❌ Unpromote (${user.first_name || user.username || "-"})`
            : `⬆️ Promote (${user.first_name || user.username || "-"})`,
          user.canRegisterCompany
            ? `demote_user_id_${user.id}`
            : `promote_user_id_${user.id}`
        ),
      ]);
    // Pagination and search
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Prev", `promote_user_menu_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Next", `promote_user_menu_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);
    buttons.push([Markup.button.callback("🔍 Search", "promote_user_search")]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    ctx.reply(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handlePromoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: true,
    });
    ctx.reply("✅ User promoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handlePromoteUserSearch(ctx) {
    ctx.reply("🔍 Enter username, phone, or ID to search:");
    ctx.session.state = "awaiting_promote_user_search";
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handlePromoteUserSearchInput(ctx, messageText) {
    ctx.session.state = null;
    this.handlePromoteUserMenu(ctx, 1, messageText.trim());
  }

  async handleCompanyManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const buttons = [
        [
          Markup.button.callback("🔍 Search Company", "search_company"),
          Markup.button.callback(
            "📈 Company Analytics",
            "company_analytics_summary"
          ),
        ],
        [
          Markup.button.callback("➕ Add Company", "admin_add_company"),
          Markup.button.callback("➖ Remove Company", "admin_remove_company"),
        ],
        [
          Markup.button.callback(
            "📋 List All Companies",
            "admin_list_companies"
          ),
        ],
        [
          Markup.button.callback("⚙️ Settings", "company_settings"),
          Markup.button.callback("ექსპორტი", "export_companies"),
        ],
        [Markup.button.callback("🔙 Back to Admin Panel", "admin_panel")],
      ];
      ctx.reply("🏢 *Company Management*", {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company management:", error);
      ctx.reply("❌ Failed to load company management.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminAddCompany(ctx) {
    try {
      // Clear any remove company session state
      delete ctx.session.adminRemoveCompanyStep;
      delete ctx.session.adminRemoveCompanyResults;
      delete ctx.session.adminRemoveCompanyId;
      ctx.session.adminAddCompanyStep = "name";
      ctx.session.adminAddCompanyData = {};
      ctx.reply("🏢 *Add New Company*\n\nEnter company name:", {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error starting admin add company:", error);
      ctx.reply("❌ Failed to start add company.");
    }
  }

  async handleAdminAddCompanyStep(ctx) {
    try {
      const step = ctx.session.adminAddCompanyStep;
      const text = ctx.message.text;
      if (!ctx.session.adminAddCompanyData) return;
      switch (step) {
        case "name":
          ctx.session.adminAddCompanyData.name = text;
          ctx.session.adminAddCompanyStep = "description";
          ctx.reply("Enter company description:");
          break;
        case "description":
          ctx.session.adminAddCompanyData.description = text;
          ctx.session.adminAddCompanyStep = "website";
          ctx.reply('Enter company website (or type "skip"):');
          break;
        case "website":
          ctx.session.adminAddCompanyData.website =
            text === "skip" ? null : text;
          ctx.session.adminAddCompanyStep = "phone";
          ctx.reply("Enter company phone:");
          break;
        case "phone":
          ctx.session.adminAddCompanyData.phone = text;
          ctx.session.adminAddCompanyStep = "commission_rate";
          ctx.reply("Enter referrer commission rate (1-50):");
          break;
        case "commission_rate":
          const rate = parseFloat(text);
          if (isNaN(rate) || rate < 1 || rate > 50)
            return ctx.reply("❌ Please enter a valid commission rate (1-50):");
          ctx.session.adminAddCompanyData.referrerCommissionRate = rate;
          // Show confirmation
          const c = ctx.session.adminAddCompanyData;
          ctx.reply(
            `*Confirm New Company*\n\nName: ${c.name}\nDescription: ${c.description}\nWebsite: ${c.website}\nPhone: ${c.phone}\nCommission Rate: ${c.referrerCommissionRate}%\n\nType 'confirm' to save or 'cancel' to abort.`,
            { parse_mode: "Markdown" }
          );
          ctx.session.adminAddCompanyStep = "confirm";
          break;
        case "confirm":
          if (text.toLowerCase() === "confirm") {
            await adminService.createCompanyAsAdmin(
              ctx.session.adminAddCompanyData
            );
            ctx.reply("✅ Company added successfully!");
          } else {
            ctx.reply("❌ Add cancelled.");
          }
          delete ctx.session.adminAddCompanyStep;
          delete ctx.session.adminAddCompanyData;
          break;
      }
    } catch (error) {
      logger.error("Error adding company (admin):", error);
      ctx.reply("❌ Failed to add company. Please try again.");
    }
  }

  async handleAdminRemoveCompany(ctx) {
    try {
      // Clear any add company session state
      delete ctx.session.adminAddCompanyStep;
      delete ctx.session.adminAddCompanyData;
      ctx.session.adminRemoveCompanyStep = "search";
      ctx.reply("🔍 Enter company name or ID to remove:");
    } catch (error) {
      logger.error("Error starting admin remove company:", error);
      ctx.reply("❌ Failed to start remove company.");
    }
  }

  async handleAdminRemoveCompanyStep(ctx) {
    try {
      const step = ctx.session.adminRemoveCompanyStep;
      const text = ctx.message.text;
      if (step === "search") {
        const results = await adminService.searchCompanies(text);
        if (!results.length) return ctx.reply("❌ No companies found.");
        ctx.session.adminRemoveCompanyResults = results;
        let msg = "Select a company to remove:\n";
        results.forEach((c, i) => {
          msg += `\n${i + 1}. ${c.name} (${c.id})`;
        });
        ctx.reply(msg + "\n\nType the number of the company to remove:");
        ctx.session.adminRemoveCompanyStep = "select";
      } else if (step === "select") {
        const idx = parseInt(text) - 1;
        const companies = ctx.session.adminRemoveCompanyResults || [];
        if (isNaN(idx) || idx < 0 || idx >= companies.length)
          return ctx.reply("❌ Invalid selection.");
        ctx.session.adminRemoveCompanyId = companies[idx].id;
        ctx.reply(
          `⚠️ Are you sure you want to delete ${companies[idx].name}? Type 'delete' to confirm or 'cancel' to abort.`
        );
        ctx.session.adminRemoveCompanyStep = "confirm";
      } else if (step === "confirm") {
        if (text.toLowerCase() === "delete") {
          await adminService.deleteCompany(ctx.session.adminRemoveCompanyId);
          ctx.reply("✅ Company deleted successfully!");
        } else {
          ctx.reply("❌ Delete cancelled.");
        }
        delete ctx.session.adminRemoveCompanyStep;
        delete ctx.session.adminRemoveCompanyResults;
        delete ctx.session.adminRemoveCompanyId;
      }
    } catch (error) {
      logger.error("Error removing company (admin):", error);
      ctx.reply("❌ Failed to remove company. Please try again.");
    }
  }

  async handlePayoutManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      // List all payouts
      const payouts = await adminService.getAllPayouts();
      let message = `💸 *Payout Management*\n\nTotal Payouts: ${payouts.length}\n`;
      payouts.slice(0, 20).forEach((payout, i) => {
        message += `\n${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        } - ${payout.status || "pending"} - ${payout.id}`;
      });
      const buttons = [
        [Markup.button.callback("⏳ Pending Payouts", "pending_payouts")],
        [Markup.button.callback("✅ Approved Payouts", "approved_payouts")],
        [Markup.button.callback("❌ Rejected Payouts", "rejected_payouts")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in payout management:", error);
      ctx.reply("❌ Failed to load payout management.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const pending = await adminService.getPayoutsByStatus("pending");
      let message = `⏳ *Pending Payouts*\n\n`;
      if (pending.length === 0) message += "No pending payouts.";
      pending.slice(0, 20).forEach((payout, i) => {
        message += `\n${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        } - ${payout.id}`;
      });
      const buttons = pending
        .slice(0, 20)
        .map((payout) => [
          Markup.button.callback(
            `✅ Approve $${payout.amount}`,
            `approve_payout_${payout.id}`
          ),
          Markup.button.callback(
            `❌ Reject $${payout.amount}`,
            `reject_payout_${payout.id}`
          ),
        ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_payouts")]);
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in pending payouts:", error);
      ctx.reply("❌ Failed to load pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApprovePayout(ctx, payoutId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.approveWithdrawal(payoutId);
      ctx.reply("✅ Payout approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving payout:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectPayout(ctx, payoutId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.rejectWithdrawal(payoutId);
      ctx.reply("❌ Payout rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting payout:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBroadcast(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      ctx.session.waitingForBroadcast = true;
      ctx.session.state = null;
      delete ctx.session.awaitingBroadcast;
      delete ctx.session.adminRemoveCompanyStep;
      delete ctx.session.adminRemoveCompanyResults;
      ctx.reply("📢 Please enter the message to broadcast to all users:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in broadcast:", error);
      ctx.reply("❌ Failed to start broadcast.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBroadcastType(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id))) return;

      const type = ctx.callbackQuery.data.split("_")[1];
      ctx.session.broadcastType = type;
      ctx.session.waitingForBroadcast = true;
      ctx.session.state = null;
      delete ctx.session.awaitingBroadcast;
      delete ctx.session.adminRemoveCompanyStep;
      delete ctx.session.adminRemoveCompanyResults;
      ctx.reply("📝 Please enter your broadcast message:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting broadcast type:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBroadcastMessage(ctx, messageText) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id))) return;
      if (!ctx.session || !ctx.session.waitingForBroadcast) {
        return ctx.reply(
          "❌ Session expired. Please start the broadcast again.",
          Markup.inlineKeyboard([
            [Markup.button.callback("📢 Start Broadcast", "admin_broadcast")],
          ])
        );
      }
      const message = messageText || (ctx.message && ctx.message.text);
      const type = ctx.session.broadcastType || "all";

      try {
        const result = await adminService.sendBroadcast(message, type);
        // Clear session
        delete ctx.session.waitingForBroadcast;
        delete ctx.session.broadcastType;
        let summary = `✅ Broadcast sent successfully!\n\n📊 Statistics:\n• Sent: ${result.sent}\n• Failed: ${result.failed}\n• Total: ${result.total}`;
        if (
          result.failed > 0 &&
          result.failedUsers &&
          result.failedUsers.length > 0
        ) {
          summary += `\n\nFailed user IDs: ${result.failedUsers.join(", ")}`;
        }
        ctx.reply(summary);
      } catch (validationError) {
        ctx.reply(`❌ Broadcast failed: ${validationError.message}`);
      }
    } catch (error) {
      logger.error("Error sending broadcast:", error);
      ctx.reply("❌ Failed to send broadcast.");
    }
  }

  async handleBroadcastMedia(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      if (!ctx.session || !ctx.session.waitingForBroadcast) {
        return ctx.reply(
          "❌ Session expired. Please start the broadcast again.",
          Markup.inlineKeyboard([
            [Markup.button.callback("📢 Start Broadcast", "admin_broadcast")],
          ])
        );
      }
      const { getBot } = require("../services/adminService");
      const bot = getBot ? getBot() : ctx.telegram;
      const usersSnap = await require("../config/database").users().get();
      let sent = 0,
        failed = 0,
        total = 0;
      let failedUsers = [];
      for (const doc of usersSnap.docs) {
        const user = doc.data();
        if (!user.telegramId) continue;
        total++;
        try {
          if (ctx.message.photo) {
            const fileId =
              ctx.message.photo[ctx.message.photo.length - 1].file_id;
            await bot.telegram.sendPhoto(user.telegramId, fileId, {
              caption: ctx.message.caption || undefined,
            });
          } else if (ctx.message.document) {
            await bot.telegram.sendDocument(
              user.telegramId,
              ctx.message.document.file_id,
              { caption: ctx.message.caption || undefined }
            );
          } else if (ctx.message.sticker) {
            await bot.telegram.sendSticker(
              user.telegramId,
              ctx.message.sticker.file_id
            );
          } else if (ctx.message.video) {
            await bot.telegram.sendVideo(
              user.telegramId,
              ctx.message.video.file_id,
              { caption: ctx.message.caption || undefined }
            );
          } else if (ctx.message.audio) {
            await bot.telegram.sendAudio(
              user.telegramId,
              ctx.message.audio.file_id,
              { caption: ctx.message.caption || undefined }
            );
          } else if (ctx.message.voice) {
            await bot.telegram.sendVoice(
              user.telegramId,
              ctx.message.voice.file_id
            );
          } else if (ctx.message.video_note) {
            await bot.telegram.sendVideoNote(
              user.telegramId,
              ctx.message.video_note.file_id
            );
          }
          sent++;
        } catch (err) {
          failed++;
          failedUsers.push(user.telegramId);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      delete ctx.session.waitingForBroadcast;
      delete ctx.session.broadcastType;
      let summary = `✅ Media broadcast sent!\n\n📊 Statistics:\n• Sent: ${sent}\n• Failed: ${failed}\n• Total: ${total}`;
      if (failed > 0 && failedUsers.length > 0) {
        summary += `\n\nFailed user IDs: ${failedUsers.join(", ")}`;
      }
      ctx.reply(summary);
    } catch (error) {
      logger.error("Error sending media broadcast:", error);
      ctx.reply("❌ Failed to send media broadcast.");
    }
  }

  async handleSystemSettings(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const settings = await adminService.getPlatformSettings();
      let message = `⚙️ *System Settings*\n\n`;
      message += `• Commission: ${settings.referralCommissionPercent || 0}%\n`;
      message += `• Discount: ${settings.referralDiscountPercent || 0}%\n`;
      message += `• Platform Fee: ${settings.platformFeePercent || 0}%\n`;
      message += `• Min Withdrawal: $${settings.minWithdrawalAmount || 0}\n`;
      message += `• Max Referral Uses: ${settings.maxReferralUses || 0}\n`;
      message += `• Referral Expiry: ${
        settings.referralExpiryDays || 0
      } days\n`;
      ctx.reply(message, { parse_mode: "Markdown" });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in system settings:", error);
      ctx.reply("❌ Failed to load system settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAnalytics(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getPlatformStats();
      let message = `📊 *Platform Analytics*\n\n`;
      message += `👥 Users: ${stats.totalUsers}\n`;
      message += `🏢 Companies: ${stats.totalCompanies}\n`;
      message += `🛍️ Orders: ${stats.totalOrders}\n`;
      message += `💰 Revenue: $${(stats.platformRevenue || 0).toFixed(2)}\n`;
      if (stats.growth) {
        message += `\n📈 Growth (30d):\n`;
        message += `• Users: +${stats.growth.users30d || 0}%\n`;
        message += `• Orders: +${stats.growth.orders30d || 0}%\n`;
        message += `• Revenue: +${stats.growth.revenue30d || 0}%\n`;
      }
      ctx.reply(message, { parse_mode: "Markdown" });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in analytics:", error);
      ctx.reply("❌ Failed to load analytics.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSearchUser(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      ctx.session.searchType = "user";
      ctx.session.waitingForSearch = true;

      ctx.reply("🔍 Enter user ID, username, or phone number to search:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting user search:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSearchQuery(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id) || !ctx.session.waitingForSearch) return;

      const query = ctx.message.text;
      const searchType = ctx.session.searchType;

      let results;
      switch (searchType) {
        case "user":
          results = await adminService.searchUsers(query);
          break;
        case "company":
          results = await adminService.searchCompanies(query);
          break;
        case "order":
          results = await adminService.searchOrders(query);
          break;
        case "payout":
          results = await adminService.searchPayouts(query);
          break;
      }

      delete ctx.session.waitingForSearch;
      delete ctx.session.searchType;

      if (results.length === 0) {
        return ctx.reply("❌ No results found.");
      }

      let message = `🔍 *Search Results (${results.length})*\n\n`;

      results.slice(0, 10).forEach((result, index) => {
        switch (searchType) {
          case "user":
            message += `${index + 1}. ${result.firstName} ${
              result.lastName || ""
            }\n`;
            message += `   📱 ${result.phoneNumber || "No phone"}\n`;
            message += `   💰 Balance: $${(result.referralBalance || 0).toFixed(
              2
            )}\n`;
            message += `   📅 Joined: ${
              toDateSafe(result.createdAt)
                ? toDateSafe(result.createdAt).toLocaleDateString()
                : "-"
            }\n\n`;
            break;
          case "company":
            message += `${index + 1}. ${result.name}\n`;
            message += `   📧 ${result.email || "No email"}\n`;
            message += `   📊 Products: ${result.productCount}\n`;
            message += `   💰 Revenue: $${(result.totalRevenue || 0).toFixed(
              2
            )}\n\n`;
            break;
          case "order":
            message += `${index + 1}. ${result.productTitle}\n`;
            message += `   💰 $${result.amount}\n`;
            message += `   📋 Status: ${result.status}\n`;
            message += `   📅 ${
              toDateSafe(result.createdAt)
                ? toDateSafe(result.createdAt).toLocaleDateString()
                : "-"
            }\n\n`;
            break;
          case "payout":
            message += `${index + 1}. $${result.amount.toFixed(2)}\n`;
            message += `   👤 ${result.userName}\n`;
            message += `   📋 Status: ${result.status}\n`;
            message += `   📅 ${
              toDateSafe(result.requestedAt)
                ? toDateSafe(result.requestedAt).toLocaleDateString()
                : "-"
            }\n\n`;
            break;
        }
      });

      const buttons = [
        [Markup.button.callback("🔍 New Search", `search_${searchType}`)],
        [Markup.button.callback("🔙 Back", `admin_${searchType}s`)],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error processing search query:", error);
      ctx.reply("❌ Search failed. Please try again.");
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const currentMode = await adminService.getMaintenanceMode();

      const message = `
🔧 *Maintenance Mode*

Current Status: ${currentMode ? "🔴 ENABLED" : "🟢 DISABLED"}

${
  currentMode
    ? "The bot is currently in maintenance mode. Only admins can use the bot."
    : "The bot is operating normally. All users can access features."
}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            currentMode ? "🟢 Disable Maintenance" : "🔴 Enable Maintenance",
            "toggle_maintenance"
          ),
        ],
        [
          Markup.button.callback(
            "📢 Maintenance Message",
            "maintenance_message"
          ),
        ],
        [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing maintenance mode:", error);
      ctx.reply("❌ Failed to load maintenance settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const newMode = await adminService.toggleMaintenanceMode();

      ctx.reply(`✅ Maintenance mode ${newMode ? "enabled" : "disabled"}.`);
      if (ctx.callbackQuery) ctx.answerCbQuery();

      // Refresh maintenance settings
      setTimeout(() => {
        this.handleMaintenanceMode(ctx);
      }, 1000);
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportData(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const exportType = ctx.callbackQuery.data.split("_")[1];

      ctx.reply("📤 Generating export... This may take a moment.");

      const exportData = await adminService.exportData(exportType);

      // In a real implementation, you would send the file
      // For now, we'll just show a summary
      ctx.reply(
        `✅ Export completed!\n\n📊 Summary:\n• Records: ${exportData.recordCount}\n• File size: ${exportData.fileSize}\n• Format: CSV\n\nFile would be sent here in production.`
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting data:", error);
      ctx.reply("❌ Export failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalytics();
      let message = `📊 *Company Analytics Summary*\n\n`;
      message += `• Total Companies: ${stats.total}\n`;
      message += `• Approved: ${stats.approved}\n`;
      message += `• Pending: ${stats.pending}\n`;
      message += `• Rejected: ${stats.rejected}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "admin_companies")],
        ]),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("💾 Creating system backup... Please wait.");
      const backup = await adminService.createBackup();
      let message = `✅ Backup created successfully!\n\n`;
      message += `📦 ID: ${backup.id || "-"}\n`;
      message += `📏 Size: ${backup.size || "-"}\n`;
      message += `📋 Tables: ${backup.tables || "-"}\n`;
      message += `📅 Created: ${
        toDateSafe(backup.createdAt)
          ? toDateSafe(backup.createdAt).toLocaleString()
          : "-"
      }`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle unban_user_{userId} callback
  async handleUnbanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^unban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid unban action.");
      const userId = match[1];
      await this.handleUnbanUser(ctx, userId);
      // Refresh banned users list
      setTimeout(() => this.handleBannedUsers(ctx), 500);
    } catch (error) {
      logger.error("Error in unban user callback:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle ban_user_{userId} callback
  async handleBanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^ban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid ban action.");
      const userId = match[1];
      await this.handleBanUser(ctx, userId);
      // Refresh banned users list if coming from banned users, else refresh search
      if (ctx.session && ctx.session.state === "awaiting_user_search") {
        ctx.reply("🔄 User banned. Please search again or go back.");
      } else {
        setTimeout(() => this.handleBannedUsers(ctx), 500);
      }
    } catch (error) {
      logger.error("Error in ban user callback:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_company_{companyId} callback
  async handleApproveCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const companyId = match[1];
      await this.handleApproveCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in approve company callback:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_company_{companyId} callback
  async handleRejectCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const companyId = match[1];
      await this.handleRejectCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in reject company callback:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_order_{orderId} callback
  async handleApproveOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const orderId = match[1];
      await this.handleApproveOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in approve order callback:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_order_{orderId} callback
  async handleRejectOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const orderId = match[1];
      await this.handleRejectOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in reject order callback:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const payoutId = match[1];
      await this.handleApprovePayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in approve payout callback:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_payout_{payoutId} callback
  async handleRejectPayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const payoutId = match[1];
      await this.handleRejectPayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in reject payout callback:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "approved", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `✅ Your product (${product.title}) has been approved and is now public!`,
            { type: "product", action: "approved", productId }
          );
      }
      ctx.reply("✅ Product approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving product:", error);
      ctx.reply("❌ Failed to approve product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "rejected", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`,
            { type: "product", action: "rejected", productId }
          );
      }
      ctx.reply("❌ Product rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting product:", error);
      ctx.reply("❌ Failed to reject product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply("No users found.");
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach((user) => {
        msg += `• ${
          user.first_name || user.firstName || user.username || user.id
        }\n`;
        buttons.push([
          Markup.button.callback(
            user.first_name || user.firstName || user.username || user.id,
            `admin_user_${user.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_list_users_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_users_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing users:", error);
      ctx.reply("❌ Failed to list users.");
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply("❌ User not found.");
      let msg = `👤 *${
        user.first_name || user.firstName || user.username || user.id
      }*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || "N/A"}\n`;
      msg += `Phone: ${user.phone_number || "N/A"}\n`;
      msg += `Email: ${user.email || "N/A"}\n`;
      msg += `Role: ${user.role || "user"}\n`;
      msg += `Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Verified: ${user.phone_verified ? "✅" : "❌"}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${
        user.referralCodes
          ? Object.values(user.referralCodes).join(", ")
          : "N/A"
      }\n`;
      msg += `Last Active: ${
        toDateSafe(user.last_active)
          ? toDateSafe(user.last_active).toLocaleString()
          : "N/A"
      }\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany
        ? "🟢 Eligible to register companies"
        : "🔴 Not eligible to register companies";
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += "No purchases found.\n";
      } else {
        orders.forEach((order) => {
          msg += `• ${order.product_title || order.productId} ($${
            order.amount
          }) from company ${order.company_name || order.companyId} on ${
            toDateSafe(order.createdAt)
              ? toDateSafe(order.createdAt).toLocaleString()
              : "N/A"
          }\n`;
        });
      }
      // Referral stats
      const stats = await referralService.getReferralStats(userId);
      msg += `\n*Referral Stats:*\n`;
      msg += `Total Referrals: ${stats.totalReferrals}\n`;
      msg += `Total Earnings: $${stats.totalEarnings.toFixed(2)}\n`;
      msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
      msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
      // Companies joined and referral codes
      if (user.joinedCompanies && user.joinedCompanies.length) {
        msg += `\n*Companies Joined:*\n`;
        for (const companyId of user.joinedCompanies) {
          const company = await companyService.getCompanyById(companyId);
          const code =
            user.referralCodes && company && company.codePrefix
              ? user.referralCodes[company.codePrefix]
              : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += "\n";
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([
          Markup.button.callback("✅ Unban", `unban_user_${user.id}`),
        ]);
      } else {
        buttons.push([Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            "❌ Demote (Remove Company Permission)",
            `demote_company_${user.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            "✅ Promote (Allow Company Registration)",
            `promote_company_${user.id}`
          ),
        ]);
      }
      // Back button to user list
      buttons.push([
        Markup.button.callback("🔙 Back to Users", "admin_list_users"),
      ]);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply("❌ Failed to load user details.");
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply("✅ User promoted: can now register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply("❌ User demoted: can no longer register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply("❌ Failed to demote user.");
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: false,
    });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number &&
            u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
          (u.first_name &&
            u.first_name.toLowerCase().includes(search.toLowerCase())) ||
          (u.last_name &&
            u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${
        u.first_name || u.firstName || "No name"
      } (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1)
      buttons.push([
        Markup.button.callback("⬅️ Prev", `all_users_menu_${page - 1}`),
      ]);
    if (page < totalPages)
      buttons.push([
        Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`),
      ]);
    buttons.push([
      Markup.button.callback("🔍 Search User", "all_users_search"),
    ]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    const userButtons = pageUsers.map((u) => [
      Markup.button.callback(
        `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
        `admin_user_${u.id}`
      ),
    ]);
    buttons.unshift(...userButtons);
    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    ctx.session.state = null;
  }

  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const bannedUsers = await userService.getBannedUsers();
      if (!bannedUsers.length) {
        return ctx.reply("No banned users found.");
      }
      let message = `🚫 *Banned Users*\n\n`;
      bannedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unbanUser(userId);
      ctx.reply("✅ User unbanned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.banUser(userId);
      ctx.reply("✅ User banned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.approveCompany(companyId);
      ctx.reply("✅ Company approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.approveOrder(orderId);
      ctx.reply("✅ Order approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving order:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.rejectOrder(orderId);
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies.");
      }
      let message = `⚠️ *Pending Company Registrations*\n\n`;
      companies.forEach((company, i) => {
        message += `${i + 1}. ${company.name} (${company.id})\n`;
        message += `   📧 ${company.email || "N/A"}\n`;
        message += `   📞 ${company.phone || "N/A"}\n`;
        message += `   👤 ${company.ownerName || company.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(company.createdAt)
            ? toDateSafe(company.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${company.referralCode || "N/A"}\n`;
        message += `   👥 ${company.joinedUsers || 0} Users\n`;
        message += `   💰 ${company.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${company.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_companies"
          ),
        ],
        [
          Markup.button.callback(
            "❌ Reject All",
            "reject_all_pending_companies"
          ),
        ],
        [Markup.button.callback("🔙 Back to Companies", "admin_companies")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleApproveCompany(ctx, company.id);
      }
      ctx.reply("✅ All pending companies approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending companies:", error);
      ctx.reply("❌ Failed to approve all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleRejectCompany(ctx, company.id);
      }
      ctx.reply("❌ All pending companies rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending companies:", error);
      ctx.reply("❌ Failed to reject all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders.");
      }
      let message = `⏳ *Pending Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.productTitle} ($${order.amount})\n`;
        message += `   👤 ${order.userName}\n`;
        message += `   📅 ${
          toDateSafe(order.createdAt)
            ? toDateSafe(order.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${order.referralCode || "N/A"}\n`;
        message += `   💰 ${order.amount} Revenue\n`;
        message += `   ⚙️ ${order.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_orders"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_orders")],
        [Markup.button.callback("🔙 Back to Orders", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleApproveOrder(ctx, order.id);
      }
      ctx.reply("✅ All pending orders approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending orders:", error);
      ctx.reply("❌ Failed to approve all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleRejectOrder(ctx, order.id);
      }
      ctx.reply("❌ All pending orders rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending orders:", error);
      ctx.reply("❌ Failed to reject all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      if (!payouts.length) {
        return ctx.reply("No pending payouts.");
      }
      let message = `⏳ *Pending Payouts*\n\n`;
      payouts.forEach((payout, i) => {
        message += `${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        }\n`;
        message += `   📅 ${
          toDateSafe(payout.requestedAt)
            ? toDateSafe(payout.requestedAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   ⚙️ ${payout.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_payouts"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_payouts")],
        [Markup.button.callback("🔙 Back to Payouts", "admin_payouts")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending payouts:", error);
      ctx.reply("❌ Failed to load pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleApprovePayout(ctx, payout.id);
      }
      ctx.reply("✅ All pending payouts approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending payouts:", error);
      ctx.reply("❌ Failed to approve all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleRejectPayout(ctx, payout.id);
      }
      ctx.reply("❌ All pending payouts rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending payouts:", error);
      ctx.reply("❌ Failed to reject all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessage(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.session.state = "awaiting_maintenance_message";
      ctx.reply("📝 Please enter the message for the maintenance mode:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting maintenance message:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessageInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;
      if (
        !ctx.session ||
        ctx.session.state !== "awaiting_maintenance_message"
      ) {
        return ctx.reply("❌ Invalid state for maintenance message input.");
      }
      const message = messageText.trim();
      if (!message) {
        return ctx.reply("❌ Message cannot be empty.");
      }
      await adminService.setMaintenanceMessage(message);
      ctx.reply("✅ Maintenance message updated.");
      delete ctx.session.state;
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting maintenance message:", error);
      ctx.reply("❌ Failed to set maintenance message.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const currentMode = await adminService.getMaintenanceMode();

      const message = `
🔧 *Maintenance Mode*

Current Status: ${currentMode ? "🔴 ENABLED" : "🟢 DISABLED"}

${
  currentMode
    ? "The bot is currently in maintenance mode. Only admins can use the bot."
    : "The bot is operating normally. All users can access features."
}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            currentMode ? "🟢 Disable Maintenance" : "🔴 Enable Maintenance",
            "toggle_maintenance"
          ),
        ],
        [
          Markup.button.callback(
            "📢 Maintenance Message",
            "maintenance_message"
          ),
        ],
        [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing maintenance mode:", error);
      ctx.reply("❌ Failed to load maintenance settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const newMode = await adminService.toggleMaintenanceMode();

      ctx.reply(`✅ Maintenance mode ${newMode ? "enabled" : "disabled"}.`);
      if (ctx.callbackQuery) ctx.answerCbQuery();

      // Refresh maintenance settings
      setTimeout(() => {
        this.handleMaintenanceMode(ctx);
      }, 1000);
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportData(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const exportType = ctx.callbackQuery.data.split("_")[1];

      ctx.reply("📤 Generating export... This may take a moment.");

      const exportData = await adminService.exportData(exportType);

      // In a real implementation, you would send the file
      // For now, we'll just show a summary
      ctx.reply(
        `✅ Export completed!\n\n📊 Summary:\n• Records: ${exportData.recordCount}\n• File size: ${exportData.fileSize}\n• Format: CSV\n\nFile would be sent here in production.`
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting data:", error);
      ctx.reply("❌ Export failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalytics();
      let message = `📊 *Company Analytics Summary*\n\n`;
      message += `• Total Companies: ${stats.total}\n`;
      message += `• Approved: ${stats.approved}\n`;
      message += `• Pending: ${stats.pending}\n`;
      message += `• Rejected: ${stats.rejected}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "admin_companies")],
        ]),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("💾 Creating system backup... Please wait.");
      const backup = await adminService.createBackup();
      let message = `✅ Backup created successfully!\n\n`;
      message += `📦 ID: ${backup.id || "-"}\n`;
      message += `📏 Size: ${backup.size || "-"}\n`;
      message += `📋 Tables: ${backup.tables || "-"}\n`;
      message += `📅 Created: ${
        toDateSafe(backup.createdAt)
          ? toDateSafe(backup.createdAt).toLocaleString()
          : "-"
      }`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle unban_user_{userId} callback
  async handleUnbanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^unban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid unban action.");
      const userId = match[1];
      await this.handleUnbanUser(ctx, userId);
      // Refresh banned users list
      setTimeout(() => this.handleBannedUsers(ctx), 500);
    } catch (error) {
      logger.error("Error in unban user callback:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle ban_user_{userId} callback
  async handleBanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^ban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid ban action.");
      const userId = match[1];
      await this.handleBanUser(ctx, userId);
      // Refresh banned users list if coming from banned users, else refresh search
      if (ctx.session && ctx.session.state === "awaiting_user_search") {
        ctx.reply("🔄 User banned. Please search again or go back.");
      } else {
        setTimeout(() => this.handleBannedUsers(ctx), 500);
      }
    } catch (error) {
      logger.error("Error in ban user callback:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_company_{companyId} callback
  async handleApproveCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const companyId = match[1];
      await this.handleApproveCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in approve company callback:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_company_{companyId} callback
  async handleRejectCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const companyId = match[1];
      await this.handleRejectCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in reject company callback:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_order_{orderId} callback
  async handleApproveOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const orderId = match[1];
      await this.handleApproveOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in approve order callback:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_order_{orderId} callback
  async handleRejectOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const orderId = match[1];
      await this.handleRejectOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in reject order callback:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const payoutId = match[1];
      await this.handleApprovePayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in approve payout callback:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_payout_{payoutId} callback
  async handleRejectPayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const payoutId = match[1];
      await this.handleRejectPayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in reject payout callback:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "approved", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `✅ Your product (${product.title}) has been approved and is now public!`,
            { type: "product", action: "approved", productId }
          );
      }
      ctx.reply("✅ Product approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving product:", error);
      ctx.reply("❌ Failed to approve product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "rejected", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`,
            { type: "product", action: "rejected", productId }
          );
      }
      ctx.reply("❌ Product rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting product:", error);
      ctx.reply("❌ Failed to reject product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply("No users found.");
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach((user) => {
        msg += `• ${
          user.first_name || user.firstName || user.username || user.id
        }\n`;
        buttons.push([
          Markup.button.callback(
            user.first_name || user.firstName || user.username || user.id,
            `admin_user_${user.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_list_users_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_users_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing users:", error);
      ctx.reply("❌ Failed to list users.");
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply("❌ User not found.");
      let msg = `👤 *${
        user.first_name || user.firstName || user.username || user.id
      }*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || "N/A"}\n`;
      msg += `Phone: ${user.phone_number || "N/A"}\n`;
      msg += `Email: ${user.email || "N/A"}\n`;
      msg += `Role: ${user.role || "user"}\n`;
      msg += `Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Verified: ${user.phone_verified ? "✅" : "❌"}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${
        user.referralCodes
          ? Object.values(user.referralCodes).join(", ")
          : "N/A"
      }\n`;
      msg += `Last Active: ${
        toDateSafe(user.last_active)
          ? toDateSafe(user.last_active).toLocaleString()
          : "N/A"
      }\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany
        ? "🟢 Eligible to register companies"
        : "🔴 Not eligible to register companies";
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += "No purchases found.\n";
      } else {
        orders.forEach((order) => {
          msg += `• ${order.product_title || order.productId} ($${
            order.amount
          }) from company ${order.company_name || order.companyId} on ${
            toDateSafe(order.createdAt)
              ? toDateSafe(order.createdAt).toLocaleString()
              : "N/A"
          }\n`;
        });
      }
      // Referral stats
      const stats = await referralService.getReferralStats(userId);
      msg += `\n*Referral Stats:*\n`;
      msg += `Total Referrals: ${stats.totalReferrals}\n`;
      msg += `Total Earnings: $${stats.totalEarnings.toFixed(2)}\n`;
      msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
      msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
      // Companies joined and referral codes
      if (user.joinedCompanies && user.joinedCompanies.length) {
        msg += `\n*Companies Joined:*\n`;
        for (const companyId of user.joinedCompanies) {
          const company = await companyService.getCompanyById(companyId);
          const code =
            user.referralCodes && company && company.codePrefix
              ? user.referralCodes[company.codePrefix]
              : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += "\n";
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([
          Markup.button.callback("✅ Unban", `unban_user_${user.id}`),
        ]);
      } else {
        buttons.push([Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            "❌ Demote (Remove Company Permission)",
            `demote_company_${user.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            "✅ Promote (Allow Company Registration)",
            `promote_company_${user.id}`
          ),
        ]);
      }
      // Back button to user list
      buttons.push([
        Markup.button.callback("🔙 Back to Users", "admin_list_users"),
      ]);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply("❌ Failed to load user details.");
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply("✅ User promoted: can now register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply("❌ User demoted: can no longer register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply("❌ Failed to demote user.");
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: false,
    });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number &&
            u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
          (u.first_name &&
            u.first_name.toLowerCase().includes(search.toLowerCase())) ||
          (u.last_name &&
            u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${
        u.first_name || u.firstName || "No name"
      } (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1)
      buttons.push([
        Markup.button.callback("⬅️ Prev", `all_users_menu_${page - 1}`),
      ]);
    if (page < totalPages)
      buttons.push([
        Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`),
      ]);
    buttons.push([
      Markup.button.callback("🔍 Search User", "all_users_search"),
    ]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    const userButtons = pageUsers.map((u) => [
      Markup.button.callback(
        `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
        `admin_user_${u.id}`
      ),
    ]);
    buttons.unshift(...userButtons);
    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    ctx.session.state = null;
  }

  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const bannedUsers = await userService.getBannedUsers();
      if (!bannedUsers.length) {
        return ctx.reply("No banned users found.");
      }
      let message = `🚫 *Banned Users*\n\n`;
      bannedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unbanUser(userId);
      ctx.reply("✅ User unbanned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.banUser(userId);
      ctx.reply("✅ User banned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.approveCompany(companyId);
      ctx.reply("✅ Company approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.approveOrder(orderId);
      ctx.reply("✅ Order approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving order:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.rejectOrder(orderId);
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies.");
      }
      let message = `⚠️ *Pending Company Registrations*\n\n`;
      companies.forEach((company, i) => {
        message += `${i + 1}. ${company.name} (${company.id})\n`;
        message += `   📧 ${company.email || "N/A"}\n`;
        message += `   📞 ${company.phone || "N/A"}\n`;
        message += `   👤 ${company.ownerName || company.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(company.createdAt)
            ? toDateSafe(company.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${company.referralCode || "N/A"}\n`;
        message += `   👥 ${company.joinedUsers || 0} Users\n`;
        message += `   💰 ${company.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${company.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_companies"
          ),
        ],
        [
          Markup.button.callback(
            "❌ Reject All",
            "reject_all_pending_companies"
          ),
        ],
        [Markup.button.callback("🔙 Back to Companies", "admin_companies")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleApproveCompany(ctx, company.id);
      }
      ctx.reply("✅ All pending companies approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending companies:", error);
      ctx.reply("❌ Failed to approve all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleRejectCompany(ctx, company.id);
      }
      ctx.reply("❌ All pending companies rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending companies:", error);
      ctx.reply("❌ Failed to reject all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders.");
      }
      let message = `⏳ *Pending Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.productTitle} ($${order.amount})\n`;
        message += `   👤 ${order.userName}\n`;
        message += `   📅 ${
          toDateSafe(order.createdAt)
            ? toDateSafe(order.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${order.referralCode || "N/A"}\n`;
        message += `   💰 ${order.amount} Revenue\n`;
        message += `   ⚙️ ${order.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_orders"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_orders")],
        [Markup.button.callback("🔙 Back to Orders", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleApproveOrder(ctx, order.id);
      }
      ctx.reply("✅ All pending orders approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending orders:", error);
      ctx.reply("❌ Failed to approve all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleRejectOrder(ctx, order.id);
      }
      ctx.reply("❌ All pending orders rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending orders:", error);
      ctx.reply("❌ Failed to reject all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      if (!payouts.length) {
        return ctx.reply("No pending payouts.");
      }
      let message = `⏳ *Pending Payouts*\n\n`;
      payouts.forEach((payout, i) => {
        message += `${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        }\n`;
        message += `   📅 ${
          toDateSafe(payout.requestedAt)
            ? toDateSafe(payout.requestedAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   ⚙️ ${payout.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_payouts"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_payouts")],
        [Markup.button.callback("🔙 Back to Payouts", "admin_payouts")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending payouts:", error);
      ctx.reply("❌ Failed to load pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleApprovePayout(ctx, payout.id);
      }
      ctx.reply("✅ All pending payouts approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending payouts:", error);
      ctx.reply("❌ Failed to approve all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleRejectPayout(ctx, payout.id);
      }
      ctx.reply("❌ All pending payouts rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending payouts:", error);
      ctx.reply("❌ Failed to reject all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessage(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.session.state = "awaiting_maintenance_message";
      ctx.reply("📝 Please enter the message for the maintenance mode:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting maintenance message:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessageInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;
      if (
        !ctx.session ||
        ctx.session.state !== "awaiting_maintenance_message"
      ) {
        return ctx.reply("❌ Invalid state for maintenance message input.");
      }
      const message = messageText.trim();
      if (!message) {
        return ctx.reply("❌ Message cannot be empty.");
      }
      await adminService.setMaintenanceMessage(message);
      ctx.reply("✅ Maintenance message updated.");
      delete ctx.session.state;
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting maintenance message:", error);
      ctx.reply("❌ Failed to set maintenance message.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const currentMode = await adminService.getMaintenanceMode();

      const message = `
🔧 *Maintenance Mode*

Current Status: ${currentMode ? "🔴 ENABLED" : "🟢 DISABLED"}

${
  currentMode
    ? "The bot is currently in maintenance mode. Only admins can use the bot."
    : "The bot is operating normally. All users can access features."
}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            currentMode ? "🟢 Disable Maintenance" : "🔴 Enable Maintenance",
            "toggle_maintenance"
          ),
        ],
        [
          Markup.button.callback(
            "📢 Maintenance Message",
            "maintenance_message"
          ),
        ],
        [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing maintenance mode:", error);
      ctx.reply("❌ Failed to load maintenance settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const newMode = await adminService.toggleMaintenanceMode();

      ctx.reply(`✅ Maintenance mode ${newMode ? "enabled" : "disabled"}.`);
      if (ctx.callbackQuery) ctx.answerCbQuery();

      // Refresh maintenance settings
      setTimeout(() => {
        this.handleMaintenanceMode(ctx);
      }, 1000);
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportData(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const exportType = ctx.callbackQuery.data.split("_")[1];

      ctx.reply("📤 Generating export... This may take a moment.");

      const exportData = await adminService.exportData(exportType);

      // In a real implementation, you would send the file
      // For now, we'll just show a summary
      ctx.reply(
        `✅ Export completed!\n\n📊 Summary:\n• Records: ${exportData.recordCount}\n• File size: ${exportData.fileSize}\n• Format: CSV\n\nFile would be sent here in production.`
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting data:", error);
      ctx.reply("❌ Export failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalytics();
      let message = `📊 *Company Analytics Summary*\n\n`;
      message += `• Total Companies: ${stats.total}\n`;
      message += `• Approved: ${stats.approved}\n`;
      message += `• Pending: ${stats.pending}\n`;
      message += `• Rejected: ${stats.rejected}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "admin_companies")],
        ]),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("💾 Creating system backup... Please wait.");
      const backup = await adminService.createBackup();
      let message = `✅ Backup created successfully!\n\n`;
      message += `📦 ID: ${backup.id || "-"}\n`;
      message += `📏 Size: ${backup.size || "-"}\n`;
      message += `📋 Tables: ${backup.tables || "-"}\n`;
      message += `📅 Created: ${
        toDateSafe(backup.createdAt)
          ? toDateSafe(backup.createdAt).toLocaleString()
          : "-"
      }`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle unban_user_{userId} callback
  async handleUnbanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^unban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid unban action.");
      const userId = match[1];
      await this.handleUnbanUser(ctx, userId);
      // Refresh banned users list
      setTimeout(() => this.handleBannedUsers(ctx), 500);
    } catch (error) {
      logger.error("Error in unban user callback:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle ban_user_{userId} callback
  async handleBanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^ban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid ban action.");
      const userId = match[1];
      await this.handleBanUser(ctx, userId);
      // Refresh banned users list if coming from banned users, else refresh search
      if (ctx.session && ctx.session.state === "awaiting_user_search") {
        ctx.reply("🔄 User banned. Please search again or go back.");
      } else {
        setTimeout(() => this.handleBannedUsers(ctx), 500);
      }
    } catch (error) {
      logger.error("Error in ban user callback:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_company_{companyId} callback
  async handleApproveCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const companyId = match[1];
      await this.handleApproveCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in approve company callback:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_company_{companyId} callback
  async handleRejectCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const companyId = match[1];
      await this.handleRejectCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in reject company callback:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_order_{orderId} callback
  async handleApproveOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const orderId = match[1];
      await this.handleApproveOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in approve order callback:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_order_{orderId} callback
  async handleRejectOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const orderId = match[1];
      await this.handleRejectOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in reject order callback:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const payoutId = match[1];
      await this.handleApprovePayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in approve payout callback:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_payout_{payoutId} callback
  async handleRejectPayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const payoutId = match[1];
      await this.handleRejectPayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in reject payout callback:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "approved", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `✅ Your product (${product.title}) has been approved and is now public!`,
            { type: "product", action: "approved", productId }
          );
      }
      ctx.reply("✅ Product approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving product:", error);
      ctx.reply("❌ Failed to approve product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "rejected", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`,
            { type: "product", action: "rejected", productId }
          );
      }
      ctx.reply("❌ Product rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting product:", error);
      ctx.reply("❌ Failed to reject product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply("No users found.");
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach((user) => {
        msg += `• ${
          user.first_name || user.firstName || user.username || user.id
        }\n`;
        buttons.push([
          Markup.button.callback(
            user.first_name || user.firstName || user.username || user.id,
            `admin_user_${user.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_list_users_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_users_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing users:", error);
      ctx.reply("❌ Failed to list users.");
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply("❌ User not found.");
      let msg = `👤 *${
        user.first_name || user.firstName || user.username || user.id
      }*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || "N/A"}\n`;
      msg += `Phone: ${user.phone_number || "N/A"}\n`;
      msg += `Email: ${user.email || "N/A"}\n`;
      msg += `Role: ${user.role || "user"}\n`;
      msg += `Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Verified: ${user.phone_verified ? "✅" : "❌"}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${
        user.referralCodes
          ? Object.values(user.referralCodes).join(", ")
          : "N/A"
      }\n`;
      msg += `Last Active: ${
        toDateSafe(user.last_active)
          ? toDateSafe(user.last_active).toLocaleString()
          : "N/A"
      }\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany
        ? "🟢 Eligible to register companies"
        : "🔴 Not eligible to register companies";
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += "No purchases found.\n";
      } else {
        orders.forEach((order) => {
          msg += `• ${order.product_title || order.productId} ($${
            order.amount
          }) from company ${order.company_name || order.companyId} on ${
            toDateSafe(order.createdAt)
              ? toDateSafe(order.createdAt).toLocaleString()
              : "N/A"
          }\n`;
        });
      }
      // Referral stats
      const stats = await referralService.getReferralStats(userId);
      msg += `\n*Referral Stats:*\n`;
      msg += `Total Referrals: ${stats.totalReferrals}\n`;
      msg += `Total Earnings: $${stats.totalEarnings.toFixed(2)}\n`;
      msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
      msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
      // Companies joined and referral codes
      if (user.joinedCompanies && user.joinedCompanies.length) {
        msg += `\n*Companies Joined:*\n`;
        for (const companyId of user.joinedCompanies) {
          const company = await companyService.getCompanyById(companyId);
          const code =
            user.referralCodes && company && company.codePrefix
              ? user.referralCodes[company.codePrefix]
              : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += "\n";
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([
          Markup.button.callback("✅ Unban", `unban_user_${user.id}`),
        ]);
      } else {
        buttons.push([Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            "❌ Demote (Remove Company Permission)",
            `demote_company_${user.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            "✅ Promote (Allow Company Registration)",
            `promote_company_${user.id}`
          ),
        ]);
      }
      // Back button to user list
      buttons.push([
        Markup.button.callback("🔙 Back to Users", "admin_list_users"),
      ]);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply("❌ Failed to load user details.");
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply("✅ User promoted: can now register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply("❌ User demoted: can no longer register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply("❌ Failed to demote user.");
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: false,
    });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number &&
            u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
          (u.first_name &&
            u.first_name.toLowerCase().includes(search.toLowerCase())) ||
          (u.last_name &&
            u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${
        u.first_name || u.firstName || "No name"
      } (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1)
      buttons.push([
        Markup.button.callback("⬅️ Prev", `all_users_menu_${page - 1}`),
      ]);
    if (page < totalPages)
      buttons.push([
        Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`),
      ]);
    buttons.push([
      Markup.button.callback("🔍 Search User", "all_users_search"),
    ]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    const userButtons = pageUsers.map((u) => [
      Markup.button.callback(
        `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
        `admin_user_${u.id}`
      ),
    ]);
    buttons.unshift(...userButtons);
    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    ctx.session.state = null;
  }

  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const bannedUsers = await userService.getBannedUsers();
      if (!bannedUsers.length) {
        return ctx.reply("No banned users found.");
      }
      let message = `🚫 *Banned Users*\n\n`;
      bannedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unbanUser(userId);
      ctx.reply("✅ User unbanned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.banUser(userId);
      ctx.reply("✅ User banned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.approveCompany(companyId);
      ctx.reply("✅ Company approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.approveOrder(orderId);
      ctx.reply("✅ Order approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving order:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.rejectOrder(orderId);
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies.");
      }
      let message = `⚠️ *Pending Company Registrations*\n\n`;
      companies.forEach((company, i) => {
        message += `${i + 1}. ${company.name} (${company.id})\n`;
        message += `   📧 ${company.email || "N/A"}\n`;
        message += `   📞 ${company.phone || "N/A"}\n`;
        message += `   👤 ${company.ownerName || company.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(company.createdAt)
            ? toDateSafe(company.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${company.referralCode || "N/A"}\n`;
        message += `   👥 ${company.joinedUsers || 0} Users\n`;
        message += `   💰 ${company.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${company.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_companies"
          ),
        ],
        [
          Markup.button.callback(
            "❌ Reject All",
            "reject_all_pending_companies"
          ),
        ],
        [Markup.button.callback("🔙 Back to Companies", "admin_companies")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleApproveCompany(ctx, company.id);
      }
      ctx.reply("✅ All pending companies approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending companies:", error);
      ctx.reply("❌ Failed to approve all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleRejectCompany(ctx, company.id);
      }
      ctx.reply("❌ All pending companies rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending companies:", error);
      ctx.reply("❌ Failed to reject all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders.");
      }
      let message = `⏳ *Pending Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.productTitle} ($${order.amount})\n`;
        message += `   👤 ${order.userName}\n`;
        message += `   📅 ${
          toDateSafe(order.createdAt)
            ? toDateSafe(order.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${order.referralCode || "N/A"}\n`;
        message += `   💰 ${order.amount} Revenue\n`;
        message += `   ⚙️ ${order.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_orders"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_orders")],
        [Markup.button.callback("🔙 Back to Orders", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleApproveOrder(ctx, order.id);
      }
      ctx.reply("✅ All pending orders approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending orders:", error);
      ctx.reply("❌ Failed to approve all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleRejectOrder(ctx, order.id);
      }
      ctx.reply("❌ All pending orders rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending orders:", error);
      ctx.reply("❌ Failed to reject all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      if (!payouts.length) {
        return ctx.reply("No pending payouts.");
      }
      let message = `⏳ *Pending Payouts*\n\n`;
      payouts.forEach((payout, i) => {
        message += `${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        }\n`;
        message += `   📅 ${
          toDateSafe(payout.requestedAt)
            ? toDateSafe(payout.requestedAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   ⚙️ ${payout.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_payouts"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_payouts")],
        [Markup.button.callback("🔙 Back to Payouts", "admin_payouts")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending payouts:", error);
      ctx.reply("❌ Failed to load pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleApprovePayout(ctx, payout.id);
      }
      ctx.reply("✅ All pending payouts approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending payouts:", error);
      ctx.reply("❌ Failed to approve all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleRejectPayout(ctx, payout.id);
      }
      ctx.reply("❌ All pending payouts rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending payouts:", error);
      ctx.reply("❌ Failed to reject all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessage(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.session.state = "awaiting_maintenance_message";
      ctx.reply("📝 Please enter the message for the maintenance mode:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting maintenance message:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessageInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;
      if (
        !ctx.session ||
        ctx.session.state !== "awaiting_maintenance_message"
      ) {
        return ctx.reply("❌ Invalid state for maintenance message input.");
      }
      const message = messageText.trim();
      if (!message) {
        return ctx.reply("❌ Message cannot be empty.");
      }
      await adminService.setMaintenanceMessage(message);
      ctx.reply("✅ Maintenance message updated.");
      delete ctx.session.state;
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting maintenance message:", error);
      ctx.reply("❌ Failed to set maintenance message.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const currentMode = await adminService.getMaintenanceMode();

      const message = `
🔧 *Maintenance Mode*

Current Status: ${currentMode ? "🔴 ENABLED" : "🟢 DISABLED"}

${
  currentMode
    ? "The bot is currently in maintenance mode. Only admins can use the bot."
    : "The bot is operating normally. All users can access features."
}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            currentMode ? "🟢 Disable Maintenance" : "🔴 Enable Maintenance",
            "toggle_maintenance"
          ),
        ],
        [
          Markup.button.callback(
            "📢 Maintenance Message",
            "maintenance_message"
          ),
        ],
        [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing maintenance mode:", error);
      ctx.reply("❌ Failed to load maintenance settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const newMode = await adminService.toggleMaintenanceMode();

      ctx.reply(`✅ Maintenance mode ${newMode ? "enabled" : "disabled"}.`);
      if (ctx.callbackQuery) ctx.answerCbQuery();

      // Refresh maintenance settings
      setTimeout(() => {
        this.handleMaintenanceMode(ctx);
      }, 1000);
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportData(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const exportType = ctx.callbackQuery.data.split("_")[1];

      ctx.reply("📤 Generating export... This may take a moment.");

      const exportData = await adminService.exportData(exportType);

      // In a real implementation, you would send the file
      // For now, we'll just show a summary
      ctx.reply(
        `✅ Export completed!\n\n📊 Summary:\n• Records: ${exportData.recordCount}\n• File size: ${exportData.fileSize}\n• Format: CSV\n\nFile would be sent here in production.`
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting data:", error);
      ctx.reply("❌ Export failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalytics();
      let message = `📊 *Company Analytics Summary*\n\n`;
      message += `• Total Companies: ${stats.total}\n`;
      message += `• Approved: ${stats.approved}\n`;
      message += `• Pending: ${stats.pending}\n`;
      message += `• Rejected: ${stats.rejected}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "admin_companies")],
        ]),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("💾 Creating system backup... Please wait.");
      const backup = await adminService.createBackup();
      let message = `✅ Backup created successfully!\n\n`;
      message += `📦 ID: ${backup.id || "-"}\n`;
      message += `📏 Size: ${backup.size || "-"}\n`;
      message += `📋 Tables: ${backup.tables || "-"}\n`;
      message += `📅 Created: ${
        toDateSafe(backup.createdAt)
          ? toDateSafe(backup.createdAt).toLocaleString()
          : "-"
      }`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle unban_user_{userId} callback
  async handleUnbanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^unban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid unban action.");
      const userId = match[1];
      await this.handleUnbanUser(ctx, userId);
      // Refresh banned users list
      setTimeout(() => this.handleBannedUsers(ctx), 500);
    } catch (error) {
      logger.error("Error in unban user callback:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle ban_user_{userId} callback
  async handleBanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^ban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid ban action.");
      const userId = match[1];
      await this.handleBanUser(ctx, userId);
      // Refresh banned users list if coming from banned users, else refresh search
      if (ctx.session && ctx.session.state === "awaiting_user_search") {
        ctx.reply("🔄 User banned. Please search again or go back.");
      } else {
        setTimeout(() => this.handleBannedUsers(ctx), 500);
      }
    } catch (error) {
      logger.error("Error in ban user callback:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_company_{companyId} callback
  async handleApproveCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const companyId = match[1];
      await this.handleApproveCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in approve company callback:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_company_{companyId} callback
  async handleRejectCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const companyId = match[1];
      await this.handleRejectCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in reject company callback:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_order_{orderId} callback
  async handleApproveOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const orderId = match[1];
      await this.handleApproveOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in approve order callback:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_order_{orderId} callback
  async handleRejectOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const orderId = match[1];
      await this.handleRejectOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in reject order callback:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const payoutId = match[1];
      await this.handleApprovePayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in approve payout callback:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_payout_{payoutId} callback
  async handleRejectPayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const payoutId = match[1];
      await this.handleRejectPayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in reject payout callback:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "approved", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `✅ Your product (${product.title}) has been approved and is now public!`,
            { type: "product", action: "approved", productId }
          );
      }
      ctx.reply("✅ Product approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving product:", error);
      ctx.reply("❌ Failed to approve product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "rejected", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`,
            { type: "product", action: "rejected", productId }
          );
      }
      ctx.reply("❌ Product rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting product:", error);
      ctx.reply("❌ Failed to reject product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply("No users found.");
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach((user) => {
        msg += `• ${
          user.first_name || user.firstName || user.username || user.id
        }\n`;
        buttons.push([
          Markup.button.callback(
            user.first_name || user.firstName || user.username || user.id,
            `admin_user_${user.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_list_users_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_users_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing users:", error);
      ctx.reply("❌ Failed to list users.");
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply("❌ User not found.");
      let msg = `👤 *${
        user.first_name || user.firstName || user.username || user.id
      }*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || "N/A"}\n`;
      msg += `Phone: ${user.phone_number || "N/A"}\n`;
      msg += `Email: ${user.email || "N/A"}\n`;
      msg += `Role: ${user.role || "user"}\n`;
      msg += `Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Verified: ${user.phone_verified ? "✅" : "❌"}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${
        user.referralCodes
          ? Object.values(user.referralCodes).join(", ")
          : "N/A"
      }\n`;
      msg += `Last Active: ${
        toDateSafe(user.last_active)
          ? toDateSafe(user.last_active).toLocaleString()
          : "N/A"
      }\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany
        ? "🟢 Eligible to register companies"
        : "🔴 Not eligible to register companies";
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += "No purchases found.\n";
      } else {
        orders.forEach((order) => {
          msg += `• ${order.product_title || order.productId} ($${
            order.amount
          }) from company ${order.company_name || order.companyId} on ${
            toDateSafe(order.createdAt)
              ? toDateSafe(order.createdAt).toLocaleString()
              : "N/A"
          }\n`;
        });
      }
      // Referral stats
      const stats = await referralService.getReferralStats(userId);
      msg += `\n*Referral Stats:*\n`;
      msg += `Total Referrals: ${stats.totalReferrals}\n`;
      msg += `Total Earnings: $${stats.totalEarnings.toFixed(2)}\n`;
      msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
      msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
      // Companies joined and referral codes
      if (user.joinedCompanies && user.joinedCompanies.length) {
        msg += `\n*Companies Joined:*\n`;
        for (const companyId of user.joinedCompanies) {
          const company = await companyService.getCompanyById(companyId);
          const code =
            user.referralCodes && company && company.codePrefix
              ? user.referralCodes[company.codePrefix]
              : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += "\n";
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([
          Markup.button.callback("✅ Unban", `unban_user_${user.id}`),
        ]);
      } else {
        buttons.push([Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            "❌ Demote (Remove Company Permission)",
            `demote_company_${user.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            "✅ Promote (Allow Company Registration)",
            `promote_company_${user.id}`
          ),
        ]);
      }
      // Back button to user list
      buttons.push([
        Markup.button.callback("🔙 Back to Users", "admin_list_users"),
      ]);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply("❌ Failed to load user details.");
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply("✅ User promoted: can now register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply("❌ User demoted: can no longer register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply("❌ Failed to demote user.");
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: false,
    });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number &&
            u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
          (u.first_name &&
            u.first_name.toLowerCase().includes(search.toLowerCase())) ||
          (u.last_name &&
            u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${
        u.first_name || u.firstName || "No name"
      } (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1)
      buttons.push([
        Markup.button.callback("⬅️ Prev", `all_users_menu_${page - 1}`),
      ]);
    if (page < totalPages)
      buttons.push([
        Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`),
      ]);
    buttons.push([
      Markup.button.callback("🔍 Search User", "all_users_search"),
    ]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    const userButtons = pageUsers.map((u) => [
      Markup.button.callback(
        `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
        `admin_user_${u.id}`
      ),
    ]);
    buttons.unshift(...userButtons);
    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    ctx.session.state = null;
  }

  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const bannedUsers = await userService.getBannedUsers();
      if (!bannedUsers.length) {
        return ctx.reply("No banned users found.");
      }
      let message = `🚫 *Banned Users*\n\n`;
      bannedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unbanUser(userId);
      ctx.reply("✅ User unbanned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.banUser(userId);
      ctx.reply("✅ User banned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.approveCompany(companyId);
      ctx.reply("✅ Company approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.approveOrder(orderId);
      ctx.reply("✅ Order approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving order:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.rejectOrder(orderId);
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies.");
      }
      let message = `⚠️ *Pending Company Registrations*\n\n`;
      companies.forEach((company, i) => {
        message += `${i + 1}. ${company.name} (${company.id})\n`;
        message += `   📧 ${company.email || "N/A"}\n`;
        message += `   📞 ${company.phone || "N/A"}\n`;
        message += `   👤 ${company.ownerName || company.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(company.createdAt)
            ? toDateSafe(company.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${company.referralCode || "N/A"}\n`;
        message += `   👥 ${company.joinedUsers || 0} Users\n`;
        message += `   💰 ${company.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${company.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_companies"
          ),
        ],
        [
          Markup.button.callback(
            "❌ Reject All",
            "reject_all_pending_companies"
          ),
        ],
        [Markup.button.callback("🔙 Back to Companies", "admin_companies")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleApproveCompany(ctx, company.id);
      }
      ctx.reply("✅ All pending companies approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending companies:", error);
      ctx.reply("❌ Failed to approve all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleRejectCompany(ctx, company.id);
      }
      ctx.reply("❌ All pending companies rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending companies:", error);
      ctx.reply("❌ Failed to reject all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders.");
      }
      let message = `⏳ *Pending Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.productTitle} ($${order.amount})\n`;
        message += `   👤 ${order.userName}\n`;
        message += `   📅 ${
          toDateSafe(order.createdAt)
            ? toDateSafe(order.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${order.referralCode || "N/A"}\n`;
        message += `   💰 ${order.amount} Revenue\n`;
        message += `   ⚙️ ${order.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_orders"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_orders")],
        [Markup.button.callback("🔙 Back to Orders", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleApproveOrder(ctx, order.id);
      }
      ctx.reply("✅ All pending orders approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending orders:", error);
      ctx.reply("❌ Failed to approve all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleRejectOrder(ctx, order.id);
      }
      ctx.reply("❌ All pending orders rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending orders:", error);
      ctx.reply("❌ Failed to reject all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      if (!payouts.length) {
        return ctx.reply("No pending payouts.");
      }
      let message = `⏳ *Pending Payouts*\n\n`;
      payouts.forEach((payout, i) => {
        message += `${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        }\n`;
        message += `   📅 ${
          toDateSafe(payout.requestedAt)
            ? toDateSafe(payout.requestedAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   ⚙️ ${payout.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_payouts"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_payouts")],
        [Markup.button.callback("🔙 Back to Payouts", "admin_payouts")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending payouts:", error);
      ctx.reply("❌ Failed to load pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleApprovePayout(ctx, payout.id);
      }
      ctx.reply("✅ All pending payouts approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending payouts:", error);
      ctx.reply("❌ Failed to approve all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleRejectPayout(ctx, payout.id);
      }
      ctx.reply("❌ All pending payouts rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending payouts:", error);
      ctx.reply("❌ Failed to reject all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessage(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.session.state = "awaiting_maintenance_message";
      ctx.reply("📝 Please enter the message for the maintenance mode:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting maintenance message:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessageInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;
      if (
        !ctx.session ||
        ctx.session.state !== "awaiting_maintenance_message"
      ) {
        return ctx.reply("❌ Invalid state for maintenance message input.");
      }
      const message = messageText.trim();
      if (!message) {
        return ctx.reply("❌ Message cannot be empty.");
      }
      await adminService.setMaintenanceMessage(message);
      ctx.reply("✅ Maintenance message updated.");
      delete ctx.session.state;
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting maintenance message:", error);
      ctx.reply("❌ Failed to set maintenance message.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const currentMode = await adminService.getMaintenanceMode();

      const message = `
🔧 *Maintenance Mode*

Current Status: ${currentMode ? "🔴 ENABLED" : "🟢 DISABLED"}

${
  currentMode
    ? "The bot is currently in maintenance mode. Only admins can use the bot."
    : "The bot is operating normally. All users can access features."
}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            currentMode ? "🟢 Disable Maintenance" : "🔴 Enable Maintenance",
            "toggle_maintenance"
          ),
        ],
        [
          Markup.button.callback(
            "📢 Maintenance Message",
            "maintenance_message"
          ),
        ],
        [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing maintenance mode:", error);
      ctx.reply("❌ Failed to load maintenance settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const newMode = await adminService.toggleMaintenanceMode();

      ctx.reply(`✅ Maintenance mode ${newMode ? "enabled" : "disabled"}.`);
      if (ctx.callbackQuery) ctx.answerCbQuery();

      // Refresh maintenance settings
      setTimeout(() => {
        this.handleMaintenanceMode(ctx);
      }, 1000);
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportData(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const exportType = ctx.callbackQuery.data.split("_")[1];

      ctx.reply("📤 Generating export... This may take a moment.");

      const exportData = await adminService.exportData(exportType);

      // In a real implementation, you would send the file
      // For now, we'll just show a summary
      ctx.reply(
        `✅ Export completed!\n\n📊 Summary:\n• Records: ${exportData.recordCount}\n• File size: ${exportData.fileSize}\n• Format: CSV\n\nFile would be sent here in production.`
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting data:", error);
      ctx.reply("❌ Export failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalytics();
      let message = `📊 *Company Analytics Summary*\n\n`;
      message += `• Total Companies: ${stats.total}\n`;
      message += `• Approved: ${stats.approved}\n`;
      message += `• Pending: ${stats.pending}\n`;
      message += `• Rejected: ${stats.rejected}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "admin_companies")],
        ]),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("💾 Creating system backup... Please wait.");
      const backup = await adminService.createBackup();
      let message = `✅ Backup created successfully!\n\n`;
      message += `📦 ID: ${backup.id || "-"}\n`;
      message += `📏 Size: ${backup.size || "-"}\n`;
      message += `📋 Tables: ${backup.tables || "-"}\n`;
      message += `📅 Created: ${
        toDateSafe(backup.createdAt)
          ? toDateSafe(backup.createdAt).toLocaleString()
          : "-"
      }`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle unban_user_{userId} callback
  async handleUnbanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^unban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid unban action.");
      const userId = match[1];
      await this.handleUnbanUser(ctx, userId);
      // Refresh banned users list
      setTimeout(() => this.handleBannedUsers(ctx), 500);
    } catch (error) {
      logger.error("Error in unban user callback:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle ban_user_{userId} callback
  async handleBanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^ban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid ban action.");
      const userId = match[1];
      await this.handleBanUser(ctx, userId);
      // Refresh banned users list if coming from banned users, else refresh search
      if (ctx.session && ctx.session.state === "awaiting_user_search") {
        ctx.reply("🔄 User banned. Please search again or go back.");
      } else {
        setTimeout(() => this.handleBannedUsers(ctx), 500);
      }
    } catch (error) {
      logger.error("Error in ban user callback:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_company_{companyId} callback
  async handleApproveCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const companyId = match[1];
      await this.handleApproveCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in approve company callback:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_company_{companyId} callback
  async handleRejectCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const companyId = match[1];
      await this.handleRejectCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in reject company callback:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_order_{orderId} callback
  async handleApproveOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const orderId = match[1];
      await this.handleApproveOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in approve order callback:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_order_{orderId} callback
  async handleRejectOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const orderId = match[1];
      await this.handleRejectOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in reject order callback:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const payoutId = match[1];
      await this.handleApprovePayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in approve payout callback:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_payout_{payoutId} callback
  async handleRejectPayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const payoutId = match[1];
      await this.handleRejectPayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in reject payout callback:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "approved", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `✅ Your product (${product.title}) has been approved and is now public!`,
            { type: "product", action: "approved", productId }
          );
      }
      ctx.reply("✅ Product approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving product:", error);
      ctx.reply("❌ Failed to approve product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "rejected", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`,
            { type: "product", action: "rejected", productId }
          );
      }
      ctx.reply("❌ Product rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting product:", error);
      ctx.reply("❌ Failed to reject product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply("No users found.");
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach((user) => {
        msg += `• ${
          user.first_name || user.firstName || user.username || user.id
        }\n`;
        buttons.push([
          Markup.button.callback(
            user.first_name || user.firstName || user.username || user.id,
            `admin_user_${user.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_list_users_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_users_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing users:", error);
      ctx.reply("❌ Failed to list users.");
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply("❌ User not found.");
      let msg = `👤 *${
        user.first_name || user.firstName || user.username || user.id
      }*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || "N/A"}\n`;
      msg += `Phone: ${user.phone_number || "N/A"}\n`;
      msg += `Email: ${user.email || "N/A"}\n`;
      msg += `Role: ${user.role || "user"}\n`;
      msg += `Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Verified: ${user.phone_verified ? "✅" : "❌"}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${
        user.referralCodes
          ? Object.values(user.referralCodes).join(", ")
          : "N/A"
      }\n`;
      msg += `Last Active: ${
        toDateSafe(user.last_active)
          ? toDateSafe(user.last_active).toLocaleString()
          : "N/A"
      }\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany
        ? "🟢 Eligible to register companies"
        : "🔴 Not eligible to register companies";
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += "No purchases found.\n";
      } else {
        orders.forEach((order) => {
          msg += `• ${order.product_title || order.productId} ($${
            order.amount
          }) from company ${order.company_name || order.companyId} on ${
            toDateSafe(order.createdAt)
              ? toDateSafe(order.createdAt).toLocaleString()
              : "N/A"
          }\n`;
        });
      }
      // Referral stats
      const stats = await referralService.getReferralStats(userId);
      msg += `\n*Referral Stats:*\n`;
      msg += `Total Referrals: ${stats.totalReferrals}\n`;
      msg += `Total Earnings: $${stats.totalEarnings.toFixed(2)}\n`;
      msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
      msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
      // Companies joined and referral codes
      if (user.joinedCompanies && user.joinedCompanies.length) {
        msg += `\n*Companies Joined:*\n`;
        for (const companyId of user.joinedCompanies) {
          const company = await companyService.getCompanyById(companyId);
          const code =
            user.referralCodes && company && company.codePrefix
              ? user.referralCodes[company.codePrefix]
              : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += "\n";
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([
          Markup.button.callback("✅ Unban", `unban_user_${user.id}`),
        ]);
      } else {
        buttons.push([Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            "❌ Demote (Remove Company Permission)",
            `demote_company_${user.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            "✅ Promote (Allow Company Registration)",
            `promote_company_${user.id}`
          ),
        ]);
      }
      // Back button to user list
      buttons.push([
        Markup.button.callback("🔙 Back to Users", "admin_list_users"),
      ]);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply("❌ Failed to load user details.");
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply("✅ User promoted: can now register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply("❌ User demoted: can no longer register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply("❌ Failed to demote user.");
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: false,
    });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number &&
            u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
          (u.first_name &&
            u.first_name.toLowerCase().includes(search.toLowerCase())) ||
          (u.last_name &&
            u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${
        u.first_name || u.firstName || "No name"
      } (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1)
      buttons.push([
        Markup.button.callback("⬅️ Prev", `all_users_menu_${page - 1}`),
      ]);
    if (page < totalPages)
      buttons.push([
        Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`),
      ]);
    buttons.push([
      Markup.button.callback("🔍 Search User", "all_users_search"),
    ]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    const userButtons = pageUsers.map((u) => [
      Markup.button.callback(
        `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
        `admin_user_${u.id}`
      ),
    ]);
    buttons.unshift(...userButtons);
    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    ctx.session.state = null;
  }

  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const bannedUsers = await userService.getBannedUsers();
      if (!bannedUsers.length) {
        return ctx.reply("No banned users found.");
      }
      let message = `🚫 *Banned Users*\n\n`;
      bannedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unbanUser(userId);
      ctx.reply("✅ User unbanned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.banUser(userId);
      ctx.reply("✅ User banned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.approveCompany(companyId);
      ctx.reply("✅ Company approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.approveOrder(orderId);
      ctx.reply("✅ Order approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving order:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.rejectOrder(orderId);
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies.");
      }
      let message = `⚠️ *Pending Company Registrations*\n\n`;
      companies.forEach((company, i) => {
        message += `${i + 1}. ${company.name} (${company.id})\n`;
        message += `   📧 ${company.email || "N/A"}\n`;
        message += `   📞 ${company.phone || "N/A"}\n`;
        message += `   👤 ${company.ownerName || company.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(company.createdAt)
            ? toDateSafe(company.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${company.referralCode || "N/A"}\n`;
        message += `   👥 ${company.joinedUsers || 0} Users\n`;
        message += `   💰 ${company.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${company.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_companies"
          ),
        ],
        [
          Markup.button.callback(
            "❌ Reject All",
            "reject_all_pending_companies"
          ),
        ],
        [Markup.button.callback("🔙 Back to Companies", "admin_companies")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleApproveCompany(ctx, company.id);
      }
      ctx.reply("✅ All pending companies approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending companies:", error);
      ctx.reply("❌ Failed to approve all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleRejectCompany(ctx, company.id);
      }
      ctx.reply("❌ All pending companies rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending companies:", error);
      ctx.reply("❌ Failed to reject all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders.");
      }
      let message = `⏳ *Pending Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.productTitle} ($${order.amount})\n`;
        message += `   👤 ${order.userName}\n`;
        message += `   📅 ${
          toDateSafe(order.createdAt)
            ? toDateSafe(order.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${order.referralCode || "N/A"}\n`;
        message += `   💰 ${order.amount} Revenue\n`;
        message += `   ⚙️ ${order.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_orders"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_orders")],
        [Markup.button.callback("🔙 Back to Orders", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleApproveOrder(ctx, order.id);
      }
      ctx.reply("✅ All pending orders approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending orders:", error);
      ctx.reply("❌ Failed to approve all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleRejectOrder(ctx, order.id);
      }
      ctx.reply("❌ All pending orders rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending orders:", error);
      ctx.reply("❌ Failed to reject all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      if (!payouts.length) {
        return ctx.reply("No pending payouts.");
      }
      let message = `⏳ *Pending Payouts*\n\n`;
      payouts.forEach((payout, i) => {
        message += `${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        }\n`;
        message += `   📅 ${
          toDateSafe(payout.requestedAt)
            ? toDateSafe(payout.requestedAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   ⚙️ ${payout.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_payouts"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_payouts")],
        [Markup.button.callback("🔙 Back to Payouts", "admin_payouts")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending payouts:", error);
      ctx.reply("❌ Failed to load pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleApprovePayout(ctx, payout.id);
      }
      ctx.reply("✅ All pending payouts approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending payouts:", error);
      ctx.reply("❌ Failed to approve all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleRejectPayout(ctx, payout.id);
      }
      ctx.reply("❌ All pending payouts rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending payouts:", error);
      ctx.reply("❌ Failed to reject all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessage(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.session.state = "awaiting_maintenance_message";
      ctx.reply("📝 Please enter the message for the maintenance mode:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting maintenance message:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessageInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;
      if (
        !ctx.session ||
        ctx.session.state !== "awaiting_maintenance_message"
      ) {
        return ctx.reply("❌ Invalid state for maintenance message input.");
      }
      const message = messageText.trim();
      if (!message) {
        return ctx.reply("❌ Message cannot be empty.");
      }
      await adminService.setMaintenanceMessage(message);
      ctx.reply("✅ Maintenance message updated.");
      delete ctx.session.state;
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting maintenance message:", error);
      ctx.reply("❌ Failed to set maintenance message.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const currentMode = await adminService.getMaintenanceMode();

      const message = `
🔧 *Maintenance Mode*

Current Status: ${currentMode ? "🔴 ENABLED" : "🟢 DISABLED"}

${
  currentMode
    ? "The bot is currently in maintenance mode. Only admins can use the bot."
    : "The bot is operating normally. All users can access features."
}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            currentMode ? "🟢 Disable Maintenance" : "🔴 Enable Maintenance",
            "toggle_maintenance"
          ),
        ],
        [
          Markup.button.callback(
            "📢 Maintenance Message",
            "maintenance_message"
          ),
        ],
        [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing maintenance mode:", error);
      ctx.reply("❌ Failed to load maintenance settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const newMode = await adminService.toggleMaintenanceMode();

      ctx.reply(`✅ Maintenance mode ${newMode ? "enabled" : "disabled"}.`);
      if (ctx.callbackQuery) ctx.answerCbQuery();

      // Refresh maintenance settings
      setTimeout(() => {
        this.handleMaintenanceMode(ctx);
      }, 1000);
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportData(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const exportType = ctx.callbackQuery.data.split("_")[1];

      ctx.reply("📤 Generating export... This may take a moment.");

      const exportData = await adminService.exportData(exportType);

      // In a real implementation, you would send the file
      // For now, we'll just show a summary
      ctx.reply(
        `✅ Export completed!\n\n📊 Summary:\n• Records: ${exportData.recordCount}\n• File size: ${exportData.fileSize}\n• Format: CSV\n\nFile would be sent here in production.`
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting data:", error);
      ctx.reply("❌ Export failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalytics();
      let message = `📊 *Company Analytics Summary*\n\n`;
      message += `• Total Companies: ${stats.total}\n`;
      message += `• Approved: ${stats.approved}\n`;
      message += `• Pending: ${stats.pending}\n`;
      message += `• Rejected: ${stats.rejected}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "admin_companies")],
        ]),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("💾 Creating system backup... Please wait.");
      const backup = await adminService.createBackup();
      let message = `✅ Backup created successfully!\n\n`;
      message += `📦 ID: ${backup.id || "-"}\n`;
      message += `📏 Size: ${backup.size || "-"}\n`;
      message += `📋 Tables: ${backup.tables || "-"}\n`;
      message += `📅 Created: ${
        toDateSafe(backup.createdAt)
          ? toDateSafe(backup.createdAt).toLocaleString()
          : "-"
      }`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle unban_user_{userId} callback
  async handleUnbanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^unban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid unban action.");
      const userId = match[1];
      await this.handleUnbanUser(ctx, userId);
      // Refresh banned users list
      setTimeout(() => this.handleBannedUsers(ctx), 500);
    } catch (error) {
      logger.error("Error in unban user callback:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle ban_user_{userId} callback
  async handleBanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^ban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid ban action.");
      const userId = match[1];
      await this.handleBanUser(ctx, userId);
      // Refresh banned users list if coming from banned users, else refresh search
      if (ctx.session && ctx.session.state === "awaiting_user_search") {
        ctx.reply("🔄 User banned. Please search again or go back.");
      } else {
        setTimeout(() => this.handleBannedUsers(ctx), 500);
      }
    } catch (error) {
      logger.error("Error in ban user callback:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_company_{companyId} callback
  async handleApproveCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const companyId = match[1];
      await this.handleApproveCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in approve company callback:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_company_{companyId} callback
  async handleRejectCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const companyId = match[1];
      await this.handleRejectCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in reject company callback:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_order_{orderId} callback
  async handleApproveOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const orderId = match[1];
      await this.handleApproveOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in approve order callback:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_order_{orderId} callback
  async handleRejectOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const orderId = match[1];
      await this.handleRejectOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in reject order callback:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const payoutId = match[1];
      await this.handleApprovePayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in approve payout callback:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_payout_{payoutId} callback
  async handleRejectPayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const payoutId = match[1];
      await this.handleRejectPayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in reject payout callback:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "approved", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `✅ Your product (${product.title}) has been approved and is now public!`,
            { type: "product", action: "approved", productId }
          );
      }
      ctx.reply("✅ Product approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving product:", error);
      ctx.reply("❌ Failed to approve product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "rejected", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`,
            { type: "product", action: "rejected", productId }
          );
      }
      ctx.reply("❌ Product rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting product:", error);
      ctx.reply("❌ Failed to reject product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply("No users found.");
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach((user) => {
        msg += `• ${
          user.first_name || user.firstName || user.username || user.id
        }\n`;
        buttons.push([
          Markup.button.callback(
            user.first_name || user.firstName || user.username || user.id,
            `admin_user_${user.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_list_users_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_users_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing users:", error);
      ctx.reply("❌ Failed to list users.");
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply("❌ User not found.");
      let msg = `👤 *${
        user.first_name || user.firstName || user.username || user.id
      }*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || "N/A"}\n`;
      msg += `Phone: ${user.phone_number || "N/A"}\n`;
      msg += `Email: ${user.email || "N/A"}\n`;
      msg += `Role: ${user.role || "user"}\n`;
      msg += `Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Verified: ${user.phone_verified ? "✅" : "❌"}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${
        user.referralCodes
          ? Object.values(user.referralCodes).join(", ")
          : "N/A"
      }\n`;
      msg += `Last Active: ${
        toDateSafe(user.last_active)
          ? toDateSafe(user.last_active).toLocaleString()
          : "N/A"
      }\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany
        ? "🟢 Eligible to register companies"
        : "🔴 Not eligible to register companies";
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += "No purchases found.\n";
      } else {
        orders.forEach((order) => {
          msg += `• ${order.product_title || order.productId} ($${
            order.amount
          }) from company ${order.company_name || order.companyId} on ${
            toDateSafe(order.createdAt)
              ? toDateSafe(order.createdAt).toLocaleString()
              : "N/A"
          }\n`;
        });
      }
      // Referral stats
      const stats = await referralService.getReferralStats(userId);
      msg += `\n*Referral Stats:*\n`;
      msg += `Total Referrals: ${stats.totalReferrals}\n`;
      msg += `Total Earnings: $${stats.totalEarnings.toFixed(2)}\n`;
      msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
      msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
      // Companies joined and referral codes
      if (user.joinedCompanies && user.joinedCompanies.length) {
        msg += `\n*Companies Joined:*\n`;
        for (const companyId of user.joinedCompanies) {
          const company = await companyService.getCompanyById(companyId);
          const code =
            user.referralCodes && company && company.codePrefix
              ? user.referralCodes[company.codePrefix]
              : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += "\n";
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([
          Markup.button.callback("✅ Unban", `unban_user_${user.id}`),
        ]);
      } else {
        buttons.push([Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            "❌ Demote (Remove Company Permission)",
            `demote_company_${user.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            "✅ Promote (Allow Company Registration)",
            `promote_company_${user.id}`
          ),
        ]);
      }
      // Back button to user list
      buttons.push([
        Markup.button.callback("🔙 Back to Users", "admin_list_users"),
      ]);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply("❌ Failed to load user details.");
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply("✅ User promoted: can now register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply("❌ User demoted: can no longer register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply("❌ Failed to demote user.");
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: false,
    });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number &&
            u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
          (u.first_name &&
            u.first_name.toLowerCase().includes(search.toLowerCase())) ||
          (u.last_name &&
            u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${
        u.first_name || u.firstName || "No name"
      } (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1)
      buttons.push([
        Markup.button.callback("⬅️ Prev", `all_users_menu_${page - 1}`),
      ]);
    if (page < totalPages)
      buttons.push([
        Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`),
      ]);
    buttons.push([
      Markup.button.callback("🔍 Search User", "all_users_search"),
    ]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    const userButtons = pageUsers.map((u) => [
      Markup.button.callback(
        `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
        `admin_user_${u.id}`
      ),
    ]);
    buttons.unshift(...userButtons);
    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    ctx.session.state = null;
  }

  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const bannedUsers = await userService.getBannedUsers();
      if (!bannedUsers.length) {
        return ctx.reply("No banned users found.");
      }
      let message = `🚫 *Banned Users*\n\n`;
      bannedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unbanUser(userId);
      ctx.reply("✅ User unbanned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.banUser(userId);
      ctx.reply("✅ User banned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.approveCompany(companyId);
      ctx.reply("✅ Company approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.approveOrder(orderId);
      ctx.reply("✅ Order approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving order:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.rejectOrder(orderId);
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies.");
      }
      let message = `⚠️ *Pending Company Registrations*\n\n`;
      companies.forEach((company, i) => {
        message += `${i + 1}. ${company.name} (${company.id})\n`;
        message += `   📧 ${company.email || "N/A"}\n`;
        message += `   📞 ${company.phone || "N/A"}\n`;
        message += `   👤 ${company.ownerName || company.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(company.createdAt)
            ? toDateSafe(company.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${company.referralCode || "N/A"}\n`;
        message += `   👥 ${company.joinedUsers || 0} Users\n`;
        message += `   💰 ${company.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${company.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_companies"
          ),
        ],
        [
          Markup.button.callback(
            "❌ Reject All",
            "reject_all_pending_companies"
          ),
        ],
        [Markup.button.callback("🔙 Back to Companies", "admin_companies")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleApproveCompany(ctx, company.id);
      }
      ctx.reply("✅ All pending companies approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending companies:", error);
      ctx.reply("❌ Failed to approve all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleRejectCompany(ctx, company.id);
      }
      ctx.reply("❌ All pending companies rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending companies:", error);
      ctx.reply("❌ Failed to reject all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders.");
      }
      let message = `⏳ *Pending Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.productTitle} ($${order.amount})\n`;
        message += `   👤 ${order.userName}\n`;
        message += `   📅 ${
          toDateSafe(order.createdAt)
            ? toDateSafe(order.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${order.referralCode || "N/A"}\n`;
        message += `   💰 ${order.amount} Revenue\n`;
        message += `   ⚙️ ${order.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_orders"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_orders")],
        [Markup.button.callback("🔙 Back to Orders", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleApproveOrder(ctx, order.id);
      }
      ctx.reply("✅ All pending orders approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending orders:", error);
      ctx.reply("❌ Failed to approve all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleRejectOrder(ctx, order.id);
      }
      ctx.reply("❌ All pending orders rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending orders:", error);
      ctx.reply("❌ Failed to reject all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      if (!payouts.length) {
        return ctx.reply("No pending payouts.");
      }
      let message = `⏳ *Pending Payouts*\n\n`;
      payouts.forEach((payout, i) => {
        message += `${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        }\n`;
        message += `   📅 ${
          toDateSafe(payout.requestedAt)
            ? toDateSafe(payout.requestedAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   ⚙️ ${payout.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_payouts"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_payouts")],
        [Markup.button.callback("🔙 Back to Payouts", "admin_payouts")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending payouts:", error);
      ctx.reply("❌ Failed to load pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleApprovePayout(ctx, payout.id);
      }
      ctx.reply("✅ All pending payouts approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending payouts:", error);
      ctx.reply("❌ Failed to approve all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleRejectPayout(ctx, payout.id);
      }
      ctx.reply("❌ All pending payouts rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending payouts:", error);
      ctx.reply("❌ Failed to reject all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessage(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.session.state = "awaiting_maintenance_message";
      ctx.reply("📝 Please enter the message for the maintenance mode:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting maintenance message:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessageInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;
      if (
        !ctx.session ||
        ctx.session.state !== "awaiting_maintenance_message"
      ) {
        return ctx.reply("❌ Invalid state for maintenance message input.");
      }
      const message = messageText.trim();
      if (!message) {
        return ctx.reply("❌ Message cannot be empty.");
      }
      await adminService.setMaintenanceMessage(message);
      ctx.reply("✅ Maintenance message updated.");
      delete ctx.session.state;
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting maintenance message:", error);
      ctx.reply("❌ Failed to set maintenance message.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const currentMode = await adminService.getMaintenanceMode();

      const message = `
🔧 *Maintenance Mode*

Current Status: ${currentMode ? "🔴 ENABLED" : "🟢 DISABLED"}

${
  currentMode
    ? "The bot is currently in maintenance mode. Only admins can use the bot."
    : "The bot is operating normally. All users can access features."
}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            currentMode ? "🟢 Disable Maintenance" : "🔴 Enable Maintenance",
            "toggle_maintenance"
          ),
        ],
        [
          Markup.button.callback(
            "📢 Maintenance Message",
            "maintenance_message"
          ),
        ],
        [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing maintenance mode:", error);
      ctx.reply("❌ Failed to load maintenance settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const newMode = await adminService.toggleMaintenanceMode();

      ctx.reply(`✅ Maintenance mode ${newMode ? "enabled" : "disabled"}.`);
      if (ctx.callbackQuery) ctx.answerCbQuery();

      // Refresh maintenance settings
      setTimeout(() => {
        this.handleMaintenanceMode(ctx);
      }, 1000);
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportData(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const exportType = ctx.callbackQuery.data.split("_")[1];

      ctx.reply("📤 Generating export... This may take a moment.");

      const exportData = await adminService.exportData(exportType);

      // In a real implementation, you would send the file
      // For now, we'll just show a summary
      ctx.reply(
        `✅ Export completed!\n\n📊 Summary:\n• Records: ${exportData.recordCount}\n• File size: ${exportData.fileSize}\n• Format: CSV\n\nFile would be sent here in production.`
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting data:", error);
      ctx.reply("❌ Export failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalytics();
      let message = `📊 *Company Analytics Summary*\n\n`;
      message += `• Total Companies: ${stats.total}\n`;
      message += `• Approved: ${stats.approved}\n`;
      message += `• Pending: ${stats.pending}\n`;
      message += `• Rejected: ${stats.rejected}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "admin_companies")],
        ]),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("💾 Creating system backup... Please wait.");
      const backup = await adminService.createBackup();
      let message = `✅ Backup created successfully!\n\n`;
      message += `📦 ID: ${backup.id || "-"}\n`;
      message += `📏 Size: ${backup.size || "-"}\n`;
      message += `📋 Tables: ${backup.tables || "-"}\n`;
      message += `📅 Created: ${
        toDateSafe(backup.createdAt)
          ? toDateSafe(backup.createdAt).toLocaleString()
          : "-"
      }`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle unban_user_{userId} callback
  async handleUnbanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^unban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid unban action.");
      const userId = match[1];
      await this.handleUnbanUser(ctx, userId);
      // Refresh banned users list
      setTimeout(() => this.handleBannedUsers(ctx), 500);
    } catch (error) {
      logger.error("Error in unban user callback:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle ban_user_{userId} callback
  async handleBanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^ban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid ban action.");
      const userId = match[1];
      await this.handleBanUser(ctx, userId);
      // Refresh banned users list if coming from banned users, else refresh search
      if (ctx.session && ctx.session.state === "awaiting_user_search") {
        ctx.reply("🔄 User banned. Please search again or go back.");
      } else {
        setTimeout(() => this.handleBannedUsers(ctx), 500);
      }
    } catch (error) {
      logger.error("Error in ban user callback:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_company_{companyId} callback
  async handleApproveCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const companyId = match[1];
      await this.handleApproveCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in approve company callback:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_company_{companyId} callback
  async handleRejectCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const companyId = match[1];
      await this.handleRejectCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in reject company callback:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_order_{orderId} callback
  async handleApproveOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const orderId = match[1];
      await this.handleApproveOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in approve order callback:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_order_{orderId} callback
  async handleRejectOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const orderId = match[1];
      await this.handleRejectOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in reject order callback:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const payoutId = match[1];
      await this.handleApprovePayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in approve payout callback:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_payout_{payoutId} callback
  async handleRejectPayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const payoutId = match[1];
      await this.handleRejectPayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in reject payout callback:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "approved", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `✅ Your product (${product.title}) has been approved and is now public!`,
            { type: "product", action: "approved", productId }
          );
      }
      ctx.reply("✅ Product approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving product:", error);
      ctx.reply("❌ Failed to approve product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "rejected", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`,
            { type: "product", action: "rejected", productId }
          );
      }
      ctx.reply("❌ Product rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting product:", error);
      ctx.reply("❌ Failed to reject product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply("No users found.");
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach((user) => {
        msg += `• ${
          user.first_name || user.firstName || user.username || user.id
        }\n`;
        buttons.push([
          Markup.button.callback(
            user.first_name || user.firstName || user.username || user.id,
            `admin_user_${user.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_list_users_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_users_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing users:", error);
      ctx.reply("❌ Failed to list users.");
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply("❌ User not found.");
      let msg = `👤 *${
        user.first_name || user.firstName || user.username || user.id
      }*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || "N/A"}\n`;
      msg += `Phone: ${user.phone_number || "N/A"}\n`;
      msg += `Email: ${user.email || "N/A"}\n`;
      msg += `Role: ${user.role || "user"}\n`;
      msg += `Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Verified: ${user.phone_verified ? "✅" : "❌"}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${
        user.referralCodes
          ? Object.values(user.referralCodes).join(", ")
          : "N/A"
      }\n`;
      msg += `Last Active: ${
        toDateSafe(user.last_active)
          ? toDateSafe(user.last_active).toLocaleString()
          : "N/A"
      }\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany
        ? "🟢 Eligible to register companies"
        : "🔴 Not eligible to register companies";
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += "No purchases found.\n";
      } else {
        orders.forEach((order) => {
          msg += `• ${order.product_title || order.productId} ($${
            order.amount
          }) from company ${order.company_name || order.companyId} on ${
            toDateSafe(order.createdAt)
              ? toDateSafe(order.createdAt).toLocaleString()
              : "N/A"
          }\n`;
        });
      }
      // Referral stats
      const stats = await referralService.getReferralStats(userId);
      msg += `\n*Referral Stats:*\n`;
      msg += `Total Referrals: ${stats.totalReferrals}\n`;
      msg += `Total Earnings: $${stats.totalEarnings.toFixed(2)}\n`;
      msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
      msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
      // Companies joined and referral codes
      if (user.joinedCompanies && user.joinedCompanies.length) {
        msg += `\n*Companies Joined:*\n`;
        for (const companyId of user.joinedCompanies) {
          const company = await companyService.getCompanyById(companyId);
          const code =
            user.referralCodes && company && company.codePrefix
              ? user.referralCodes[company.codePrefix]
              : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += "\n";
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([
          Markup.button.callback("✅ Unban", `unban_user_${user.id}`),
        ]);
      } else {
        buttons.push([Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            "❌ Demote (Remove Company Permission)",
            `demote_company_${user.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            "✅ Promote (Allow Company Registration)",
            `promote_company_${user.id}`
          ),
        ]);
      }
      // Back button to user list
      buttons.push([
        Markup.button.callback("🔙 Back to Users", "admin_list_users"),
      ]);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply("❌ Failed to load user details.");
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply("✅ User promoted: can now register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply("❌ User demoted: can no longer register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply("❌ Failed to demote user.");
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: false,
    });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number &&
            u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
          (u.first_name &&
            u.first_name.toLowerCase().includes(search.toLowerCase())) ||
          (u.last_name &&
            u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${
        u.first_name || u.firstName || "No name"
      } (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1)
      buttons.push([
        Markup.button.callback("⬅️ Prev", `all_users_menu_${page - 1}`),
      ]);
    if (page < totalPages)
      buttons.push([
        Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`),
      ]);
    buttons.push([
      Markup.button.callback("🔍 Search User", "all_users_search"),
    ]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    const userButtons = pageUsers.map((u) => [
      Markup.button.callback(
        `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
        `admin_user_${u.id}`
      ),
    ]);
    buttons.unshift(...userButtons);
    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    ctx.session.state = null;
  }

  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const bannedUsers = await userService.getBannedUsers();
      if (!bannedUsers.length) {
        return ctx.reply("No banned users found.");
      }
      let message = `🚫 *Banned Users*\n\n`;
      bannedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unbanUser(userId);
      ctx.reply("✅ User unbanned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.banUser(userId);
      ctx.reply("✅ User banned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.approveCompany(companyId);
      ctx.reply("✅ Company approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.approveOrder(orderId);
      ctx.reply("✅ Order approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving order:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.rejectOrder(orderId);
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies.");
      }
      let message = `⚠️ *Pending Company Registrations*\n\n`;
      companies.forEach((company, i) => {
        message += `${i + 1}. ${company.name} (${company.id})\n`;
        message += `   📧 ${company.email || "N/A"}\n`;
        message += `   📞 ${company.phone || "N/A"}\n`;
        message += `   👤 ${company.ownerName || company.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(company.createdAt)
            ? toDateSafe(company.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${company.referralCode || "N/A"}\n`;
        message += `   👥 ${company.joinedUsers || 0} Users\n`;
        message += `   💰 ${company.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${company.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_companies"
          ),
        ],
        [
          Markup.button.callback(
            "❌ Reject All",
            "reject_all_pending_companies"
          ),
        ],
        [Markup.button.callback("🔙 Back to Companies", "admin_companies")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleApproveCompany(ctx, company.id);
      }
      ctx.reply("✅ All pending companies approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending companies:", error);
      ctx.reply("❌ Failed to approve all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      for (const company of companies) {
        await this.handleRejectCompany(ctx, company.id);
      }
      ctx.reply("❌ All pending companies rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending companies:", error);
      ctx.reply("❌ Failed to reject all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders.");
      }
      let message = `⏳ *Pending Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.productTitle} ($${order.amount})\n`;
        message += `   👤 ${order.userName}\n`;
        message += `   📅 ${
          toDateSafe(order.createdAt)
            ? toDateSafe(order.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${order.referralCode || "N/A"}\n`;
        message += `   💰 ${order.amount} Revenue\n`;
        message += `   ⚙️ ${order.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_orders"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_orders")],
        [Markup.button.callback("🔙 Back to Orders", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleApproveOrder(ctx, order.id);
      }
      ctx.reply("✅ All pending orders approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending orders:", error);
      ctx.reply("❌ Failed to approve all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      for (const order of orders) {
        await this.handleRejectOrder(ctx, order.id);
      }
      ctx.reply("❌ All pending orders rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending orders:", error);
      ctx.reply("❌ Failed to reject all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      if (!payouts.length) {
        return ctx.reply("No pending payouts.");
      }
      let message = `⏳ *Pending Payouts*\n\n`;
      payouts.forEach((payout, i) => {
        message += `${i + 1}. $${payout.amount} - ${
          payout.userName || payout.user_name || "No user"
        }\n`;
        message += `   📅 ${
          toDateSafe(payout.requestedAt)
            ? toDateSafe(payout.requestedAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   ⚙️ ${payout.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve All",
            "approve_all_pending_payouts"
          ),
        ],
        [Markup.button.callback("❌ Reject All", "reject_all_pending_payouts")],
        [Markup.button.callback("🔙 Back to Payouts", "admin_payouts")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending payouts:", error);
      ctx.reply("❌ Failed to load pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleApprovePayout(ctx, payout.id);
      }
      ctx.reply("✅ All pending payouts approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending payouts:", error);
      ctx.reply("❌ Failed to approve all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const payouts = await adminService.getPayoutsByStatus("pending");
      for (const payout of payouts) {
        await this.handleRejectPayout(ctx, payout.id);
      }
      ctx.reply("❌ All pending payouts rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending payouts:", error);
      ctx.reply("❌ Failed to reject all pending payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessage(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.session.state = "awaiting_maintenance_message";
      ctx.reply("📝 Please enter the message for the maintenance mode:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting maintenance message:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMessageInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;
      if (
        !ctx.session ||
        ctx.session.state !== "awaiting_maintenance_message"
      ) {
        return ctx.reply("❌ Invalid state for maintenance message input.");
      }
      const message = messageText.trim();
      if (!message) {
        return ctx.reply("❌ Message cannot be empty.");
      }
      await adminService.setMaintenanceMessage(message);
      ctx.reply("✅ Maintenance message updated.");
      delete ctx.session.state;
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting maintenance message:", error);
      ctx.reply("❌ Failed to set maintenance message.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const currentMode = await adminService.getMaintenanceMode();

      const message = `
🔧 *Maintenance Mode*

Current Status: ${currentMode ? "🔴 ENABLED" : "🟢 DISABLED"}

${
  currentMode
    ? "The bot is currently in maintenance mode. Only admins can use the bot."
    : "The bot is operating normally. All users can access features."
}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            currentMode ? "🟢 Disable Maintenance" : "🔴 Enable Maintenance",
            "toggle_maintenance"
          ),
        ],
        [
          Markup.button.callback(
            "📢 Maintenance Message",
            "maintenance_message"
          ),
        ],
        [Markup.button.callback("🔙 Back to Settings", "admin_settings")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing maintenance mode:", error);
      ctx.reply("❌ Failed to load maintenance settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleMaintenance(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const newMode = await adminService.toggleMaintenanceMode();

      ctx.reply(`✅ Maintenance mode ${newMode ? "enabled" : "disabled"}.`);
      if (ctx.callbackQuery) ctx.answerCbQuery();

      // Refresh maintenance settings
      setTimeout(() => {
        this.handleMaintenanceMode(ctx);
      }, 1000);
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportData(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return;

      const exportType = ctx.callbackQuery.data.split("_")[1];

      ctx.reply("📤 Generating export... This may take a moment.");

      const exportData = await adminService.exportData(exportType);

      // In a real implementation, you would send the file
      // For now, we'll just show a summary
      ctx.reply(
        `✅ Export completed!\n\n📊 Summary:\n• Records: ${exportData.recordCount}\n• File size: ${exportData.fileSize}\n• Format: CSV\n\nFile would be sent here in production.`
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting data:", error);
      ctx.reply("❌ Export failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalyticsSummary(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalytics();
      let message = `📊 *Company Analytics Summary*\n\n`;
      message += `• Total Companies: ${stats.total}\n`;
      message += `• Approved: ${stats.approved}\n`;
      message += `• Pending: ${stats.pending}\n`;
      message += `• Rejected: ${stats.rejected}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "admin_companies")],
        ]),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBackupSystem(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("💾 Creating system backup... Please wait.");
      const backup = await adminService.createBackup();
      let message = `✅ Backup created successfully!\n\n`;
      message += `📦 ID: ${backup.id || "-"}\n`;
      message += `📏 Size: ${backup.size || "-"}\n`;
      message += `📋 Tables: ${backup.tables || "-"}\n`;
      message += `📅 Created: ${
        toDateSafe(backup.createdAt)
          ? toDateSafe(backup.createdAt).toLocaleString()
          : "-"
      }`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle unban_user_{userId} callback
  async handleUnbanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^unban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid unban action.");
      const userId = match[1];
      await this.handleUnbanUser(ctx, userId);
      // Refresh banned users list
      setTimeout(() => this.handleBannedUsers(ctx), 500);
    } catch (error) {
      logger.error("Error in unban user callback:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle ban_user_{userId} callback
  async handleBanUserCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^ban_user_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid ban action.");
      const userId = match[1];
      await this.handleBanUser(ctx, userId);
      // Refresh banned users list if coming from banned users, else refresh search
      if (ctx.session && ctx.session.state === "awaiting_user_search") {
        ctx.reply("🔄 User banned. Please search again or go back.");
      } else {
        setTimeout(() => this.handleBannedUsers(ctx), 500);
      }
    } catch (error) {
      logger.error("Error in ban user callback:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_company_{companyId} callback
  async handleApproveCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const companyId = match[1];
      await this.handleApproveCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in approve company callback:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_company_{companyId} callback
  async handleRejectCompanyCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_company_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const companyId = match[1];
      await this.handleRejectCompany(ctx, companyId);
      setTimeout(() => this.handlePendingCompanies(ctx), 500);
    } catch (error) {
      logger.error("Error in reject company callback:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_order_{orderId} callback
  async handleApproveOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const orderId = match[1];
      await this.handleApproveOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in approve order callback:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_order_{orderId} callback
  async handleRejectOrderCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_order_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const orderId = match[1];
      await this.handleRejectOrder(ctx, orderId);
      setTimeout(() => this.handlePendingOrders(ctx), 500);
    } catch (error) {
      logger.error("Error in reject order callback:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^approve_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid approve action.");
      const payoutId = match[1];
      await this.handleApprovePayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in approve payout callback:", error);
      ctx.reply("❌ Failed to approve payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle reject_payout_{payoutId} callback
  async handleRejectPayoutCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^reject_payout_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid reject action.");
      const payoutId = match[1];
      await this.handleRejectPayout(ctx, payoutId);
      setTimeout(() => this.handlePendingPayouts(ctx), 500);
    } catch (error) {
      logger.error("Error in reject payout callback:", error);
      ctx.reply("❌ Failed to reject payout.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "approved", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `✅ Your product (${product.title}) has been approved and is now public!`,
            { type: "product", action: "approved", productId }
          );
      }
      ctx.reply("✅ Product approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving product:", error);
      ctx.reply("❌ Failed to approve product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require("../config/database").getDb();
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply("❌ Product not found.");
      await productRef.update({ status: "rejected", updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require("../services/notificationService")
          .getNotificationServiceInstance()
          .sendNotification(
            product.creatorTelegramId,
            `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`,
            { type: "product", action: "rejected", productId }
          );
      }
      ctx.reply("❌ Product rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting product:", error);
      ctx.reply("❌ Failed to reject product.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply("No users found.");
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach((user) => {
        msg += `• ${
          user.first_name || user.firstName || user.username || user.id
        }\n`;
        buttons.push([
          Markup.button.callback(
            user.first_name || user.firstName || user.username || user.id,
            `admin_user_${user.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback("⬅️ Previous", `admin_list_users_${page - 1}`)
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback("➡️ Next", `admin_list_users_${page + 1}`)
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error listing users:", error);
      ctx.reply("❌ Failed to list users.");
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply("❌ User not found.");
      let msg = `👤 *${
        user.first_name || user.firstName || user.username || user.id
      }*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || "N/A"}\n`;
      msg += `Phone: ${user.phone_number || "N/A"}\n`;
      msg += `Email: ${user.email || "N/A"}\n`;
      msg += `Role: ${user.role || "user"}\n`;
      msg += `Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleString()
          : "N/A"
      }\n`;
      msg += `Verified: ${user.phone_verified ? "✅" : "❌"}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${
        user.referralCodes
          ? Object.values(user.referralCodes).join(", ")
          : "N/A"
      }\n`;
      msg += `Last Active: ${
        toDateSafe(user.last_active)
          ? toDateSafe(user.last_active).toLocaleString()
          : "N/A"
      }\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany
        ? "🟢 Eligible to register companies"
        : "🔴 Not eligible to register companies";
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += "No purchases found.\n";
      } else {
        orders.forEach((order) => {
          msg += `• ${order.product_title || order.productId} ($${
            order.amount
          }) from company ${order.company_name || order.companyId} on ${
            toDateSafe(order.createdAt)
              ? toDateSafe(order.createdAt).toLocaleString()
              : "N/A"
          }\n`;
        });
      }
      // Referral stats
      const stats = await referralService.getReferralStats(userId);
      msg += `\n*Referral Stats:*\n`;
      msg += `Total Referrals: ${stats.totalReferrals}\n`;
      msg += `Total Earnings: $${stats.totalEarnings.toFixed(2)}\n`;
      msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
      msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
      // Companies joined and referral codes
      if (user.joinedCompanies && user.joinedCompanies.length) {
        msg += `\n*Companies Joined:*\n`;
        for (const companyId of user.joinedCompanies) {
          const company = await companyService.getCompanyById(companyId);
          const code =
            user.referralCodes && company && company.codePrefix
              ? user.referralCodes[company.codePrefix]
              : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += "\n";
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([
          Markup.button.callback("✅ Unban", `unban_user_${user.id}`),
        ]);
      } else {
        buttons.push([Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            "❌ Demote (Remove Company Permission)",
            `demote_company_${user.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            "✅ Promote (Allow Company Registration)",
            `promote_company_${user.id}`
          ),
        ]);
      }
      // Back button to user list
      buttons.push([
        Markup.button.callback("🔙 Back to Users", "admin_list_users"),
      ]);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply("❌ Failed to load user details.");
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: true,
      });
      ctx.reply("✅ User promoted: can now register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    try {
      await userService.userService.updateUser(userId, {
        canRegisterCompany: false,
      });
      ctx.reply("❌ User demoted: can no longer register companies.");
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error("Error demoting user:", error);
      ctx.reply("❌ Failed to demote user.");
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, {
      canRegisterCompany: false,
    });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(
        (u) =>
          (u.username &&
            u.username.toLowerCase().includes(search.toLowerCase())) ||
          (u.phone_number &&
            u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
          (u.first_name &&
            u.first_name.toLowerCase().includes(search.toLowerCase())) ||
          (u.last_name &&
            u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${
        u.first_name || u.firstName || "No name"
      } (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1)
      buttons.push([
        Markup.button.callback("⬅️ Prev", `all_users_menu_${page - 1}`),
      ]);
    if (page < totalPages)
      buttons.push([
        Markup.button.callback("➡️ Next", `all_users_menu_${page + 1}`),
      ]);
    buttons.push([
      Markup.button.callback("🔍 Search User", "all_users_search"),
    ]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    const userButtons = pageUsers.map((u) => [
      Markup.button.callback(
        `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
        `admin_user_${u.id}`
      ),
    ]);
    buttons.unshift(...userButtons);
    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
    ctx.session.state = null;
  }

  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const bannedUsers = await userService.getBannedUsers();
      if (!bannedUsers.length) {
        return ctx.reply("No banned users found.");
      }
      let message = `🚫 *Banned Users*\n\n`;
      bannedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unbanUser(userId);
      ctx.reply("✅ User unbanned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.banUser(userId);
      ctx.reply("✅ User banned.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.approveCompany(companyId);
      ctx.reply("✅ Company approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.approveOrder(orderId);
      ctx.reply("✅ Order approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving order:", error);
      ctx.reply("❌ Failed to approve order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await orderService.rejectOrder(orderId);
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies.");
      }
      let message = `⚠️ *Pending Company Registrations*\n\n`;
      companies.forEach((company, i) => {
        message += `${i + 1}. ${company.name} (${company.id})\n`;
        message += `   📧 ${company.email || "N/A"}\n`;
        message += `   📞 ${company.phone || "N/A"}\n`;
        message += `   👤 ${company.ownerName || company.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(company.createdAt)
            ? toDateSafe(company.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${company.referralCode || "N/A"}\n`;
        message += `   👥 ${company.joinedUsers || 0} Users\n`;
        message += `   💰 ${company.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${company.status || "N/A"}\n`;
      });
      const buttons = [
        [
          Markup.button.callback(
            "🔙 Back to Company Management",
            "admin_companies"
          ),
        ],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders to reject.");
      }
      await orderService.rejectAllPendingOrders();
      ctx.reply("❌ All pending orders rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending orders:", error);
      ctx.reply("❌ Failed to reject all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders to approve.");
      }
      await orderService.approveAllPendingOrders();
      ctx.reply("✅ All pending orders approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending orders:", error);
      ctx.reply("❌ Failed to approve all pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const orders = await orderService.getPendingOrders();
      if (!orders.length) {
        return ctx.reply("No pending orders.");
      }
      let message = `⚠️ *Pending Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.id}\n`;
        message += `   👤 ${
          order.user.first_name ||
          order.user.firstName ||
          order.user.username ||
          order.user.id
        } (@${order.user.username || "-"})\n`;
        message += `   📱 ${
          order.user.phone_number || order.user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 ${
          toDateSafe(order.created_at)
            ? toDateSafe(order.created_at).toLocaleDateString()
            : "-"
        }\n`;
        message += `   💵 ${order.total_price || 0} Total Price\n`;
        message += `   📦 ${order.items.length} Items\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to Order Management", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies to approve.");
      }
      await companyService.approveAllPendingCompanies();
      ctx.reply("✅ All pending companies approved.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving all pending companies:", error);
      ctx.reply("❌ Failed to approve all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectAllPendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await companyService.getPendingCompanies();
      if (!companies.length) {
        return ctx.reply("No pending companies to reject.");
      }
      await companyService.rejectAllPendingCompanies();
      ctx.reply("❌ All pending companies rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting all pending companies:", error);
      ctx.reply("❌ Failed to reject all pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePromoteUserMenu(ctx, page = 1, search = "") {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const PAGE_SIZE = 10;
      let users = await userService.getAllUsers();
      if (search) {
        users = users.filter(
          (u) =>
            (u.username &&
              u.username.toLowerCase().includes(search.toLowerCase())) ||
            (u.phone_number &&
              u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
            (u.first_name &&
              u.first_name.toLowerCase().includes(search.toLowerCase())) ||
            (u.last_name &&
              u.last_name.toLowerCase().includes(search.toLowerCase()))
        );
      }
      const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
      page = Math.max(1, Math.min(page, totalPages));
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageUsers = users.slice(start, end);
      let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
      pageUsers.forEach((u, i) => {
        message += `${start + i + 1}. ${
          u.first_name || u.firstName || "No name"
        } (@${u.username || "-"})\n`;
        message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
        message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
      });
      const buttons = [];
      if (page > 1)
        buttons.push([
          Markup.button.callback("⬅️ Prev", `promote_user_menu_${page - 1}`),
        ]);
      if (page < totalPages)
        buttons.push([
          Markup.button.callback("➡️ Next", `promote_user_menu_${page + 1}`),
        ]);
      buttons.push([
        Markup.button.callback("🔍 Search User", "promote_user_search"),
      ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
      const userButtons = pageUsers.map((u) => [
        Markup.button.callback(
          `${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`,
          `promote_user_${u.id}`
        ),
      ]);
      buttons.unshift(...userButtons);
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      ctx.session.state = null;
    } catch (error) {
      logger.error("Error listing users for promotion:", error);
      ctx.reply("❌ Failed to load users for promotion.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePromoteUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.promoteUser(userId);
      ctx.reply("✅ User promoted!");
      setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
    } catch (error) {
      logger.error("Error promoting user:", error);
      ctx.reply("❌ Failed to promote user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnpromoteUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.unpromoteUser(userId);
      ctx.reply("✅ User unpromoted!");
      setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
    } catch (error) {
      logger.error("Error unpromoting user:", error);
      ctx.reply("❌ Failed to unpromote user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePromotedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const promotedUsers = await userService.getPromotedUsers();
      if (!promotedUsers.length) {
        return ctx.reply("No promoted users found.");
      }
      let message = `👑 *Promoted Users*\n\n`;
      promotedUsers.forEach((user, i) => {
        message += `${i + 1}. ${
          user.first_name || user.firstName || user.username || user.id
        } (@${user.username || "-"})\n`;
        message += `   📱 ${
          user.phone_number || user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 Joined: ${
          toDateSafe(user.created_at)
            ? toDateSafe(user.created_at).toLocaleDateString()
            : "-"
        }\n`;
      });
      const buttons = [
        [Markup.button.callback("🔙 Back to User Management", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing promoted users:", error);
      ctx.reply("❌ Failed to load promoted users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMaintenanceMode(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const maintenanceMode = await adminService.toggleMaintenanceMode();
      ctx.reply(
        maintenanceMode
          ? "The bot is currently in maintenance mode. Only admins can use the bot."
          : "The bot is operating normally. All users can access features."
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error toggling maintenance mode:", error);
      ctx.reply("❌ Failed to toggle maintenance mode.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminMenu(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getPlatformStats();
      const message = `
👋 Welcome to the Admin Panel, ${
        ctx.from.first_name ||
        ctx.from.firstName ||
        ctx.from.username ||
        ctx.from.id
      }!

📊 *Platform Statistics*
👥 Total Users: ${stats.totalUsers}
🏢 Total Companies: ${stats.totalCompanies}
🛒 Total Orders: ${stats.totalOrders}
💵 Total Revenue: ${stats.totalRevenue}

What would you like to do?
      `;
      const buttons = [
        [
          Markup.button.callback("👥 User Management", "admin_users"),
          Markup.button.callback("🏢 Company Management", "admin_companies"),
        ],
        [
          Markup.button.callback("🛒 Order Management", "admin_orders"),
          Markup.button.callback("📊 Analytics", "admin_analytics"),
        ],
        [
          Markup.button.callback("🔧 Settings", "admin_settings"),
          Markup.button.callback("🔙 Back", "main_menu"),
        ],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading admin menu:", error);
      ctx.reply("❌ Failed to load admin menu.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUserManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const message = `
👥 *User Management*

What would you like to do?
      `;
      const buttons = [
        [
          Markup.button.callback("👥 All Users", "all_users_menu_1"),
          Markup.button.callback("🚫 Banned Users", "banned_users"),
        ],
        [
          Markup.button.callback("👑 Promoted Users", "promoted_users"),
          Markup.button.callback("🔙 Back", "admin_menu"),
        ],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading user management menu:", error);
      ctx.reply("❌ Failed to load user management menu.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const message = `
🏢 *Company Management*

What would you like to do?
      `;
      const buttons = [
        [
          Markup.button.callback("🏢 All Companies", "all_companies_menu_1"),
          Markup.button.callback("⚠️ Pending Companies", "pending_companies"),
        ],
        [Markup.button.callback("🔙 Back", "admin_menu")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading company management menu:", error);
      ctx.reply("❌ Failed to load company management menu.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleOrderManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const message = `
🛒 *Order Management*

What would you like to do?
      `;
      const buttons = [
        [
          Markup.button.callback("🛒 All Orders", "all_orders_menu_1"),
          Markup.button.callback("⚠️ Pending Orders", "pending_orders"),
        ],
        [Markup.button.callback("🔙 Back", "admin_menu")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading order management menu:", error);
      ctx.reply("❌ Failed to load order management menu.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSettings(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const message = `
🔧 *Settings*

What would you like to do?
      `;
      const buttons = [
        [Markup.button.callback("🔒 Maintenance Mode", "maintenance_mode")],
        [Markup.button.callback("🔙 Back", "admin_menu")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading settings menu:", error);
      ctx.reply("❌ Failed to load settings menu.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAllCompaniesMenu(ctx, page = 1, search = "") {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const PAGE_SIZE = 10;
      let companies = await companyService.getAllCompanies();
      if (search) {
        companies = companies.filter(
          (c) =>
            (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
            (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
            (c.phone && c.phone.toLowerCase().includes(search.toLowerCase())) ||
            (c.ownerName &&
              c.ownerName.toLowerCase().includes(search.toLowerCase())) ||
            (c.owner && c.owner.toLowerCase().includes(search.toLowerCase())) ||
            (c.referralCode &&
              c.referralCode.toLowerCase().includes(search.toLowerCase()))
        );
      }
      const totalPages = Math.ceil(companies.length / PAGE_SIZE) || 1;
      page = Math.max(1, Math.min(page, totalPages));
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageCompanies = companies.slice(start, end);
      let message = `🏢 *All Companies* (Page ${page}/${totalPages})\n\n`;
      pageCompanies.forEach((c, i) => {
        message += `${start + i + 1}. ${c.name} (${c.id})\n`;
        message += `   📧 ${c.email || "N/A"}\n`;
        message += `   📞 ${c.phone || "N/A"}\n`;
        message += `   👤 ${c.ownerName || c.owner || "N/A"}\n`;
        message += `   📅 ${
          toDateSafe(c.createdAt)
            ? toDateSafe(c.createdAt).toLocaleDateString()
            : "-"
        }\n`;
        message += `   🔗 ${c.referralCode || "N/A"}\n`;
        message += `   👥 ${c.joinedUsers || 0} Users\n`;
        message += `   💰 ${c.totalRevenue || 0} Revenue\n`;
        message += `   ⚙️ ${c.status || "N/A"}\n`;
      });
      const buttons = [];
      if (page > 1)
        buttons.push([
          Markup.button.callback("⬅️ Prev", `all_companies_menu_${page - 1}`),
        ]);
      if (page < totalPages)
        buttons.push([
          Markup.button.callback("➡️ Next", `all_companies_menu_${page + 1}`),
        ]);
      buttons.push([
        Markup.button.callback("🔍 Search Company", "all_companies_search"),
      ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_companies")]);
      const companyButtons = pageCompanies.map((c) => [
        Markup.button.callback(`${c.name} (${c.id})`, `admin_company_${c.id}`),
      ]);
      buttons.unshift(...companyButtons);
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      ctx.session.state = null;
    } catch (error) {
      logger.error("Error listing companies:", error);
      ctx.reply("❌ Failed to load companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAllOrdersMenu(ctx, page = 1, search = "") {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const PAGE_SIZE = 10;
      let orders = await orderService.getAllOrders();
      if (search) {
        orders = orders.filter(
          (o) =>
            (o.id && o.id.toString().includes(search)) ||
            (o.user &&
              o.user.username &&
              o.user.username.toLowerCase().includes(search.toLowerCase())) ||
            (o.user &&
              o.user.phone_number &&
              o.user.phone_number
                .toLowerCase()
                .includes(search.toLowerCase())) ||
            (o.user &&
              o.user.first_name &&
              o.user.first_name.toLowerCase().includes(search.toLowerCase())) ||
            (o.user &&
              o.user.last_name &&
              o.user.last_name.toLowerCase().includes(search.toLowerCase()))
        );
      }
      const totalPages = Math.ceil(orders.length / PAGE_SIZE) || 1;
      page = Math.max(1, Math.min(page, totalPages));
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageOrders = orders.slice(start, end);
      let message = `🛒 *All Orders* (Page ${page}/${totalPages})\n\n`;
      pageOrders.forEach((o, i) => {
        message += `${start + i + 1}. ${o.id}\n`;
        message += `   👤 ${
          o.user.first_name || o.user.firstName || o.user.username || o.user.id
        } (@${o.user.username || "-"})\n`;
        message += `   📱 ${
          o.user.phone_number || o.user.phoneNumber || "No phone"
        }\n`;
        message += `   📅 ${
          toDateSafe(o.created_at)
            ? toDateSafe(o.created_at).toLocaleDateString()
            : "-"
        }\n`;
        message += `   💵 ${o.total_price || 0} Total Price\n`;
        message += `   📦 ${o.items.length} Items\n`;
      });
      const buttons = [];
      if (page > 1)
        buttons.push([
          Markup.button.callback("⬅️ Prev", `all_orders_menu_${page - 1}`),
        ]);
      if (page < totalPages)
        buttons.push([
          Markup.button.callback("➡️ Next", `all_orders_menu_${page + 1}`),
        ]);
      buttons.push([
        Markup.button.callback("🔍 Search Order", "all_orders_search"),
      ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_orders")]);
      const orderButtons = pageOrders.map((o) => [
        Markup.button.callback(`${o.id}`, `admin_order_${o.id}`),
      ]);
      buttons.unshift(...orderButtons);
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      ctx.session.state = null;
    } catch (error) {
      logger.error("Error listing orders:", error);
      ctx.reply("❌ Failed to load orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAnalytics(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getPlatformStats();
      const message = `
📊 *Analytics*

👥 Total Users: ${stats.totalUsers}
🏢 Total Companies: ${stats.totalCompanies}
🛒 Total Orders: ${stats.totalOrders}
💵 Total Revenue: ${stats.totalRevenue}
      `;
      const buttons = [[Markup.button.callback("🔙 Back", "admin_menu")]];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading analytics:", error);
      ctx.reply("❌ Failed to load analytics.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const user = await userService.getUserById(userId);
      if (!user) {
        return ctx.reply("User not found.");
      }
      const message = `
👤 *User Details*

👤 Name: ${user.first_name || user.firstName || user.username || user.id}
📱 Phone: ${user.phone_number || user.phoneNumber || "N/A"}
📧 Email: ${user.email || "N/A"}
📅 Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleDateString()
          : "-"
      }
🔗 Username: @${user.username || "-"}
🚫 Banned: ${user.banned ? "Yes" : "No"}
👑 Promoted: ${user.is_admin ? "Yes" : "No"}
      `;
      const buttons = [
        [
          Markup.button.callback("🚫 Ban User", `ban_user_${user.id}`),
          Markup.button.callback("✅ Unban User", `unban_user_${user.id}`),
        ],
        [
          Markup.button.callback("👑 Promote User", `promote_user_${user.id}`),
          Markup.button.callback(
            "👑 Unpromote User",
            `unpromote_user_${user.id}`
          ),
        ],
        [Markup.button.callback("🔙 Back", "admin_users")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading user details:", error);
      ctx.reply("❌ Failed to load user details.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const company = await companyService.getCompanyById(companyId);
      if (!company) {
        return ctx.reply("Company not found.");
      }
      const message = `
🏢 *Company Details*

🏢 Name: ${company.name}
📧 Email: ${company.email || "N/A"}
📞 Phone: ${company.phone || "N/A"}
👤 Owner: ${company.ownerName || company.owner || "N/A"}
📅 Created: ${
        toDateSafe(company.createdAt)
          ? toDateSafe(company.createdAt).toLocaleDateString()
          : "-"
      }
🔗 Referral Code: ${company.referralCode || "N/A"}
👥 Joined Users: ${company.joinedUsers || 0}
💰 Total Revenue: ${company.totalRevenue || 0}
⚙️ Status: ${company.status || "N/A"}
      `;
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve Company",
            `approve_company_${company.id}`
          ),
          Markup.button.callback(
            "❌ Reject Company",
            `reject_company_${company.id}`
          ),
        ],
        [Markup.button.callback("🔙 Back", "admin_companies")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading company details:", error);
      ctx.reply("❌ Failed to load company details.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const order = await orderService.getOrderById(orderId);
      if (!order) {
        return ctx.reply("Order not found.");
      }
      const message = `
🛒 *Order Details*

🛒 Order ID: ${order.id}
👤 User: ${
        order.user.first_name ||
        order.user.firstName ||
        order.user.username ||
        order.user.id
      } (@${order.user.username || "-"})
📱 Phone: ${order.user.phone_number || order.user.phoneNumber || "No phone"}
📅 Created: ${
        toDateSafe(order.created_at)
          ? toDateSafe(order.created_at).toLocaleDateString()
          : "-"
      }
💵 Total Price: ${order.total_price || 0}
📦 Items: ${order.items.length}
      `;
      const buttons = [
        [
          Markup.button.callback(
            "✅ Approve Order",
            `approve_order_${order.id}`
          ),
          Markup.button.callback("❌ Reject Order", `reject_order_${order.id}`),
        ],
        [Markup.button.callback("🔙 Back", "admin_orders")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading order details:", error);
      ctx.reply("❌ Failed to load order details.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSearch(ctx, type) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.session.state = { type, step: "search" };
      ctx.reply(`Enter the search query for ${type}:`);
    } catch (error) {
      logger.error("Error handling search:", error);
      ctx.reply("❌ Failed to handle search.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSearchResult(ctx, query) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const { type } = ctx.session.state;
      let result;
      switch (type) {
        case "all_users":
          result = await this.handleAllUsersMenu(ctx, 1, query);
          break;
        case "all_companies":
          result = await this.handleAllCompaniesMenu(ctx, 1, query);
          break;
        case "all_orders":
          result = await this.handleAllOrdersMenu(ctx, 1, query);
          break;
        case "promote_user":
          result = await this.handlePromoteUserMenu(ctx, 1, query);
          break;
        default:
          return ctx.reply("Invalid search type.");
      }
      ctx.session.state = null;
    } catch (error) {
      logger.error("Error handling search result:", error);
      ctx.reply("❌ Failed to handle search result.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCallbackQuery(ctx) {
    try {
      const data = ctx.callbackQuery.data;
      const match = data.match(/^(.+?)_(\d+)$/);
      if (match) {
        const [, action, id] = match;
        switch (action) {
          case "admin_user":
            return this.handleAdminUser(ctx, id);
          case "admin_company":
            return this.handleAdminCompany(ctx, id);
          case "admin_order":
            return this.handleAdminOrder(ctx, id);
          case "ban_user":
            return this.handleBanUser(ctx, id);
          case "unban_user":
            return this.handleUnbanUser(ctx, id);
          case "promote_user":
            return this.handlePromoteUser(ctx, id);
          case "unpromote_user":
            return this.handleUnpromoteUser(ctx, id);
          case "approve_company":
            return this.handleApproveCompany(ctx, id);
          case "reject_company":
            return this.handleRejectCompany(ctx, id);
          case "approve_order":
            return this.handleApproveOrder(ctx, id);
          case "reject_order":
            return this.handleRejectOrder(ctx, id);
          case "all_users_menu":
            return this.handleAllUsersMenu(ctx, parseInt(id));
          case "all_companies_menu":
            return this.handleAllCompaniesMenu(ctx, parseInt(id));
          case "all_orders_menu":
            return this.handleAllOrdersMenu(ctx, parseInt(id));
          case "promote_user_menu":
            return this.handlePromoteUserMenu(ctx, parseInt(id));
          default:
            return ctx.reply("Invalid action.");
        }
      }
      switch (data) {
        case "admin_menu":
          return this.handleAdminMenu(ctx);
        case "admin_users":
          return this.handleUserManagement(ctx);
        case "admin_companies":
          return this.handleCompanyManagement(ctx);
        case "admin_orders":
          return this.handleOrderManagement(ctx);
        case "admin_analytics":
          return this.handleAnalytics(ctx);
        case "admin_settings":
          return this.handleSettings(ctx);
        case "banned_users":
          return this.handleBannedUsers(ctx);
        case "promoted_users":
          return this.handlePromotedUsers(ctx);
        case "pending_companies":
          return this.handlePendingCompanies(ctx);
        case "pending_orders":
          return this.handlePendingOrders(ctx);
        case "maintenance_mode":
          return this.handleMaintenanceMode(ctx);
        case "all_users_search":
          return this.handleSearch(ctx, "all_users");
        case "all_companies_search":
          return this.handleSearch(ctx, "all_companies");
        case "all_orders_search":
          return this.handleSearch(ctx, "all_orders");
        case "promote_user_search":
          return this.handleSearch(ctx, "promote_user");
        case "approve_all_pending_orders":
          return this.handleApproveAllPendingOrders(ctx);
        case "reject_all_pending_orders":
          return this.handleRejectAllPendingOrders(ctx);
        case "approve_all_pending_companies":
          return this.handleApproveAllPendingCompanies(ctx);
        case "reject_all_pending_companies":
          return this.handleRejectAllPendingCompanies(ctx);
        case "main_menu":
          return this.handleMainMenu(ctx);
        default:
          return ctx.reply("Invalid action.");
      }
    } catch (error) {
      logger.error("Error handling callback query:", error);
      ctx.reply("❌ Failed to handle callback query.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleText(ctx) {
    try {
      const { state } = ctx.session;
      if (state && state.step === "search") {
        return this.handleSearchResult(ctx, ctx.message.text);
      }
      return ctx.reply("Invalid command.");
    } catch (error) {
      logger.error("Error handling text:", error);
      ctx.reply("❌ Failed to handle text.");
    }
  }

  async handleStart(ctx) {
    try {
      const user = await userService.getOrCreateUser(ctx.from);
      if (user.banned) {
        return ctx.reply("❌ You are banned from using this bot.");
      }
      if (this.isAdmin(ctx.from.id)) {
        return this.handleAdminMenu(ctx);
      }
      return this.handleMainMenu(ctx);
    } catch (error) {
      logger.error("Error handling start:", error);
      ctx.reply("❌ Failed to handle start.");
    }
  }

  async handleMainMenu(ctx) {
    try {
      const message = `
👋 Welcome to the Main Menu, ${
        ctx.from.first_name ||
        ctx.from.firstName ||
        ctx.from.username ||
        ctx.from.id
      }!

What would you like to do?
      `;
      const buttons = [
        [
          Markup.button.callback("👤 My Profile", "my_profile"),
          Markup.button.callback("🏢 My Company", "my_company"),
        ],
        [
          Markup.button.callback("🛒 My Orders", "my_orders"),
          Markup.button.callback("📊 My Analytics", "my_analytics"),
        ],
        [
          Markup.button.callback("🔧 Settings", "settings"),
          Markup.button.callback("📞 Support", "support"),
        ],
      ];
      if (this.isAdmin(ctx.from.id)) {
        buttons.push([Markup.button.callback("👑 Admin Panel", "admin_menu")]);
      }
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading main menu:", error);
      ctx.reply("❌ Failed to load main menu.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMyProfile(ctx) {
    try {
      const user = await userService.getUserById(ctx.from.id);
      if (!user) {
        return ctx.reply("User not found.");
      }
      const message = `
👤 *My Profile*

👤 Name: ${user.first_name || user.firstName || user.username || user.id}
📱 Phone: ${user.phone_number || user.phoneNumber || "N/A"}
📧 Email: ${user.email || "N/A"}
📅 Joined: ${
        toDateSafe(user.created_at)
          ? toDateSafe(user.created_at).toLocaleDateString()
          : "-"
      }
🔗 Username: @${user.username || "-"}
🚫 Banned: ${user.banned ? "Yes" : "No"}
👑 Promoted: ${user.is_admin ? "Yes" : "No"}
      `;
      const buttons = [[Markup.button.callback("🔙 Back", "main_menu")]];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading my profile:", error);
      ctx.reply("❌ Failed to load my profile.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMyCompany(ctx) {
    try {
      const company = await companyService.getCompanyByOwner(ctx.from.id);
      if (!company) {
        return ctx.reply("You don't have a company.");
      }
      const message = `
🏢 *My Company*

🏢 Name: ${company.name}
📧 Email: ${company.email || "N/A"}
📞 Phone: ${company.phone || "N/A"}
👤 Owner: ${company.ownerName || company.owner || "N/A"}
📅 Created: ${
        toDateSafe(company.createdAt)
          ? toDateSafe(company.createdAt).toLocaleDateString()
          : "-"
      }
🔗 Referral Code: ${company.referralCode || "N/A"}
👥 Joined Users: ${company.joinedUsers || 0}
💰 Total Revenue: ${company.totalRevenue || 0}
⚙️ Status: ${company.status || "N/A"}
      `;
      const buttons = [[Markup.button.callback("🔙 Back", "main_menu")]];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading my company:", error);
      ctx.reply("❌ Failed to load my company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMyOrders(ctx) {
    try {
      const orders = await orderService.getOrdersByUser(ctx.from.id);
      if (!orders.length) {
        return ctx.reply("You don't have any orders.");
      }
      let message = `🛒 *My Orders*\n\n`;
      orders.forEach((order, i) => {
        message += `${i + 1}. ${order.id}\n`;
        message += `   📅 ${
          toDateSafe(order.created_at)
            ? toDateSafe(order.created_at).toLocaleDateString()
            : "-"
        }\n`;
        message += `   💵 ${order.total_price || 0} Total Price\n`;
        message += `   📦 ${order.items.length} Items\n`;
      });
      const buttons = [[Markup.button.callback("🔙 Back", "main_menu")]];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading my orders:", error);
      ctx.reply("❌ Failed to load my orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMyAnalytics(ctx) {
    try {
      const stats = await userService.getUserStats(ctx.from.id);
      const message = `
📊 *My Analytics*

🛒 Total Orders: ${stats.totalOrders}
💵 Total Spent: ${stats.totalSpent}
📦 Total Items: ${stats.totalItems}
      `;
      const buttons = [[Markup.button.callback("🔙 Back", "main_menu")]];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading my analytics:", error);
      ctx.reply("❌ Failed to load my analytics.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSettings(ctx) {
    try {
      const message = `
🔧 *Settings*

What would you like to do?
      `;
      const buttons = [[Markup.button.callback("🔙 Back", "main_menu")]];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading settings:", error);
      ctx.reply("❌ Failed to load settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSupport(ctx) {
    try {
      const message = `
📞 *Support*

If you need help, please contact our support team at support@example.com.
      `;
      const buttons = [[Markup.button.callback("🔙 Back", "main_menu")]];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error loading support:", error);
      ctx.reply("❌ Failed to load support.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnknownCommand(ctx) {
    try {
      return ctx.reply("Invalid command.");
    } catch (error) {
      logger.error("Error handling unknown command:", error);
      ctx.reply("❌ Failed to handle unknown command.");
    }
  }
}

module.exports = new AdminHandlers();
