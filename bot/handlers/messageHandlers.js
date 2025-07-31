console.log("Entering handlers/messageHandlers.js");
const userService = require("../services/userService");
const companyService = require("../services/companyService");
const adminService = require("../services/adminService");
const logger = require("../../utils/logger");
const referralService = require("../services/referralService");
const { getPlatformSettings } = require("../utils/helpers");
const { t } = require("../../utils/localize");

const adminHandlers = require("./adminHandlers");
const userHandlers = require("./userHandlers");
const companyHandlers = require("./companyHandlers");

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

class MessageHandlers {
  async handleTextMessage(ctx) {
    console.log(
      "[DEBUG] handleTextMessage called:",
      ctx.message.text,
      JSON.stringify(ctx.session)
    );
    if (ctx.message && ctx.message.text && ctx.message.text.startsWith("/")) {
      return;
    }
    try {
      const messageText = ctx.message.text;
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (blockIfBanned(ctx, user)) return;

      if (ctx.session && ctx.session.adminAddCompanyStep) {
        return adminHandlers.handleAdminAddCompanyStep(ctx);
      }
      if (ctx.session && ctx.session.adminRemoveCompanyStep) {
        return adminHandlers.handleAdminRemoveCompanyStep(ctx);
      }
      if (ctx.session && ctx.session.broadcastStep === "awaiting_content") {
        return adminHandlers.handleBroadcastContent(ctx);
      }
      if (
        ctx.session &&
        (ctx.session.companyRegistrationStep ||
          ctx.session.awaitingCompanyAgreement)
      ) {
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
      if (ctx.session && ctx.session.editSetting) {
        return adminHandlers.handleUpdateSetting(ctx, messageText);
      }

      // Platform withdrawal handlers
      if (ctx.session && ctx.session.platformWithdrawalStep === "amount") {
        return adminHandlers.handlePlatformWithdrawalAmount(ctx);
      }
      if (ctx.session && ctx.session.platformWithdrawalStep === "reason") {
        return adminHandlers.handlePlatformWithdrawalReason(ctx);
      }
      if (ctx.session && ctx.session.denyWithdrawalStep === "reason") {
        return adminHandlers.handleDenyPlatformWithdrawalReason(ctx);
      }

      // Company withdrawal handlers
      if (ctx.session && ctx.session.companyWithdrawalStep === "amount") {
        return adminHandlers.handleCompanyWithdrawalAmount(ctx);
      }
      if (ctx.session && ctx.session.companyWithdrawalStep === "reason") {
        return adminHandlers.handleCompanyWithdrawalReason(ctx);
      }
      if (ctx.session && ctx.session.denyWithdrawalStep === "reason") {
        // Check if it's a company withdrawal denial
        if (ctx.session.denyWithdrawalId) {
          return companyHandlers.handleCompanyDenyWithdrawalReason(ctx);
        } else {
          return adminHandlers.handleDenyPlatformWithdrawalReason(ctx);
        }
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

      ctx.reply(t("msg__unknown_command", {}, ctx.session?.language || "en"));
    } catch (error) {
      logger.error("Error in handleTextMessage:", error);
      ctx.reply(
        t(
          "msg__something_went_wrong_please_try_again",
          {},
          ctx.session?.language || "en"
        )
      );
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
          return adminHandlers.handleAdminListCompanies(ctx, 1, messageText);
        case "awaiting_platform_fee":
        case "awaiting_referral_bonus":
        case "awaiting_buyer_bonus":
          return adminHandlers.handleUpdateSetting(ctx, messageText);
        case "awaiting_fee_calculator_amount": {
          const amount = parseFloat(messageText);
          if (isNaN(amount) || amount <= 0) {
            return ctx.reply(
              t(
                "msg__please_enter_a_valid_amount",
                {},
                ctx.session?.language || "en"
              )
            );
          }
          // Fetch dynamic settings
          const settings = await getPlatformSettings();
          const PLATFORM_FEE_PERCENT = settings.platformFeePercent;
          const REFERRAL_BONUS_PERCENT = settings.referralBonusPercent;
          const BUYER_BONUS_PERCENT = settings.buyerBonusPercent;
          const discount = amount * (BUYER_BONUS_PERCENT / 100);
          const referrerReward = amount * (REFERRAL_BONUS_PERCENT / 100);
          const platformFee = amount * (PLATFORM_FEE_PERCENT / 100);
          const companyPayout =
            amount - discount - referrerReward - platformFee;
          const message = `
💰 *Fee & Reward Calculation*

Purchase Amount: $${amount.toFixed(2)}
- Buyer Discount (${BUYER_BONUS_PERCENT}%): $${discount.toFixed(2)}
- Referrer Reward (${REFERRAL_BONUS_PERCENT}%): $${referrerReward.toFixed(2)}
- Platform Fee (${PLATFORM_FEE_PERCENT}%): $${platformFee.toFixed(2)}
= Company Payout: $${companyPayout.toFixed(2)}
`;
          ctx.session.state = null;
          return ctx.reply(message, { parse_mode: "Markdown" });
        }
        default:
          ctx.session.state = null;
          ctx.reply(
            t(
              "msg__session_expired_please_start_over",
              {},
              ctx.session?.language || "en"
            )
          );
      }
    } catch (error) {
      logger.error("Error in handleSessionState:", error);
      ctx.reply(
        t(
          "msg__something_went_wrong_please_try_again",
          {},
          ctx.session?.language || "en"
        )
      );
    }
  }

  async handleCompanyName(ctx, companyName) {
    if (companyName.length < 2 || companyName.length > 100) {
      return ctx.reply(
        t(
          "msg__company_name_must_be_between_2_and_100_charac",
          {},
          ctx.session?.language || "en"
        )
      );
    }
    ctx.session.companyData = { name: companyName };
    ctx.session.state = "awaiting_company_description";
    ctx.reply(
      t(
        "msg__company_name_savednnnow_please_provide_a_brie",
        {},
        ctx.session?.language || "en"
      )
    );
  }

  async handleCompanyDescription(ctx, description) {
    if (description.length < 10 || description.length > 500) {
      return ctx.reply(
        t(
          "msg__description_must_be_between_10_and_500_charac",
          {},
          ctx.session?.language || "en"
        )
      );
    }
    ctx.session.companyData.description = description;
    ctx.session.state = "awaiting_company_website";
    ctx.reply(
      t(
        "msg__description_savednnplease_provide_your_compan",
        {},
        ctx.session?.language || "en"
      )
    );
  }

  async handleCompanyWebsite(ctx, website) {
    const urlRegex = /^https?:\/\/.+\..+/;
    if (!urlRegex.test(website)) {
      return ctx.reply(
        t(
          "msg__please_provide_a_valid_website_url_starting_w",
          {},
          ctx.session?.language || "en"
        )
      );
    }
    ctx.session.companyData.website = website;
    ctx.session.state = "awaiting_company_email";
    ctx.reply(
      t(
        "msg__website_savednnfinally_please_provide_your_bu",
        {},
        ctx.session?.language || "en"
      )
    );
  }

  async handleCompanyEmail(ctx, email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ctx.reply(
        t(
          "msg__please_provide_a_valid_email_address",
          {},
          ctx.session?.language || "en"
        )
      );
    }
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (blockIfBanned(ctx, user)) return;

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
      ctx.reply(
        t(
          "msg__failed_to_submit_registration_please_try_agai",
          {},
          ctx.session?.language || "en"
        )
      );
    }
  }

  async handleWithdrawalDetails(ctx, details) {
    try {
      ctx.session.withdrawalDetails = details;
      ctx.session.state = "awaiting_withdrawal_amount";
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (blockIfBanned(ctx, user)) return;
      const balance = user.coinBalance || 0;
      ctx.reply(
        t(
          "msg__payment_details_savednnhow_much_would_you_lik",
          {},
          ctx.session?.language || "en"
        )
      );
    } catch (error) {
      logger.error("Error in handleWithdrawalDetails:", error);
      ctx.reply(
        t(
          "msg__failed_to_save_withdrawal_details_please_try_",
          {},
          ctx.session?.language || "en"
        )
      );
    }
  }

  async handleWithdrawalAmount(ctx, amountText) {
    try {
      const amount = parseFloat(amountText);
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply(
          t(
            "msg__please_enter_a_valid_amount",
            {},
            ctx.session?.language || "en"
          )
        );
      }
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (blockIfBanned(ctx, user)) return;
      const withdrawalId = await userService.requestWithdrawal(
        ctx.from.id,
        ctx.session.withdrawalCompanyId, // companyId
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
    } catch (error) {
      logger.error("Error in handleWithdrawalAmount:", error);
      ctx.reply(t("msg__errormessage", {}, ctx.session?.language || "en"));
    }
  }

  async handleReferralCodeUsage(ctx, referralCode) {
    try {
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      if (!user) {
        return ctx.reply(
          t(
            "msg__you_are_not_registered_in_the_system",
            {},
            ctx.session?.language || "en"
          )
        );
      }
      if (blockIfBanned(ctx, user)) return;

      const referral = await referralService.referralService.getReferralByCode(
        referralCode
      );
      if (!referral) {
        return ctx.reply(
          t("msg__invalid_referral_code", {}, ctx.session?.language || "en")
        );
      }

      if (referral.usedByTelegramId) {
        return ctx.reply(
          t(
            "msg__this_referral_code_has_already_been_used",
            {},
            ctx.session?.language || "en"
          )
        );
      }

      if (referral.userId === user.id) {
        return ctx.reply(
          t(
            "msg__you_cannot_use_your_own_referral_code",
            {},
            ctx.session?.language || "en"
          )
        );
      }

      await userService.userService.addCoinBalance(user.id, 10); // Example reward
      await referralService.referralService.markReferralAsUsed(
        referralCode,
        ctx.from.id
      );

      const successMessage = `
🎉 *Referral Code Used!*
✅ You received 10 coins for using the referral code: ${referralCode}.
📈 Your total coin balance is now: ${user.coinBalance} coins.
⏳ You can use this referral code to invite more users!
      `;
      ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error("Error in handleReferralCodeUsage:", error);
      ctx.reply(
        t(
          "msg__something_went_wrong_please_try_again",
          {},
          ctx.session?.language || "en"
        )
      );
    }
  }

  async handlePhotoMessage(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (blockIfBanned(ctx, user)) return;

      // Handle broadcast content
      if (ctx.session && ctx.session.broadcastStep === "awaiting_content") {
        return adminHandlers.handleBroadcastContent(ctx);
      }

      // Default response for photo messages
      ctx.reply(t("msg__photo_received", {}, ctx.session?.language || "en"));
    } catch (error) {
      logger.error("Error in handlePhotoMessage:", error);
      ctx.reply(
        t(
          "msg__something_went_wrong_please_try_again",
          {},
          ctx.session?.language || "en"
        )
      );
    }
  }

  async handleVideoMessage(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (blockIfBanned(ctx, user)) return;

      // Handle broadcast content
      if (ctx.session && ctx.session.broadcastStep === "awaiting_content") {
        return adminHandlers.handleBroadcastContent(ctx);
      }

      // Default response for video messages
      ctx.reply(t("msg__video_received", {}, ctx.session?.language || "en"));
    } catch (error) {
      logger.error("Error in handleVideoMessage:", error);
      ctx.reply(
        t(
          "msg__something_went_wrong_please_try_again",
          {},
          ctx.session?.language || "en"
        )
      );
    }
  }

  async handleDocumentMessage(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (blockIfBanned(ctx, user)) return;

      // Handle broadcast content
      if (ctx.session && ctx.session.broadcastStep === "awaiting_content") {
        return adminHandlers.handleBroadcastContent(ctx);
      }

      // Default response for document messages
      ctx.reply(t("msg__document_received", {}, ctx.session?.language || "en"));
    } catch (error) {
      logger.error("Error in handleDocumentMessage:", error);
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

module.exports = MessageHandlers;
