console.log("Entering handlers/userHandlers.js");
const { Markup } = require("telegraf");
console.log("Loaded telegraf in userHandlers");
const userService = require("../services/userService");
console.log("Loaded services/userService in userHandlers");
const productService = require("../services/productService");
console.log("Loaded services/productService in userHandlers");
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
const { getPlatformSettings } = require("../utils/helpers");

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
      let user;
      try {
        user = await userService.userService.getUserByTelegramId(ctx.from.id);
      } catch (err) {
        if (err.message === "User not found") {
          // Create the user if not found
          user = await userService.userService.createUser({
            telegramId: ctx.from.id,
            username: ctx.from.username || null,
            firstName: ctx.from.first_name || null,
            lastName: ctx.from.last_name || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          throw err;
        }
      }
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      // Use the already declared 'user' variable for all further logic
      if (user && user.banned) {
        return ctx.reply(t("msg_you_are_banned", {}, userLanguage || "en"));
      }
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
      user = await userService.userService.createOrUpdateUser(userData);
      console.log("[DEBUG] handleStart user:", user);
      logger.info(`[DEBUG] handleStart user: ${JSON.stringify(user)}`);

      // After fetching user, map phone_verified to phoneVerified for compatibility
      if (user.phone_verified && typeof user.phoneVerified === "undefined") {
        user.phoneVerified = user.phone_verified;
      }

      const isVerified = user.phoneVerified;
      const isAdmin = user.role === "admin" || user.isAdmin === true;
      const isCompany = user.isCompanyOwner === true || user.companyId;

      // Get user's language preference
      const userLanguage = user.language || "en";
      const { t } = require("../../utils/localize");

      const welcomeMessage =
        t("welcome", {}, userLanguage) +
        "\n\n" +
        t("start_instructions", {}, userLanguage);

      let buttons = [];
      if (user.canRegisterCompany) {
        buttons.push([
          Markup.button.callback(
            t("btn_register_company", {}, userLanguage),
            "register_company"
          ),
        ]);
        buttons.push([
          Markup.button.callback(
            t("btn_my_companies", {}, userLanguage),
            "my_companies"
          ),
        ]);
        buttons.push([
          Markup.button.callback(
            t("btn_my_products", {}, userLanguage),
            "my_products"
          ),
        ]);
      } else if (user.companyId || user.isCompanyOwner) {
        buttons.push([
          Markup.button.callback(
            t("btn_my_companies", {}, userLanguage),
            "my_companies"
          ),
        ]);
        buttons.push([
          Markup.button.callback(
            t("btn_my_products", {}, userLanguage),
            "my_products"
          ),
        ]);
      }
      // Always show My Referral Codes
      buttons.push([
        Markup.button.callback(
          t("btn_my_referral_codes", {}, userLanguage),
          "my_referral_codes"
        ),
      ]);
      // 2-column layout for main menu
      const mainRow1 = [
        Markup.button.callback(
          t("btn_browse_products", {}, userLanguage),
          "browse_products"
        ),
        Markup.button.callback(
          t("btn_my_referrals", {}, userLanguage),
          "my_referrals"
        ),
      ];
      // Only show Balance & Withdraw if user has balance > 0
      const mainRow2 =
        user.coinBalance > 0
          ? [
              Markup.button.callback(
                t("btn_balance_withdraw", {}, userLanguage),
                "balance_withdraw"
              ),
              Markup.button.callback(
                t("btn_leaderboard", {}, userLanguage),
                "leaderboard"
              ),
            ]
          : [
              Markup.button.callback(
                t("btn_leaderboard", {}, userLanguage),
                "leaderboard"
              ),
            ];
      const mainRow3 = [
        Markup.button.callback(
          t("btn_favorites", {}, userLanguage),
          "view_favorites"
        ),
        Markup.button.callback(t("btn_cart", {}, userLanguage), "view_cart"),
      ];
      const mainRow4 = [
        Markup.button.callback(
          t("btn_profile", {}, userLanguage),
          "user_profile"
        ),
        Markup.button.callback(t("btn_help", {}, userLanguage), "help"),
      ];
      // Add Language button
      const mainRow5 = [
        Markup.button.callback(
          t("btn_language", {}, userLanguage),
          "language_settings"
        ),
      ];
      // Add Community button (URL button)
      const mainRow6 = [
        Markup.button.url(
          t("btn_community", {}, userLanguage),
          "https://t.me/birrpayofficial"
        ),
      ];
      buttons.push(mainRow1, mainRow2, mainRow3, mainRow4, mainRow5, mainRow6);
      if (isAdmin) {
        buttons.push([
          Markup.button.callback(
            t("btn_admin_panel", {}, userLanguage),
            "admin_panel"
          ),
        ]);
      }
      if (!isVerified) {
        buttons.push([
          Markup.button.callback(
            t("btn_verify_phone", {}, userLanguage),
            "verify_phone"
          ),
        ]);
      }
      ctx.reply(welcomeMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in start handler:", error);
      ctx.reply(t("error_generic", {}, userLanguage || "en"));
    }
  }

  async handleBrowseProducts(ctx, pageArg) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    ctx.session = {}; // Reset session state
    const products = await productService.getAllActiveProductsWithCompany();
    logger.info(`[BrowseProducts] Found ${products.length} active products.`);

    if (products.length === 0) {
      ctx.reply(t("msg_no_products", {}, userLanguage || "en"));
      return;
    }

    const ITEMS_PER_PAGE = 5;
    let page = 1;
    if (typeof pageArg === "number") page = pageArg;
    else if (
      ctx.callbackQuery &&
      ctx.callbackQuery.data.startsWith("browse_products_page_")
    ) {
      page =
        parseInt(ctx.callbackQuery.data.replace("browse_products_page_", "")) ||
        1;
    }
    const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageProducts = products.slice(startIdx, endIdx);

    let message = t(
      "msg_available_products",
      { page, totalPages },
      userLanguage || "en"
    );
    const buttons = [];

    pageProducts.forEach((product, index) => {
      message += t(
        "msg_product_info",
        {
          index: startIdx + index + 1,
          title: product.title,
          price: Number(product.price) || 0,
          companyName:
            product.companyName || t("msg_unknown", {}, userLanguage),
          description: (product.description || "").substring(0, 50),
        },
        userLanguage || "en"
      );
      buttons.push([
        Markup.button.callback(
          `🛒 View ${product.title}`,
          `view_product_${product.id}`
        ),
      ]);
    });

    // Pagination controls
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback(
          t("btn_previous_page", {}, userLanguage || "en"),
          `browse_products_page_${page - 1}`
        )
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback(
          t("btn_next_page", {}, userLanguage || "en"),
          `browse_products_page_${page + 1}`
        )
      );
    if (navButtons.length) buttons.push(navButtons);
    buttons.push([
      Markup.button.callback(
        t("btn_back_to_menu", {}, userLanguage || "en"),
        "main_menu"
      ),
    ]);

    ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  async handleViewProduct(ctx, productIdArg) {
    try {
      // Immediately answer callback query to prevent timeout
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      let productId = productIdArg;
      if (!productId) {
        productId = ctx.callbackQuery.data;
        if (productId.startsWith("view_product_")) {
          productId = productId.replace("view_product_", "");
        }
      }

      logger.info(`[DEBUG] handleViewProduct: productId=${productId}`);

      // Get user language for localization
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      const userLanguage = user?.language || "en";

      const product = await productService.getProductById(productId);

      if (!product) {
        logger.error(
          `[DEBUG] handleViewProduct: Product not found for ID ${productId}`
        );
        await ctx.reply(t("msg_product_not_found", {}, userLanguage));
        return;
      }

      // Use the companyStatus from the joined product data
      if (product.companyStatus !== "active") {
        await ctx.reply(t("msg_company_inactive", {}, userLanguage));
        return;
      }

      // Human-friendly status label
      const statusLabels = {
        instock: t("msg_product_status_instock", {}, userLanguage),
        out_of_stock: t("msg_product_status_out_of_stock", {}, userLanguage),
        low_stock: t("msg_product_status_low_stock", {}, userLanguage),
      };
      const statusLabel =
        statusLabels[product.status] ||
        product.status ||
        t("msg_product_status_unknown", {}, userLanguage);

      // Fetch company details for display
      let companyDetails = "";
      try {
        const companyService = require("../services/companyService");
        const company = await companyService.getCompanyById(product.companyId);
        if (company) {
          companyDetails = `\n🏢 Company: ${
            company.name || t("msg_no_description", {}, userLanguage)
          }\n📍 Address: ${
            company.address || t("msg_no_description", {}, userLanguage)
          }\n📞 Phone: ${
            company.phone || t("msg_no_description", {}, userLanguage)
          }\n✉️ Email: ${
            company.email || t("msg_no_description", {}, userLanguage)
          }\n🌐 Website: ${
            company.website || t("msg_no_description", {}, userLanguage)
          }\n📌 Location: ${
            company.location || t("msg_no_description", {}, userLanguage)
          }\n`;
          if (company.ownerUsername) {
            companyDetails += `👤 Telegram: @${company.ownerUsername}\n`;
          }
        }
      } catch (e) {
        logger.error("Error fetching company details for product view:", e);
      }

      const productMessage =
        t(
          "msg_product_details",
          {
            title: product.title,
            price: Number(product.price) || 0,
            companyName:
              product.companyName || t("msg_unknown", {}, userLanguage),
            description:
              product.description || t("msg_no_description", {}, userLanguage),
          },
          userLanguage
        ) +
        `\n\n${companyDetails}\n\n${t(
          "msg_product_contact_owner",
          {},
          userLanguage
        )}`;

      // Fetch company to check ownership
      let isOwner = false;
      try {
        const companyService = require("../services/companyService");
        const company = await companyService.getCompanyById(product.companyId);
        if (company && company.telegramId === ctx.from.id) {
          isOwner = true;
        }
      } catch (e) {
        logger.error("Error checking company ownership:", e);
      }

      const buttons = [];
      if (isOwner) {
        buttons.push([
          Markup.button.callback(
            t("msg_product_sell", {}, userLanguage),
            `sell_product_${product.id}`
          ),
        ]);
        buttons.push([
          Markup.button.callback(
            t("msg_product_edit", {}, userLanguage),
            `edit_product_field_${product.id}`
          ),
          Markup.button.callback(
            t("msg_product_delete", {}, userLanguage),
            `delete_product_${product.id}`
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            t("msg_product_add_to_favorites", {}, userLanguage),
            `add_favorite_${product.id}`
          ),
          Markup.button.callback(
            t("msg_product_add_to_cart", {}, userLanguage),
            `add_cart_${product.id}`
          ),
        ]);
      }
      buttons.push([
        Markup.button.callback(
          t("btn_back_to_menu", {}, userLanguage),
          "main_menu"
        ),
      ]);

      await ctx.reply(productMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in handleViewProduct:", error);
      const userLanguage = "en"; // Fallback language
      await ctx.reply(t("msg_failed_load_products", {}, userLanguage));
    }
  }

  async handleReferralYes(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      ctx.session.purchaseProductId = productId;

      ctx.reply("🎯 Please enter your referral code:");
      ctx.session.waitingForReferralCode = true;
    } catch (error) {
      logger.error("Error handling referral yes:", error);
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
      ctx.reply(t("msg_failed_process_purchase", {}, userLanguage));
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
        return ctx.reply(t("msg_upload_proof", {}, userLanguage));
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
        return;
      }

      // Check if user is phone verified
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      if (!user.phoneVerified) {
        ctx.reply(
          "❌ Please verify your phone number first to become a referrer."
        );
        return;
      }

      const referralCode = await referralService.generateReferralCode(
        telegramId,
        companyId
      );

      const message = t(
        "msg_referral_code_generated",
        {
          code: referralCode,
          companyName: company.name,
        },
        userLanguage || "en"
      );

      const buttons = [
        [
          Markup.button.callback(
            t("btn_my_referral_stats", {}, userLanguage || "en"),
            "my_referrals"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_share_code", {}, userLanguage || "en"),
            `share_code_${referralCode}`
          ),
        ],
        [
          Markup.button.callback(
            t("btn_share_link", {}, userLanguage || "en"),
            `share_link_${companyId}_${referralCode}`
          ),
        ],
        [
          Markup.button.callback(
            t("btn_back_to_product", {}, userLanguage || "en"),
            `view_product_${ctx.session.lastProductId || "browse"}`
          ),
        ],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error generating referral code:", error);
      ctx.reply("❌ Failed to generate referral code. Please try again.");
    }
  }

  async handleMyReferrals(ctx, pageArg) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    ctx.session = {}; // Reset session state
    if (!ctx.from || !ctx.from.id) {
      ctx.reply(t("msg_failed_load_stats", {}, userLanguage || "en"));
      return;
    }

    const user = await userService.userService.getUserByTelegramId(ctx.from.id);
    const userLanguage = user?.language || "en";

    const referralService = require("../services/referralService");
    const stats = await referralService.getUserReferralStats(ctx.from.id);

    let msg = t(
      "msg_referral_statistics",
      {
        totalReferrals: stats.totalReferrals,
        verifiedReferrals: stats.verifiedReferrals || 0,
        totalRewards: stats.totalEarnings.toFixed(2),
        recentActivity:
          stats.recentActivity || t("msg_no_recent_activity", {}, userLanguage),
      },
      userLanguage
    );

    if (!stats.totalReferrals) {
      await ctx.reply(t("msg_no_referrals_yet", {}, userLanguage));
      return;
    }

    // Pagination for company list
    const minPayout = parseFloat(process.env.MIN_PAYOUT_AMOUNT || "10");
    const companyStats = stats.companyStats || {};
    const companyEntries = Object.entries(companyStats);
    const ITEMS_PER_PAGE = 5;
    let page = 1;
    if (typeof pageArg === "number") page = pageArg;
    else if (
      ctx.callbackQuery &&
      ctx.callbackQuery.data.startsWith("my_referrals_page_")
    ) {
      page =
        parseInt(ctx.callbackQuery.data.replace("my_referrals_page_", "")) || 1;
    }
    const totalPages = Math.ceil(companyEntries.length / ITEMS_PER_PAGE) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageCompanies = companyEntries.slice(startIdx, endIdx);

    let companyMsg = t(
      "msg_your_companies",
      { page, totalPages },
      userLanguage
    );
    const buttons = [];

    for (const [companyId, data] of pageCompanies) {
      companyMsg += t(
        "msg_company_stats_entry",
        {
          companyName: data.companyName || companyId,
          earnings: data.earnings.toFixed(2),
          count: data.count,
        },
        userLanguage
      );

      buttons.push([
        require("telegraf").Markup.button.callback(
          t(
            "btn_company_details",
            { companyName: data.companyName || companyId },
            userLanguage
          ),
          `ref_company_${companyId}`
        ),
      ]);

      if (data.earnings >= minPayout) {
        buttons.push([
          require("telegraf").Markup.button.callback(
            t(
              "btn_withdraw_from_company",
              {
                companyName: data.companyName || companyId,
                earnings: data.earnings.toFixed(2),
              },
              userLanguage
            ),
            `withdraw_company_${companyId}`
          ),
        ]);
      }
    }

    // Pagination controls
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        require("telegraf").Markup.button.callback(
          t("btn_previous_page", {}, userLanguage),
          `my_referrals_page_${page - 1}`
        )
      );
    if (page < totalPages)
      navButtons.push(
        require("telegraf").Markup.button.callback(
          t("btn_next_page", {}, userLanguage),
          `my_referrals_page_${page + 1}`
        )
      );
    if (navButtons.length) buttons.push(navButtons);
    buttons.push([
      require("telegraf").Markup.button.callback(
        t("btn_back_to_menu", {}, userLanguage),
        "main_menu"
      ),
    ]);
    ctx.reply(msg + companyMsg, {
      parse_mode: "Markdown",
      ...require("telegraf").Markup.inlineKeyboard(buttons),
    });
  }

  async handleLeaderboard(ctx, pageArg) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    try {
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      const userLanguage = user?.language || "en";

      const topReferrers = await referralService.getTopReferrers(100); // Fetch enough for pagination
      const ITEMS_PER_PAGE = 5;
      let page = 1;
      if (typeof pageArg === "number") page = pageArg;
      else if (
        ctx.callbackQuery &&
        ctx.callbackQuery.data.startsWith("leaderboard_page_")
      ) {
        page =
          parseInt(ctx.callbackQuery.data.replace("leaderboard_page_", "")) ||
          1;
      }
      const totalPages = Math.ceil(topReferrers.length / ITEMS_PER_PAGE) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIdx = (page - 1) * ITEMS_PER_PAGE;
      const endIdx = startIdx + ITEMS_PER_PAGE;
      const pageReferrers = topReferrers.slice(startIdx, endIdx);

      let message = t(
        "msg_leaderboard_title",
        { page, totalPages },
        userLanguage
      );

      if (!topReferrers || topReferrers.length === 0) {
        message += t("msg_no_leaderboard_data", {}, userLanguage);
      } else {
        pageReferrers.forEach((user, i) => {
          const displayName = user.username
            ? `@${user.username}`
            : user.firstName || t("msg_no_payment_details", {}, userLanguage);
          message += t(
            "msg_leaderboard_entry",
            {
              rank: startIdx + i + 1,
              name: displayName,
              score: user.totalReferrals,
            },
            userLanguage
          );
        });
      }

      const buttons = [];
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback(
            t("btn_previous_page", {}, userLanguage),
            `leaderboard_page_${page - 1}`
          )
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback(
            t("btn_next_page", {}, userLanguage),
            `leaderboard_page_${page + 1}`
          )
        );
      if (navButtons.length) buttons.push(navButtons);
      buttons.push([
        Markup.button.callback(
          t("btn_back_to_menu", {}, userLanguage),
          "main_menu"
        ),
      ]);

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing leaderboard:", error);
      ctx.reply(t("msg_failed_load_leaderboard", {}, userLanguage || "en"));
    }
  }

  async handleRequestPayout(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      const userLanguage = user.language || "en";

      const referralService = require("../services/referralService");
      const stats = await referralService.getUserReferralStats(telegramId);
      if (!stats.totalReferrals) {
        await ctx.reply(t("msg_no_referrals_yet", {}, userLanguage));
        return;
      }
      const balance = user.referralBalance || 0;
      const minPayout = parseFloat(process.env.MIN_PAYOUT_AMOUNT || "10");
      if (balance < minPayout) {
        ctx.reply(
          t(
            "msg_insufficient_balance",
            {
              minPayout,
              balance: balance.toFixed(2),
            },
            userLanguage
          )
        );
        return;
      }

      const message = t(
        "msg_payout_options",
        {
          balance: balance.toFixed(2),
          paymentMethod:
            user.paymentMethod || t("msg_not_set", {}, userLanguage),
        },
        userLanguage
      );

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
            t("btn_withdraw_all", { amount: balance.toFixed(2) }, userLanguage),
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
    } catch (error) {
      logger.error("Error requesting payout:", error);
      ctx.reply("❌ Failed to load payout options. Please try again.");
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
    } catch (error) {
      logger.error("Error processing payout:", error);
      ctx.reply(`❌ Payout failed: ${error.message}`);
    }
  }

  async handlePayoutCustom(ctx) {
    try {
      ctx.session.waitingForPayoutAmount = true;
      ctx.reply("💸 Please enter the amount you want to withdraw:");
    } catch (error) {
      logger.error("Error handling custom payout:", error);
    }
  }

  async handleCustomPayoutAmount(ctx) {
    try {
      if (!ctx.session.waitingForPayoutAmount) return;
      const amount = parseFloat(ctx.message.text);
      const telegramId = ctx.from.id;
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply(t("msg_enter_valid_amount", {}, userLanguage));
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
        [
          Markup.button.callback(
            t("btn_new_payout", {}, userLanguage),
            "request_payout"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_back_to_referrals", {}, userLanguage),
            "my_referrals"
          ),
        ],
      ];
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing payout history:", error);
      ctx.reply("❌ Failed to load payout history. Please try again.");
    }
  }

  async handleVerifyPhone(ctx) {
    try {
      // Prompt for phone number with reply keyboard
      await ctx.reply(t("msg_share_phone_number", {}, userLanguage), {
        reply_markup: {
          keyboard: [
            [
              {
                text: t("btn_share_phone", {}, userLanguage),
                request_contact: true,
              },
            ],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
    } catch (error) {
      logger.error("Error starting phone verification:", error);
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
      // Remove the reply keyboard after verification
      await ctx.reply(t("msg_phone_verified", {}, userLanguage), {
        reply_markup: { remove_keyboard: true },
      });
      // Show the main menu as an inline keyboard
      await this.handleStart(ctx);
    } catch (error) {
      logger.error("Error in handlePhoneContact:", error);
      ctx.reply("❌ Failed to verify phone.");
    }
  }

  async handleJoinCompany(ctx, companyId) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.getUserByTelegramId(telegramId);
      const userLanguage = user.language || "en";

      // Fetch company info (assume companyService.getCompanyById exists)
      const company =
        await require("../services/companyService").getCompanyById(companyId);
      logger.info(`[JoinCompany] Company: ${JSON.stringify(company)}`);
      if (!company)
        return ctx.reply(t("msg_company_not_found", {}, userLanguage));

      // Join company and get referral code
      const code = await userService.userService.joinCompany(
        telegramId,
        company
      );
      ctx.reply(
        t(
          "msg_joined_company",
          {
            companyName: company.name,
            code: code,
          },
          userLanguage
        )
      );
    } catch (error) {
      logger.error("Error joining company:", error);
      ctx.reply(t("msg_failed_join_company", {}, userLanguage || "en"));
    }
  }

  async handleUserProfile(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      const userLanguage = user.language || "en";

      if (user.phone_verified && !user.phoneVerified)
        user.phoneVerified = user.phone_verified;

      const message =
        t("msg_profile_title", {}, userLanguage) +
        t(
          "msg_profile_info",
          {
            name: `${user.firstName} ${user.lastName || ""}`,
            username: user.username || t("msg_not_set", {}, userLanguage),
            phone: user.phoneVerified
              ? t("msg_phone_verified", {}, userLanguage)
              : t("msg_phone_not_verified", {}, userLanguage),
            memberSince: toDateSafe(user.createdAt)?.toLocaleDateString(),
            companies: user.companies?.length || 0,
            balance: (user.referralBalance || 0).toFixed(2),
            referrals: user.totalReferrals || 0,
          },
          userLanguage
        );

      const buttons = [
        [
          Markup.button.callback(
            t("btn_edit_profile", {}, userLanguage),
            "edit_profile"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_back_to_menu", {}, userLanguage),
            "main_menu"
          ),
        ],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing user profile:", error);
      ctx.reply(t("msg_failed_load_profile", {}, userLanguage || "en"));
    }
  }

  async handleOrderHistory(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const user = await userService.getUserByTelegramId(telegramId);
      const userLanguage = user.language || "en";

      const orders = await orderService.getUserOrders(telegramId);

      let message = t("msg_order_history_title", {}, userLanguage);

      if (orders.length === 0) {
        message += t("msg_no_orders_yet", {}, userLanguage);
      } else {
        orders.forEach((order, index) => {
          const statusIcon =
            order.status === "approved"
              ? "✅"
              : order.status === "pending"
              ? "⏳"
              : "❌";

          message += t(
            "msg_order_entry",
            {
              index: index + 1,
              statusIcon,
              date: toDateSafe(order.createdAt)?.toLocaleDateString(),
              productTitle: order.productTitle,
              price: order.finalPrice || order.amount,
              companyName:
                order.company_name || t("msg_no_description", {}, userLanguage),
              referralCode: order.referralCode
                ? t("msg_used_code", { code: order.referralCode }, userLanguage)
                : "",
              rewardApplied:
                order.status === "approved"
                  ? t("msg_reward_applied", {}, userLanguage)
                  : "",
              proofUploaded: order.proofFileId
                ? t("msg_proof_uploaded", {}, userLanguage)
                : "",
            },
            userLanguage
          );
        });
      }

      const buttons = [
        [
          Markup.button.callback(
            t("btn_browse_products", {}, userLanguage),
            "browse_products"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_back_to_profile", {}, userLanguage),
            "user_profile"
          ),
        ],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing order history:", error);
      ctx.reply(t("msg_failed_load_orders", {}, userLanguage || "en"));
    }
  }

  async handleShareCode(ctx) {
    try {
      const referralCode = ctx.callbackQuery.data.split("_")[2];
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      const userLanguage = user?.language || "en";

      const shareMessage = t(
        "msg_share_code_message",
        {
          code: referralCode,
        },
        userLanguage
      );

      ctx.reply(
        t("msg_share_code_instructions", {}, userLanguage) + shareMessage,
        {
          parse_mode: "Markdown",
        }
      );
    } catch (error) {
      logger.error("Error sharing code:", error);
      ctx.reply(t("msg_failed_generate_share", {}, userLanguage || "en"));
    }
  }

  async handleHelp(ctx) {
    try {
      ctx.session = {}; // Reset session state
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      const userLanguage = user?.language || "en";

      const buttons = [
        [
          Markup.button.callback(
            t("btn_start_shopping", {}, userLanguage),
            "browse_products"
          ),
          Markup.button.callback(
            t("btn_my_referrals", {}, userLanguage),
            "my_referrals"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_fee_calculator", {}, userLanguage),
            "fee_calculator"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_back_to_menu", {}, userLanguage),
            "main_menu"
          ),
        ],
      ];

      ctx.reply(t("help", {}, userLanguage), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing help:", error);
      ctx.reply(t("msg_failed_load_help", {}, userLanguage || "en"));
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
          Markup.button.callback(t("btn_help", {}, userLanguage), "help"),
        ],
      ];

      ctx.reply(t("main_menu"), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing main menu:", error);
      ctx.reply("❌ Failed to load menu.");
    }
  }

  async handleBalance(ctx) {
    // Call handleMyReferrals with the same context
    return this.handleMyReferrals(ctx);
  }

  async handlePrivacy(ctx) {
    ctx.session = {}; // Reset session state
    const user = await userService.userService.getUserByTelegramId(ctx.from.id);
    const userLanguage = user?.language || "en";

    ctx.reply(t("msg_privacy_policy", {}, userLanguage), {
      parse_mode: "Markdown",
    });
  }

  async handleTerms(ctx) {
    ctx.session = {}; // Reset session state
    const user = await userService.userService.getUserByTelegramId(ctx.from.id);
    const userLanguage = user?.language || "en";

    ctx.reply(t("msg_terms_of_service", {}, userLanguage), {
      parse_mode: "Markdown",
    });
  }

  async handleCancel(ctx) {
    try {
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      const userLanguage = user?.language || "en";

      // Clear all session data
      ctx.session = {};

      ctx.reply(
        t("msg_operation_cancelled", {}, userLanguage),
        Markup.removeKeyboard()
      );
    } catch (error) {
      logger.error("Error in cancel handler:", error);
      ctx.reply(t("msg_operation_cancelled", {}, userLanguage || "en"));
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

Current Method: ${user.paymentMethod || t("msg_not_set", {}, userLanguage)}
${
  user.paymentDetails
    ? `Details: ${
        user.paymentDetails.accountNumber
          ? "****" + user.paymentDetails.accountNumber.slice(-4)
          : t("msg_configured", {}, userLanguage)
      }`
    : t("msg_no_payment_details", {}, userLanguage)
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
    } catch (error) {
      logger.error("Error showing payment settings:", error);
      ctx.reply("❌ Failed to load payment settings.");
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
    } catch (error) {
      logger.error("Error setting payment method:", error);
      ctx.reply("❌ Failed to set payment method.");
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
    } catch (error) {
      logger.error("Error showing notification settings:", error);
      ctx.reply("❌ Failed to load notification settings.");
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
    } catch (error) {
      logger.error("Error toggling notification:", error);
      ctx.reply("❌ Failed to update notification setting.");
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
    } catch (error) {
      logger.error("Error showing detailed referral stats:", error);
      ctx.reply("❌ Failed to load detailed stats. Please try again.");
    }
  }

  async handleRegisterCompany(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      const userLanguage = user.language || "en";

      if (!user.canRegisterCompany) {
        return ctx.reply(
          t("msg_not_eligible_register_company", {}, userLanguage)
        );
      }

      ctx.session.companyRegistrationStep = "name";
      ctx.session.companyRegistrationData = {};

      ctx.reply(t("msg_company_registration_agreement", {}, userLanguage), {
        parse_mode: "Markdown",
      });
      ctx.session.awaitingCompanyAgreement = true;
    } catch (error) {
      logger.error("Error starting company registration:", error);
      ctx.reply(t("msg_failed_start_registration", {}, userLanguage || "en"));
    }
  }

  async handleCompanyRegistrationStep(ctx) {
    console.log(
      "[DEBUG] handleCompanyRegistrationStep called:",
      ctx.message.text,
      JSON.stringify(ctx.session)
    );
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
        ctx.reply(t(ctx, "msg_enter_company_name"));
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
          ctx.reply(t(ctx, "msg_enter_company_description"));
          break;
        case "description":
          ctx.session.companyRegistrationData.description = text;
          ctx.session.companyRegistrationStep = "website";
          ctx.reply(t(ctx, "msg_enter_company_website"));
          break;
        case "website":
          ctx.session.companyRegistrationData.website =
            text === "skip" ? null : text;
          ctx.session.companyRegistrationStep = "phone";
          ctx.reply(t(ctx, "msg_enter_company_phone"));
          break;
        case "phone":
          ctx.session.companyRegistrationData.phone = text;
          ctx.session.companyRegistrationStep = "email";
          ctx.reply(t(ctx, "msg_enter_company_email"));
          break;
        case "email":
          if (!/^\S+@\S+\.\S+$/.test(text)) {
            return ctx.reply(t(ctx, "msg_enter_valid_email"));
          }
          ctx.session.companyRegistrationData.email = text;
          ctx.session.companyRegistrationStep = "address";
          ctx.reply(t(ctx, "msg_enter_company_address"));
          break;
        case "address":
          ctx.session.companyRegistrationData.address = text;
          ctx.session.companyRegistrationStep = "location";
          ctx.reply(t(ctx, "msg_enter_company_location"));
          break;
        case "location":
          ctx.session.companyRegistrationData.location = text;
          ctx.session.companyRegistrationStep = "offer";
          ctx.reply(t(ctx, "msg_enter_company_offer"));
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
          let companyIdRaw =
            await require("../services/companyService").createCompany(
              companyData
            );
          console.log(
            "[DEBUG] createCompany returned:",
            companyIdRaw,
            "type:",
            typeof companyIdRaw
          );
          let companyId = companyIdRaw;
          // Firestore DocumentReference or object with .id
          if (companyIdRaw && typeof companyIdRaw === "object") {
            if (companyIdRaw.id) companyId = companyIdRaw.id;
            else if (companyIdRaw._id) companyId = companyIdRaw._id;
            else if (
              companyIdRaw.path &&
              typeof companyIdRaw.path === "string"
            ) {
              // Firestore DocumentReference: path is like 'companies/abc123', extract last part
              const parts = companyIdRaw.path.split("/");
              companyId = parts[parts.length - 1];
            } else {
              companyId = String(companyIdRaw);
            }
          }

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
      ctx.reply(t("msg_agreement_accepted", {}, userLanguage));
      return this.handleCompanyRegistrationStep(ctx);
    } else {
      ctx.reply(t("msg_must_accept_agreement", {}, userLanguage));
    }
  }

  async handleCompanyActionMenu(ctx, companyId) {
    try {
      console.log("[DEBUG] handleCompanyActionMenu companyId:", companyId);
      const companyService = require("../services/companyService");
      const company = await companyService.getCompanyById(companyId);
      console.log("[DEBUG] handleCompanyActionMenu company:", company);
      if (!company) return ctx.reply("❌ Company not found.");
      let msg = `🏢 *Manage Company*\n\n`;
      msg += `*Name:* ${company.name}\n`;
      msg += `*Description:* ${
        company.description || t("msg_no_description", {}, userLanguage)
      }\n`;
      msg += `*Website:* ${
        company.website || t("msg_no_description", {}, userLanguage)
      }\n`;
      msg += `*Phone:* ${
        company.phone || t("msg_no_description", {}, userLanguage)
      }\n`;
      msg += `*Email:* ${
        company.email || t("msg_no_description", {}, userLanguage)
      }\n`;
      msg += `*Address:* ${
        company.address || t("msg_no_description", {}, userLanguage)
      }\n`;
      msg += `*Location:* ${
        company.location || t("msg_no_description", {}, userLanguage)
      }\n`;
      msg += `*Offer:* ${
        company.offer || t("msg_no_description", {}, userLanguage)
      }\n`;
      msg += `*Status:* ${
        company.status || t("msg_no_description", {}, userLanguage)
      }\n`;
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
      ctx.reply(t("msg_select_field_edit", {}, userLanguage), {
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
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
      ctx.reply(t("msg_failed_update_company", {}, userLanguage));
    }
  }

  async handleAddProductStart(ctx, companyId) {
    logger.info(
      `[DEBUG] handleAddProductStart: companyId=`,
      companyId,
      typeof companyId
    );
    // Ensure companyId is a string
    if (companyId && typeof companyId === "object" && companyId.id)
      companyId = companyId.id;
    ctx.session.addProductStep = "title";
    ctx.session.addProductData = { companyId: String(companyId) };
    ctx.reply(t("msg_enter_product_title", {}, userLanguage), {
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
          ctx.reply(t("msg_enter_product_description", {}, userLanguage));
          break;
        case "description":
          ctx.session.addProductData.description = text;
          ctx.session.addProductStep = "price";
          ctx.reply(t("msg_enter_product_price", {}, userLanguage));
          break;
        case "price":
          ctx.session.addProductData.price = parseFloat(text);
          ctx.session.addProductStep = "quantity";
          ctx.reply(t("msg_enter_product_quantity", {}, userLanguage));
          break;
        case "quantity":
          const qty = parseInt(text);
          if (isNaN(qty) || qty < 0) {
            ctx.reply(t("msg_invalid_quantity", {}, userLanguage));
            return;
          }
          ctx.session.addProductData.quantity = qty;
          ctx.session.addProductStep = "category";
          ctx.reply(t("msg_enter_product_category", {}, userLanguage));
          break;
        case "category":
          ctx.session.addProductData.category = text;
          ctx.session.addProductStep = "status";
          ctx.reply("Enter product status (instock, out_of_stock, low_stock):");
          break;
        case "status":
          const validStatuses = ["instock", "out_of_stock", "low_stock"];
          if (!validStatuses.includes(text.trim().toLowerCase())) {
            ctx.reply(t("msg_invalid_status", {}, userLanguage));
            return;
          }
          ctx.session.addProductData.status = text.trim().toLowerCase();
          ctx.session.addProductStep = null;
          // Save product
          const productService = require("../services/productService");
          const productData = {
            ...ctx.session.addProductData,
            creatorTelegramId: ctx.from.id,
            createdAt: new Date(),
          };
          await productService.createProduct(productData, ctx.from.id);
          ctx.reply(t("msg_product_created", {}, userLanguage));
          ctx.session.addProductData = null;
          ctx.session.addProductStep = null;
          break;
        default:
          ctx.reply(t("msg_invalid_product_step", {}, userLanguage));
          ctx.session.addProductStep = null;
          ctx.session.addProductData = null;
      }
    } catch (error) {
      logger.error("Error in handleAddProductStep:", error);
      ctx.reply(t("msg_failed_add_product", {}, userLanguage));
    }
  }

  // Add to the class UserHandlers
  async handleFavoriteProduct(ctx) {
    const telegramId = ctx.from.id;
    const productId = ctx.callbackQuery.data.split("_")[2];
    await userService.userService.addFavorite(telegramId, productId);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(t("msg_added_to_favorites", {}, userLanguage));
      ctx.reply(t("msg_product_added_favorites", {}, userLanguage));
    } else {
      ctx.reply(t("msg_added_to_favorites", {}, userLanguage));
    }
    ctx.reply("⭐ Product favorite status updated.");
  }

  async handleAddToCart(ctx) {
    const telegramId = ctx.from.id;
    const productId = ctx.callbackQuery.data.split("_")[2];
    await userService.userService.addToCart(telegramId, productId);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(t("msg_added_to_cart", {}, userLanguage));
      ctx.reply(t("msg_product_added_cart", {}, userLanguage));
    } else {
      ctx.reply(t("msg_added_to_cart", {}, userLanguage));
    }
    ctx.reply(t("msg_product_added_cart", {}, userLanguage));
  }

  async handleRemoveFromCart(ctx) {
    const telegramId = ctx.from.id;
    const productId = ctx.callbackQuery.data.split("_")[2];
    await userService.userService.removeFromCart(telegramId, productId);
    ctx.reply(t("msg_removed_from_cart", {}, userLanguage));
    ctx.reply(t("msg_product_removed_cart", {}, userLanguage));
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
      return ctx.reply(t("msg_no_favorites_yet", {}, userLanguage));
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
    if (!cart.length) return ctx.reply(t("msg_cart_empty", {}, userLanguage));
    let msg = "🛒 *Your Cart*\n\n";
    cart.forEach((p, i) => {
      msg += `${i + 1}. ${p.title} ($${p.price})\n`;
    });
    ctx.reply(msg, { parse_mode: "Markdown" });
  }

  async handleFavorites(ctx, pageArg) {
    const userService = require("../services/userService");
    const productService = require("../services/productService");
    const { Markup } = require("telegraf");
    const ITEMS_PER_PAGE = 5;
    let page = 1;
    if (typeof pageArg === "number") page = pageArg;
    else if (
      ctx.callbackQuery &&
      ctx.callbackQuery.data.startsWith("favorites_page_")
    ) {
      page =
        parseInt(ctx.callbackQuery.data.replace("favorites_page_", ""), 10) ||
        1;
    }
    const favorites = await userService.userService.getFavorites(ctx.from.id);
    if (!favorites.length)
      return ctx.reply("⭐ You have no favorite products.");

    // Filter valid product IDs
    const validFavorites = [];
    for (const pid of favorites) {
      if (typeof pid !== "string" || pid.length < 10) continue;
      const product = await productService.getProductById(pid);
      if (product && product.title && product.price !== undefined) {
        validFavorites.push({ pid, product });
      }
    }
    if (!validFavorites.length) {
      return ctx.reply("⭐ You have no valid favorite products.");
    }
    const totalPages = Math.ceil(validFavorites.length / ITEMS_PER_PAGE);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageFavorites = validFavorites.slice(startIdx, endIdx);

    let msg = `⭐ *Your Favorite Products* (Page ${page}/${totalPages})\n\n`;
    const buttons = [];
    pageFavorites.forEach(({ pid, product }, idx) => {
      msg += `${startIdx + idx + 1}. ${product.title} ($${product.price})\n`;
      buttons.push([
        Markup.button.callback(
          `❌ Remove ${product.title}`,
          `remove_favorite_${pid}`
        ),
      ]);
    });
    // Pagination buttons
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Prev", `favorites_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("Next ➡️", `favorites_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);
    buttons.push([
      Markup.button.callback(
        t("btn_back_to_menu", {}, userLanguage),
        "main_menu"
      ),
    ]);
    ctx.reply(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  async handleAddFavorite(ctx, productId) {
    const userService = require("../services/userService");
    if (!productId)
      return ctx.reply(t("msg_no_product_specified", {}, userLanguage));
    await userService.userService.addFavorite(ctx.from.id, productId);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery("⭐ Added to favorites!");
      await ctx.reply(t("msg_product_added_favorites", {}, userLanguage));
    } else {
      ctx.reply(t("msg_product_added_favorites", {}, userLanguage));
    }
  }

  async handleRemoveFavorite(ctx, productId) {
    const userService = require("../services/userService");
    if (!productId) {
      if (ctx.callbackQuery) {
        productId = ctx.callbackQuery.data.replace("remove_favorite_", "");
      } else {
        productId = ctx.message.text.split(" ")[1];
      }
    }
    if (!productId)
      return ctx.reply(t("msg_usage_removefavorite", {}, userLanguage));
    await userService.userService.removeFavorite(ctx.from.id, productId);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery("❌ Removed from favorites!");
      await ctx.reply("❌ Product removed from your favorites!");
    } else {
      ctx.reply("❌ Product removed from your favorites!");
    }
  }

  async handleCart(ctx, pageArg) {
    const userService = require("../services/userService");
    const productService = require("../services/productService");
    const { Markup } = require("telegraf");
    const ITEMS_PER_PAGE = 5;
    let page = 1;
    if (typeof pageArg === "number") page = pageArg;
    else if (
      ctx.callbackQuery &&
      ctx.callbackQuery.data.startsWith("cart_page_")
    ) {
      page =
        parseInt(ctx.callbackQuery.data.replace("cart_page_", ""), 10) || 1;
    }
    const cart = await userService.userService.getCart(ctx.from.id);
    if (!cart.length) return ctx.reply("🛒 Your cart is empty.");
    // Filter valid product IDs
    const validCart = [];
    for (const pid of cart) {
      if (typeof pid !== "string" || pid === "cart" || pid.length < 10)
        continue;
      const product = await productService.getProductById(pid);
      if (product && product.title && product.price !== undefined) {
        validCart.push({ pid, product });
      }
    }
    if (!validCart.length) {
      return ctx.reply("🛒 You have no valid products in your cart.");
    }
    const totalPages = Math.ceil(validCart.length / ITEMS_PER_PAGE);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageCart = validCart.slice(startIdx, endIdx);

    let msg = `🛒 *Your Cart* (Page ${page}/${totalPages})\n\n`;
    const buttons = [];
    pageCart.forEach(({ pid, product }, idx) => {
      msg += `${startIdx + idx + 1}. ${product.title} ($${product.price})\n`;
      buttons.push([
        Markup.button.callback(
          `❌ Remove ${product.title}`,
          `remove_cart_${pid}`
        ),
      ]);
    });
    // Pagination buttons
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Prev", `cart_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("Next ➡️", `cart_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);
    buttons.push([
      Markup.button.callback(
        t("btn_back_to_menu", {}, userLanguage),
        "main_menu"
      ),
    ]);
    ctx.reply(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  async handleAddCart(ctx, productId) {
    const userService = require("../services/userService");
    if (!productId)
      return ctx.reply(t("msg_no_product_specified", {}, userLanguage));
    await userService.userService.addToCart(ctx.from.id, productId);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery("🛒 Added to cart!");
      await ctx.reply(t("msg_product_added_cart", {}, userLanguage));
    } else {
      ctx.reply(t("msg_product_added_cart", {}, userLanguage));
    }
  }

  async handleRemoveCart(ctx, productId) {
    const userService = require("../services/userService");
    if (!productId) {
      if (ctx.callbackQuery) {
        productId = ctx.callbackQuery.data.replace("remove_cart_", "");
      } else {
        productId = ctx.message.text.split(" ")[1];
      }
    }
    if (!productId)
      return ctx.reply(t("msg_usage_removecart", {}, userLanguage));
    await userService.userService.removeFromCart(ctx.from.id, productId);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery("❌ Removed from cart!");
      await ctx.reply("❌ Product removed from your cart!");
    } else {
      ctx.reply("❌ Product removed from your cart!");
    }
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

  async handleMyReferralCodes(ctx, pageArg) {
    try {
      const referralService = require("../services/referralService");
      const codes = await referralService.getUserReferralCodes(ctx.from.id);
      if (!codes.length)
        return ctx.reply(
          "❌ You have no referral codes yet. Make a purchase to get your first code!"
        );
      // Pagination
      const ITEMS_PER_PAGE = 5;
      let page = 1;
      if (typeof pageArg === "number") page = pageArg;
      else if (
        ctx.callbackQuery &&
        ctx.callbackQuery.data.startsWith("my_referral_codes_page_")
      ) {
        page =
          parseInt(
            ctx.callbackQuery.data.replace("my_referral_codes_page_", "")
          ) || 1;
      }
      const totalPages = Math.ceil(codes.length / ITEMS_PER_PAGE) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIdx = (page - 1) * ITEMS_PER_PAGE;
      const endIdx = startIdx + ITEMS_PER_PAGE;
      const pageCodes = codes.slice(startIdx, endIdx);
      let msg = `🎯 *Your Referral Codes* (Page ${page}/${totalPages})\n\n`;
      const buttons = [];
      pageCodes.forEach((code) => {
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
      // Pagination controls
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          require("telegraf").Markup.button.callback(
            "⬅️ Previous",
            `my_referral_codes_page_${page - 1}`
          )
        );
      if (page < totalPages)
        navButtons.push(
          require("telegraf").Markup.button.callback(
            "Next ➡️",
            `my_referral_codes_page_${page + 1}`
          )
        );
      if (navButtons.length) buttons.push(navButtons);
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in handleMyReferralCodes:", error);
      ctx.reply("❌ Failed to load your referral codes.");
    }
  }

  async handleMyProducts(ctx, pageArg) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      const userLanguage = user?.language || "en";

      // Get companies owned by the user
      const companies =
        await require("../services/companyService").getCompaniesByOwner(
          telegramId
        );
      if (!companies || companies.length === 0) {
        return await ctx.reply(
          t("msg_no_companies_or_products", {}, userLanguage)
        );
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
        return await ctx.reply(t("msg_no_products_yet", {}, userLanguage), {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                t("btn_back_to_menu", {}, userLanguage),
                "main_menu"
              ),
            ],
          ]),
        });
      }

      // Pagination
      const ITEMS_PER_PAGE = 5;
      let page = parseInt(pageArg) || 1;
      const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIdx = (page - 1) * ITEMS_PER_PAGE;
      const endIdx = startIdx + ITEMS_PER_PAGE;
      const pageProducts = allProducts.slice(startIdx, endIdx);

      // Show each product as a single clickable button
      const productButtons = pageProducts.map((product) => [
        Markup.button.callback(
          t("btn_view_product", { title: product.title }, userLanguage),
          `view_product_${product.id}`
        ),
      ]);

      // Pagination controls
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback(
            t("btn_previous_page", {}, userLanguage),
            `my_products_page_${page - 1}`
          )
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback(
            t("btn_next_page", {}, userLanguage),
            `my_products_page_${page + 1}`
          )
        );
      if (navButtons.length) productButtons.push(navButtons);
      productButtons.push([
        Markup.button.callback(
          t("btn_back_to_menu", {}, userLanguage),
          "main_menu"
        ),
      ]);

      await ctx.reply(
        t(
          "msg_my_products_title",
          {
            page: page,
            totalPages: totalPages,
          },
          userLanguage
        ),
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(productButtons),
        }
      );
    } catch (error) {
      logger.error("Error in handleMyProducts:", error);
      const userLanguage = "en"; // Fallback language
      await ctx.reply(t("msg_failed_load_products", {}, userLanguage));
    }
  }

  async handleProductActionMenu(ctx, productIdArg) {
    try {
      const productId =
        productIdArg ||
        (ctx.callbackQuery && ctx.callbackQuery.data.split("_")[2]);
      const productService = require("../services/productService");
      const product = await productService.getProductById(productId);
      if (!product)
        return ctx.reply(t("msg_product_not_found", {}, userLanguage));
      let msg = `🛠️ *Manage Product*\n\n`;
      msg += `*Title:* ${product.title}\n`;
      msg += `*Price:* $${product.price}\n`;
      msg += `*Description:* ${
        product.description || t("msg_no_description", {}, userLanguage)
      }\n`;
      msg += `*Quantity:* ${product.quantity}\n`;
      msg += `*Category:* ${
        product.category || t("msg_no_description", {}, userLanguage)
      }\n`;
      // Human-friendly status label
      const statusLabels = {
        instock: "In Stock",
        out_of_stock: "Out of Stock",
        low_stock: "Low Stock",
      };
      const statusLabel =
        statusLabels[product.status] ||
        product.status ||
        t("msg_unknown", {}, userLanguage);
      msg += `*Status:* ${statusLabel}\n`;
      msg += `*Company:* ${
        product.companyName || t("msg_no_description", {}, userLanguage)
      }\n`;
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
    } catch (error) {
      logger.error("Error in handleProductActionMenu:", error);
      ctx.reply(t("msg_failed_load_product_actions", {}, userLanguage));
    }
  }

  async handleSellProduct(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      const productService = require("../services/productService");
      const product = await productService.getProductById(productId);
      if (!product)
        return ctx.reply(t("msg_product_not_found", {}, userLanguage));
      if (product.quantity <= 0)
        return ctx.reply(t("msg_no_stock_available", {}, userLanguage));
      ctx.session.sellProductId = productId;
      ctx.session.sellStep = "buyer_username";
      ctx.reply(t("msg_enter_buyer_username", {}, userLanguage));
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
      if (!productId)
        return ctx.reply(
          t("msg_no_product_selected_for_sale", {}, userLanguage)
        );
      const product = await productService.getProductById(productId);
      if (!product)
        return ctx.reply(t("msg_product_not_found", {}, userLanguage));
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
          return ctx.reply(t("msg_enter_valid_quantity", {}, userLanguage));
        if (qty > product.quantity)
          return ctx.reply(t("msg_not_enough_stock", {}, userLanguage));
        ctx.session.sellQuantity = qty;
        ctx.session.sellStep = "referral";
        ctx.reply(t("msg_ask_referral_code", {}, userLanguage));
        return;
      }
      if (step === "referral") {
        const answer = ctx.message.text.trim().toLowerCase();
        if (answer === "yes") {
          ctx.session.sellStep = "referral_code";
          ctx.reply(t("msg_enter_referral_code", {}, userLanguage));
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
          ctx.reply(t("msg_answer_yes_no", {}, userLanguage));
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
      // Fetch dynamic platform settings
      const settings = await getPlatformSettings();
      const PLATFORM_FEE_PERCENT = settings.platformFeePercent;
      const REFERRAL_BONUS_PERCENT = settings.referralBonusPercent;
      const BUYER_BONUS_PERCENT = settings.buyerBonusPercent;
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
        referrerBonus = total * (REFERRAL_BONUS_PERCENT / 100);
        buyerBonus = total * (BUYER_BONUS_PERCENT / 100);
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
        // Create a referral record for the referrer (for multi-company withdrawal tracking)
        await referralService.createReferral({
          referrerTelegramId: referral.referrerTelegramId,
          userId: referral.referrerTelegramId,
          companyId: product.companyId,
          productId: product.id,
          product_title: product.title,
          amount: total,
          reward: referrerBonus,
          createdAt: new Date(),
          status: "paid",
          code: referral.code,
          buyerId: buyerId,
          quantity: quantity,
        });
        // Notify the referrer with buyer info, bonus, and new balance
        ctx.telegram.sendMessage(
          referral.referrerTelegramId,
          `🎉 Your referral code was used by @$${
            buyerUsername || buyerId
          }!\nYou earned a ${REFERRAL_BONUS_PERCENT}% reward: $${referrerBonus.toFixed(
            2
          )}.\nYour new balance: $${referrerBalance.toFixed(2)}.`
        );
        buyerMsg += `• Referral code used: ${referral.code} (by @$${
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
      // Save sale to sales collection (for analytics)
      await databaseService.getDb().collection("sales").add({
        productId: product.id,
        companyId: product.companyId,
        buyerId,
        sellerId: ctx.from.id,
        quantity,
        total,
        referrerBonus,
        buyerBonus,
        createdAt: new Date(),
      });
    } catch (error) {
      logger.error("Error in processSale:", error);
      ctx.reply("❌ Failed to process sale. Please try again.");
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
          return ctx.reply(t("msg_enter_valid_price", {}, userLanguage));
        update.price = price;
      } else if (field === "quantity") {
        const qty = parseInt(value);
        if (isNaN(qty) || qty < 0)
          return ctx.reply(t("msg_invalid_quantity", {}, userLanguage));
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
      if (!product)
        return ctx.reply(t("msg_product_not_found", {}, userLanguage));
      ctx.session.editProductId = productId;
      ctx.session.editProductStep = "title";
      ctx.session.editProductData = { ...product };
      ctx.reply(
        `📝 *Edit Product*\n\nCurrent Title: ${product.title}\n\nEnter new title or type 'skip' to keep unchanged:`,
        { parse_mode: "Markdown" }
      );
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
    } catch (error) {
      logger.error("Error in handleDeleteCompany:", error);
      ctx.reply("❌ Failed to delete company.");
    }
  }

  async handleMyCompanies(ctx, pageArg) {
    try {
      ctx.session = {}; // Reset session state
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );
      const userLanguage = user?.language || "en";

      const companies =
        await require("../services/companyService").getUserCompanies(
          telegramId
        );
      if (!companies || companies.length === 0) {
        await ctx.reply(t("msg_no_companies_yet", {}, userLanguage), {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                t("btn_register_company", {}, userLanguage),
                "register_company"
              ),
            ],
            [
              Markup.button.callback(
                t("btn_back_to_menu", {}, userLanguage),
                "main_menu"
              ),
            ],
          ]),
        });
        return;
      }
      const ITEMS_PER_PAGE = 5;
      const totalPages = Math.ceil(companies.length / ITEMS_PER_PAGE);
      let page = parseInt(pageArg) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIdx = (page - 1) * ITEMS_PER_PAGE;
      const endIdx = startIdx + ITEMS_PER_PAGE;
      const pageCompanies = companies.slice(startIdx, endIdx);

      // Show each company as a single clickable button
      const companyButtons = pageCompanies.map((company) => [
        Markup.button.callback(
          `${company.name}`,
          `company_action_${company.id}`
        ),
      ]);

      // Pagination controls
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          Markup.button.callback(
            t("btn_previous_page", {}, userLanguage),
            `my_companies_page_${page - 1}`
          )
        );
      if (page < totalPages)
        navButtons.push(
          Markup.button.callback(
            t("btn_next_page", {}, userLanguage),
            `my_companies_page_${page + 1}`
          )
        );
      if (navButtons.length) companyButtons.push(navButtons);
      companyButtons.push([
        Markup.button.callback(
          t("btn_back_to_menu", {}, userLanguage),
          "main_menu"
        ),
      ]);

      await ctx.reply(
        t(
          "msg_my_companies_title",
          {
            page: page,
            totalPages: totalPages,
          },
          userLanguage
        ),
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(companyButtons),
        }
      );
    } catch (error) {
      logger.error("Error in handleMyCompanies:", error);
      const userLanguage = "en"; // Fallback language
      await ctx.reply(t("msg_failed_load_companies", {}, userLanguage));
    }
  }

  async handleEditProductField(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[3];
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      const userLanguage = user?.language || "en";

      const productService = require("../services/productService");
      const product = await productService.getProductById(productId);
      if (!product)
        return ctx.reply(t("msg_product_not_found", {}, userLanguage));

      ctx.session.editProductId = productId;
      ctx.session.editProductStep = null;
      ctx.session.editProductData = { ...product };

      const buttons = [
        [
          Markup.button.callback(
            t("btn_edit_title", {}, userLanguage),
            "edit_field_title"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_edit_description", {}, userLanguage),
            "edit_field_description"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_edit_price", {}, userLanguage),
            "edit_field_price"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_edit_quantity", {}, userLanguage),
            "edit_field_quantity"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_edit_category", {}, userLanguage),
            "edit_field_category"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_edit_status", {}, userLanguage),
            "edit_field_status"
          ),
        ],
        [
          Markup.button.callback(
            t("btn_back", {}, userLanguage),
            `product_action_${productId}`
          ),
        ],
      ];

      ctx.reply(t("msg_select_field_to_edit", {}, userLanguage), {
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in handleEditProductField:", error);
      ctx.reply(t("msg_failed_load_product", {}, userLanguage || "en"));
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
        status: "company_pending", // Changed from 'pending' to 'company_pending' for proper approval flow
        createdAt: new Date(),
      };
      const ref = await require("../config/database")
        .withdrawals()
        .add(withdrawal);
      // Get user and company info for message
      const company =
        await require("../services/companyService").getCompanyById(companyId);
      const user =
        await require("../services/userService").userService.getUserByTelegramId(
          telegramId
        );
      const userDisplay = user.username
        ? `@${user.username}`
        : `${
            user.first_name ||
            user.firstName ||
            t("msg_no_payment_details", {}, userLanguage)
          } ${user.last_name || user.lastName || ""}`;
      let historyMsg = `💸 *Withdrawal Request*\n\n👤 User: ${userDisplay}\n🏢 Company: ${
        company?.name || companyId
      }\n💰 Amount: $${companyStats.earnings.toFixed(
        2
      )}\n\n*Referral History:*\n`;
      // List referrals for this company
      if (companyStats.referrals && companyStats.referrals.length > 0) {
        companyStats.referrals.forEach((ref) => {
          let createdAt = ref.createdAt;
          if (createdAt && createdAt.toDate) {
            createdAt = createdAt.toDate();
          } else if (
            typeof createdAt === "string" ||
            typeof createdAt === "number"
          ) {
            createdAt = new Date(createdAt);
          }
          let dateStr = t("msg_unknown", {}, userLanguage);
          if (createdAt instanceof Date && !isNaN(createdAt)) {
            dateStr = `${createdAt.toLocaleDateString()} (${createdAt.toLocaleTimeString()})`;
          }
          historyMsg += `• $${ref.amount.toFixed(2)} — ${
            ref.product_title || ""
          } — ${dateStr}\n`;
        });
      } else {
        historyMsg += t("msg_no_detailed_referral_history", {}, userLanguage);
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
      ctx.reply(
        "✅ Your withdrawal request has been sent for approval. You will be notified once it is processed."
      );
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
      const user =
        await require("../services/userService").userService.getUserByTelegramId(
          withdrawal.userId
        );
      const company =
        await require("../services/companyService").getCompanyById(
          withdrawal.companyId
        );
      const userDisplay = user.username
        ? `@${user.username}`
        : `${
            user.first_name ||
            user.firstName ||
            t("msg_no_payment_details", {}, userLanguage)
          } ${user.last_name || user.lastName || ""}`;
      ctx.telegram.sendMessage(
        withdrawal.userId,
        `✅ Your withdrawal request from *${
          company?.name || withdrawal.companyId
        }* for $${withdrawal.amount.toFixed(
          2
        )} has been *approved*!\n\nThank you for using our platform.`,
        { parse_mode: "Markdown" }
      );
      ctx.reply(`✅ Withdrawal approved and user (${userDisplay}) notified.`);
    } catch (error) {
      logger.error("Error in handleApproveWithdrawal:", error);
      ctx.reply("❌ Failed to approve withdrawal. Please try again.");
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
        status: "declined",
        declinedAt: new Date(),
        declinedBy: ctx.from.id,
      });
      // Notify user
      const user =
        await require("../services/userService").userService.getUserByTelegramId(
          withdrawal.userId
        );
      const company =
        await require("../services/companyService").getCompanyById(
          withdrawal.companyId
        );
      const userDisplay = user.username
        ? `@${user.username}`
        : `${
            user.first_name ||
            user.firstName ||
            t("msg_no_payment_details", {}, userLanguage)
          } ${user.last_name || user.lastName || ""}`;
      ctx.telegram.sendMessage(
        withdrawal.userId,
        `❌ Your withdrawal request from *${
          company?.name || withdrawal.companyId
        }* for $${withdrawal.amount.toFixed(
          2
        )} has been *declined*.\n\nIf you have questions, please contact support.`,
        { parse_mode: "Markdown" }
      );
      ctx.reply(`❌ Withdrawal declined and user (${userDisplay}) notified.`);
    } catch (error) {
      logger.error("Error in handleDenyWithdrawal:", error);
      ctx.reply("❌ Failed to decline withdrawal. Please try again.");
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
      await ctx.reply(t("msg_enter_valid_value", {}, userLanguage));
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
      await ctx.reply(t("msg_profile_updated", {}, userLanguage));
      ctx.session.editProfileStep = null;
      ctx.session.editProfileData = null;
      // Optionally show updated profile
      return this.handleUserProfile(ctx);
    }
  }

  async handleCompanyReferralDetails(ctx, companyId, pageArg) {
    const referralService = require("../services/referralService");
    const stats = await referralService.getUserReferralStats(ctx.from.id);
    const data = stats.companyStats && stats.companyStats[companyId];
    if (!data) {
      return ctx.reply(t("msg_no_referral_data", {}, userLanguage));
    }
    let msg = `🏢 *${data.companyName || companyId} Referral Details*\n\n`;
    msg += `Total Referrals: ${data.count}\n`;
    msg += `Total Earnings: $${data.earnings.toFixed(2)}\n`;
    const ITEMS_PER_PAGE = 5;
    let page = 1;
    if (typeof pageArg === "number") page = pageArg;
    else if (
      ctx.callbackQuery &&
      ctx.callbackQuery.data.startsWith("ref_company_") &&
      ctx.callbackQuery.data.includes("_page_")
    ) {
      const parts = ctx.callbackQuery.data.split("_page_");
      page = parseInt(parts[1]) || 1;
    }
    if (!data.referrals || data.referrals.length === 0) {
      msg += t("msg_no_detailed_referral_history", {}, userLanguage);
    } else {
      const totalPages = Math.ceil(data.referrals.length / ITEMS_PER_PAGE) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      msg += `\n*Referrals (Page ${page}/${totalPages}):*\n`;
      const startIdx = (page - 1) * ITEMS_PER_PAGE;
      const endIdx = startIdx + ITEMS_PER_PAGE;
      const pageReferrals = data.referrals.slice(startIdx, endIdx);
      pageReferrals.forEach((ref, i) => {
        let createdAt = ref.createdAt;
        if (createdAt && createdAt.toDate) {
          createdAt = createdAt.toDate();
        } else if (
          typeof createdAt === "string" ||
          typeof createdAt === "number"
        ) {
          createdAt = new Date(createdAt);
        }
        let dateStr = t("msg_unknown", {}, userLanguage);
        if (createdAt instanceof Date && !isNaN(createdAt)) {
          dateStr = `${createdAt.toLocaleDateString()} (${createdAt.toLocaleTimeString()})`;
        }
        // Human-friendly referral info: price, quantity, product, date/time, status (NO ID)
        const price = ref.amount
          ? `$${ref.amount.toFixed(2)}`
          : t("msg_no_description", {}, userLanguage);
        const qty = ref.quantity ? `Qty: ${ref.quantity}` : "";
        const product = ref.product_title || "Product";
        // Patch: If product looks like a UUID, show 'Product' instead
        const isUUID = /^[0-9a-fA-F-]{36}$/.test(product);
        msg += `• ${price} ${qty} — ${
          isUUID ? "Product" : product
        } — ${dateStr} ${ref.status ? `Status: ${ref.status}` : ""}\n`;
      });
      // Pagination buttons
      const navButtons = [];
      if (page > 1)
        navButtons.push(
          require("telegraf").Markup.button.callback(
            "⬅️ Previous",
            `ref_company_${companyId}_page_${page - 1}`
          )
        );
      if (page < totalPages)
        navButtons.push(
          require("telegraf").Markup.button.callback(
            "➡️ Next",
            `ref_company_${companyId}_page_${page + 1}`
          )
        );
      const buttons = [];
      if (navButtons.length) buttons.push(navButtons);
      buttons.push([
        require("telegraf").Markup.button.callback(
          t("btn_back_to_referrals", {}, userLanguage),
          "my_referrals"
        ),
      ]);
      return ctx.reply(msg, {
        parse_mode: "Markdown",
        ...require("telegraf").Markup.inlineKeyboard(buttons),
      });
    }
    msg += `\nUse the Withdraw button in the previous menu if eligible.`;
    ctx.reply(msg, {
      parse_mode: "Markdown",
      ...require("telegraf").Markup.inlineKeyboard([
        [
          require("telegraf").Markup.button.callback(
            t("btn_back_to_referrals", {}, userLanguage),
            "my_referrals"
          ),
        ],
      ]),
    });
  }

  async handleLanguageSettings(ctx) {
    try {
      const { t } = require("../../utils/localize");
      const user = await userService.userService.getUserByTelegramId(
        ctx.from.id
      );
      const currentLanguage = user.language || "en";

      const message = t("msg_language_settings", {}, currentLanguage);
      const buttons = [
        [
          Markup.button.callback("🇺🇸 English", "set_language_en"),
          Markup.button.callback("🇪🇹 አማርኛ", "set_language_am"),
        ],
        [
          Markup.button.callback(
            t("btn_back_to_menu", {}, currentLanguage),
            "main_menu"
          ),
        ],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in handleLanguageSettings:", error);
      ctx.reply("❌ Failed to load language settings. Please try again.");
    }
  }

  async handleSetLanguage(ctx, language) {
    try {
      const telegramId = ctx.from.id;
      await userService.userService.updateUser(telegramId, { language });

      const { t } = require("../../utils/localize");
      const message = t("msg_language_changed", {}, language);
      const buttons = [
        [
          Markup.button.callback(
            t("btn_back_to_menu", {}, language),
            "main_menu"
          ),
        ],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error in handleSetLanguage:", error);
      ctx.reply("❌ Failed to change language. Please try again.");
    }
  }
}

module.exports = new UserHandlers();

console.log("Exiting handlers/userHandlers.js");
