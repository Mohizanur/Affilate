console.log("Entering handlers/userHandlers.js");
const { Markup } = require("telegraf");
console.log("Loaded telegraf in userHandlers");
const userService = require("../services/userService");
console.log("Loaded services/userService in userHandlers");
const productService = require("../services/productService");
console.log("Loaded services/productService in userHandlers");
const orderService = require("../services/orderService");
console.log("Loaded services/orderService in userHandlers");
const referralService = require("../services/referralService");
console.log("Loaded services/referralService in userHandlers");
const logger = require("../../utils/logger");
console.log("Loaded utils/logger in userHandlers");
const databaseService = require("../config/database");
console.log("Loaded services/databaseService in userHandlers");
const {
  getNotificationServiceInstance,
} = require("../services/notificationService");
const { t } = require("../../utils/localize");

const rateLimitMap = {};
function isRateLimited(userId, action) {
  const now = Date.now();
  if (!rateLimitMap[userId]) rateLimitMap[userId] = {};
  if (!rateLimitMap[userId][action]) rateLimitMap[userId][action] = [];
  // Remove timestamps older than 1 minute
  rateLimitMap[userId][action] = rateLimitMap[userId][action].filter(
    (ts) => now - ts < 60000
  );
  if (rateLimitMap[userId][action].length >= 3) return true;
  rateLimitMap[userId][action].push(now);
  return false;
}

function toDateSafe(x) {
  if (!x) return null;
  if (typeof x.toDate === "function") return x.toDate();
  if (typeof x === "string" || typeof x === "number") return new Date(x);
  return x instanceof Date ? x : null;
}

class UserHandlers {
  async handleStart(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const userData = {
        telegramId,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
      };

      // Check for referral code in start payload
      const referralCode = ctx.startPayload;
      if (referralCode) {
        try {
          const codeData = await referralService.validateReferralCode(
            referralCode
          );
          if (codeData) {
            userData.referralCode = referralCode;
            userData.referredBy = codeData.referrerTelegramId;
            console.log(
              `[DEBUG] handleStart: User ${telegramId} referred by ${codeData.referrerTelegramId} with code ${referralCode}`
            );
            logger.info(
              `[DEBUG] handleStart: User ${telegramId} referred by ${codeData.referrerTelegramId} with code ${referralCode}`
            );
          } else {
            console.warn(
              `[DEBUG] handleStart: Invalid referral code in start payload: ${referralCode}`
            );
            logger.warn(
              `[DEBUG] handleStart: Invalid referral code in start payload: ${referralCode}`
            );
          }
        } catch (error) {
          console.error(
            `[DEBUG] handleStart: Error validating referral code ${referralCode}:`,
            error
          );
          logger.error(
            `[DEBUG] handleStart: Error validating referral code ${referralCode}:`,
            error
          );
        }
      }

      // Create or update user in Firestore
      const user = await userService.userService.createOrUpdateUser(userData);
      console.log("[DEBUG] handleStart user:", user);
      logger.info(`[DEBUG] handleStart user: ${JSON.stringify(user)}`);

      // After fetching user, map phone_verified to phoneVerified for compatibility
      if (user.phone_verified && typeof user.phoneVerified === "undefined") {
        user.phoneVerified = user.phone_verified;
      }

      const isVerified = user.phoneVerified;
      const isAdmin = user.role === "admin" || user.isAdmin === true;
      const isCompany = user.isCompanyOwner === true || user.companyId;
      const welcomeMessage = `
🎉 Welcome to ReferralBot!

1. Buy from any company and get a referral code
2. Share your code (single-use, per company)
3. When someone uses your code and buys, you get 2% reward, they get 1% discount
4. Company must approve the purchase for rewards to be paid
5. All rewards, discounts, and balances are automatic and visible in your profile
6. Platform takes 5% fee, companies pay monthly
7. Use /help for full details

Let's get started! 👇
      `;

      let buttons = [];
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback("🏢 Register Company", "register_company"),
        ]);
        buttons.push([
          Markup.button.callback("🏢 My Companies", "my_companies"),
        ]);
        buttons.push([Markup.button.callback("📦 My Products", "my_products")]);
      } else if (user.companyId || user.isCompanyOwner) {
        buttons.push([
          Markup.button.callback("🏢 My Companies", "my_companies"),
        ]);
        buttons.push([Markup.button.callback("📦 My Products", "my_products")]);
      }
      // Always show My Referral Codes
      buttons.push([
        Markup.button.callback("🎯 My Referral Codes", "my_referral_codes"),
      ]);
      // 2-column layout for main menu
      const mainRow1 = [
        Markup.button.callback("🛍️ Browse Products", "browse_products"),
        Markup.button.callback("🔗 My Referrals", "my_referrals"),
      ];
      // Only show Balance & Withdraw if user has balance > 0
      const mainRow2 =
        user.coinBalance > 0
          ? [
              Markup.button.callback(
                "💰 Balance & Withdraw",
                "balance_withdraw"
              ),
              Markup.button.callback("🏆 Leaderboard", "leaderboard"),
            ]
          : [Markup.button.callback("🏆 Leaderboard", "leaderboard")];
      const mainRow3 = [
        Markup.button.callback("⭐ Favorites", "view_favorites"),
        Markup.button.callback("🛒 Cart", "view_cart"),
      ];
      const mainRow4 = [
        Markup.button.callback("👤 Profile", "user_profile"),
        Markup.button.callback("ℹ️ Help", "help"),
      ];
      buttons.push(mainRow1, mainRow2, mainRow3, mainRow4);
      if (isAdmin) {
        buttons.push([Markup.button.callback("🔧 Admin Panel", "admin_panel")]);
      }
      if (!isVerified) {
        buttons.push([
          Markup.button.callback("📱 Verify Phone", "verify_phone"),
        ]);
      }
      ctx.reply(welcomeMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in start handler:", error);
      ctx.reply(
        "❌ Something went wrong. Please try again later or contact @Nife777online if the problem persists."
      );
    }
  }

  async handleBrowseProducts(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const products = await productService.getAllActiveProductsWithCompany();
      logger.info(`[BrowseProducts] Found ${products.length} active products.`);

      if (products.length === 0) {
        ctx.reply("📦 No products available at the moment. Check back later!");
        if (ctx.callbackQuery) return ctx.answerCbQuery();
        return;
      }

      let message = "🛍️ *Available Products*\n\n";
      const buttons = [];

      products.slice(0, 10).forEach((product, index) => {
        message += `${index + 1}. **${product.title}**\n`;
        message += `   💰 $${Number(product.price) || 0} | 🏢 ${
          product.companyName || "Unknown"
        }\n`;
        message += `   📝 ${(product.description || "").substring(
          0,
          50
        )}...\n\n`;

        buttons.push([
          Markup.button.callback(
            `🛒 View ${product.title}`,
            `view_product_${product.id}`
          ),
        ]);
      });

      buttons.push([Markup.button.callback("🔙 Back to Menu", "main_menu")]);

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error browsing products:", error);
      ctx.reply("❌ Failed to load products. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleViewProduct(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      const product = await productService.getProductById(productId);

      if (!product) {
        ctx.reply("❌ Product not found.");
        if (ctx.callbackQuery) return ctx.answerCbQuery();
      }

      // Use the companyStatus from the joined product data
      if (product.companyStatus !== "active") {
        ctx.reply(
          "⏳ This company is not active. You cannot interact with its products."
        );
        if (ctx.callbackQuery) return ctx.answerCbQuery();
      }

      const productMessage = `
 *${product.title}* ${product.statusBadge || ""}

📝 Description: ${product.description}
💰 Price: $${Number(product.price) || 0}
🏢 Company: ${product.companyName || "Unknown"}
🏷️ Category: ${product.category}
📦 Quantity: ${
        typeof product.quantity !== "undefined" ? product.quantity : "N/A"
      }

To purchase this item, please contact the company owner directly. You can provide them with a referral code if you have one.
      `;

      const buttons = [
        [
          Markup.button.callback(
            "⭐ Favorite",
            `favorite_product_${productId}`
          ),
          Markup.button.callback("🛒 Add to Cart", `add_to_cart_${productId}`),
        ],
        [Markup.button.callback("🔙 Back to Products", "browse_products")],
      ];

      ctx.reply(productMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error viewing product:", error);
      ctx.reply("❌ Failed to load product details.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleReferralYes(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      ctx.session.purchaseProductId = productId;

      ctx.reply("🎯 Please enter your referral code:");
      ctx.session.waitingForReferralCode = true;
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error handling referral yes:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleReferralNo(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      const telegramId = ctx.from.id;
      const orderId = await orderService.processPurchase(telegramId, productId);
      ctx.reply(
        `✅ Order placed successfully! Order ID: ${orderId.substring(
          0,
          8
        )}\n\nPlease upload a screenshot or file as proof of purchase.\n\nWaiting for company approval...`
      );
      ctx.session.waitingForProofOrderId = orderId;
      // Get companyId from product
      // The following code is commented out to prevent duplicate referral code messages:
      // const product = await productService.getProductById(productId);
      // if (product && product.companyId) {
      //   const newReferralCode = await referralService.generateReferralCode(
      //     product.companyId,
      //     telegramId
      //   );
      //   ctx.reply(
      //     `🔗 Here is your new referral code for this company: <code>${newReferralCode}</code>   (Click to copy)\nShare it with friends to earn rewards!`,
      //     {
      //       parse_mode: "HTML",
      //     }
      //   );
      // }
    } catch (error) {
      logger.error("Error processing purchase without referral:", error);
      ctx.reply("❌ Failed to process purchase.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleReferralCodeInput(ctx) {
    try {
      if (!ctx.session.waitingForReferralCode) return;
      const referralCode = ctx.message.text.toUpperCase();
      const productId = ctx.session.purchaseProductId;
      const telegramId = ctx.from.id;
      // Validate referral code
      const product = await productService.getProductById(productId);
      const codeData = await referralService.validateReferralCode({
        code: referralCode,
        companyId: product.companyId,
        buyerTelegramId: telegramId,
        amount: product.price,
      });
      if (!codeData || codeData.valid === false) {
        let userMsg = t("referral_code_invalid_user");
        let companyMsg = t("referral_code_invalid_company");
        let sellerMsg = null;
        let isSelfReferral = false;
        if (
          codeData &&
          codeData.message &&
          codeData.message.toLowerCase().includes("yourself")
        ) {
          userMsg = t("referral_self_not_allowed_user");
          companyMsg = t("referral_self_not_allowed_company");
          sellerMsg =
            "⚠️ The buyer attempted to use their own referral code, which is not allowed. Please kindly ask them to enter a valid code from another user, or continue without a code.";
          isSelfReferral = true;
        }
        if (!isSelfReferral) ctx.reply(userMsg); // Only send to user if not self-referral
        if (sellerMsg) ctx.reply(sellerMsg);
        // Notify company owner if available
        if (product && product.companyId) {
          const company = await companyService.getCompanyById(
            product.companyId
          );
          if (
            company &&
            company.telegramId &&
            company.telegramId !== ctx.from.id
          ) {
            ctx.telegram.sendMessage(company.telegramId, companyMsg);
          }
        }
        return;
      }
      const orderId = await orderService.processPurchase(
        telegramId,
        productId,
        referralCode
      );
      // Clear session
      delete ctx.session.waitingForReferralCode;
      delete ctx.session.purchaseProductId;
      ctx.reply(
        `✅ Order placed successfully with referral code! Order ID: ${orderId.substring(
          0,
          8
        )}\n\nPlease upload a screenshot or file as proof of purchase.\n\n🎉 You'll receive a discount when the order is approved!\n\nWaiting for company approval...`
      );
      ctx.session.waitingForProofOrderId = orderId;
      // The following code is commented out to prevent duplicate referral code messages:
      // const companyId = codeData.companyId; // Get companyId from validated code
      // const newReferralCode = await referralService.generateReferralCode(
      //   companyId,
      //   telegramId
      // );
      // ctx.reply(
      //   `🔗 Here is your new referral code for this company: <code>${newReferralCode}</code>(Click to copy)\nShare it with friends to earn rewards!`,
      //   {
      //     parse_mode: "HTML",
      //   }
      // );
    } catch (error) {
      logger.error("Error processing referral code:", error);
      ctx.reply("❌ Failed to process referral code. Please try again.");
    }
  }

  async handleProofUpload(ctx) {
    try {
      if (!ctx.session.waitingForProofOrderId) return;
      const orderId = ctx.session.waitingForProofOrderId;
      let fileId = null;
      if (ctx.message.photo) {
        fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      } else if (ctx.message.document) {
        fileId = ctx.message.document.file_id;
      }
      if (!fileId) {
        return ctx.reply("❌ Please upload an image or file as proof.");
      }
      await orderService.attachProofToOrder(orderId, fileId);
      delete ctx.session.waitingForProofOrderId;
      ctx.reply(
        "✅ Proof of purchase uploaded! Your order will be reviewed by the company."
      );
    } catch (error) {
      logger.error("Error uploading proof:", error);
      ctx.reply("❌ Failed to upload proof. Please try again.");
    }
  }

  async handleGetReferralCode(ctx) {
    try {
      const companyId = ctx.callbackQuery.data.split("_")[2];
      const telegramId = ctx.from.id;

      // Check for rate limiting
      if (isRateLimited(telegramId, "code")) {
        ctx.reply(
          "⚠️ You've reached the maximum number of referral code generation attempts per minute. Please try again later."
        );
        if (ctx.callbackQuery) return ctx.answerCbQuery();
      }

      // Check if user is phone verified
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (!user.phoneVerified) {
        ctx.reply(
          "❌ Please verify your phone number first to become a referrer."
        );
        if (ctx.callbackQuery) return ctx.answerCbQuery();
      }

      const referralCode = await referralService.generateReferralCode(
        telegramId,
        companyId
      );

      const message = `
🎯 *Your Referral Code Generated!*

�� Code: \`${referralCode}\`

💰 How it works:
• Share this code with friends
• They get a discount on purchases
• You earn commission on each sale
• Track your earnings in "My Referrals"

Share your code and start earning! 💸
      `;

      const buttons = [
        [Markup.button.callback("📊 My Referral Stats", "my_referrals")],
        [Markup.button.callback("📤 Share Code", `share_code_${referralCode}`)],
        [
          Markup.button.callback(
            "📤 Share Link",
            `share_link_${companyId}_${referralCode}`
          ),
        ],
        [
          Markup.button.callback(
            "🔙 Back to Product",
            `view_product_${ctx.session.lastProductId || "browse"}`
          ),
        ],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error generating referral code:", error);
      ctx.reply("❌ Failed to generate referral code. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleMyReferrals(ctx) {
    ctx.session = {}; // Reset session state
    if (!ctx.from || !ctx.from.id) {
      ctx.reply("❌ Unable to get your referral stats: missing user ID.");
      return;
    }
    const referralService = require("../services/referralService");
    const stats = await referralService.getUserReferralStats(ctx.from.id);
    let msg = `📊 Your Referral Stats:\n`;
    msg += `Total Referrals: ${stats.totalReferrals}\n`;
    msg += `Total Earnings (recorded): $${stats.totalEarnings.toFixed(2)}\n`;
    msg += `Pending Earnings: $${stats.pendingEarnings.toFixed(2)}\n`;
    msg += `This Month: $${stats.thisMonthEarnings.toFixed(2)}\n`;
    if (!stats.totalReferrals) {
      return ctx.reply(
        "🎯 You have no referrals yet. Share your referral code to start earning!"
      );
    }
    // Show companies as clickable buttons
    const minPayout = parseFloat(process.env.MIN_PAYOUT_AMOUNT || "10");
    const companyStats = stats.companyStats || {};
    let companyMsg = "\n\n*Your Companies:*\n";
    const buttons = [];
    for (const [companyId, data] of Object.entries(companyStats)) {
      companyMsg += `• ${
        data.companyName || companyId
      }: $${data.earnings.toFixed(2)} (${data.count} referrals)\n`;
      buttons.push([
        require("telegraf").Markup.button.callback(
          `${data.companyName || companyId} Details`,
          `ref_company_${companyId}`
        ),
      ]);
      if (data.earnings >= minPayout) {
        buttons.push([
          require("telegraf").Markup.button.callback(
            `💸 Withdraw from ${
              data.companyName || companyId
            } ($${data.earnings.toFixed(2)})`,
            `withdraw_company_${companyId}`
          ),
        ]);
      }
    }
    buttons.push([
      require("telegraf").Markup.button.callback(
        "🔙 Back to Main Menu",
        "main_menu"
      ),
    ]);
    ctx.reply(msg + companyMsg, {
      parse_mode: "Markdown",
      ...require("telegraf").Markup.inlineKeyboard(buttons),
    });
  }

  async handleLeaderboard(ctx) {
    ctx.session = {}; // Reset session state
    const referralService = require("../services/referralService");
    const leaderboard = await referralService.getTopReferrers(10);
    let msg = "🏆 Top Referrers Leaderboard:\n";
    leaderboard.forEach((u, i) => {
      msg += `${i + 1}. ${u.firstName || "User"}: $${u.totalEarnings.toFixed(
        2
      )}\n`;
    });
    ctx.reply(msg);
  }

  async handleRequestPayout(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      const balance = user.referralBalance || 0;
      const minPayout = parseFloat(process.env.MIN_PAYOUT_AMOUNT || "10");

      if (balance < minPayout) {
        ctx.reply(
          `❌ Minimum payout amount is $${minPayout}. Your current balance: $${balance.toFixed(
            2
          )}`
        );
        if (ctx.callbackQuery) return ctx.answerCbQuery();
      }

      const message = `
💸 *Request Payout*

💰 Available Balance: $${balance.toFixed(2)}
💳 Payment Method: ${user.paymentMethod || "Not set"}

How much would you like to withdraw?
      `;

      const buttons = [
        [
          Markup.button.callback(`💸 $${minPayout}`, `payout_${minPayout}`),
          Markup.button.callback(
            `💸 $${Math.min(50, balance)}`,
            `payout_${Math.min(50, balance)}`
          ),
        ],
        [
          Markup.button.callback(
            `💸 All ($${balance.toFixed(2)})`,
            `payout_${balance}`
          ),
          Markup.button.callback("💳 Custom Amount", "payout_custom"),
        ],
        [
          Markup.button.callback("⚙️ Payment Settings", "payment_settings"),
          Markup.button.callback("🔙 Back", "my_referrals"),
        ],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error requesting payout:", error);
      ctx.reply("❌ Failed to load payout options. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePayoutAmount(ctx) {
    try {
      const amount = parseFloat(ctx.callbackQuery.data.split("_")[1]);
      const telegramId = ctx.from.id;
      // Use withdrawalService for robust Firestore-powered logic
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      const method = user.paymentMethod || "not_set";
      const details = user.paymentDetails || {};
      const payoutId = await userService.userService.requestWithdrawal(
        telegramId,
        amount,
        method,
        details
      );

      const fee = amount * 0.02; // 2% withdrawal fee
      const payoutAmount = amount - fee;

      ctx.reply(
        `✅ Payout request submitted!\n\nAmount: $${amount.toFixed(
          2
        )}\nFee (2%): $${fee.toFixed(2)}\nPayout: $${payoutAmount.toFixed(
          2
        )}\nRequest ID: ${payoutId.substring(
          0,
          8
        )}\n\nProcessing time: 3-5 business days`
      );
      // Notify admins
      await getNotificationServiceInstance().sendAdminActionNotification(
        "User Withdrawal/Reward",
        {
          user: telegramId,
          amount: amount,
          payoutAmount: payoutAmount,
          method: method,
          time: new Date().toISOString(),
          details: JSON.stringify(details),
        }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error processing payout:", error);
      ctx.reply(`❌ Payout failed: ${error.message}`);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePayoutCustom(ctx) {
    try {
      ctx.session.waitingForPayoutAmount = true;
      ctx.reply("💸 Please enter the amount you want to withdraw:");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error handling custom payout:", error);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCustomPayoutAmount(ctx) {
    try {
      if (!ctx.session.waitingForPayoutAmount) return;
      const amount = parseFloat(ctx.message.text);
      const telegramId = ctx.from.id;
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Please enter a valid amount:");
      }
      // Use withdrawalService for robust Firestore-powered logic
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      const method = user.paymentMethod || "not_set";
      const details = user.paymentDetails || {};
      const payoutId = await userService.userService.requestWithdrawal(
        telegramId,
        amount,
        method,
        details
      );
      delete ctx.session.waitingForPayoutAmount;

      const fee = amount * 0.02; // 2% withdrawal fee
      const payoutAmount = amount - fee;

      ctx.reply(
        `✅ Payout request submitted!\n\nAmount: $${amount.toFixed(
          2
        )}\nFee (2%): $${fee.toFixed(2)}\nPayout: $${payoutAmount.toFixed(
          2
        )}\nRequest ID: ${payoutId.substring(
          0,
          8
        )}\n\nProcessing time: 3-5 business days`
      );
      // Notify admins
      await getNotificationServiceInstance().sendAdminActionNotification(
        "User Withdrawal/Reward",
        {
          user: telegramId,
          amount: amount,
          payoutAmount: payoutAmount,
          method: method,
          time: new Date().toISOString(),
          details: JSON.stringify(details),
        }
      );
    } catch (error) {
      logger.error("Error processing custom payout:", error);
      ctx.reply(`❌ Payout failed: ${error.message}`);
    }
  }

  async handlePayoutHistory(ctx) {
    try {
      const telegramId = ctx.from.id;
      const history = await userService.userService.getUserWithdrawalHistory(
        telegramId
      );
      let message = "📜 *Payout History*\n\n";
      if (history.length === 0) {
        message += "No payout requests yet.";
      } else {
        history.forEach((payout, index) => {
          const status =
            payout.status === "completed"
              ? "✅"
              : payout.status === "pending"
              ? "⏳"
              : "❌";
          message += `${index + 1}. ${status} $${payout.amount.toFixed(2)}\n`;
          message += `   📅 ${toDateSafe(
            payout.createdAt
          )?.toLocaleDateString()}\n`;
          message += `   📋 ${payout.id.substring(0, 8)}\n\n`;
        });
      }
      const buttons = [
        [Markup.button.callback("💸 New Payout", "request_payout")],
        [Markup.button.callback("🔙 Back to Referrals", "my_referrals")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing payout history:", error);
      ctx.reply("❌ Failed to load payout history. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleVerifyPhone(ctx) {
    try {
      ctx.session = {}; // Reset session state
      ctx.reply("📱 Please share your phone number to verify your account:", {
        reply_markup: {
          keyboard: [
            [{ text: "📱 Share Phone Number", request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    } catch (error) {
      logger.error("Error in verify phone handler:", error);
      ctx.reply("❌ Failed to start phone verification.");
    }
  }

  async handlePhoneContact(ctx) {
    try {
      const telegramId = ctx.from.id;
      const contact = ctx.message.contact;
      if (!contact || !contact.phone_number) {
        return ctx.reply(t("error_share_phone"));
      }
      // Enforce phone uniqueness and verify
      try {
        await userService.userService.verifyPhone(
          telegramId,
          contact.phone_number
        );
      } catch (err) {
        return ctx.reply("❌ " + err.message);
      }
      // Show unified main menu after verification
      // Remove the custom keyboard (Share Phone Number) using sendMessage for reliability
      await ctx.telegram.sendMessage(telegramId, t("phone_verified"), {
        reply_markup: { remove_keyboard: true },
      });
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      // Update user info if changed
      if (user) {
        const updates = {};
        if (ctx.from) {
          if (
            ctx.from.username &&
            ctx.from.username.toLowerCase() !== user.username
          )
            updates.username = ctx.from.username.toLowerCase();
          if (
            ctx.from.first_name &&
            ctx.from.first_name !== user.firstName &&
            ctx.from.first_name !== user.first_name
          )
            updates.first_name = ctx.from.first_name;
          if (
            ctx.from.last_name &&
            ctx.from.last_name !== user.lastName &&
            ctx.from.last_name !== user.last_name
          )
            updates.last_name = ctx.from.last_name;
        }
        if (
          ctx.message &&
          ctx.message.contact &&
          ctx.message.contact.phone_number &&
          ctx.message.contact.phone_number !== user.phone_number
        ) {
          updates.phone_number = ctx.message.contact.phone_number;
        }
        if (Object.keys(updates).length > 0) {
          await userService.userService.updateUser(telegramId, updates);
        }
      }
      const isAdmin = user.role === "admin" || user.isAdmin === true;
      const isCompany = user.isCompanyOwner === true || user.companyId;
      const welcomeMessage = t("welcome");
      const buttons = [
        [
          Markup.button.callback("🛍️ Browse Products", "browse_products"),
          Markup.button.callback("💰 My Referrals", "my_referrals"),
        ],
        [
          Markup.button.callback("⭐ Favorites", "view_favorites"),
          Markup.button.callback("🛒 Cart", "view_cart"),
        ],
        [
          Markup.button.callback("👤 Profile", "user_profile"),
          Markup.button.callback("🏆 Leaderboard", "leaderboard"),
        ],
        [Markup.button.callback("ℹ️ Help", "help")],
      ];
      if (isCompany) {
        buttons.push([
          Markup.button.callback("🏢 Company Dashboard", "company_dashboard"),
        ]);
      }
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback("🏢 Register Company", "register_company"),
        ]);
      }
      if (isAdmin) {
        buttons.push([Markup.button.callback("🔧 Admin Panel", "admin_panel")]);
      }
      ctx.reply(welcomeMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error handling phone contact:", error);
      ctx.reply("❌ Failed to verify phone. Please try again.");
    }
  }

  // Add handler for joining a company
  async handleJoinCompany(ctx, companyId) {
    try {
      logger.info(`[JoinCompany] Attempting to join company: ${companyId}`);
      const telegramId = ctx.from.id;
      // Fetch company info (assume companyService.getCompanyById exists)
      const company =
        await require("../services/companyService").getCompanyById(companyId);
      logger.info(`[JoinCompany] Company: ${JSON.stringify(company)}`);
      if (!company) return ctx.reply("❌ Company not found.");
      // Join company and get referral code
      const code = await userService.userService.joinCompany(
        telegramId,
        company
      );
      ctx.reply(`✅ Joined ${company.name}! Your referral code: \`${code}\``);
    } catch (error) {
      logger.error("Error joining company:", error);
      ctx.reply("❌ Failed to join company. Please try again.");
    }
  }

  async handleUserProfile(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (user.phone_verified && !user.phoneVerified)
        user.phoneVerified = user.phone_verified;
      const orders = await orderService.getUserOrders(telegramId);

      const message = `
👤 *Your Profile*

📋 Personal Info:
• Name: ${user.firstName} ${user.lastName || ""}
• Username: @${user.username || "Not set"}
• Phone: ${user.phoneVerified ? "✅ Verified" : "❌ Not verified"}
• Member since: ${toDateSafe(user.createdAt)?.toLocaleDateString()}

📊 Activity:
• Total Orders: ${orders.length}
• Payment Method: ${user.paymentMethod || "Not set"}
      `;

      const buttons = [
        [
          Markup.button.callback("✏️ Edit Profile", "edit_profile"),
          Markup.button.callback("💳 Payment Settings", "payment_settings"),
        ],
        [
          Markup.button.callback("📋 Order History", "order_history"),
          Markup.button.callback("🔔 Notifications", "notification_settings"),
        ],
        [Markup.button.callback("🔙 Main Menu", "main_menu")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing user profile:", error);
      ctx.reply("❌ Failed to load profile. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleOrderHistory(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const orders = await orderService.getUserOrders(telegramId);

      let message = "📋 *Order History*\n\n";

      if (orders.length === 0) {
        message +=
          "No orders yet. Start shopping! 🛍️ Use /browse to find products.";
      } else {
        orders.forEach((order, index) => {
          const statusIcon =
            order.status === "approved"
              ? "✅"
              : order.status === "pending"
              ? "⏳"
              : "❌";
          message += `${index + 1}. ${statusIcon} [${toDateSafe(
            order.createdAt
          )?.toLocaleDateString()}] ${order.productTitle} ($${
            order.finalPrice || order.amount
          })\n   Company: ${order.company_name || "-"}\n   ${
            order.referralCode ? "🎯 Used code: " + order.referralCode : ""
          }\n   ${
            order.status === "approved" ? "🎉 Reward/Discount applied!" : ""
          }\n   ${order.proofFileId ? "📄 Proof Uploaded" : ""}\n\n`;
        });
      }

      const buttons = [
        [Markup.button.callback("🛍️ Browse Products", "browse_products")],
        [Markup.button.callback("🔙 Back to Profile", "user_profile")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing order history:", error);
      ctx.reply("❌ Failed to load order history. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleShareCode(ctx) {
    try {
      const referralCode = ctx.callbackQuery.data.split("_")[2];

      const shareMessage = `
🎯 *Special Referral Code!*

Use my code \`${referralCode}\` and get a discount on your purchase!

💰 Benefits:
• Instant discount on checkout
• Support a friend (me!)
• Great products at better prices

Start shopping now! 🛍️
      `;

      ctx.reply("📤 Share this message with your friends:\n\n" + shareMessage, {
        parse_mode: "Markdown",
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error sharing code:", error);
      ctx.reply("❌ Failed to generate share message.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleHelp(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const helpMessage = `
🤖 *How ReferralBot Works:*

1. Buy from any company to get a referral code (unique, single-use, per company)
2. Share your code with friends
3. When a friend uses your code and buys, you get 2% reward, they get 1% discount
4. Company must approve the purchase for rewards to be paid
5. All rewards, discounts, and balances are automatic and visible in your profile
6. Platform takes 5% fee from each sale, companies pay 500-1000 birr/month
7. Withdrawals take 3-5 days and may have a small fee
8. No self-referral, codes expire after use

*For Companies:*
- Approve purchases to trigger rewards
- See all referrals, stats, and payouts in your dashboard
- All logic is automatic and transparent

For more info, contact @Nife777online
      `;

      const buttons = [
        [
          Markup.button.callback("🛍️ Start Shopping", "browse_products"),
          Markup.button.callback("💰 My Referrals", "my_referrals"),
        ],
        [Markup.button.callback("💰 Fee Calculator", "fee_calculator")],
        [Markup.button.callback("🔙 Main Menu", "main_menu")],
      ];

      ctx.reply(t("help"), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing help:", error);
      ctx.reply("❌ Failed to load help information.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleFeeCalculator(ctx) {
    try {
      ctx.session = {}; // Reset session state
      ctx.session.state = "awaiting_fee_calculator_amount";
      await ctx.reply("Enter a purchase amount to calculate fees and rewards:");
    } catch (error) {
      logger.error("Error in handleFeeCalculator:", error);
      ctx.reply("❌ Something went wrong.");
    }
  }

  async handleMainMenu(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const menuMessage = `
🏠 *Main Menu*

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback("🛍️ Browse Products", "browse_products"),
          Markup.button.callback("💰 My Referrals", "my_referrals"),
        ],
        [
          Markup.button.callback("👤 Profile", "user_profile"),
          Markup.button.callback("📋 Order History", "order_history"),
        ],
        [
          Markup.button.callback("📱 Verify Phone", "verify_phone"),
          Markup.button.callback("ℹ️ Help", "help"),
        ],
      ];

      ctx.reply(t("main_menu"), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing main menu:", error);
      ctx.reply("❌ Failed to load menu.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleBalance(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (!user) {
        return ctx.reply(t("error_user_not_found"));
      }
      // Get per-company referral stats
      const stats =
        await require("../services/referralService").getUserReferralStats(
          telegramId
        );
      let balanceMsg = "💰 *Your Referral Balances:*\n";
      const eligibleCompanies = [];
      const minPayout = parseFloat(process.env.MIN_PAYOUT_AMOUNT || "10");
      if (stats.companyStats) {
        for (const [companyId, data] of Object.entries(stats.companyStats)) {
          balanceMsg += `• ${data.code || companyId}: $${data.earnings.toFixed(
            2
          )}\n`;
          if (data.earnings >= minPayout) {
            eligibleCompanies.push({
              companyId,
              code: data.code,
              earnings: data.earnings,
            });
          }
        }
      }
      if (eligibleCompanies.length === 0) {
        balanceMsg += "\nNo company balances eligible for withdrawal yet.";
      } else {
        balanceMsg += "\nSelect a company below to request withdrawal:";
      }
      const buttons = eligibleCompanies.map((c) => [
        require("telegraf").Markup.button.callback(
          `Withdraw from ${c.code || c.companyId} ($${c.earnings.toFixed(2)})`,
          `withdraw_company_${c.companyId}`
        ),
      ]);
      buttons.push([
        require("telegraf").Markup.button.callback("🔙 Back", "main_menu"),
      ]);
      ctx.reply(balanceMsg, {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in balance command:", error);
      ctx.reply("❌ Failed to load balance. Please try again.");
    }
  }

  async handlePrivacy(ctx) {
    ctx.session = {}; // Reset session state
    const message = `
  🔒 *Privacy Policy*
  
  - We collect your Telegram ID, username, and phone number for account and referral management.
  - Your data is used only for platform features (referrals, rewards, company management).
  - We do not share your personal data with third parties except as required by law.
  - You can request deletion of your data at any time by contacting @Nife777online
  - The platform may update this policy at any time.
  `;
    ctx.reply(message, { parse_mode: "Markdown" });
  }

  async handleTerms(ctx) {
    ctx.session = {}; // Reset session state
    const message = `
  📜 *Terms of Service*
  
  By using this bot, you agree to:
  - Provide accurate information
  - Not abuse the referral system
  - Only use one account per person
  - Respect company and platform rules
  - Understand that rewards and payouts are subject to approval and platform policy
  - The platform may update these terms at any time
  
  For questions, contact @Nife777online
  `;
    ctx.reply(message, { parse_mode: "Markdown" });
  }

  async handleCancel(ctx) {
    try {
      // Clear all session data
      ctx.session = {};

      ctx.reply(
        "❌ Operation cancelled. Use /start to return to main menu.",
        Markup.removeKeyboard()
      );
    } catch (error) {
      logger.error("Error in cancel handler:", error);
      ctx.reply("Operation cancelled.");
    }
  }

  async handlePaymentSettings(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );

      const message = `
💳 *Payment Settings*

Current Method: ${user.paymentMethod || "Not set"}
${
  user.paymentDetails
    ? `Details: ${
        user.paymentDetails.accountNumber
          ? "****" + user.paymentDetails.accountNumber.slice(-4)
          : "Configured"
      }`
    : "No payment details set"
}

Choose your preferred payout method:
      `;

      const buttons = [
        [
          Markup.button.callback("🏦 Bank Transfer", "payment_bank"),
          Markup.button.callback("💳 PayPal", "payment_paypal"),
        ],
        [
          Markup.button.callback("₿ Crypto", "payment_crypto"),
          Markup.button.callback("📱 Mobile Money", "payment_mobile"),
        ],
        [Markup.button.callback("🔙 Back", "user_profile")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing payment settings:", error);
      ctx.reply("❌ Failed to load payment settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePaymentMethod(ctx) {
    try {
      const method = ctx.callbackQuery.data.split("_")[1];
      ctx.session.paymentMethod = method;

      let message = "";
      switch (method) {
        case "bank":
          message =
            "🏦 *Bank Transfer Setup*\n\nPlease enter your bank account number:";
          ctx.session.paymentStep = "bank_account";
          break;
        case "paypal":
          message =
            "💳 *PayPal Setup*\n\nPlease enter your PayPal email address:";
          ctx.session.paymentStep = "paypal_email";
          break;
        case "crypto":
          message = "₿ *Crypto Setup*\n\nPlease enter your wallet address:";
          ctx.session.paymentStep = "crypto_wallet";
          break;
        case "mobile":
          message =
            "📱 *Mobile Money Setup*\n\nPlease enter your mobile money number:";
          ctx.session.paymentStep = "mobile_number";
          break;
      }

      ctx.reply(message, { parse_mode: "Markdown" });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error setting payment method:", error);
      ctx.reply("❌ Failed to set payment method.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handlePaymentDetails(ctx) {
    try {
      const step = ctx.session.paymentStep;
      const text = ctx.message.text;
      const telegramId = ctx.from.id;

      if (!step) return;

      let paymentDetails = {};
      let methodName = "";

      switch (step) {
        case "bank_account":
          paymentDetails = { accountNumber: text };
          methodName = "bank_transfer";
          break;
        case "paypal_email":
          paymentDetails = { email: text };
          methodName = "paypal";
          break;
        case "crypto_wallet":
          paymentDetails = { walletAddress: text };
          methodName = "crypto";
          break;
        case "mobile_number":
          paymentDetails = { phoneNumber: text };
          methodName = "mobile_money";
          break;
      }

      await userService.userService.updatePaymentMethod(
        telegramId,
        methodName,
        paymentDetails
      );

      // Clear session
      delete ctx.session.paymentMethod;
      delete ctx.session.paymentStep;

      ctx.reply("✅ Payment method updated successfully!");
    } catch (error) {
      logger.error("Error updating payment details:", error);
      ctx.reply("❌ Failed to update payment method. Please try again.");
    }
  }

  async handleNotificationSettings(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );

      const message = `
🔔 *Notification Settings*

Current Settings:
• Order Updates: ${user.notifications?.orders ? "✅" : "❌"}
• Referral Earnings: ${user.notifications?.referrals ? "✅" : "❌"}
• Payout Updates: ${user.notifications?.payouts ? "✅" : "❌"}
• Marketing: ${user.notifications?.marketing ? "✅" : "❌"}

Toggle notifications:
      `;

      const buttons = [
        [
          Markup.button.callback(
            `${user.notifications?.orders ? "🔕" : "🔔"} Order Updates`,
            "toggle_orders"
          ),
        ],
        [
          Markup.button.callback(
            `${user.notifications?.referrals ? "🔕" : "🔔"} Referral Earnings`,
            "toggle_referrals"
          ),
        ],
        [
          Markup.button.callback(
            `${user.notifications?.payouts ? "🔕" : "🔔"} Payout Updates`,
            "toggle_payouts"
          ),
        ],
        [
          Markup.button.callback(
            `${user.notifications?.marketing ? "🔕" : "🔔"} Marketing`,
            "toggle_marketing"
          ),
        ],
        [Markup.button.callback("🔙 Back to Profile", "user_profile")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing notification settings:", error);
      ctx.reply("❌ Failed to load notification settings.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleToggleNotification(ctx) {
    try {
      const type = ctx.callbackQuery.data.split("_")[1];
      const telegramId = ctx.from.id;

      await userService.userService.toggleNotification(telegramId, type);

      ctx.reply(
        `✅ ${
          type.charAt(0).toUpperCase() + type.slice(1)
        } notifications updated!`
      );

      // Refresh notification settings
      setTimeout(() => {
        this.handleNotificationSettings(ctx);
      }, 1000);

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error toggling notification:", error);
      ctx.reply("❌ Failed to update notification setting.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleLeaderboard(ctx) {
    try {
      const topReferrers = await referralService.getTopReferrers(10); // [{telegramId, firstName, totalEarnings}]
      let message = "🏆 *Top Referrers Leaderboard*\n\n";
      if (!topReferrers || topReferrers.length === 0) {
        message += "No referral activity yet.";
      } else {
        topReferrers.forEach((user, i) => {
          message += `${i + 1}. ${user.firstName || "User"} (${
            user.telegramId
          }): $${user.totalEarnings.toFixed(2)}\n`;
        });
      }
      const buttons = [
        [Markup.button.callback("🔙 Back to Menu", "main_menu")],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing leaderboard:", error);
      ctx.reply("❌ Failed to load leaderboard. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleDetailedReferralStats(ctx) {
    try {
      const telegramId = ctx.from.id;
      const stats = await referralService.getUserReferralStats(telegramId);
      let message = `📊 *Detailed Referral Stats*\n\n`;
      message += `• Total Earnings: $${(stats.totalEarnings || 0).toFixed(
        2
      )}\n`;
      message += `• Total Referrals: ${stats.totalReferrals || 0}\n`;
      message += `• Active Codes: ${stats.activeReferralCodes || 0}\n\n`;
      if (stats.codes && stats.codes.length > 0) {
        message += `*Per-Company Stats:*\n`;
        const companyMap = {};
        stats.codes.forEach((code) => {
          if (!companyMap[code.companyName])
            companyMap[code.companyName] = { earnings: 0, uses: 0, codes: [] };
          companyMap[code.companyName].earnings += code.totalEarnings || 0;
          companyMap[code.companyName].uses += code.totalUses || 0;
          companyMap[code.companyName].codes.push(code);
        });
        Object.entries(companyMap).forEach(([company, data]) => {
          message += `• ${company}: $${data.earnings.toFixed(2)} from ${
            data.uses
          } uses\n`;
          data.codes.forEach((code) => {
            message += `   └ Code: \`${code.code}\` — $${(
              code.totalEarnings || 0
            ).toFixed(2)}, ${code.totalUses || 0} uses\n`;
          });
        });
        message += "\n";
      }
      if (stats.recentReferrals && stats.recentReferrals.length > 0) {
        message += `*Recent Referral Activity:*\n`;
        stats.recentReferrals.slice(0, 10).forEach((ref) => {
          message += `• $${(ref.referrerCommission || 0).toFixed(
            2
          )} — ${toDateSafe(ref.createdAt)?.toLocaleDateString()} — Code: \`${
            ref.code
          }\`\n`;
        });
      } else {
        message += "No recent referral activity.";
      }
      ctx.reply(message, { parse_mode: "Markdown" });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing detailed referral stats:", error);
      ctx.reply("❌ Failed to load detailed stats. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleRegisterCompany(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (!user.canRegisterCompany) {
        return ctx.reply(
          "❌ You are not eligible to register a company. Please contact an admin to request access."
        );
      }
      ctx.session.companyRegistrationStep = "name";
      ctx.session.companyRegistrationData = {};
      ctx.reply(
        '🏢 *Register New Company*\n\nBefore proceeding, please review and accept the company agreement:\n\n"By registering, you agree to the monthly fee (500-1000 birr), a 2% referral reward, and a 5% platform fee. All payments are handled outside the system. See full terms at any time with /agreement."\n\nType "I accept" to continue or "Cancel" to abort.',
        { parse_mode: "Markdown" }
      );
      ctx.session.awaitingCompanyAgreement = true;
    } catch (error) {
      logger.error("Error starting company registration:", error);
      ctx.reply("❌ Failed to start company registration.");
    }
  }

  async handleCompanyRegistrationStep(ctx) {
    try {
      if (ctx.session.awaitingCompanyAgreement) {
        if (ctx.message.text.trim().toLowerCase() !== "i accept") {
          ctx.reply("❌ You must accept the agreement to register a company.");
          ctx.session.companyRegistrationStep = null;
          ctx.session.companyRegistrationData = null;
          ctx.session.awaitingCompanyAgreement = null;
          return;
        }
        ctx.session.awaitingCompanyAgreement = null;
        ctx.reply("Please enter your company name:");
        ctx.session.companyRegistrationStep = "name";
        return;
      }
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (!user.canRegisterCompany) {
        return ctx.reply(
          "❌ You are not eligible to register a company. Please contact an admin to request access."
        );
      }
      const step = ctx.session.companyRegistrationStep;
      const text = ctx.message.text;
      if (!ctx.session.companyRegistrationData)
        ctx.session.companyRegistrationData = {};
      switch (step) {
        case "name":
          ctx.session.companyRegistrationData.name = text;
          ctx.session.companyRegistrationStep = "description";
          ctx.reply("Please enter a brief description of your company:");
          break;
        case "description":
          ctx.session.companyRegistrationData.description = text;
          ctx.session.companyRegistrationStep = "website";
          ctx.reply('Please enter your company website (or type "skip"):');
          break;
        case "website":
          ctx.session.companyRegistrationData.website =
            text === "skip" ? null : text;
          ctx.session.companyRegistrationStep = "phone";
          ctx.reply("Please enter your company phone number:");
          break;
        case "phone":
          ctx.session.companyRegistrationData.phone = text;
          ctx.session.companyRegistrationStep = "email";
          ctx.reply("Please enter your company email address:");
          break;
        case "email":
          if (!/^\S+@\S+\.\S+$/.test(text)) {
            return ctx.reply("❌ Please enter a valid email address:");
          }
          ctx.session.companyRegistrationData.email = text;
          ctx.session.companyRegistrationStep = "address";
          ctx.reply("Please enter your company address:");
          break;
        case "address":
          ctx.session.companyRegistrationData.address = text;
          ctx.session.companyRegistrationStep = "location";
          ctx.reply(
            "Please enter your company location (city, region, or GPS coordinates):"
          );
          break;
        case "location":
          ctx.session.companyRegistrationData.location = text;
          ctx.session.companyRegistrationStep = "offer";
          ctx.reply("Please describe your main offer, product, or service:");
          break;
        case "offer":
          ctx.session.companyRegistrationData.offer = text;
          const companyData = {
            ...ctx.session.companyRegistrationData,
            telegramId: ctx.from.id,
            ownerName: ctx.from.first_name,
            ownerUsername: ctx.from.username,
            status: "active",
            createdAt: new Date(),
          };
          const companyId =
            await require("../services/companyService").createCompany(
              companyData
            );

          // Also update the user to be a company owner
          await userService.userService.updateUser(ctx.from.id, {
            isCompanyOwner: true,
            companyId: companyId,
          });

          ctx.reply(
            "✅ Company registered and active! You can now add products and manage your dashboard.",
            {
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback(
                    "📦 Add a Product",
                    `add_product_${companyId}`
                  ),
                ],
                [Markup.button.callback("🔙 Back to Main Menu", "main_menu")],
              ]),
            }
          );
          ctx.session.companyRegistrationStep = null;
          ctx.session.companyRegistrationData = null;
          break;
        default:
          ctx.reply("❌ Invalid registration step. Please start again.");
          ctx.session.companyRegistrationStep = null;
          ctx.session.companyRegistrationData = null;
      }
    } catch (error) {
      logger.error("Error in company registration step:", error);
      ctx.reply("❌ Failed to register company. Please try again.");
    }
  }

  async handleCompanyAgreementStep(ctx) {
    if (ctx.message.text.trim().toLowerCase() === "i accept") {
      ctx.session.companyAgreementAccepted = true;
      ctx.session.companyAgreementStep = false;
      ctx.reply("Agreement accepted. Continuing registration...");
      return this.handleCompanyRegistrationStep(ctx);
    } else {
      ctx.reply(
        'You must accept the agreement to register. Type "I accept" to proceed.'
      );
    }
  }

  async handleCompanyActionMenu(ctx, companyIdArg) {
    try {
      const companyId =
        companyIdArg ||
        (ctx.callbackQuery && ctx.callbackQuery.data.split("_")[2]);
      const companyService = require("../services/companyService");
      const company = await companyService.getCompanyById(companyId);
      if (!company) return ctx.reply("❌ Company not found.");
      let msg = `🏢 *Manage Company*\n\n`;
      msg += `*Name:* ${company.name}\n`;
      msg += `*Description:* ${company.description || "-"}\n`;
      msg += `*Website:* ${company.website || "-"}\n`;
      msg += `*Phone:* ${company.phone || "-"}\n`;
      msg += `*Email:* ${company.email || "-"}\n`;
      msg += `*Address:* ${company.address || "-"}\n`;
      msg += `*Location:* ${company.location || "-"}\n`;
      msg += `*Offer:* ${company.offer || "-"}\n`;
      msg += `*Status:* ${company.status || "-"}\n`;
      const buttons = [
        [
          require("telegraf").Markup.button.callback(
            "✏️ Edit",
            `edit_company_field_${company.id}`
          ),
          require("telegraf").Markup.button.callback(
            "🗑️ Delete",
            `delete_company_${company.id}`
          ),
          require("telegraf").Markup.button.callback(
            "➕ Add Product",
            `add_product_${company.id}`
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "🔙 Back to My Companies",
            "my_companies"
          ),
        ],
      ];
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in handleCompanyActionMenu:", error);
      ctx.reply("❌ Failed to load company actions.");
    }
  }

  async handleEditCompanyField(ctx) {
    try {
      const companyId = ctx.callbackQuery.data.split("_")[3];
      const companyService = require("../services/companyService");
      const company = await companyService.getCompanyById(companyId);
      if (!company) return ctx.reply("❌ Company not found.");
      ctx.session.editCompanyId = companyId;
      ctx.session.editCompanyStep = null;
      ctx.session.editCompanyData = { ...company };
      const buttons = [
        [
          require("telegraf").Markup.button.callback(
            "Name",
            "edit_companyfield_name"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Description",
            "edit_companyfield_description"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Website",
            "edit_companyfield_website"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Phone",
            "edit_companyfield_phone"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Email",
            "edit_companyfield_email"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Address",
            "edit_companyfield_address"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Location",
            "edit_companyfield_location"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Offer",
            "edit_companyfield_offer"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Status",
            "edit_companyfield_status"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "🔙 Back",
            `company_action_${companyId}`
          ),
        ],
      ];
      ctx.reply("Select the field you want to edit:", {
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in handleEditCompanyField:", error);
      ctx.reply("❌ Failed to load edit options.");
    }
  }

  async handleEditCompanyFieldInput(ctx) {
    try {
      const field = ctx.session.editCompanyStep;
      const companyId = ctx.session.editCompanyId;
      const companyService = require("../services/companyService");
      if (!field || !companyId) return ctx.reply("❌ Invalid edit session.");
      const value = ctx.message.text;
      const update = {};
      update[field] = value;
      await companyService.updateCompany(companyId, update, ctx.from.id);
      ctx.reply("✅ Company updated successfully.");
      // Show updated company details
      await this.handleCompanyActionMenu(ctx, companyId);
    } catch (error) {
      logger.error("Error in handleEditCompanyFieldInput:", error);
      ctx.reply("❌ Failed to update company.");
    }
  }

  async handleAddProductStart(ctx, companyId) {
    logger.info(
      `[DEBUG] handleAddProductStart: companyId=`,
      companyId,
      typeof companyId
    );
    // Ensure companyId is a string
    if (typeof companyId === "object" && companyId.id) companyId = companyId.id;
    ctx.session.addProductStep = "title";
    ctx.session.addProductData = { companyId: String(companyId) };
    ctx.reply("Enter product title:", {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Main Menu", "main_menu")],
      ]),
    });
  }

  async handleAddProductStep(ctx) {
    try {
      const step = ctx.session.addProductStep;
      const text = ctx.message.text;
      if (!ctx.session.addProductData) ctx.session.addProductData = {};
      switch (step) {
        case "title":
          ctx.session.addProductData.title = text;
          ctx.session.addProductStep = "description";
          ctx.reply("Enter product description:");
          break;
        case "description":
          ctx.session.addProductData.description = text;
          ctx.session.addProductStep = "price";
          ctx.reply("Enter product price:");
          break;
        case "price":
          ctx.session.addProductData.price = parseFloat(text);
          ctx.session.addProductStep = "quantity";
          ctx.reply("Enter product quantity (number):");
          break;
        case "quantity":
          const qty = parseInt(text);
          if (isNaN(qty) || qty < 0) {
            ctx.reply(
              "❌ Please enter a valid non-negative number for quantity:"
            );
            return;
          }
          ctx.session.addProductData.quantity = qty;
          ctx.session.addProductStep = "category";
          ctx.reply("Enter product category:");
          break;
        case "category":
          ctx.session.addProductData.category = text;
          ctx.session.addProductStep = "status";
          ctx.reply("Enter product status (e.g., active, out_of_stock):");
          break;
        case "status":
          ctx.session.addProductData.status = text;
          ctx.session.addProductStep = null;
          // Save product
          const productService = require("../services/productService");
          const productData = {
            ...ctx.session.addProductData,
            creatorTelegramId: ctx.from.id,
            createdAt: new Date(),
          };
          await productService.createProduct(productData, ctx.from.id);
          ctx.reply("✅ Product created and is now active!");
          ctx.session.addProductData = null;
          ctx.session.addProductStep = null;
          break;
        default:
          ctx.reply("❌ Invalid product step. Please start again.");
          ctx.session.addProductStep = null;
          ctx.session.addProductData = null;
      }
    } catch (error) {
      logger.error("Error in handleAddProductStep:", error);
      ctx.reply("❌ Failed to add product.");
    }
  }

  // Add to the class UserHandlers
  async handleFavoriteProduct(ctx) {
    const telegramId = ctx.from.id;
    const productId = ctx.callbackQuery.data.split("_")[2];
    await userService.userService.addFavorite(telegramId, productId);
    ctx.answerCbQuery("Favorite updated!");
    ctx.reply("⭐ Product favorite status updated.");
  }

  async handleAddToCart(ctx) {
    const telegramId = ctx.from.id;
    const productId = ctx.callbackQuery.data.split("_")[2];
    await userService.userService.addToCart(telegramId, productId);
    ctx.answerCbQuery("Added to cart!");
    ctx.reply("🛒 Product added to your cart.");
  }

  async handleRemoveFromCart(ctx) {
    const telegramId = ctx.from.id;
    const productId = ctx.callbackQuery.data.split("_")[2];
    await userService.userService.removeFromCart(telegramId, productId);
    ctx.answerCbQuery("Removed from cart!");
    ctx.reply("🗑️ Product removed from your cart.");
  }

  async handleViewFavorites(ctx) {
    const telegramId = ctx.from.id;
    const favorites = await userService.userService.getFavorites(telegramId);
    logger.info(
      `[ViewFavorites] Found ${favorites.length} favorites: ${favorites
        .map((f) => f.title + " (" + f.id + ")")
        .join(", ")}`
    );
    if (!favorites.length)
      return ctx.reply(
        "⭐ You have no favorite products yet. Browse products and tap ⭐ to add favorites!"
      );
    let msg = "⭐ *Your Favorite Products*\n\n";
    favorites.forEach((p, i) => {
      msg += `${i + 1}. ${p.title} ($${p.price})\n`;
    });
    ctx.reply(msg, { parse_mode: "Markdown" });
  }

  async handleViewCart(ctx) {
    const telegramId = ctx.from.id;
    const cart = await userService.userService.getCart(telegramId);
    logger.info(
      `[ViewCart] Found ${cart.length} items in cart: ${cart
        .map((c) => c.title + " (" + c.id + ")")
        .join(", ")}`
    );
    if (!cart.length)
      return ctx.reply(
        " Your cart is empty. Browse products and tap 🛒 to add items!"
      );
    let msg = "🛒 *Your Cart*\n\n";
    cart.forEach((p, i) => {
      msg += `${i + 1}. ${p.title} ($${p.price})\n`;
    });
    ctx.reply(msg, { parse_mode: "Markdown" });
  }

  async handleFavorites(ctx) {
    const userService = require("../services/userService");
    const productService = require("../services/productService");
    const favorites = await userService.userService.getFavorites(ctx.from.id);
    if (!favorites.length)
      return ctx.reply("⭐ You have no favorite products.");
    let msg = "⭐ Your Favorites:\n";
    for (const pid of favorites) {
      const product = await productService.getProductById(pid);
      if (product) msg += `- ${product.title} ($${product.price})\n`;
    }
    ctx.reply(msg);
  }

  async handleAddFavorite(ctx) {
    const userService = require("../services/userService");
    const productId = ctx.message.text.split(" ")[1];
    if (!productId) return ctx.reply("Usage: /addfavorite <productId>");
    await userService.userService.addFavorite(ctx.from.id, productId);
    ctx.reply("Added to favorites.");
  }

  async handleRemoveFavorite(ctx) {
    const userService = require("../services/userService");
    const productId = ctx.message.text.split(" ")[1];
    if (!productId) return ctx.reply("Usage: /removefavorite <productId>");
    await userService.userService.removeFavorite(ctx.from.id, productId);
    ctx.reply("Removed from favorites.");
  }

  async handleCart(ctx) {
    const userService = require("../services/userService");
    const productService = require("../services/productService");
    const cart = await userService.userService.getCart(ctx.from.id);
    if (!cart.length) return ctx.reply("🛒 Your cart is empty.");
    let msg = "🛒 Your Cart:\n";
    for (const pid of cart) {
      const product = await productService.getProductById(pid);
      if (product) msg += `- ${product.title} ($${product.price})\n`;
    }
    ctx.reply(msg);
  }

  async handleAddCart(ctx) {
    const userService = require("../services/userService");
    const productId = ctx.message.text.split(" ")[1];
    if (!productId) return ctx.reply("Usage: /addcart <productId>");
    await userService.userService.addToCart(ctx.from.id, productId);
    ctx.reply("Added to cart.");
  }

  async handleRemoveCart(ctx) {
    const userService = require("../services/userService");
    const productId = ctx.message.text.split(" ")[1];
    if (!productId) return ctx.reply("Usage: /removecart <productId>");
    await userService.userService.removeFromCart(ctx.from.id, productId);
    ctx.reply("Removed from cart.");
  }

  async handleShowAgreement(ctx) {
    const agreement = `Terms of Service\n\n- Companies: Monthly fee, 2%/5% cut, must approve purchases, manual payout.\n- Users: 1% discount on referred purchases, referral rewards are manual or discount-based.\n- All: No online payments, all purchases are in-person.\n- See full terms at: https://example.com/terms`;
    ctx.reply(agreement);
  }

  async handleRequestWithdrawal(ctx) {
    const userService = require("../services/userService");
    const companyId = ctx.message.text.split(" ")[1];
    if (!companyId) return ctx.reply("Usage: /requestwithdrawal <companyId>");
    try {
      await userService.userService.requestWithdrawal(ctx.from.id, companyId);
      ctx.reply(
        "Withdrawal request submitted. Company and admins have been notified."
      );
    } catch (e) {
      ctx.reply(`❌ ${e.message}`);
    }
  }

  async handleMyReferralCodes(ctx) {
    try {
      const referralService = require("../services/referralService");
      const codes = await referralService.getUserReferralCodes(ctx.from.id);
      if (!codes.length)
        return ctx.reply(
          "❌ You have no referral codes yet. Make a purchase to get your first code!"
        );
      let msg = "🎯 *Your Referral Codes*\n\n";
      const buttons = [];
      codes.forEach((code) => {
        msg += `• ${code.code} (Company: ${
          code.company_name || code.companyId
        })\n`;
        buttons.push([
          require("telegraf").Markup.button.callback(
            `📤 Share ${code.code}`,
            `share_code_${code.code}`
          ),
        ]);
      });
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in handleMyReferralCodes:", error);
      ctx.reply("❌ Failed to load your referral codes.");
    }
  }

  async handleMyProducts(ctx) {
    try {
      const telegramId = ctx.from.id;
      // Get companies owned by the user
      const companies =
        await require("../services/companyService").getCompaniesByOwner(
          telegramId
        );
      if (!companies || companies.length === 0) {
        return ctx.reply("❌ You do not own any companies or products.");
      }
      let allProducts = [];
      const productService = require("../services/productService");
      for (const company of companies) {
        const products = await productService.getProductsByCompany(company.id);
        if (products && products.length > 0) {
          allProducts = allProducts.concat(
            products.map((p) => ({
              ...p,
              companyName: company.name,
              companyId: company.id,
            }))
          );
        }
      }
      if (allProducts.length === 0) {
        return ctx.reply("❌ You have not added any products yet.", {
          parse_mode: "Markdown",
          ...require("telegraf").Markup.inlineKeyboard([
            [
              require("telegraf").Markup.button.callback(
                "🔙 Back to Main Menu",
                "main_menu"
              ),
            ],
          ]),
        });
      }
      // Show each product as a single clickable button
      const productButtons = allProducts.map((product) => [
        require("telegraf").Markup.button.callback(
          `${product.title} ($${product.price}) | ${product.companyName}`,
          `product_action_${product.id}`
        ),
      ]);
      ctx.reply("📦 *Your Products*", {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard([
          ...productButtons,
          [
            require("telegraf").Markup.button.callback(
              "🔙 Back to Main Menu",
              "main_menu"
            ),
          ],
        ]),
      });
    } catch (error) {
      logger.error("Error in handleMyProducts:", error);
      ctx.reply("❌ Failed to load your products.");
    }
  }

  async handleProductActionMenu(ctx, productIdArg) {
    try {
      const productId =
        productIdArg ||
        (ctx.callbackQuery && ctx.callbackQuery.data.split("_")[2]);
      const productService = require("../services/productService");
      const product = await productService.getProductById(productId);
      if (!product) return ctx.reply("❌ Product not found.");
      let msg = `🛠️ *Manage Product*\n\n`;
      msg += `*Title:* ${product.title}\n`;
      msg += `*Price:* $${product.price}\n`;
      msg += `*Description:* ${product.description || "-"}\n`;
      msg += `*Quantity:* ${product.quantity}\n`;
      msg += `*Category:* ${product.category || "-"}\n`;
      msg += `*Status:* ${product.status || "-"}\n`;
      msg += `*Company:* ${product.companyName || "-"}\n`;
      const buttons = [
        [
          require("telegraf").Markup.button.callback(
            "✏️ Edit",
            `edit_product_field_${product.id}`
          ),
          require("telegraf").Markup.button.callback(
            "🗑️ Delete",
            `delete_product_${product.id}`
          ),
          require("telegraf").Markup.button.callback(
            "💸 Sell",
            `sell_product_${product.id}`
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "🔙 Back to My Products",
            "my_products"
          ),
        ],
      ];
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in handleProductActionMenu:", error);
      ctx.reply("❌ Failed to load product actions.");
    }
  }

  async handleSellProduct(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      const productService = require("../services/productService");
      const product = await productService.getProductById(productId);
      if (!product) return ctx.reply("❌ Product not found.");
      if (product.quantity <= 0)
        return ctx.reply("❌ No stock available to sell.");
      ctx.session.sellProductId = productId;
      ctx.session.sellStep = "buyer_username";
      ctx.reply("Enter the buyer's Telegram username (without @):");
    } catch (error) {
      logger.error("Error in handleSellProduct:", error);
      ctx.reply("❌ Failed to process sale.");
    }
  }

  async handleSellProductStep(ctx) {
    try {
      const step = ctx.session.sellStep;
      const productId = ctx.session.sellProductId;
      const productService = require("../services/productService");
      const referralService = require("../services/referralService");
      const userService = require("../services/userService").userService;
      const companyService = require("../services/companyService");
      if (!productId) return ctx.reply("❌ No product selected for sale.");
      const product = await productService.getProductById(productId);
      if (!product) return ctx.reply("❌ Product not found.");
      if (step === "buyer_username") {
        let username = ctx.message.text.trim().replace(/^@/, "").toLowerCase();
        // Look up user by username
        const buyer = await userService.getUserByUsername(username, ctx.from);
        if (!buyer || !buyer.telegramId) {
          return ctx.reply(
            "❌ Buyer not found. Please enter a valid Telegram username (without @):"
          );
        }
        if (buyer.telegramId === ctx.from.id) {
          return ctx.reply(
            "❌ You cannot sell to yourself. Please enter a different buyer's username."
          );
        }
        ctx.session.sellBuyerId = buyer.telegramId;
        ctx.session.buyerUsername = username; // Store buyer username for receipts
        ctx.session.sellStep = "quantity";
        ctx.reply("Enter quantity to sell:");
        return;
      }
      if (step === "quantity") {
        const qty = parseInt(ctx.message.text);
        if (isNaN(qty) || qty <= 0)
          return ctx.reply("❌ Enter a valid quantity:");
        if (qty > product.quantity)
          return ctx.reply("❌ Not enough stock. Enter a lower quantity:");
        ctx.session.sellQuantity = qty;
        ctx.session.sellStep = "referral";
        ctx.reply("Does the buyer have a referral code? (yes/no)");
        return;
      }
      if (step === "referral") {
        const answer = ctx.message.text.trim().toLowerCase();
        if (answer === "yes") {
          ctx.session.sellStep = "referral_code";
          ctx.reply("Enter referral code:");
          return;
        } else if (answer === "no") {
          // No referral, proceed to sale
          await this.processSale(
            ctx,
            product,
            ctx.session.sellQuantity,
            null,
            ctx.session.sellBuyerId
          );
          ctx.session.sellStep = null;
          ctx.session.sellProductId = null;
          ctx.session.sellQuantity = null;
          ctx.session.sellBuyerId = null;
          return;
        } else {
          ctx.reply("Please answer yes or no:");
          return;
        }
      }
      if (step === "referral_code") {
        const code = ctx.message.text.trim();
        if (code.toLowerCase() === "no") {
          // User chose to continue without a referral code
          await this.processSale(
            ctx,
            product,
            ctx.session.sellQuantity,
            null,
            ctx.session.sellBuyerId
          );
          ctx.session.sellStep = null;
          ctx.session.sellProductId = null;
          ctx.session.sellQuantity = null;
          ctx.session.sellBuyerId = null;
          return;
        }
        // Defensive check for product and companyId
        if (!product || !product.companyId) {
          ctx.reply(
            "❌ Could not validate referral code: missing company context. Please try again or contact support."
          );
          return;
        }
        // Validate referral code
        const codeData = await referralService.validateReferralCode({
          code,
          companyId: product.companyId,
          buyerTelegramId: ctx.session.sellBuyerId,
          amount: product.price,
        });
        const referralForSale = {
          ...codeData,
          referrerTelegramId: codeData.referrerId,
        };
        if (!codeData || codeData.valid === false) {
          let userMsg = t("referral_code_invalid_user");
          let companyMsg = t("referral_code_invalid_company");
          let sellerMsg = null;
          let isSelfReferral = false;
          if (
            codeData &&
            codeData.message &&
            codeData.message.toLowerCase().includes("yourself")
          ) {
            userMsg = t("referral_self_not_allowed_user");
            companyMsg = t("referral_self_not_allowed_company");
            sellerMsg =
              "⚠️ The buyer attempted to use their own referral code, which is not allowed. Please kindly ask them to enter a valid code from another user, or continue without a code.";
            isSelfReferral = true;
          }
          if (!isSelfReferral) ctx.reply(userMsg); // Only send to user if not self-referral
          if (sellerMsg) ctx.reply(sellerMsg);
          // Notify company owner if available
          if (product && product.companyId) {
            const company = await companyService.getCompanyById(
              product.companyId
            );
            if (
              company &&
              company.telegramId &&
              company.telegramId !== ctx.from.id
            ) {
              ctx.telegram.sendMessage(company.telegramId, companyMsg);
            }
          }
          // Do NOT call processSale. Instead, prompt for a valid code or 'no'.
          ctx.session.sellStep = "referral_code";
          ctx.reply(
            "Please enter a valid referral code, or type 'no' to continue without a code:"
          );
          return;
        }
        await this.processSale(
          ctx,
          product,
          ctx.session.sellQuantity,
          referralForSale,
          ctx.session.sellBuyerId
        );
        ctx.session.sellStep = null;
        ctx.session.sellProductId = null;
        ctx.session.sellQuantity = null;
        ctx.session.sellBuyerId = null;
        return;
      }
    } catch (error) {
      logger.error("Error in handleSellProductStep:", error);
      ctx.reply("❌ Failed to process sale.");
    }
  }

  async processSale(ctx, product, quantity, referral, buyerId) {
    try {
      const productService = require("../services/productService");
      const referralService = require("../services/referralService");
      const companyService = require("../services/companyService");
      // Reduce product quantity
      await productService.updateProductFirestore(product.id, {
        quantity: product.quantity - quantity,
      });
      let total = product.price * quantity;
      let referrerBonus = 0,
        buyerBonus = 0,
        newCode = null;
      // Fetch buyer and referrer usernames for receipt and notifications
      let buyerUsername =
        ctx.session && ctx.session.buyerUsername
          ? ctx.session.buyerUsername
          : null;
      let referrerUsername = null;
      try {
        const buyerDoc = await databaseService
          .users()
          .doc(buyerId.toString())
          .get();
        if (buyerDoc.exists && !buyerUsername)
          buyerUsername = buyerDoc.data().username || buyerId;
        if (referral && referral.referrerTelegramId) {
          const refDoc = await databaseService
            .users()
            .doc(referral.referrerTelegramId.toString())
            .get();
          if (refDoc.exists)
            referrerUsername =
              refDoc.data().username || referral.referrerTelegramId;
        }
      } catch (e) {
        /* ignore for now */
      }
      // Seller/owner gets a clear sale confirmation (always send to ctx.from.id)
      ctx.telegram.sendMessage(
        ctx.from.id,
        `✅ Sold ${quantity}x ${product.title} for $${total.toFixed(2)}.`
      );
      // Buyer message (send ONLY to buyerId)
      let buyerMsg = `🛒 *Thank you for your purchase!*\n\n`;
      buyerMsg += `• Product: ${product.title}\n`;
      buyerMsg += `• Quantity: ${quantity}\n`;
      buyerMsg += `• Total: $${total.toFixed(2)}\n`;
      buyerMsg += `• Seller: @${ctx.from.username || ctx.from.id}\n`;
      if (
        referral &&
        referral.referrerTelegramId &&
        referral.referrerTelegramId !== buyerId &&
        referral.referrerTelegramId !== null &&
        referral.referrerTelegramId !== undefined
      ) {
        referrerBonus = total * 0.02;
        buyerBonus = total * 0.01;
        await referralService.addReferralEarnings(
          referral.referrerTelegramId,
          referrerBonus
        );
        await referralService.addReferralEarnings(buyerId, buyerBonus);
        // Update buyer's balance
        const buyerRef = databaseService.users().doc(buyerId.toString());
        const buyerDoc = await buyerRef.get();
        let buyerBalance = 0;
        if (buyerDoc.exists) {
          const currentBalance = buyerDoc.data().coinBalance || 0;
          buyerBalance = currentBalance + buyerBonus;
          await buyerRef.update({ coinBalance: buyerBalance });
        }
        // Update referrer's balance for notification
        let referrerBalance = 0;
        if (referral.referrerTelegramId) {
          const refDoc = await databaseService
            .users()
            .doc(referral.referrerTelegramId.toString())
            .get();
          if (refDoc.exists)
            referrerBalance = (refDoc.data().coinBalance || 0) + referrerBonus;
        }
        // Notify the referrer with buyer info, bonus, and new balance
        ctx.telegram.sendMessage(
          referral.referrerTelegramId,
          `🎉 Your referral code was used by @${
            buyerUsername || buyerId
          }!\nYou earned a 2% reward: $${referrerBonus.toFixed(
            2
          )}.\nYour new balance: $${referrerBalance.toFixed(2)}.`
        );
        buyerMsg += `• Referral code used: ${referral.code} (by @${
          referrerUsername || referral.referrerTelegramId
        })\n`;
        buyerMsg += `• You received a $${buyerBonus.toFixed(
          2
        )} bonus for using a referral code!\n`;
        buyerMsg += `• Your new balance: $${buyerBalance.toFixed(2)}\n`;
      } else if (referral && referral.codeAttempted) {
        // If a code was attempted but invalid/expired/self-referral
        buyerMsg += `• Referral code used: Invalid, expired, or not allowed.\n`;
      } else {
        buyerMsg += `• Referral code used: None\n`;
      }
      // Debug log for seller and buyer IDs
      logger.info(
        `[processSale] Seller (ctx.from.id): ${ctx.from.id}, Buyer (buyerId): ${buyerId}`
      );
      // Only send buyerMsg to the buyer if they are not the seller
      if (buyerId && buyerId !== ctx.from.id) {
        try {
          logger.info(
            `[processSale] About to send thank you/receipt to buyerId=${buyerId}, message=${buyerMsg}`
          );
          await ctx.telegram.sendMessage(buyerId, buyerMsg, {
            parse_mode: "Markdown",
          });
          logger.info(
            `[processSale] Sent thank you/receipt to buyer ${buyerId}`
          );

          // Generate and send new referral code for the buyer
          if (product.companyId) {
            const newReferralCode = await referralService.generateReferralCode(
              product.companyId,
              buyerId
            );
            await ctx.telegram.sendMessage(
              buyerId,
              `🔗 Here is your new referral code: <code>${newReferralCode}</code>  (Click to copy)\nShare it with friends to earn rewards!`,
              {
                parse_mode: "HTML",
              }
            );
          }
        } catch (err) {
          logger.error(
            `[processSale] Failed to send thank you/receipt to buyer ${buyerId}: ${err.message}`
          );
          await ctx.telegram.sendMessage(
            ctx.from.id,
            `⚠️ Could not deliver the thank you/receipt message to the buyer (ID: ${buyerId}). They may not have started the bot or have blocked it.`
          );
        }
      }
      // Compose a business-like sale receipt for the seller
      const saleDate =
        new Date().toISOString().replace("T", " ").substring(0, 16) + " UTC";
      let sellerReceipt = `🧾 Sale Receipt\n\n`;
      sellerReceipt += `• Product: ${product.title}\n`;
      sellerReceipt += `• Quantity: ${quantity}\n`;
      sellerReceipt += `• Total: $${total.toFixed(2)}\n`;
      sellerReceipt += `• Buyer: @${buyerUsername || buyerId}\n`;
      if (
        referral &&
        referral.referrerTelegramId &&
        referral.referrerTelegramId !== buyerId
      ) {
        sellerReceipt += `• Referral code used: ${referral.code} (by @${
          referrerUsername || referral.referrerTelegramId
        })\n`;
        sellerReceipt += `• Buyer bonus: $${buyerBonus.toFixed(2)}\n`;
        sellerReceipt += `• Referrer bonus: $${referrerBonus.toFixed(2)}\n`;
      } else {
        sellerReceipt += `• Referral code used: None\n`;
      }
      sellerReceipt += `• Date: ${saleDate}`;
      ctx.telegram.sendMessage(ctx.from.id, sellerReceipt);
      await getNotificationServiceInstance().sendAdminActionNotification(
        "Product Sold",
        {
          product: product.title,
          quantity,
          buyer: buyerId,
          company: product.companyName || product.companyId,
          owner: product.creatorTelegramId,
          total: total,
          code:
            referral && typeof referral.code === "string"
              ? referral.code
              : typeof newCode === "string"
              ? newCode
              : "",
        }
      );
    } catch (error) {
      logger.error("Error in processSale:", error);
      ctx.reply("❌ Failed to complete sale.");
    }
  }

  async handleEditProductFieldInput(ctx) {
    try {
      const field = ctx.session.editProductStep;
      const productId = ctx.session.editProductId;
      const productService = require("../services/productService");
      if (!field || !productId) return ctx.reply("❌ Invalid edit session.");
      const value = ctx.message.text;
      const update = {};
      if (field === "price") {
        const price = parseFloat(value);
        if (isNaN(price) || price <= 0)
          return ctx.reply("❌ Please enter a valid price:");
        update.price = price;
      } else if (field === "quantity") {
        const qty = parseInt(value);
        if (isNaN(qty) || qty < 0)
          return ctx.reply(
            "❌ Please enter a valid non-negative number for quantity:"
          );
        update.quantity = qty;
      } else {
        update[field] = value;
      }
      await productService.updateProductFirestore(productId, update);
      ctx.reply("✅ Product updated successfully.");
      // Notify admins
      const updatedProduct = await productService.getProductById(productId);
      await getNotificationServiceInstance().sendAdminActionNotification(
        "Product Edited",
        {
          product: updatedProduct.title,
          company: updatedProduct.companyName || updatedProduct.companyId,
          editor: ctx.from.id,
          time: new Date().toISOString(),
          details: JSON.stringify(updatedProduct),
        }
      );
      // Show updated product details
      await this.handleProductActionMenu(ctx, productId);
    } catch (error) {
      logger.error("Error in handleEditProductFieldInput:", error);
      ctx.reply("❌ Failed to update product.");
    }
  }

  async handleEditProduct(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      const productService = require("../services/productService");
      const product = await productService.getProductById(productId);
      if (!product) return ctx.reply("❌ Product not found.");
      ctx.session.editProductId = productId;
      ctx.session.editProductStep = "title";
      ctx.session.editProductData = { ...product };
      ctx.reply(
        `📝 *Edit Product*\n\nCurrent Title: ${product.title}\n\nEnter new title or type 'skip' to keep unchanged:`,
        { parse_mode: "Markdown" }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in handleEditProduct:", error);
      ctx.reply("❌ Failed to load product for editing.");
    }
  }

  async handleDeleteProduct(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      const productService = require("../services/productService");
      const deletedProduct = await productService.getProductById(productId);
      await productService.deleteProductFirestore(productId);
      ctx.reply("🗑️ Product deleted successfully.");
      // Notify admins
      await getNotificationServiceInstance().sendAdminActionNotification(
        "Product Deleted",
        {
          product: deletedProduct.title,
          company: deletedProduct.companyName || deletedProduct.companyId,
          deleter: ctx.from.id,
          time: new Date().toISOString(),
          details: JSON.stringify(deletedProduct),
        }
      );
      // Refresh product list
      await this.handleMyProducts(ctx);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in handleDeleteProduct:", error);
      ctx.reply("❌ Failed to delete product.");
    }
  }

  async handleEditCompany(ctx) {
    try {
      const companyId = ctx.callbackQuery.data.split("_")[2];
      const companyService = require("../services/companyService");
      const company = await companyService.getCompanyById(companyId);
      if (!company) return ctx.reply("❌ Company not found.");
      ctx.session.editCompanyId = companyId;
      ctx.session.editCompanyStep = "name";
      ctx.session.editCompanyData = { ...company };
      ctx.reply(
        `📝 *Edit Company*\n\nCurrent Name: ${company.name}\n\nEnter new name or type 'skip' to keep unchanged:`,
        { parse_mode: "Markdown" }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in handleEditCompany:", error);
      ctx.reply("❌ Failed to load company for editing.");
    }
  }

  async handleDeleteCompany(ctx) {
    try {
      const companyId = ctx.callbackQuery.data.split("_")[2];
      const companyService = require("../services/companyService");
      await companyService.deleteCompany(companyId);
      ctx.reply("🗑️ Company deleted successfully.");
      // Refresh company list
      await this.handleMyCompanies(ctx);
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in handleDeleteCompany:", error);
      ctx.reply("❌ Failed to delete company.");
    }
  }

  async handleMyCompanies(ctx) {
    try {
      const telegramId = ctx.from.id;
      const companiesSnap =
        await require("../services/companyService").getCompaniesByOwner(
          telegramId
        );
      if (!companiesSnap || companiesSnap.length === 0) {
        return ctx.reply(
          '❌ You have not registered any companies yet. Use "Register Company" to add one.'
        );
      }
      const buttons = companiesSnap.map((company) => [
        require("telegraf").Markup.button.callback(
          `${company.name} (${company.status || ""})`,
          `company_action_${company.id}`
        ),
      ]);
      ctx.reply("🏢 *Your Companies*", {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard([
          ...buttons,
          [
            require("telegraf").Markup.button.callback(
              "🔙 Back to Main Menu",
              "main_menu"
            ),
          ],
        ]),
      });
    } catch (error) {
      logger.error("Error showing my companies:", error);
      ctx.reply("❌ Failed to load your companies.");
    }
  }

  async handleEditProductField(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[3];
      const productService = require("../services/productService");
      const product = await productService.getProductById(productId);
      if (!product) return ctx.reply("❌ Product not found.");
      ctx.session.editProductId = productId;
      ctx.session.editProductStep = null;
      ctx.session.editProductData = { ...product };
      const buttons = [
        [
          require("telegraf").Markup.button.callback(
            "Title",
            "edit_field_title"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Description",
            "edit_field_description"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Price",
            "edit_field_price"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Quantity",
            "edit_field_quantity"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Category",
            "edit_field_category"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "Status",
            "edit_field_status"
          ),
        ],
        [
          require("telegraf").Markup.button.callback(
            "🔙 Back",
            `product_action_${productId}`
          ),
        ],
      ];
      ctx.reply("Select the field you want to edit:", {
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in handleEditProductField:", error);
      ctx.reply("❌ Failed to load edit options.");
    }
  }

  async handleWithdrawCompany(ctx, companyId) {
    try {
      const telegramId = ctx.from.id;
      const stats =
        await require("../services/referralService").getUserReferralStats(
          telegramId
        );
      const minPayout = parseFloat(process.env.MIN_PAYOUT_AMOUNT || "10");
      const companyStats = stats.companyStats && stats.companyStats[companyId];
      if (!companyStats || companyStats.earnings < minPayout) {
        return ctx.reply(
          "❌ You are not eligible to withdraw from this company yet."
        );
      }
      // Create withdrawal request
      const withdrawal = {
        userId: telegramId,
        companyId,
        amount: companyStats.earnings,
        status: "pending",
        createdAt: new Date(),
      };
      const ref = await require("../config/database")
        .withdrawals()
        .add(withdrawal);
      // Notify company with referral history
      const company =
        await require("../services/companyService").getCompanyById(companyId);
      let historyMsg = `💸 *Withdrawal Request*\n\nUser: ${telegramId}\nAmount: $${companyStats.earnings.toFixed(
        2
      )}\n\n*Referral History:*\n`;
      // List referrals for this company
      if (companyStats.referrals && companyStats.referrals.length > 0) {
        companyStats.referrals.forEach((ref) => {
          historyMsg += `• $${ref.amount.toFixed(2)} — ${
            ref.product_title || ""
          } — ${
            ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : ""
          }\n`;
        });
      } else {
        historyMsg += "No detailed referral history.";
      }
      historyMsg += `\nApprove or deny this request:`;
      const approveBtn = require("telegraf").Markup.button.callback(
        "✅ Approve",
        `approve_withdrawal_${ref.id}`
      );
      const denyBtn = require("telegraf").Markup.button.callback(
        "❌ Deny",
        `deny_withdrawal_${ref.id}`
      );
      if (company && company.telegramId) {
        ctx.telegram.sendMessage(company.telegramId, historyMsg, {
          parse_mode: "Markdown",
          ...require("telegraf").Markup.inlineKeyboard([[approveBtn, denyBtn]]),
        });
      }
      ctx.reply("✅ Withdrawal request sent to the company for approval.");
    } catch (error) {
      logger.error("Error in handleWithdrawCompany:", error);
      ctx.reply("❌ Failed to request withdrawal.");
    }
  }

  async handleApproveWithdrawal(ctx, withdrawalId) {
    try {
      const db = require("../config/database");
      const withdrawalRef = db.withdrawals().doc(withdrawalId);
      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) return ctx.reply("❌ Withdrawal not found.");
      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "pending")
        return ctx.reply("❌ Withdrawal already processed.");
      await withdrawalRef.update({
        status: "approved",
        approvedAt: new Date(),
        approvedBy: ctx.from.id,
      });
      // Notify user
      ctx.telegram.sendMessage(
        withdrawal.userId,
        `✅ Your withdrawal request from company ${
          withdrawal.companyId
        } for $${withdrawal.amount.toFixed(2)} has been approved!`
      );
      ctx.reply("✅ Withdrawal approved and user notified.");
    } catch (error) {
      logger.error("Error in handleApproveWithdrawal:", error);
      ctx.reply("❌ Failed to approve withdrawal.");
    }
  }

  async handleDenyWithdrawal(ctx, withdrawalId) {
    try {
      const db = require("../config/database");
      const withdrawalRef = db.withdrawals().doc(withdrawalId);
      const withdrawalDoc = await withdrawalRef.get();
      if (!withdrawalDoc.exists) return ctx.reply("❌ Withdrawal not found.");
      const withdrawal = withdrawalDoc.data();
      if (withdrawal.status !== "pending")
        return ctx.reply("❌ Withdrawal already processed.");
      await withdrawalRef.update({
        status: "denied",
        deniedAt: new Date(),
        deniedBy: ctx.from.id,
      });
      // Notify user
      ctx.telegram.sendMessage(
        withdrawal.userId,
        `❌ Your withdrawal request from company ${
          withdrawal.companyId
        } for $${withdrawal.amount.toFixed(2)} was denied.`
      );
      ctx.reply("❌ Withdrawal denied and user notified.");
    } catch (error) {
      logger.error("Error in handleDenyWithdrawal:", error);
      ctx.reply("❌ Failed to deny withdrawal.");
    }
  }

  async handleEditProfile(ctx) {
    ctx.session.editProfileStep = "first_name";
    ctx.session.editProfileData = {};
    await ctx.reply("📝 Please enter your *first name*:", {
      parse_mode: "Markdown",
    });
  }

  async handleEditProfileStep(ctx) {
    if (!ctx.session.editProfileStep) return;
    const step = ctx.session.editProfileStep;
    const value = ctx.message.text && ctx.message.text.trim();
    if (!value) {
      await ctx.reply("❌ Please enter a valid value.");
      return;
    }
    if (step === "first_name") {
      ctx.session.editProfileData.firstName = value;
      ctx.session.editProfileStep = "last_name";
      await ctx.reply("Please enter your *last name*:", {
        parse_mode: "Markdown",
      });
      return;
    }
    if (step === "last_name") {
      ctx.session.editProfileData.lastName = value;
      ctx.session.editProfileStep = "username";
      await ctx.reply("Please enter your *Telegram username* (without @):", {
        parse_mode: "Markdown",
      });
      return;
    }
    if (step === "username") {
      ctx.session.editProfileData.username = value.replace(/^@/, "");
      ctx.session.editProfileStep = "phone";
      await ctx.reply("Please enter your *phone number* (with country code):", {
        parse_mode: "Markdown",
      });
      return;
    }
    if (step === "phone") {
      ctx.session.editProfileData.phoneNumber = value;
      // Save to database
      const userData = {
        telegramId: ctx.from.id,
        firstName: ctx.session.editProfileData.firstName,
        lastName: ctx.session.editProfileData.lastName,
        username: ctx.session.editProfileData.username,
        phoneNumber: ctx.session.editProfileData.phoneNumber,
      };
      await userService.userService.createOrUpdateUser(userData);
      await ctx.reply("✅ Your profile has been updated!");
      ctx.session.editProfileStep = null;
      ctx.session.editProfileData = null;
      // Optionally show updated profile
      return this.handleUserProfile(ctx);
    }
  }

  async handleCompanyReferralDetails(ctx, companyId) {
    const referralService = require("../services/referralService");
    const stats = await referralService.getUserReferralStats(ctx.from.id);
    const data = stats.companyStats && stats.companyStats[companyId];
    if (!data) {
      return ctx.reply("❌ No referral data found for this company.");
    }
    let msg = `🏢 *${data.companyName || companyId} Referral Details*\n\n`;
    msg += `Total Referrals: ${data.count}\n`;
    msg += `Total Earnings: $${data.earnings.toFixed(2)}\n`;
    if (!data.referrals || data.referrals.length === 0) {
      msg += "No detailed referral history.";
    } else {
      msg += `\n*Referrals:*\n`;
      data.referrals.forEach((ref, i) => {
        msg += `• $${ref.amount.toFixed(2)} — ${
          ref.product_title || "Product"
        } — ${
          ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : ""
        } (${ref.status})\n`;
      });
    }
    msg += `\n`;
    msg += `\nUse the Withdraw button in the previous menu if eligible.`;
    ctx.reply(msg, {
      parse_mode: "Markdown",
      ...require("telegraf").Markup.inlineKeyboard([
        [
          require("telegraf").Markup.button.callback(
            "🔙 Back to Referrals",
            "my_referrals"
          ),
        ],
      ]),
    });
  }
}

module.exports = new UserHandlers();

console.log("Exiting handlers/userHandlers.js");
