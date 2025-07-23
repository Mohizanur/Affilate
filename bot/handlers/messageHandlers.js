console.log("Entering handlers/messageHandlers.js");
const userService = require("../services/userService");
const companyService = require("../services/companyService");
const orderService = require("../services/orderService");
const adminService = require("../services/adminService");
const logger = require("../../utils/logger");
const referralService = require("../services/referralService");

const adminHandlers = require("./adminHandlers");
const userHandlers = require("./userHandlers");

class MessageHandlers {
  async handleTextMessage(ctx) {
    if (ctx.message && ctx.message.text && ctx.message.text.startsWith("/")) {
      return;
    }

    console.log("handleTextMessage called", {
      user: ctx.from.id,
      session: ctx.session,
      messageType:
        ctx.message && ctx.message.text
          ? "text"
          : Object.keys(ctx.message || {}),
    });
    try {
      const telegramId = ctx.from.id;
      const messageText = ctx.message.text;

      if (ctx.session && ctx.session.adminAddCompanyStep) {
        return adminHandlers.handleAdminAddCompanyStep(ctx);
      }
      if (ctx.session && ctx.session.adminRemoveCompanyStep) {
        return adminHandlers.handleAdminRemoveCompanyStep(ctx);
      }
      if (ctx.session && ctx.session.waitingForBroadcast) {
        return adminHandlers.handleBroadcastMessage(ctx, messageText);
      }
      if (ctx.session && ctx.session.companyRegistrationStep) {
        return userHandlers.handleCompanyRegistrationStep(ctx);
      }
      if (ctx.session && ctx.session.editProfileStep) {
        return userHandlers.handleEditProfileStep(ctx);
      }
      // Prioritize sellStep, editProductStep, and editCompanyStep over addProductStep
      if (ctx.session && ctx.session.sellStep) {
        return userHandlers.handleSellProductStep(ctx);
      }
      if (ctx.session && ctx.session.editProductStep) {
        return userHandlers.handleEditProductFieldInput(ctx);
      }
      if (ctx.session && ctx.session.editCompanyStep) {
        return userHandlers.handleEditCompanyFieldInput(ctx);
      }
      if (ctx.session && ctx.session.addProductStep) {
        return userHandlers.handleAddProductStep(ctx);
      }
      if (ctx.session && ctx.session.state) {
        return this.handleSessionState(ctx, messageText);
      }

      if (messageText && messageText.match(/^[A-Z0-9]{8}$/)) {
        return this.handleReferralCodeUsage(ctx, messageText);
      }

      if (messageText === "/my_referral_codes") {
        return userHandlers.handleMyReferralCodes(ctx);
      }

      console.error(
        `Invalid selection: user=${telegramId}, session=${JSON.stringify(
          ctx.session
        )}, text='${messageText}'`
      );
      ctx.reply(
        "❓ I didn't understand that. Use /start to see available options."
      );
    } catch (error) {
      logger.error("Error in handleTextMessage:", error);
      ctx.reply("❌ Something went wrong. Please try again.");
    }
  }

  async handleSessionState(ctx, messageText) {
    const state = ctx.session.state;
    try {
      switch (state) {
        case "awaiting_company_name":
          return this.handleCompanyName(ctx, messageText);
        case "awaiting_company_description":
          return this.handleCompanyDescription(ctx, messageText);
        case "awaiting_company_website":
          return this.handleCompanyWebsite(ctx, messageText);
        case "awaiting_company_email":
          return this.handleCompanyEmail(ctx, messageText);
        case "awaiting_withdrawal_details":
          return this.handleWithdrawalDetails(ctx, messageText);
        case "awaiting_withdrawal_amount":
          return this.handleWithdrawalAmount(ctx, messageText);
        case "awaiting_order_details":
          return this.handleOrderDetails(ctx, messageText);
        case "awaitingBroadcast":
          return adminHandlers.handleBroadcastMessage(ctx, messageText);
        case "awaiting_user_search":
          return adminHandlers.handleSearchUserInput(ctx, messageText);
        case "awaiting_company_search":
          return adminHandlers.handleSearchCompanyInput(ctx, messageText);
        case "awaiting_promote_user_search":
          return adminHandlers.handlePromoteUserSearchInput(ctx, messageText);
        case "awaiting_all_users_search":
          ctx.session.state = null;
          return adminHandlers.handleAllUsersMenu(ctx, 1, messageText);
        case "awaiting_all_companies_search":
          ctx.session.state = null;
          return adminHandlers.handleAllCompaniesMenu(ctx, 1, messageText);
        case "awaiting_fee_calculator_amount": {
          const amount = parseFloat(messageText);
          if (isNaN(amount) || amount <= 0) {
            return ctx.reply("❌ Please enter a valid amount.");
          }
          const discount = amount * 0.01;
          const referrerReward = amount * 0.025;
          const platformFee = amount * 0.015;
          const companyPayout =
            amount - discount - referrerReward - platformFee;
          const message = `
💰 *Fee & Reward Calculation*

Purchase Amount: $${amount.toFixed(2)}
- Buyer Discount (1%): $${discount.toFixed(2)}
- Referrer Reward (2.5%): $${referrerReward.toFixed(2)}
- Platform Fee (1.5%): $${platformFee.toFixed(2)}
= Company Payout: $${companyPayout.toFixed(2)}
`;
          ctx.session.state = null;
          return ctx.reply(message, { parse_mode: "Markdown" });
        }
        default:
          ctx.session.state = null;
          ctx.reply("❌ Session expired. Please start over.");
      }
    } catch (error) {
      logger.error("Error in handleSessionState:", error);
      ctx.reply("❌ Something went wrong. Please try again.");
    }
  }

  async handleCompanyName(ctx, companyName) {
    if (companyName.length < 2 || companyName.length > 100) {
      return ctx.reply(
        "❌ Company name must be between 2 and 100 characters. Please try again:"
      );
    }
    ctx.session.companyData = { name: companyName };
    ctx.session.state = "awaiting_company_description";
    ctx.reply(
      "✅ Company name saved!\\n\\nNow please provide a brief description of your business:"
    );
  }

  async handleCompanyDescription(ctx, description) {
    if (description.length < 10 || description.length > 500) {
      return ctx.reply(
        "❌ Description must be between 10 and 500 characters. Please try again:"
      );
    }
    ctx.session.companyData.description = description;
    ctx.session.state = "awaiting_company_website";
    ctx.reply(
      "✅ Description saved!\\n\\nPlease provide your company website URL:"
    );
  }

  async handleCompanyWebsite(ctx, website) {
    const urlRegex = /^https?:\/\/.+\..+/;
    if (!urlRegex.test(website)) {
      return ctx.reply(
        "❌ Please provide a valid website URL (starting with http:// or https://):"
      );
    }
    ctx.session.companyData.website = website;
    ctx.session.state = "awaiting_company_email";
    ctx.reply(
      "✅ Website saved!\\n\\nFinally, please provide your business contact email:"
    );
  }

  async handleCompanyEmail(ctx, email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ctx.reply("❌ Please provide a valid email address:");
    }
    try {
      const telegramId = ctx.from.id;
      const companyData = {
        ...ctx.session.companyData,
        email,
        telegramId,
        ownerName: ctx.from.first_name,
        ownerUsername: ctx.from.username,
      };
      await companyService.registerCompany(companyData);
      ctx.session.state = null;
      ctx.session.companyData = null;
      const successMessage = `
🎉 *Company Registration Submitted!*
✅ Your company registration has been submitted for review.
📋 *Submitted Details:*
• Company: ${companyData.name}
• Website: ${companyData.website}
• Email: ${companyData.email}
⏳ *Next Steps:*
1. Our team will review your application
2. You'll be notified once approved
3. Then you can start receiving referrals!
📞 *Contact Support:* @support if you have questions.
      `;
      ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error("Error in handleCompanyEmail:", error);
      ctx.reply("❌ Failed to submit registration. Please try again later.");
    }
  }

  async handleWithdrawalDetails(ctx, details) {
    try {
      ctx.session.withdrawalDetails = details;
      ctx.session.state = "awaiting_withdrawal_amount";
      const user = await userService.getUserByTelegramId(ctx.from.id);
      const balance = user.coinBalance || 0;
      ctx.reply(
        `✅ Payment details saved!\\n\\nHow much would you like to withdraw?\\n\\nAvailable balance: $${balance.toFixed(
          2
        )}\\nMinimum withdrawal: $${
          process.env.MIN_WITHDRAWAL_AMOUNT
        }\\n\\nPlease enter the amount:`
      );
    } catch (error) {
      logger.error("Error in handleWithdrawalDetails:", error);
      ctx.reply("❌ Failed to save withdrawal details. Please try again.");
    }
  }

  async handleWithdrawalAmount(ctx, amountText) {
    try {
      const amount = parseFloat(amountText);
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Please enter a valid amount:");
      }
      const withdrawalId = await userService.requestWithdrawal(
        ctx.from.id,
        amount,
        ctx.session.withdrawalMethod,
        ctx.session.withdrawalDetails
      );
      ctx.session.state = null;
      ctx.session.withdrawalMethod = null;
      ctx.session.withdrawalDetails = null;
      const successMessage = `
✅ *Withdrawal Request Submitted!*
💸 Amount: $${amount.toFixed(2)}
💳 Method: ${ctx.session.withdrawalMethod.toUpperCase()}
🆔 Request ID: ${withdrawalId}
⏳ Your withdrawal will be processed within 1-3 business days.
📧 You'll receive a confirmation once processed.
Use /start to return to the main menu.
      `;
      ctx.reply(successMessage, { parse_mode: "Markdown" });
      // Notify admins with full details
      const adminIds = process.env.ADMIN_IDS
        ? process.env.ADMIN_IDS.split(",")
        : [];
      const user = await userService.getUserByTelegramId(ctx.from.id);
      const adminMsg = `🚨 *Withdrawal Request*
User: ${user.firstName} ${user.lastName || ""} (@${user.username || "N/A"})
User ID: ${user.telegramId}
Amount: $${amount.toFixed(2)}
Method: ${ctx.session.withdrawalMethod}
Details: ${JSON.stringify(ctx.session.withdrawalDetails)}
Request ID: ${withdrawalId}
`;
      for (const adminId of adminIds) {
        ctx.telegram.sendMessage(adminId, adminMsg, { parse_mode: "Markdown" });
      }
    } catch (error) {
      logger.error("Error in handleWithdrawalAmount:", error);
      ctx.reply(`❌ ${error.message}`);
    }
  }

  async handleOrderDetails(ctx, orderDetails) {
    try {
      const lines = orderDetails.split("\\n");
      if (lines.length < 4) {
        return ctx.reply(
          "❌ Please provide all required details:\\n\\nOrder Code:\\nCustomer Name:\\nCustomer Email:\\nAmount:\\nReferral Code:"
        );
      }
      const orderData = {
        orderCode: lines[0].replace("Order Code:", "").trim(),
        customerName: lines[1].replace("Customer Name:", "").trim(),
        customerEmail: lines[2].replace("Customer Email:", "").trim(),
        amount: parseFloat(lines[3].replace("Amount:", "").trim()),
        referralCode: lines[4].replace("Referral Code:", "").trim(),
      };
      const orderId = await orderService.submitOrder(ctx.from.id, orderData);
      ctx.session.state = null;
      const successMessage = `
✅ *Order Submitted Successfully!*
📦 Order ID: ${orderId}
🎯 Order Code: ${orderData.orderCode}
💰 Amount: $${orderData.amount.toFixed(2)}
⏳ The order is now pending approval.
💰 Commission will be credited once approved.
Use /company_dashboard to manage orders.
      `;
      ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error("Error in handleOrderDetails:", error);
      ctx.reply(`❌ ${error.message}`);
    }
  }

  async handleReferralCodeUsage(ctx, referralCode) {
    try {
      const codeInfo = await referralService.validateReferralCode(referralCode);
      if (!codeInfo) {
        return ctx.reply("❌ Invalid or expired referral code.");
      }
      const company = await companyService.getCompanyById(codeInfo.companyId);
      const codeMessage = `
🎁 *Valid Referral Code!*
🏢 Company: ${company.name}
💰 Your Discount: ${process.env.BUYER_DISCOUNT_PERCENTAGE}%
🌐 Website: ${company.website}
📋 *How to use:*
1. Visit the company website
2. Make your purchase
3. Use code: \`${referralCode}\` at checkout
4. Enjoy your discount!
⚠️ *Important:* Make sure to use this exact code during checkout to get your discount.
      `;
      ctx.reply(codeMessage, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error("Error in handleReferralCodeUsage:", error);
      ctx.reply("❌ Failed to validate referral code. Please try again.");
    }
  }

  async handleContact(ctx) {
    try {
      let phoneNumber = ctx.message.contact.phone_number;
      phoneNumber = phoneNumber.trim().replace(/(?!^\+)\D/g, "");
      if (!phoneNumber.startsWith("+") && /^\d{10,}$/.test(phoneNumber)) {
        phoneNumber = "+" + phoneNumber;
      }
      if (phoneNumber.startsWith("+")) {
        await userService.userService.verifyPhone(ctx.from.id, phoneNumber);
      } else {
        return ctx.reply(
          "❌ Please resend your phone number in international format, starting with + and country code (e.g., +251911234567)."
        );
      }
      const successMessage = `
✅ *Phone Number Verified!*
📱 Your phone number has been successfully verified.
🎉 *You can now:*
• Generate referral codes
• Withdraw your earnings
• Access all premium features
Use /start to return to the main menu.
      `;
      ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error("Error in handleContact:", error);
      ctx.reply("❌ Failed to verify phone number. Please try again.");
    }
  }
}

const messageHandlers = new MessageHandlers();

function setupHandlers(bot) {
  bot.on("text", (ctx) => messageHandlers.handleTextMessage(ctx));
  bot.on("contact", (ctx) => messageHandlers.handleContact(ctx));
  bot.on(
    ["photo", "document", "sticker", "video", "audio", "voice", "video_note"],
    async (ctx) => {
      if (ctx.session && ctx.session.waitingForBroadcast) {
        return adminHandlers.handleBroadcastMedia(ctx);
      }
      ctx.reply(
        "❓ I didn't understand that. Use /start to see available options."
      );
    }
  );
}

console.log("Exiting handlers/messageHandlers.js");
module.exports = { setupHandlers };
