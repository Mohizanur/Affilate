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
const orderService = require("../services/orderService");
console.log("Loaded services/orderService in adminHandlers");
const referralService = require("../services/referralService");
console.log("Loaded services/referralService in adminHandlers");
const productService = require("../services/productService");
console.log("Loaded services/productService in adminHandlers");

// Add at the top:
function toDateSafe(x) {
  if (!x) return null;
  if (typeof x.toDate === 'function') return x.toDate();
  if (typeof x === 'string' || typeof x === 'number') return new Date(x);
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
      const user = await userService.userService.getUserByTelegramId(telegramId);
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
• Total Products: ${stats.totalProducts}
• Total Orders: ${stats.totalOrders}
• Total Revenue: $${stats.totalRevenue.toFixed(2)}

📈 Today's Activity:
• New Users: ${stats.today.newUsers}
• New Orders: ${stats.today.newOrders}
• Revenue: $${stats.today.revenue.toFixed(2)}

⚠️ Pending Actions:
• Pending Orders: ${stats.pending.orders}
• Pending Payouts: ${stats.pending.payouts}
• Support Tickets: ${stats.pending.tickets}
      `;

      const buttons = [
        [Markup.button.callback('👥 Users', 'admin_users'), Markup.button.callback('🏢 Companies', 'admin_companies')],
        [Markup.button.callback('📦 Orders', 'admin_orders'), Markup.button.callback('💸 Withdrawals', 'admin_withdrawals')],
        [Markup.button.callback('📊 Platform Analytics', 'platform_analytics_dashboard')],
        [Markup.button.callback('⚙️ System Settings', 'admin_settings'), Markup.button.callback('🪵 System Logs', 'admin_logs')],
        [Markup.button.callback('📢 Broadcast', 'admin_broadcast'), Markup.button.callback('💾 Backup', 'admin_backup')]
      ];

      ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in admin panel:', error);
      ctx.reply('❌ Failed to load admin panel.');
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListCompanies(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
    try {
      const companies = await companyService.getAllCompanies();
      if (!companies.length) return ctx.reply('No companies found.');
      const perPage = 10;
      const totalPages = Math.ceil(companies.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `🏢 *All Companies:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      companies.slice(start, end).forEach(company => {
        msg += `• ${company.name} ${company.statusBadge || ''} (${company.id})\n`;
        buttons.push([Markup.button.callback(`${company.name} ${company.statusBadge || ''}`, `admin_company_${company.id}`)]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1) navButtons.push(Markup.button.callback('⬅️ Previous', `admin_list_companies_${page - 1}`));
      if (page < totalPages) navButtons.push(Markup.button.callback('➡️ Next', `admin_list_companies_${page + 1}`));
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error listing companies:', error);
      ctx.reply('❌ Failed to list companies.');
    }
  }

  async handleAdminCompanyDetail(ctx, companyId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
    try {
      const company = await companyService.getCompanyById(companyId);
      if (!company) return ctx.reply('❌ Company not found.');
      let msg = `🏢 *${company.name}* ${company.statusBadge || ''}\n`;
      msg += `ID: ${company.id}\n`;
      msg += `Owner: ${company.ownerName || company.owner || 'N/A'}\n`;
      msg += `Email: ${company.email || 'N/A'}\n`;
      msg += `Phone: ${company.phone || 'N/A'}\n`;
      msg += `Status: ${company.status || 'N/A'}\n`;
      msg += `Created: ${toDateSafe(company.createdAt) ? toDateSafe(company.createdAt).toLocaleString() : 'N/A'}\n`;
      msg += `Updated: ${toDateSafe(company.updatedAt) ? toDateSafe(company.updatedAt).toLocaleString() : 'N/A'}\n`;
      msg += `Description: ${company.description || 'N/A'}\n`;
      // List products
      const products = await companyService.getCompanyProducts(company.id);
      if (products.length) {
        msg += `\n*Products:*\n`;
      }
      const buttons = [];
      products.forEach(product => {
        msg += `• ${product.title} ($${product.price})\n`;
        buttons.push([Markup.button.callback(product.title, `admin_product_${product.id}`)]);
      });
      // No approve/reject buttons
      ctx.reply(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error showing company detail:', error);
      ctx.reply('❌ Failed to load company details.');
    }
  }

  async handleAdminProductDetail(ctx, productId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
    try {
      const product = await productService.getProductById(productId);
      if (!product) return ctx.reply('❌ Product not found.');
      let msg = `🛒 *${product.title}*\n`;
      msg += `ID: ${product.id}\n`;
      msg += `Company: ${product.companyId}\n`;
      msg += `Price: $${product.price}\n`;
      msg += `Category: ${product.category || 'N/A'}\n`;
      msg += `Description: ${product.description || 'N/A'}\n`;
      msg += `Status: ${product.status || 'N/A'}\n`;
      msg += `Created: ${toDateSafe(product.createdAt) ? toDateSafe(product.createdAt).toLocaleString() : 'N/A'}\n`;
      msg += `Updated: ${toDateSafe(product.updatedAt) ? toDateSafe(product.updatedAt).toLocaleString() : 'N/A'}\n`;
      // Back button to company detail
      const buttons = [[Markup.button.callback('🔙 Back to Company', `admin_company_${product.companyId}`)]];
      ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    } catch (error) {
      logger.error('Error showing product detail:', error);
      ctx.reply('❌ Failed to load product details.');
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
        [Markup.button.callback('👥 All Users', 'all_users_menu_1')],
      ];
      ctx.reply(msg, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
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
      users = users.filter(u =>
        (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
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
      msg += `\n${start + i + 1}. ${user.first_name || user.username || user.id} (@${user.username || "-"}) - ${user.phone_number || "-"} ${user.canRegisterCompany ? "🟢" : "🔴"}`;
    });
    const buttons = users.slice(start, end).map(user => [
      Markup.button.callback(
        user.canRegisterCompany ? `❌ Unpromote (${user.first_name || user.username || '-'})` : `⬆️ Promote (${user.first_name || user.username || '-'})`,
        user.canRegisterCompany ? `demote_user_id_${user.id}` : `promote_user_id_${user.id}`
      )
    ]);
    // Pagination and search
    const navButtons = [];
    if (page > 1) navButtons.push(Markup.button.callback('⬅️ Prev', `promote_user_menu_${page - 1}`));
    if (page < totalPages) navButtons.push(Markup.button.callback('➡️ Next', `promote_user_menu_${page + 1}`));
    if (navButtons.length) buttons.push(navButtons);
    buttons.push([Markup.button.callback("🔍 Search", "promote_user_search")]);
    buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
    ctx.reply(msg, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handlePromoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, { canRegisterCompany: true });
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
        [Markup.button.callback('🔍 Search Company', 'search_company'), Markup.button.callback('📈 Company Analytics', 'company_analytics_summary')],
        [Markup.button.callback('➕ Add Company', 'admin_add_company'), Markup.button.callback('➖ Remove Company', 'admin_remove_company')],
        [Markup.button.callback('📋 List All Companies', 'admin_list_companies')],
        [Markup.button.callback('⚙️ Settings', 'company_settings'), Markup.button.callback('ექსპორტი', 'export_companies')],
        [Markup.button.callback('🔙 Back to Admin Panel', 'admin_panel')]
      ];
      ctx.reply('🏢 *Company Management*', { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in company management:', error);
      ctx.reply('❌ Failed to load company management.');
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminAddCompany(ctx) {
    try {
      // Clear any remove company session state
      delete ctx.session.adminRemoveCompanyStep;
      delete ctx.session.adminRemoveCompanyResults;
      delete ctx.session.adminRemoveCompanyId;
      ctx.session.adminAddCompanyStep = 'name';
      ctx.session.adminAddCompanyData = {};
      ctx.reply('🏢 *Add New Company*\n\nEnter company name:', { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error starting admin add company:', error);
      ctx.reply('❌ Failed to start add company.');
    }
  }

  async handleAdminAddCompanyStep(ctx) {
    try {
      const step = ctx.session.adminAddCompanyStep;
      const text = ctx.message.text;
      if (!ctx.session.adminAddCompanyData) return;
      switch (step) {
        case 'name':
          ctx.session.adminAddCompanyData.name = text;
          ctx.session.adminAddCompanyStep = 'description';
          ctx.reply('Enter company description:');
          break;
        case 'description':
          ctx.session.adminAddCompanyData.description = text;
          ctx.session.adminAddCompanyStep = 'website';
          ctx.reply('Enter company website (or type "skip"):');
          break;
        case 'website':
          ctx.session.adminAddCompanyData.website = text === 'skip' ? null : text;
          ctx.session.adminAddCompanyStep = 'phone';
          ctx.reply('Enter company phone:');
          break;
        case 'phone':
          ctx.session.adminAddCompanyData.phone = text;
          ctx.session.adminAddCompanyStep = 'commission_rate';
          ctx.reply('Enter referrer commission rate (1-50):');
          break;
        case 'commission_rate':
          const rate = parseFloat(text);
          if (isNaN(rate) || rate < 1 || rate > 50) return ctx.reply('❌ Please enter a valid commission rate (1-50):');
          ctx.session.adminAddCompanyData.referrerCommissionRate = rate;
          // Show confirmation
          const c = ctx.session.adminAddCompanyData;
          ctx.reply(`*Confirm New Company*\n\nName: ${c.name}\nDescription: ${c.description}\nWebsite: ${c.website}\nPhone: ${c.phone}\nCommission Rate: ${c.referrerCommissionRate}%\n\nType 'confirm' to save or 'cancel' to abort.`, { parse_mode: 'Markdown' });
          ctx.session.adminAddCompanyStep = 'confirm';
          break;
        case 'confirm':
          if (text.toLowerCase() === 'confirm') {
            await adminService.createCompanyAsAdmin(ctx.session.adminAddCompanyData);
            ctx.reply('✅ Company added successfully!');
          } else {
            ctx.reply('❌ Add cancelled.');
          }
          delete ctx.session.adminAddCompanyStep;
          delete ctx.session.adminAddCompanyData;
          break;
      }
    } catch (error) {
      logger.error('Error adding company (admin):', error);
      ctx.reply('❌ Failed to add company. Please try again.');
    }
  }

  async handleAdminRemoveCompany(ctx) {
    try {
      // Clear any add company session state
      delete ctx.session.adminAddCompanyStep;
      delete ctx.session.adminAddCompanyData;
      ctx.session.adminRemoveCompanyStep = 'search';
      ctx.reply('🔍 Enter company name or ID to remove:');
    } catch (error) {
      logger.error('Error starting admin remove company:', error);
      ctx.reply('❌ Failed to start remove company.');
    }
  }

  async handleAdminRemoveCompanyStep(ctx) {
    try {
      const step = ctx.session.adminRemoveCompanyStep;
      const text = ctx.message.text;
      if (step === 'search') {
        const results = await adminService.searchCompanies(text);
        if (!results.length) return ctx.reply('❌ No companies found.');
        ctx.session.adminRemoveCompanyResults = results;
        let msg = 'Select a company to remove:\n';
        results.forEach((c, i) => { msg += `\n${i + 1}. ${c.name} (${c.id})`; });
        ctx.reply(msg + '\n\nType the number of the company to remove:');
        ctx.session.adminRemoveCompanyStep = 'select';
      } else if (step === 'select') {
        const idx = parseInt(text) - 1;
        const companies = ctx.session.adminRemoveCompanyResults || [];
        if (isNaN(idx) || idx < 0 || idx >= companies.length) return ctx.reply('❌ Invalid selection.');
        ctx.session.adminRemoveCompanyId = companies[idx].id;
        ctx.reply(`⚠️ Are you sure you want to delete ${companies[idx].name}? Type 'delete' to confirm or 'cancel' to abort.`);
        ctx.session.adminRemoveCompanyStep = 'confirm';
      } else if (step === 'confirm') {
        if (text.toLowerCase() === 'delete') {
          await adminService.deleteCompany(ctx.session.adminRemoveCompanyId);
          ctx.reply('✅ Company deleted successfully!');
        } else {
          ctx.reply('❌ Delete cancelled.');
        }
        delete ctx.session.adminRemoveCompanyStep;
        delete ctx.session.adminRemoveCompanyResults;
        delete ctx.session.adminRemoveCompanyId;
      }
    } catch (error) {
      logger.error('Error removing company (admin):', error);
      ctx.reply('❌ Failed to remove company. Please try again.');
    }
  }

  async handleOrderManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      // List all orders
      const orders = await adminService.getAllOrders();
      let message = `📋 *Order Management*\n\nTotal Orders: ${orders.length}\n`;
      orders.slice(0, 20).forEach((order, i) => {
        message += `\n${i + 1}. ${order.productTitle || order.product_name || "No product"} - $${order.amount} - ${order.status || "pending"} - ${order.userName || order.user_name || "No user"} - ${order.id}`;
      });
      const buttons = [
        [Markup.button.callback("⏳ Pending Orders", "pending_orders")],
        [Markup.button.callback("✅ Approved Orders", "approved_orders")],
        [Markup.button.callback("❌ Rejected Orders", "rejected_orders")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in order management:", error);
      ctx.reply("❌ Failed to load order management.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const pending = await adminService.getOrdersByStatus("pending");
      let message = `⏳ *Pending Orders*\n\n`;
      if (pending.length === 0) message += "No pending orders.";
      pending.slice(0, 20).forEach((order, i) => {
        message += `\n${i + 1}. ${order.productTitle || order.product_name || "No product"} - $${order.amount} - ${order.userName || order.user_name || "No user"} - ${order.id}`;
      });
      const buttons = pending.slice(0, 20).map(order => [
        Markup.button.callback(`✅ Approve $${order.amount}`, `approve_order_${order.id}`),
        Markup.button.callback(`❌ Reject $${order.amount}`, `reject_order_${order.id}`),
      ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_orders")]);
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in pending orders:", error);
      ctx.reply("❌ Failed to load pending orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveOrder(ctx, orderId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await adminService.updateOrderStatus(orderId, "approved");
      ctx.reply("✅ Order approved successfully.");
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
      await adminService.updateOrderStatus(orderId, "rejected");
      ctx.reply("❌ Order rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error rejecting order:", error);
      ctx.reply("❌ Failed to reject order.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePayoutManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      // List all payouts
      const payouts = await adminService.getAllPayouts();
      let message = `💸 *Payout Management*\n\nTotal Payouts: ${payouts.length}\n`;
      payouts.slice(0, 20).forEach((payout, i) => {
        message += `\n${i + 1}. $${payout.amount} - ${payout.userName || payout.user_name || "No user"} - ${payout.status || "pending"} - ${payout.id}`;
      });
      const buttons = [
        [Markup.button.callback("⏳ Pending Payouts", "pending_payouts")],
        [Markup.button.callback("✅ Approved Payouts", "approved_payouts")],
        [Markup.button.callback("❌ Rejected Payouts", "rejected_payouts")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
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
        message += `\n${i + 1}. $${payout.amount} - ${payout.userName || payout.user_name || "No user"} - ${payout.id}`;
      });
      const buttons = pending.slice(0, 20).map(payout => [
        Markup.button.callback(`✅ Approve $${payout.amount}`, `approve_payout_${payout.id}`),
        Markup.button.callback(`❌ Reject $${payout.amount}`, `reject_payout_${payout.id}`),
      ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_payouts")]);
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
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
      if (!(await this.isAdminAsync(ctx.from.id))) return ctx.reply("❌ Access denied.");
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
          '❌ Session expired. Please start the broadcast again.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📢 Start Broadcast', 'admin_broadcast')]
          ])
        );
      }
      const message = messageText || (ctx.message && ctx.message.text);
      const type = ctx.session.broadcastType || 'all';

      try {
        const result = await adminService.sendBroadcast(message, type);
      // Clear session
      delete ctx.session.waitingForBroadcast;
      delete ctx.session.broadcastType;
      let summary = `✅ Broadcast sent successfully!\n\n📊 Statistics:\n• Sent: ${result.sent}\n• Failed: ${result.failed}\n• Total: ${result.total}`;
      if (result.failed > 0 && result.failedUsers && result.failedUsers.length > 0) {
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
      if (!(await this.isAdminAsync(ctx.from.id))) return ctx.reply("❌ Access denied.");
      if (!ctx.session || !ctx.session.waitingForBroadcast) {
        return ctx.reply(
          '❌ Session expired. Please start the broadcast again.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📢 Start Broadcast', 'admin_broadcast')]
          ])
        );
      }
      const { getBot } = require('../services/adminService');
      const bot = getBot ? getBot() : ctx.telegram;
      const usersSnap = await require("../config/database").users().get();
      let sent = 0, failed = 0, total = 0;
      let failedUsers = [];
      for (const doc of usersSnap.docs) {
        const user = doc.data();
        if (!user.telegramId) continue;
        total++;
        try {
          if (ctx.message.photo) {
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            await bot.telegram.sendPhoto(user.telegramId, fileId, { caption: ctx.message.caption || undefined });
          } else if (ctx.message.document) {
            await bot.telegram.sendDocument(user.telegramId, ctx.message.document.file_id, { caption: ctx.message.caption || undefined });
          } else if (ctx.message.sticker) {
            await bot.telegram.sendSticker(user.telegramId, ctx.message.sticker.file_id);
          } else if (ctx.message.video) {
            await bot.telegram.sendVideo(user.telegramId, ctx.message.video.file_id, { caption: ctx.message.caption || undefined });
          } else if (ctx.message.audio) {
            await bot.telegram.sendAudio(user.telegramId, ctx.message.audio.file_id, { caption: ctx.message.caption || undefined });
          } else if (ctx.message.voice) {
            await bot.telegram.sendVoice(user.telegramId, ctx.message.voice.file_id);
          } else if (ctx.message.video_note) {
            await bot.telegram.sendVideoNote(user.telegramId, ctx.message.video_note.file_id);
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
      message += `• Referral Expiry: ${settings.referralExpiryDays || 0} days\n`;
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
      message += `�� Revenue: $${(stats.platformRevenue || 0).toFixed(2)}\n`;
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
            message += `   📅 Joined: ${toDateSafe(result.createdAt) ? toDateSafe(result.createdAt).toLocaleDateString() : "-"}\n\n`;
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
            message += `   📅 ${toDateSafe(result.createdAt) ? toDateSafe(result.createdAt).toLocaleDateString() : "-"}\n\n`;
            break;
          case "payout":
            message += `${index + 1}. $${result.amount.toFixed(2)}\n`;
            message += `   👤 ${result.userName}\n`;
            message += `   📋 Status: ${result.status}\n`;
            message += `   📅 ${toDateSafe(result.requestedAt) ? toDateSafe(result.requestedAt).toLocaleDateString() : "-"}\n\n`;
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
            currentMode ? "🟢 Disable Maintenance" : "�� Enable Maintenance",
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

  async handleSystemLogs(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const logs = await adminService.getSystemLogs();
      let message = "📋 *System Logs (Last 10)*\n\n";
      logs.slice(0, 10).forEach((log, index) => {
        const icon =
          log.level === "error" ? "❌" : log.level === "warn" ? "⚠️" : "ℹ️";
        message += `${icon} ${log.message}\n`;
        message += `   📅 ${toDateSafe(log.timestamp) ? toDateSafe(log.timestamp).toLocaleString() : "-"}\n\n`;
      });
      const buttons = [
        [Markup.button.callback("❌ Error Logs", "error_logs"), Markup.button.callback("⚠️ Warning Logs", "warning_logs")],
        [Markup.button.callback("📤 Export Logs", "export_logs"), Markup.button.callback("🗑️ Clear Logs", "clear_logs")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing system logs:", error);
      ctx.reply("❌ Failed to load system logs.");
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
      message += `📅 Created: ${toDateSafe(backup.createdAt) ? toDateSafe(backup.createdAt).toLocaleString() : "-"}`;
      ctx.reply(message);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error creating backup:", error);
      ctx.reply("❌ Backup failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleManageUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      // List all users
      const users = await userService.getAllUsers();
      let msg = `👥 *User Management*

Total Users: ${users.length}
`;
      users.slice(0, 20).forEach((user, i) => {
        message += `\n${i + 1}. ${user.firstName || user.first_name || "No name"} (@${user.username || "-"}) - ${user.phone_number || "No phone"} - ${user.banned ? "🚫 Banned" : "✅ Active"}`;
      });
      const buttons = [
        [Markup.button.callback("🔍 Search User", "search_user")],
        [Markup.button.callback("🚫 Banned Users", "banned_users")],
        [Markup.button.callback("📤 Export Users", "export_users")],
        [Markup.button.callback("⬆️ Promote User", "promote_user_menu")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
        [Markup.button.callback('👥 All Users', 'all_users_menu_1')],
      ];
      ctx.reply(msg, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in user management:", error);
      ctx.reply("❌ Failed to load user management.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Called when admin clicks 'Search User' button
  async handleSearchUser(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("🔍 Please enter a username, phone, or ID to search:");
      ctx.session.state = "awaiting_user_search";
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in search user:", error);
      ctx.reply("❌ Failed to start user search.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Called when admin enters search input
  async handleSearchUserInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      if (!messageText || messageText.length < 2) return ctx.reply("❌ Please enter at least 2 characters.");
      const results = await userService.searchUsers(messageText);
      if (!results.length) return ctx.reply("❌ No users found.");
      let message = `🔍 *Search Results (${results.length})*\n\n`;
      results.slice(0, 10).forEach((user, i) => {
        message += `${i + 1}. ${user.first_name || user.firstName || "No name"} (@${user.username || "-"})\n`;
        message += `   📱 ${user.phone_number || user.phoneNumber || "No phone"}\n`;
        message += `   💰 Balance: $${(user.referral_balance || 0).toFixed(2)}\n`;
        message += `   📅 Joined: ${toDateSafe(user.created_at) ? toDateSafe(user.created_at).toLocaleDateString() : "-"}\n`;
        message += `   ${user.banned ? "🚫 Banned" : "✅ Active"}\n`;
      });
      const buttons = results.slice(0, 10).map(user => [
        user.banned
          ? Markup.button.callback("✅ Unban", `unban_user_${user.id}`)
          : Markup.button.callback("🚫 Ban", `ban_user_${user.id}`)
      ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      ctx.session.state = null;
    } catch (error) {
      logger.error("Error processing user search:", error);
      ctx.reply("❌ Search failed. Please try again.");
      ctx.session.state = null;
    }
  }

  async handleBanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.updateUser(userId, { banned: true });
      ctx.reply("🚫 User banned successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
      logger.info(`ADMIN ACTION: ${ctx.from.id} banned user ${userId}`);
    } catch (error) {
      logger.error("Error banning user:", error);
      ctx.reply("❌ Failed to ban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUnbanUser(ctx, userId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      await userService.updateUser(userId, { banned: false });
      ctx.reply("✅ User unbanned successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
      logger.info(`ADMIN ACTION: ${ctx.from.id} unbanned user ${userId}`);
    } catch (error) {
      logger.error("Error unbanning user:", error);
      ctx.reply("❌ Failed to unban user.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleExportUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const users = await userService.getAllUsers();
      // Export as CSV (robust)
      let csv = "id,firstName,lastName,username,phone,banned,createdAt\n";
      users.forEach(u => {
        csv += `${u.id},${u.first_name || u.firstName || "-"},${u.last_name || u.lastName || "-"},${u.username || "-"},${u.phone_number || u.phone || "-"},${u.banned ? "banned" : "active"},${toDateSafe(u.created_at) ? toDateSafe(u.created_at).toISOString() : "-"}\n`;
      });
      ctx.replyWithDocument({ source: Buffer.from(csv), filename: "users.csv" });
      ctx.reply("✅ Exported all users as CSV.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting users:", error);
      ctx.reply("❌ Failed to export users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleUserAnalytics(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getUserAnalytics();
      let message = `📊 *User Analytics*\n\n`;
      message += `👥 Total Users: ${stats.total}\n`;
      message += `✅ Phone Verified: ${stats.verified}\n`;
      message += `🔗 With Referral Codes: ${stats.referrers}\n`;
      message += `🟢 Active (7d): ${stats.active}\n`;
      if (stats.growth) {
        message += `\n📈 Growth:\n`;
        message += `• This Month: +${stats.growth.thisMonth || 0}\n`;
        message += `• Last Month: +${stats.growth.lastMonth || 0}\n`;
        message += `• Growth Rate: ${stats.growth.rate || 0}%\n`;
      }
      ctx.reply(message, { parse_mode: "Markdown" });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in user analytics:", error);
      ctx.reply("❌ Failed to load user analytics.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  async handleManageCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      // List all companies
      const companies = await companyService.getAllCompanies();
      let message = `🏢 *Company Management*\n\nTotal Companies: ${companies.length}\n`;
      companies.slice(0, 20).forEach((company, i) => {
        message += `\n${i + 1}. ${company.name} (${company.codePrefix}) - ${company.status || "pending"}`;
      });
      const buttons = [
        [Markup.button.callback("⏳ Pending Companies", "pending_companies")],
        [Markup.button.callback("📊 Company Analytics", "company_analytics")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
        [Markup.button.callback('🏢 All Companies', 'all_companies_menu_1')],
      ];
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company management:", error);
      ctx.reply("❌ Failed to load company management.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePendingCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const pending = await companyService.getPendingCompanies();
      let message = `⏳ *Pending Companies*\n\n`;
      if (pending.length === 0) message += "No pending companies.";
      pending.forEach((company, i) => {
        message += `\n${i + 1}. ${company.name} (${company.codePrefix}) - ${company.id}`;
      });
      const buttons = pending.map((company) => [
        Markup.button.callback(`✅ Approve ${company.name}`, `approve_company_${company.id}`),
        Markup.button.callback(`❌ Reject ${company.name}`, `reject_company_${company.id}`),
      ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_companies")]);
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in pending companies:", error);
      ctx.reply("❌ Failed to load pending companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleApproveCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const company = await companyService.updateCompanyStatus(companyId, "approved");
      // Notify company owner (if Telegram ID is available)
      if (company.telegramId) {
        try {
          await ctx.telegram.sendMessage(company.telegramId, `✅ Your company (${company.name}) has been approved! You can now access your dashboard and start adding products.`);
        } catch (notifyErr) {
          logger.error("Error notifying company owner:", notifyErr);
        }
      }
      ctx.reply("✅ Company approved successfully.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
      logger.info(`ADMIN ACTION: ${ctx.from.id} approved company ${companyId}`);
    } catch (error) {
      logger.error("Error approving company:", error);
      ctx.reply("❌ Failed to approve company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectCompany(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const company = await companyService.updateCompanyStatus(companyId, "rejected");
      // Notify company owner (if Telegram ID is available)
      if (company.telegramId) {
        try {
          await ctx.telegram.sendMessage(company.telegramId, `❌ Your company (${company.name}) has been rejected. Please contact support for more information.`);
        } catch (notifyErr) {
          logger.error("Error notifying company owner:", notifyErr);
        }
      }
      ctx.reply("❌ Company rejected.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
      logger.info(`ADMIN ACTION: ${ctx.from.id} rejected company ${companyId}`);
    } catch (error) {
      logger.error("Error rejecting company:", error);
      ctx.reply("❌ Failed to reject company.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Show analytics for a specific company
  async handleCompanyAnalytics(ctx, companyId) {
    if (!companyId || typeof companyId !== 'string' || !companyId.trim()) {
      ctx.reply("❌ Invalid company selected. Please try again from the company search.");
      return;
    }
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const stats = await adminService.getCompanyAnalyticsById(companyId);
      if (!stats) return ctx.reply("❌ Company not found.");
      let message = `📊 *Company Analytics*\n\n`;
      message += `🏢 Name: ${stats.name}\n`;
      message += `📧 Email: ${stats.email || "-"}\n`;
      message += `📊 Products: ${stats.totalProducts || 0}\n`;
      message += `🛒 Orders: ${stats.totalOrders || 0}\n`;
      message += `💰 Revenue: $${(stats.totalRevenue || 0).toFixed(2)}\n`;
      message += `🟢 Active Referrers: ${stats.activeReferrers || 0}\n`;
      message += `📅 Created: ${toDateSafe(stats.createdAt) ? toDateSafe(stats.createdAt).toLocaleDateString() : "-"}\n`;
      message += `Updated: ${toDateSafe(stats.updatedAt) ? toDateSafe(stats.updatedAt).toLocaleDateString() : "-"}\n`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", "admin_companies")]])
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics:", error);
      ctx.reply("❌ Failed to load company analytics.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle company_analytics_{companyId} callback
  async handleCompanyAnalyticsCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^company_analytics_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid analytics action.");
      const companyId = match[1];
      await this.handleCompanyAnalytics(ctx, companyId);
    } catch (error) {
      logger.error("Error in company analytics callback:", error);
      ctx.reply("❌ Failed to load company analytics.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  async handleManageWithdrawals(ctx) {
    return ctx.reply("💸 Withdrawal management: (not yet implemented)");
  }

  // Add stubs for missing admin handlers to ensure all admin panel actions are routed
  async handleBannedUsers(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const users = await userService.getAllUsers();
      const banned = users.filter(u => u.banned);
      let message = `🚫 *Banned Users*\n\nTotal: ${banned.length}\n`;
      if (banned.length === 0) message += "\nNo banned users.";
      banned.slice(0, 20).forEach((user, i) => {
        message += `\n${i + 1}. ${user.first_name || user.firstName || "No name"} (@${user.username || "-"}) - ${user.phone_number || "No phone"}`;
      });
      const buttons = banned.slice(0, 20).map(user => [
        Markup.button.callback(`✅ Unban`, `unban_user_${user.id}`)
      ]);
      buttons.push([Markup.button.callback("🔙 Back", "admin_users")]);
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing banned users:", error);
      ctx.reply("❌ Failed to load banned users.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  async handleApprovedOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const approved = await adminService.getOrdersByStatus("approved");
      let message = `✅ *Approved Orders*\n\nTotal: ${approved.length}\n`;
      if (approved.length === 0) message += "No approved orders.";
      approved.slice(0, 20).forEach((order, i) => {
        message += `\n${i + 1}. ${order.productTitle || order.product_name || "No product"} - $${order.amount} - ${order.userName || order.user_name || "No user"} - ${order.id}`;
      });
      const buttons = [[Markup.button.callback("🔙 Back", "admin_orders")]];
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing approved orders:", error);
      ctx.reply("❌ Failed to load approved orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  async handleRejectedOrders(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const rejected = await adminService.getOrdersByStatus("rejected");
      let message = `❌ *Rejected Orders*\n\nTotal: ${rejected.length}\n`;
      if (rejected.length === 0) message += "No rejected orders.";
      rejected.slice(0, 20).forEach((order, i) => {
        message += `\n${i + 1}. ${order.productTitle || order.product_name || "No product"} - $${order.amount} - ${order.userName || order.user_name || "No user"} - ${order.id}`;
      });
      const buttons = [[Markup.button.callback("🔙 Back", "admin_orders")]];
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing rejected orders:", error);
      ctx.reply("❌ Failed to load rejected orders.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  // Called when admin clicks 'Search Company' button
  async handleSearchCompany(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      ctx.reply("🔍 Please enter a company name, email, or ID to search:");
      ctx.session.state = "awaiting_company_search";
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in search company:", error);
      ctx.reply("❌ Failed to start company search.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Called when admin enters company search input
  async handleSearchCompanyInput(ctx, messageText) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      if (!messageText || messageText.length < 2) return ctx.reply("❌ Please enter at least 2 characters.");
      const results = await adminService.searchCompanies(messageText);
      if (!results.length) return ctx.reply("❌ No companies found.");
      let message = `🔍 *Company Search Results (${results.length})*\n\n`;
      results.slice(0, 10).forEach((company, i) => {
        message += `${i + 1}. ${company.name}\n`;
        message += `   📧 ${company.email || "No email"}\n`;
        message += `   📊 Products: ${company.productCount || 0}\n`;
        message += `   💰 Revenue: $${(company.totalRevenue || 0).toFixed(2)}\n`;
        message += `   Status: ${company.status || "unknown"}\n`;
      });
      const buttons = results.slice(0, 10).map(company => {
        if (company.status === "pending") {
          return [
            Markup.button.callback("✅ Approve", `approve_company_${company.id}`),
            Markup.button.callback("❌ Reject", `reject_company_${company.id}`)
          ];
        } else {
          return [
            Markup.button.callback("📊 Analytics", `company_analytics_${company.id}`),
            Markup.button.callback("⚙️ Settings", `company_settings_${company.id}`)
          ];
        }
      });
      buttons.push([Markup.button.callback("🔙 Back", "admin_companies")]);
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      ctx.session.state = null;
    } catch (error) {
      logger.error("Error processing company search:", error);
      ctx.reply("❌ Search failed. Please try again.");
      ctx.session.state = null;
    }
  }
  async handleBillingManagement(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const summary = await adminService.getCompanyBillingSummary();
      let message = `💳 *Company Billing Management*\n\n`;
      if (!summary.length) message += "No billing issues or outstanding balances.";
      summary.forEach((c, i) => {
        message += `\n${i + 1}. ${c.name} (${c.email || "-"})\n`;
        message += `   Balance: $${(c.billingBalance || 0).toFixed(2)}\n`;
        if (c.billingIssue) message += `   ⚠️ Issue: ${c.billingIssue}\n`;
      });
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", "admin_companies")]])
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in billing management:", error);
      ctx.reply("❌ Failed to load billing management.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  async handleExportCompanies(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const companies = await adminService.getAllCompanies();
      let csv = "id,name,email,status,totalProducts,totalRevenue,createdAt\n";
      companies.forEach(c => {
        csv += `${c.id},${c.name || "-"},${c.email || "-"},${c.status || "-"},${c.totalProducts || 0},${c.totalRevenue || 0},${toDateSafe(c.createdAt) ? toDateSafe(c.createdAt).toISOString() : "-"}\n`;
      });
      ctx.replyWithDocument({ source: Buffer.from(csv), filename: "companies.csv" });
      ctx.reply("✅ Exported all companies as CSV.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting companies:", error);
      ctx.reply("❌ Failed to export companies.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  // Show settings for a specific company
  async handleCompanySettings(ctx, companyId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const company = await adminService.getCompanyById(companyId);
      if (!company) return ctx.reply("❌ Company not found.");
      let message = `⚙️ *Company Settings*\n\n`;
      message += `🏢 Name: ${company.name}\n`;
      message += `📧 Email: ${company.email || "-"}\n`;
      message += `📊 Products: ${company.totalProducts || 0}\n`;
      message += `💰 Commission Rate: ${company.commissionRate || 0}%\n`;
      message += `🟢 Status: ${company.status || "unknown"}\n`;
      message += `📅 Created: ${toDateSafe(company.createdAt) ? toDateSafe(company.createdAt).toLocaleDateString() : "-"}\n`;
      message += `Updated: ${toDateSafe(company.updatedAt) ? toDateSafe(company.updatedAt).toLocaleDateString() : "-"}\n`;
      message += `\n_Edit functionality coming soon._`;
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", "admin_companies")]])
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company settings:", error);
      ctx.reply("❌ Failed to load company settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  // Helper to handle company_settings_{companyId} callback
  async handleCompanySettingsCallback(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const callbackData = ctx.callbackQuery.data;
      const match = callbackData.match(/^company_settings_(.+)$/);
      if (!match) return ctx.reply("❌ Invalid settings action.");
      const companyId = match[1];
      await this.handleCompanySettings(ctx, companyId);
    } catch (error) {
      logger.error("Error in company settings callback:", error);
      ctx.reply("❌ Failed to load company settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  async handleApprovedPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const approved = await adminService.getPayoutsByStatus("approved");
      let message = `✅ *Approved Payouts*\n\nTotal: ${approved.length}\n`;
      if (approved.length === 0) message += "\nNo approved payouts.";
      approved.slice(0, 20).forEach((payout, i) => {
        message += `\n${i + 1}. $${payout.amount} - ${payout.userName || payout.user_name || "No user"} - ${payout.id}`;
      });
      const buttons = [[Markup.button.callback("🔙 Back", "admin_payouts")]];
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing approved payouts:", error);
      ctx.reply("❌ Failed to load approved payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  async handleRejectedPayouts(ctx) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const rejected = await adminService.getPayoutsByStatus("rejected");
      let message = `❌ *Rejected Payouts*\n\nTotal: ${rejected.length}\n`;
      if (rejected.length === 0) message += "\nNo rejected payouts.";
      rejected.slice(0, 20).forEach((payout, i) => {
        message += `\n${i + 1}. $${payout.amount} - ${payout.userName || payout.user_name || "No user"} - ${payout.id}`;
      });
      const buttons = [[Markup.button.callback("🔙 Back", "admin_payouts")]];
      ctx.reply(message, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error listing rejected payouts:", error);
      ctx.reply("❌ Failed to load rejected payouts.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }
  async handleSystemLogs(ctx) {
    // TODO: Implement system logs
    ctx.reply('📜 System logs coming soon.');
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }
  async handleBackupSystem(ctx) {
    // TODO: Implement backup system
    ctx.reply('💾 Backup system coming soon.');
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  // Handler for overall company analytics summary
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
        ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", "admin_companies")]])
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company analytics summary:", error);
      ctx.reply("❌ Failed to load company analytics summary.");
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
      const db = require('../config/database').getDb();
      const productRef = db.collection('products').doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply('❌ Product not found.');
      await productRef.update({ status: 'approved', updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require('../services/notificationService').getNotificationServiceInstance().sendNotification(product.creatorTelegramId, `✅ Your product (${product.title}) has been approved and is now public!`, { type: 'product', action: 'approved', productId });
      }
      ctx.reply('✅ Product approved successfully.');
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error approving product:', error);
      ctx.reply('❌ Failed to approve product.');
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRejectProductCallback(ctx, productId) {
    try {
      if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
      const db = require('../config/database').getDb();
      const productRef = db.collection('products').doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) return ctx.reply('❌ Product not found.');
      await productRef.update({ status: 'rejected', updatedAt: new Date() });
      const product = productDoc.data();
      // Notify creator
      if (product.creatorTelegramId) {
        await require('../services/notificationService').getNotificationServiceInstance().sendNotification(product.creatorTelegramId, `❌ Your product (${product.title}) has been rejected. Please contact support for more information.`, { type: 'product', action: 'rejected', productId });
      }
      ctx.reply('❌ Product rejected.');
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error rejecting product:', error);
      ctx.reply('❌ Failed to reject product.');
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAdminListUsers(ctx, page = 1) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
    try {
      const users = await userService.getAllUsers();
      if (!users.length) return ctx.reply('No users found.');
      const perPage = 10;
      const totalPages = Math.ceil(users.length / perPage);
      page = Number(page) || 1;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      let msg = `👤 *All Users:* (Page ${page}/${totalPages})\n`;
      const buttons = [];
      users.slice(start, end).forEach(user => {
        msg += `• ${user.first_name || user.firstName || user.username || user.id}\n`;
        buttons.push([Markup.button.callback(user.first_name || user.firstName || user.username || user.id, `admin_user_${user.id}`)]);
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1) navButtons.push(Markup.button.callback('⬅️ Previous', `admin_list_users_${page - 1}`));
      if (page < totalPages) navButtons.push(Markup.button.callback('➡️ Next', `admin_list_users_${page + 1}`));
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error listing users:', error);
      ctx.reply('❌ Failed to list users.');
    }
  }

  async handleAdminUserDetail(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
    try {
      const user = await userService.userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply('❌ User not found.');
      let msg = `👤 *${user.first_name || user.firstName || user.username || user.id}*\n`;
      msg += `ID: ${user.id}\n`;
      msg += `Username: @${user.username || 'N/A'}\n`;
      msg += `Phone: ${user.phone_number || 'N/A'}\n`;
      msg += `Email: ${user.email || 'N/A'}\n`;
      msg += `Role: ${user.role || 'user'}\n`;
      msg += `Joined: ${toDateSafe(user.created_at) ? toDateSafe(user.created_at).toLocaleString() : 'N/A'}\n`;
      msg += `Verified: ${user.phone_verified ? '✅' : '❌'}\n`;
      msg += `Companies Joined: ${(user.joinedCompanies || []).length}\n`;
      msg += `Referral Codes: ${user.referralCodes ? Object.values(user.referralCodes).join(', ') : 'N/A'}\n`;
      msg += `Last Active: ${toDateSafe(user.last_active) ? toDateSafe(user.last_active).toLocaleString() : 'N/A'}\n`;
      msg += `\n*Company Registration Permission:*\n`;
      msg += user.canRegisterCompany ? '🟢 Eligible to register companies' : '🔴 Not eligible to register companies';
      // Purchase history
      const orders = await orderService.getUserOrders(userId);
      msg += `\n*Purchase History:*\n`;
      if (!orders.length) {
        msg += 'No purchases found.\n';
      } else {
        orders.forEach(order => {
          msg += `• ${order.product_title || order.productId} ($${order.amount}) from company ${order.company_name || order.companyId} on ${toDateSafe(order.createdAt) ? toDateSafe(order.createdAt).toLocaleString() : 'N/A'}\n`;
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
          const code = user.referralCodes && company && company.codePrefix ? user.referralCodes[company.codePrefix] : undefined;
          msg += `• ${company ? company.name : companyId}`;
          if (code) msg += ` (Referral: ${code})`;
          msg += '\n';
        }
      }
      // Ban/Unban and Promote/Demote buttons
      const buttons = [];
      if (user.banned) {
        buttons.push([Markup.button.callback('✅ Unban', `unban_user_${user.id}`)]);
      } else {
        buttons.push([Markup.button.callback('🚫 Ban', `ban_user_${user.id}`)]);
      }
      if (user.canRegisterCompany) {
        buttons.push([Markup.button.callback('❌ Demote (Remove Company Permission)', `demote_company_${user.id}`)]);
      } else {
        buttons.push([Markup.button.callback('✅ Promote (Allow Company Registration)', `promote_company_${user.id}`)]);
      }
      // Back button to user list
      buttons.push([Markup.button.callback('🔙 Back to Users', 'admin_list_users')]);
      ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    } catch (error) {
      logger.error('Error showing user detail:', error);
      ctx.reply('❌ Failed to load user details.');
    }
  }

  async handlePromoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
    try {
      await userService.userService.updateUser(userId, { canRegisterCompany: true });
      ctx.reply('✅ User promoted: can now register companies.');
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error('Error promoting user:', error);
      ctx.reply('❌ Failed to promote user.');
    }
  }

  async handleDemoteCompany(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
    try {
      await userService.userService.updateUser(userId, { canRegisterCompany: false });
      ctx.reply('❌ User demoted: can no longer register companies.');
      this.handleAdminUserDetail(ctx, userId);
    } catch (error) {
      logger.error('Error demoting user:', error);
      ctx.reply('❌ Failed to demote user.');
    }
  }

  async handleDemoteUserId(ctx, userId) {
    if (!this.isAdmin(ctx.from.id)) return ctx.reply("❌ Access denied.");
    await userService.userService.updateUser(userId, { canRegisterCompany: false });
    ctx.reply("❌ User unpromoted!");
    setTimeout(() => this.handlePromoteUserMenu(ctx, 1, ""), 500);
  }

  async handleAllUsersMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id))) return ctx.reply('❌ Access denied.');
    const PAGE_SIZE = 10;
    let users = await userService.getAllUsers();
    if (search) {
      users = users.filter(u =>
        (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
        (u.phone_number && u.phone_number.toLowerCase().includes(search.toLowerCase())) ||
        (u.first_name && u.first_name.toLowerCase().includes(search.toLowerCase())) ||
        (u.last_name && u.last_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageUsers = users.slice(start, end);
    let message = `👥 *All Users* (Page ${page}/${totalPages})\n\n`;
    pageUsers.forEach((u, i) => {
      message += `${start + i + 1}. ${u.first_name || u.firstName || "No name"} (@${u.username || "-"})\n`;
      message += `   📱 ${u.phone_number || u.phoneNumber || "No phone"}\n`;
      message += `   ${u.banned ? "🚫 Banned" : "✅ Active"}\n`;
    });
    const buttons = [];
    if (page > 1) buttons.push([Markup.button.callback('⬅️ Prev', `all_users_menu_${page - 1}`)]);
    if (page < totalPages) buttons.push([Markup.button.callback('➡️ Next', `all_users_menu_${page + 1}`)]);
    buttons.push([Markup.button.callback('🔍 Search User', 'all_users_search')]);
    buttons.push([Markup.button.callback('🔙 Back', 'admin_users')]);
    const userButtons = pageUsers.map(u => [Markup.button.callback(`${u.first_name || u.firstName || "No name"} (@${u.username || "-"})`, `admin_user_${u.id}`)]);
    buttons.unshift(...userButtons);
    // Remove any previous incorrect push of a single button for all users at the end.
    ctx.reply(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    ctx.session.state = null;
  }

  async handleAllUsersSearch(ctx) {
    if (!(await this.isAdminAsync(ctx.from.id))) return ctx.reply('❌ Access denied.');
    ctx.reply('🔍 Enter username, phone, or name to search:');
    ctx.session.state = 'awaiting_all_users_search';
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handleAllCompaniesMenu(ctx, page = 1, search = "") {
    if (!(await this.isAdminAsync(ctx.from.id))) return ctx.reply('❌ Access denied.');
    const PAGE_SIZE = 10;
    let companies = await companyService.getAllCompanies();
    if (search) {
      companies = companies.filter(c =>
        (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.codePrefix && c.codePrefix.toLowerCase().includes(search.toLowerCase()))
      );
    }
    const totalPages = Math.ceil(companies.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageCompanies = companies.slice(start, end);
    let message = `🏢 *All Companies* (Page ${page}/${totalPages})\n\n`;
    pageCompanies.forEach((c, i) => {
      message += `${start + i + 1}. ${c.name || "No name"} (${c.codePrefix || "-"})\n`;
      message += `   📧 ${c.email || "No email"}\n`;
      message += `   ${c.status || "unknown"}\n`;
    });
    const buttons = [];
    if (page > 1) buttons.push([Markup.button.callback('⬅️ Prev', `all_companies_menu_${page - 1}`)]);
    if (page < totalPages) buttons.push([Markup.button.callback('➡️ Next', `all_companies_menu_${page + 1}`)]);
    buttons.push([Markup.button.callback('🔍 Search Company', 'all_companies_search')]);
    buttons.push([Markup.button.callback('🔙 Back', 'admin_companies')]);
    const companyButtons = pageCompanies.map(c => [Markup.button.callback(`${c.name || "No name"} (${c.codePrefix || "-"})`, `admin_company_${c.id}`)]);
    buttons.unshift(...companyButtons);
    // Remove any previous incorrect push of a single button for all companies at the end.
    ctx.reply(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    ctx.session.state = null;
  }

  async handleAllCompaniesSearch(ctx) {
    if (!(await this.isAdminAsync(ctx.from.id))) return ctx.reply('❌ Access denied.');
    ctx.reply('🔍 Enter company name, email, or code to search:');
    ctx.session.state = 'awaiting_all_companies_search';
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handlePlatformAnalyticsDashboard(ctx) {
    try {
      const adminService = require('../services/adminService');
      const stats = await adminService.getSystemStats();
      const topCompanies = (await adminService.getTopCompanies(5)) || [];
      const topReferrers = (await adminService.getTopReferrers(5)) || [];
      let message = `📊 *Platform Analytics Dashboard*\n\n`;
      message += `👥 Users: ${stats.totalUsers}\n`;
      message += `🏢 Companies: ${stats.totalCompanies}\n`;
      message += `📦 Products: ${stats.totalProducts}\n`;
      message += `🛒 Orders: ${stats.totalOrders}\n`;
      message += `💰 Revenue: $${stats.totalRevenue.toFixed(2)}\n`;
      message += `\n🏆 *Top Companies*:\n`;
      topCompanies.forEach((c, i) => {
        message += `${i + 1}. ${c.name} ($${c.totalRevenue || 0})\n`;
      });
      message += `\n🎯 *Top Referrers*:\n`;
      topReferrers.forEach((u, i) => {
        message += `${i + 1}. ${u.firstName || 'User'}: $${u.totalEarnings.toFixed(2)}\n`;
      });
      ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error in platform analytics dashboard:', error);
      ctx.reply('❌ Failed to load platform analytics.');
    }
  }
}

console.log("Exiting handlers/adminHandlers.js");
module.exports = new AdminHandlers();
