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
  async handleAdminRequestWithdrawal(ctx, companyId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      const companies = await adminService.getCompanySalesAndCommission();
      const company = companies.find((c) => c.id === companyId);
      if (!company) return ctx.reply("❌ Company not found.");
      const amount = company.platformCommissionCurrent ?? 0;
      const sales = company.totalSales;
      ctx.session.pendingWithdrawal = { companyId, amount };
      const message = `⚠️ *Request Withdrawal*\n\nCompany: ${
        company.name
      }\nCommission Cut: $${amount.toFixed(
        2
      )}\nSales: ${sales}\n\nDo you want to request a withdrawal for this amount?`;
      const buttons = [
        [
          Markup.button.callback(
            "✅ Confirm",
            `confirm_admin_withdrawal_${companyId}`
          ),
        ],
        [Markup.button.callback("❌ Cancel", "platform_analytics_dashboard")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in admin withdrawal request:", error);
      ctx.reply("❌ Failed to start withdrawal request.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Handler for confirm_admin_withdrawal callback
  async handleAdminConfirmWithdrawal(ctx, companyId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      const companies = await adminService.getCompanySalesAndCommission();
      console.log("All companies:", companies);
      const company = companies.find((c) => c.id === companyId);
      console.log("Selected company:", company, "for companyId:", companyId);
      if (!company) return ctx.reply("❌ Company not found.");
      const amount = company.platformCommissionCurrent ?? 0;
      // Create withdrawal record
      const db = require("../config/database");
      const withdrawal = {
        type: "platform_commission",
        companyId: String(company.id),
        amount,
        status: "company_pending",
        createdAt: new Date(),
        requestedBy: ctx.from.id,
      };
      const ref = await db.withdrawals().add(withdrawal);
      // Notify company owner (fallback to company.telegramId if ownerTelegramId is missing)
      // Robust company owner lookup
      let companyOwnerId = company.ownerTelegramId || company.telegramId;
      if (!companyOwnerId) {
        // Try to find the owner in users collection
        const userService = require("../services/userService");
        let allUsers = [];
        if (userService.getAllUsers) {
          allUsers = await userService.getAllUsers();
        } else if (
          userService.userService &&
          userService.userService.getAllUsers
        ) {
          allUsers = await userService.userService.getAllUsers();
        }
        console.log("All users:", allUsers);
        const ownerUser = allUsers.find(
          (u) =>
            (u.isCompanyOwner &&
              u.companyId &&
              ((typeof u.companyId === "object" &&
                (u.companyId.id === company.id ||
                  u.companyId === company.id)) ||
                u.companyId === company.id)) ||
            (u.joinedCompanies && u.joinedCompanies.includes(company.id))
        );
        console.log("Owner user found:", ownerUser);
        if (ownerUser && ownerUser.telegramId) {
          companyOwnerId = ownerUser.telegramId;
        }
      }
      console.log("Final companyOwnerId:", companyOwnerId);
      if (!companyOwnerId) {
        ctx.reply(
          "❌ Company owner not found. Cannot send approval request. Please check the company data."
        );
        return;
      }
      const approveBtn = require("telegraf").Markup.button.callback(
        "✅ Approve",
        `company_approve_withdrawal_${ref.id}`
      );
      const denyBtn = require("telegraf").Markup.button.callback(
        "❌ Deny",
        `company_deny_withdrawal_${ref.id}`
      );
      const notifyMsg = `⚠️ *Platform Commission Withdrawal Request*\n\nThe platform is requesting a withdrawal of $${amount.toFixed(
        2
      )} from your company (${company.name}).\n\nDo you approve this payout?`;
      await ctx.telegram.sendMessage(companyOwnerId, notifyMsg, {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard([[approveBtn, denyBtn]]),
      });
      ctx.reply("✅ Withdrawal request sent to company owner for approval.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in confirm admin withdrawal:", error);
      ctx.reply("❌ Failed to process withdrawal request.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminPanel(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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

  async handleAdminCompanyDetail(ctx, companyId, productPage = 1) {
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
      // List products with pagination
      const products = await companyService.getCompanyProducts(company.id);
      const perPage = 5;
      const totalPages = Math.ceil(products.length / perPage) || 1;
      productPage = Number(productPage) || 1;
      const start = (productPage - 1) * perPage;
      const end = start + perPage;
      if (products.length) {
        msg += `\n*Products (Page ${productPage}/${totalPages}):*\n`;
      }
      const buttons = [];
      products.slice(start, end).forEach((product) => {
        msg += `• ${product.title} ($${product.price})\n`;
        buttons.push([
          Markup.button.callback(product.title, `admin_product_${product.id}`),
        ]);
      });
      // Pagination buttons for products
      const navButtons = [];
      if (productPage > 1)
        navButtons.push(
          Markup.button.callback(
            "⬅️ Previous",
            `admin_company_products_${company.id}_${productPage - 1}`
          )
        );
      if (productPage < totalPages)
        navButtons.push(
          Markup.button.callback(
            "➡️ Next",
            `admin_company_products_${company.id}_${productPage + 1}`
          )
        );
      if (navButtons.length) buttons.push(navButtons);
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      // List all users
      const users = await userService.getAllUsers();
      let msg = `👥 *User Management*\n\nTotal Users: ${users.length}\n`;
      const buttons = [
        [Markup.button.callback("👥 All Users", "all_users_menu_1")],
        [Markup.button.callback("🔍 Search User", "search_user")],
        [Markup.button.callback("🚫 Banned Users", "banned_users")],
        [Markup.button.callback("📤 Export Users", "export_users")],
        [Markup.button.callback("⬆️ Promote User", "promote_user_menu")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      // List all companies
      const companies = await companyService.getAllCompanies();
      let msg = `🏢 *Company Management*\n\nTotal Companies: ${companies.length}\n`;
      const buttons = [
        [Markup.button.callback("🏢 All Companies", "all_companies_menu_1")],
        [Markup.button.callback("🔍 Search Company", "search_company")],
        [Markup.button.callback("📤 Export Companies", "export_companies")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      ctx.reply(msg, {
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      const buttons = [
        [Markup.button.callback("Set Platform Fee", "set_platform_fee")],
        [Markup.button.callback("🔙 Back", "admin_panel")],
      ];
      ctx.reply(message, {
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

  async handleSetPlatformFee(ctx) {
    ctx.session.awaitingPlatformFee = true;
    ctx.reply("Please enter the new platform fee percentage (e.g., 2 for 2%):");
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handlePlatformFeeInput(ctx) {
    if (!ctx.session.awaitingPlatformFee) return;
    const input = ctx.message.text.trim();
    const value = parseFloat(input);
    if (isNaN(value) || value < 0 || value > 100) {
      return ctx.reply("❌ Please enter a valid percentage between 0 and 100.");
    }
    await adminService.setPlatformSetting("platformFeePercent", value);
    ctx.session.awaitingPlatformFee = false;
    ctx.reply(`✅ Platform fee updated to ${value}%.`);
    // Show updated settings
    await this.handleSystemSettings(ctx);
  }

  async handlePlatformAnalyticsDashboard(ctx, page = 1) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      const stats = await adminService.getPlatformStats();
      const companies = await adminService.getCompanySalesAndCommission();
      const perPage = 10;
      const totalPages = Math.ceil(companies.length / perPage) || 1;
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let message = `📊 *Platform Analytics Dashboard*\n\n`;
      message += `👥 Users: ${stats.totalUsers}\n`;
      message += `🏢 Companies: ${stats.totalCompanies}\n`;
      message += `💰 Revenue: $${(stats.platformRevenue || 0).toFixed(2)}\n`;
      if (stats.growth) {
        message += `\n📈 Growth (30d):\n`;
        message += `• Users: +${stats.growth.users30d || 0}%\n`;
        message += `• Revenue: +${stats.growth.revenue30d || 0}%\n`;
      }
      message += `\n\n*Company Sales & Platform Commission (Page ${page}/${totalPages}):*\n`;
      // Compose company sales & commission section
      let companyStatsMsg = "";
      companies.slice(start, end).forEach((c, idx) => {
        try {
          if (!c || typeof c !== "object") {
            companyStatsMsg += `• [Company ${
              start + idx + 1
            }] (data missing)\n`;
            return;
          }
          const name = c.name || "Unknown";
          const withdrawable = Number(
            c.platformCommissionCurrent ?? c.platformCommission ?? 0
          );
          const lifetime = Number(c.platformCommissionLifetime ?? 0);
          const sales = Number(c.totalSales ?? 0);
          const revenue = Number(c.totalRevenue ?? 0);
          companyStatsMsg += `• ${name} ($${withdrawable.toFixed(
            2
          )} withdrawable, $${lifetime.toFixed(
            2
          )} lifetime, ${sales} sales, $${revenue.toFixed(2)} total)\n`;
        } catch (err) {
          companyStatsMsg += `• [Company ${
            start + idx + 1
          }] (formatting error)\n`;
        }
      });
      message += `\nCompany Sales & Platform Commission:\n${companyStatsMsg}`;
      const buttons = [];
      companies.slice(start, end).forEach((c) => {
        if (
          c &&
          typeof c === "object" &&
          c.name &&
          c.platformCommission !== undefined &&
          c.totalSales !== undefined &&
          c.totalRevenue !== undefined
        ) {
          const commission = Number(c.platformCommission ?? 0);
          const totalSales = Number(c.totalSales ?? 0);
          const totalRevenue = Number(c.totalRevenue ?? 0);
          message += `• ${c.name} ($${commission.toFixed(
            2
          )} from ${totalSales} sales, $${totalRevenue.toFixed(2)} total)\n`;
        }
        buttons.push([
          Markup.button.callback(
            `Request Withdrawal: ${c.name || "Unknown"}`,
            `request_withdrawal_${c.id}`
          ),
        ]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback(
            "⬅️ Previous",
            `platform_analytics_dashboard_${page - 1}`
          )
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback(
            "➡️ Next",
            `platform_analytics_dashboard_${page + 1}`
          )
        );
      if (navButtons.length) buttons.push(navButtons);
      buttons.push([Markup.button.callback("🔙 Back", "admin_panel")]);
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in platform analytics dashboard:", error);
      ctx.reply("❌ Failed to load platform analytics dashboard.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSearchUser(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id))) return;

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
      if (
        !(await this.isAdminAsync(ctx.from.id)) ||
        !ctx.session.waitingForSearch
      )
        return;

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
      if (!(await this.isAdminAsync(ctx.from.id))) return;

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
      if (!(await this.isAdminAsync(ctx.from.id))) return;

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
      if (!(await this.isAdminAsync(ctx.from.id))) return;

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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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

  // Helper to handle approve_payout_{payoutId} callback
  async handleApprovePayoutCallback(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
    if (!(await this.isAdminAsync(ctx.from.id)))
      return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      await companyService.rejectCompany(companyId);
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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

  async handlePendingPayouts(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id))) return;
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
      if (!(await this.isAdminAsync(ctx.from.id))) return;

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
      if (!(await this.isAdminAsync(ctx.from.id))) return;

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
      if (!(await this.isAdminAsync(ctx.from.id))) return;

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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
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

  // Handler for company approval of platform commission withdrawal
  async handleCompanyApproveWithdrawal(ctx, withdrawalId) {
    try {
      const db = require("../config/database");
      const withdrawalRef = db.withdrawals().doc(withdrawalId);
      const withdrawalDoc = await withdrawalRef.get();
      console.log(
        "handleCompanyApproveWithdrawal: withdrawalId:",
        withdrawalId
      );
      console.log(
        "handleCompanyApproveWithdrawal: withdrawalDoc.exists:",
        withdrawalDoc.exists
      );
      if (!withdrawalDoc.exists) {
        console.log("Withdrawal not found for withdrawalId:", withdrawalId);
        return ctx.reply("❌ Withdrawal not found.");
      }
      const withdrawal = withdrawalDoc.data();
      console.log("handleCompanyApproveWithdrawal: withdrawal:", withdrawal);
      console.log(
        "handleCompanyApproveWithdrawal: withdrawal.companyId:",
        withdrawal.companyId
      );
      // Try to fetch the company by doc id
      let companyRef = db.companies().doc(String(withdrawal.companyId).trim());
      let companyDoc = await companyRef.get();
      console.log(
        "handleCompanyApproveWithdrawal: companyDoc.exists:",
        companyDoc.exists
      );
      let company = null;
      if (companyDoc.exists) {
        company = companyDoc.data();
        company._docId = companyDoc.id;
        console.log("Company found by doc id:", company);
      } else {
        // Fallback: fetch all companies and search by id field
        console.log(
          "Company not found by doc id, searching all companies for id:",
          withdrawal.companyId,
          "type:",
          typeof withdrawal.companyId
        );
        const allCompaniesSnap = await db.companies().get();
        const allCompanyIds = [];
        allCompaniesSnap.forEach((doc) => {
          const c = doc.data();
          allCompanyIds.push({ docId: doc.id, id: c.id, idType: typeof c.id });
        });
        console.log("All company doc IDs and id fields:", allCompanyIds);
        let found = false;
        allCompaniesSnap.forEach((doc) => {
          const c = doc.data();
          const docIdStr = String(doc.id).trim();
          const idFieldStr =
            c.id !== undefined ? String(c.id).trim() : undefined;
          const withdrawalIdStr = String(withdrawal.companyId).trim();
          console.log(
            "Comparing docId:",
            docIdStr,
            "idField:",
            idFieldStr,
            "to withdrawal.companyId:",
            withdrawalIdStr
          );
          if (idFieldStr && idFieldStr === withdrawalIdStr) {
            company = c;
            company._docId = doc.id;
            found = true;
            console.log("Company found by id field:", company);
          }
        });
        if (!found) {
          console.log(
            "Company not found by id field either:",
            withdrawal.companyId
          );
          return ctx.reply("❌ Company not found.");
        }
      }
      if (withdrawal.status !== "company_pending")
        return ctx.reply("❌ Withdrawal is not pending company approval.");
      await withdrawalRef.update({
        status: "admin_pending",
        companyApprovedBy: ctx.from.id,
        companyApprovedAt: new Date(),
      });
      // Notify admins with confirm button
      const userService = require("../services/userService");
      const adminIds = await userService.userService.getAdminTelegramIds();
      const confirmBtn = require("telegraf").Markup.button.callback(
        "✅ Confirm",
        `finalize_admin_withdrawal_${withdrawalId}`
      );
      const denyBtn = require("telegraf").Markup.button.callback(
        "❌ Deny",
        `deny_admin_withdrawal_${withdrawalId}`
      );
      const adminMsg = `✅ *Company Approved Platform Commission Withdrawal*\n\nCompany: ${
        withdrawal.companyId
      }\nAmount: $${withdrawal.amount.toFixed(
        2
      )}\n\nPlease confirm the payout has been received by the platform.`;
      for (const adminId of adminIds) {
        await ctx.telegram.sendMessage(adminId, adminMsg, {
          parse_mode: "Markdown",
          ...require("telegraf").Markup.inlineKeyboard([[confirmBtn, denyBtn]]),
        });
      }
      ctx.reply(
        "✅ Company approval recorded. Admins have been notified for final confirmation."
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company approve withdrawal:", error);
      ctx.reply("❌ Failed to process company approval.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyDenyWithdrawal(ctx, withdrawalId) {
    try {
      const db = require("../config/database");
      const withdrawalRef = db.withdrawals().doc(withdrawalId);
      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) return ctx.reply("❌ Withdrawal not found.");
      await withdrawalRef.update({
        status: "denied",
        companyDeniedBy: ctx.from.id,
        companyDeniedAt: new Date(),
      });
      ctx.reply("❌ Withdrawal request denied.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company deny withdrawal:", error);
      ctx.reply("❌ Failed to process denial.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Handler for admin final confirmation
  async handleAdminFinalizeWithdrawal(ctx, withdrawalId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply("❌ Access denied.");
      const db = require("../config/database");
      const withdrawalRef = db.withdrawals().doc(withdrawalId);
      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) return ctx.reply("❌ Withdrawal not found.");
      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "admin_pending")
        return ctx.reply("❌ Withdrawal is not pending admin confirmation.");
      // Subtract commission from company
      let companyRef = db.companies().doc(String(withdrawal.companyId));
      let companyDoc = await companyRef.get();
      console.log(
        "[Withdrawal Debug] Initial companyRef:",
        String(withdrawal.companyId),
        "exists:",
        companyDoc.exists
      );
      // Fallback: search all companies for a matching id field
      if (!companyDoc.exists) {
        const allCompaniesSnap = await db.companies().get();
        let foundDoc = null;
        allCompaniesSnap.forEach((doc) => {
          const data = doc.data();
          if (data.id === withdrawal.companyId) foundDoc = doc;
        });
        if (foundDoc) {
          companyDoc = foundDoc;
          companyRef = db.companies().doc(foundDoc.id);
          console.log(
            "[Withdrawal Debug] Fallback found company by id field:",
            foundDoc.id
          );
        } else {
          console.log(
            "[Withdrawal Debug] Company not found by doc id or id field:",
            withdrawal.companyId
          );
        }
      }
      if (!companyDoc.exists && !companyDoc.data) {
        console.log("[Withdrawal Debug] Company not found, aborting.");
        throw new Error("Company not found");
      }
      // Log company data before transaction
      const companyDataPre = companyDoc.data ? companyDoc.data() : {};
      console.log(
        "[Withdrawal Debug] Company data before transaction:",
        companyDataPre
      );
      await db.getDb().runTransaction(async (t) => {
        const companyDocTx = await t.get(companyRef);
        if (!companyDocTx.exists) throw new Error("Company not found");
        const data = companyDocTx.data();
        const oldCommission = data.platformCommission || 0;
        const newCommission = oldCommission - withdrawal.amount;
        console.log(
          "[Withdrawal Debug] Transaction: oldCommission:",
          oldCommission,
          "withdrawal.amount:",
          withdrawal.amount,
          "newCommission:",
          newCommission
        );
        t.update(companyRef, {
          platformCommission: Math.max(0, newCommission),
        });
        t.update(withdrawalRef, {
          status: "approved",
          adminApprovedBy: ctx.from.id,
          adminApprovedAt: new Date(),
        });
      });
      // Log company data after transaction
      const companyDocAfter = await companyRef.get();
      const companyDataPost = companyDocAfter.data
        ? companyDocAfter.data()
        : {};
      console.log(
        "[Withdrawal Debug] Company data after transaction:",
        companyDataPost
      );
      ctx.reply("✅ Withdrawal finalized and commission updated.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in admin finalize withdrawal:", error);
      ctx.reply("❌ Failed to finalize withdrawal.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
}

module.exports = new AdminHandlers();
