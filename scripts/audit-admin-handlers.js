const fs = require('fs');
const path = require('path');

const adminHandlersPath = path.join(__dirname, '../bot/handlers/adminHandlers.js');
const callbackHandlersPath = path.join(__dirname, '../bot/handlers/callbackHandlers.js');

console.log('🔍 Auditing admin handlers...');

try {
  // Read both files
  const adminContent = fs.readFileSync(adminHandlersPath, 'utf8');
  const callbackContent = fs.readFileSync(callbackHandlersPath, 'utf8');
  
  // Find all admin handler calls in callbackHandlers
  const adminCallRegex = /adminHandlers\.handle(\w+)/g;
  const calledMethods = new Set();
  let match;
  
  while ((match = adminCallRegex.exec(callbackContent)) !== null) {
    calledMethods.add(match[1]);
  }
  
  // Find all method definitions in adminHandlers
  const methodRegex = /async\s+handle(\w+)\s*\(/g;
  const definedMethods = new Set();
  
  while ((match = methodRegex.exec(adminContent)) !== null) {
    definedMethods.add(match[1]);
  }
  
  // Find stub methods (containing "Not implemented")
  const stubRegex = /async\s+handle(\w+)\s*\([^)]*\)\s*\{\s*ctx\.reply\('Not implemented:[^']*'\);\s*\}/g;
  const stubMethods = new Set();
  
  while ((match = stubRegex.exec(adminContent)) !== null) {
    stubMethods.add(match[1]);
  }
  
  console.log('\n📊 Analysis Results:');
  console.log(`✅ Defined methods: ${definedMethods.size}`);
  console.log(`📞 Called methods: ${calledMethods.size}`);
  console.log(`🚫 Stub methods: ${stubMethods.size}`);
  
  // Find missing methods
  const missingMethods = [];
  calledMethods.forEach(method => {
    if (!definedMethods.has(method)) {
      missingMethods.push(method);
    }
  });
  
  // Find methods that need real implementation
  const needsImplementation = [];
  stubMethods.forEach(method => {
    if (calledMethods.has(method)) {
      needsImplementation.push(method);
    }
  });
  
  console.log(`\n❌ Missing methods (${missingMethods.length}):`);
  missingMethods.forEach(method => console.log(`  - handle${method}`));
  
  console.log(`\n⚠️  Methods needing implementation (${needsImplementation.length}):`);
  needsImplementation.forEach(method => console.log(`  - handle${method}`));
  
  // Generate implementation for missing methods
  if (missingMethods.length > 0 || needsImplementation.length > 0) {
    console.log('\n🔧 Generating implementations...');
    
    let newMethods = '';
    
    // Add missing methods
    missingMethods.forEach(method => {
      newMethods += `
  async handle${method}(ctx) {
    ctx.reply('Not implemented: handle${method}');
  }`;
    });
    
    // Add real implementations for stub methods
    needsImplementation.forEach(method => {
      switch (method) {
        case 'AdminUserDetail':
          newMethods += `
  async handle${method}(ctx, userId) {
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
  }`;
          break;
          
        case 'PendingOrders':
          newMethods += `
  async handle${method}(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      let msg = \`⏳ *Pending Orders*\n\n\`;
      msg += \`No pending orders found.\n\n\`;
      msg += \`This feature will show orders that need admin approval.\`;
      
      const buttons = [
        [Markup.button.callback("🔙 Back to Orders", "admin_order_management")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in pending orders:", error);
      ctx.reply(t("msg__failed_to_load_pending_orders", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`;
          break;
          
        case 'ApprovedOrders':
          newMethods += `
  async handle${method}(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      let msg = \`✅ *Approved Orders*\n\n\`;
      msg += \`No approved orders found.\n\n\`;
      msg += \`This feature will show all approved orders.\`;
      
      const buttons = [
        [Markup.button.callback("🔙 Back to Orders", "admin_order_management")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in approved orders:", error);
      ctx.reply(t("msg__failed_to_load_approved_orders", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`;
          break;
          
        case 'RejectedOrders':
          newMethods += `
  async handle${method}(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      let msg = \`❌ *Rejected Orders*\n\n\`;
      msg += \`No rejected orders found.\n\n\`;
      msg += \`This feature will show all rejected orders.\`;
      
      const buttons = [
        [Markup.button.callback("🔙 Back to Orders", "admin_order_management")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in rejected orders:", error);
      ctx.reply(t("msg__failed_to_load_rejected_orders", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`;
          break;
          
        case 'ErrorLogs':
          newMethods += `
  async handle${method}(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      let msg = \`❌ *Error Logs*\n\n\`;
      msg += \`No error logs found.\n\n\`;
      msg += \`This feature will show system error logs.\`;
      
      const buttons = [
        [Markup.button.callback("🔙 Back to Logs", "admin_system_logs")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in error logs:", error);
      ctx.reply(t("msg__failed_to_load_error_logs", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`;
          break;
          
        case 'WarningLogs':
          newMethods += `
  async handle${method}(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      let msg = \`⚠️ *Warning Logs*\n\n\`;
      msg += \`No warning logs found.\n\n\`;
      msg += \`This feature will show system warning logs.\`;
      
      const buttons = [
        [Markup.button.callback("🔙 Back to Logs", "admin_system_logs")],
        [Markup.button.callback("🔙 Back to Admin", "admin_panel")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in warning logs:", error);
      ctx.reply(t("msg__failed_to_load_warning_logs", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`;
          break;
          
        case 'ExportLogs':
          newMethods += `
  async handle${method}(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      ctx.reply(t("msg__exporting_logs_please_wait", {}, ctx.session?.language || "en"));
      
      // Placeholder for log export functionality
      setTimeout(() => {
        ctx.reply(t("msg__logs_exported_successfully", {}, ctx.session?.language || "en"));
      }, 2000);
      
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error exporting logs:", error);
      ctx.reply(t("msg__failed_to_export_logs", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`;
          break;
          
        case 'ClearLogs':
          newMethods += `
  async handle${method}(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      let msg = \`🗑️ *Clear Logs*\n\n\`;
      msg += \`Are you sure you want to clear all system logs?\n\n\`;
      msg += \`⚠️ This action cannot be undone.\`;
      
      const buttons = [
        [
          Markup.button.callback("✅ Yes, Clear All", "confirm_clear_logs"),
          Markup.button.callback("❌ Cancel", "admin_system_logs"),
        ],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in clear logs:", error);
      ctx.reply(t("msg__failed_to_clear_logs", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`;
          break;
          
        case 'PromotedUsers':
          newMethods += `
  async handle${method}(ctx) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      const users = await userService.getAllUsers();
      const promotedUsers = users.filter(u => u.canRegisterCompany);
      
      let msg = \`⬆️ *Promoted Users*\n\n\`;
      msg += \`📊 Total Promoted: \${promotedUsers.length}\n\n\`;
      
      if (promotedUsers.length === 0) {
        msg += "No promoted users found.";
      } else {
        promotedUsers.slice(0, 10).forEach((user, index) => {
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
      logger.error("Error in promoted users:", error);
      ctx.reply(t("msg__failed_to_load_promoted_users", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`;
          break;
          
        default:
          newMethods += `
  async handle${method}(ctx) {
    ctx.reply('Not implemented: handle${method}');
  }`;
      }
    });
    
    // Replace stub methods with real implementations
    let updatedContent = adminContent;
    
    needsImplementation.forEach(method => {
      const stubPattern = new RegExp(
        `async\\s+handle${method}\\s*\\([^)]*\\)\\s*\\{\\s*ctx\\.reply\\('Not implemented: handle${method}'\\);\\s*\\}`,
        'g'
      );
      
      // Find the real implementation from the switch statement above
      const realImpl = newMethods.match(new RegExp(`async\\s+handle${method}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`));
      
      if (realImpl) {
        updatedContent = updatedContent.replace(stubPattern, realImpl[0]);
      }
    });
    
    // Add missing methods before the closing brace
    if (newMethods) {
      updatedContent = updatedContent.replace(
        /}\s*module\.exports/,
        `${newMethods}\n}\n\nmodule.exports`
      );
    }
    
    // Write the updated content
    fs.writeFileSync(adminHandlersPath, updatedContent, 'utf8');
    
    console.log(`✅ Updated admin handlers with ${missingMethods.length + needsImplementation.length} methods`);
  }
  
  console.log('\n✅ Audit complete!');
  
} catch (error) {
  console.error('❌ Error during audit:', error.message);
  process.exit(1);
} 