console.log("Top of companyHandlers.js");
console.log("Entering handlers/companyHandlers.js");
const { Markup } = require("telegraf");
console.log("After require telegraf");
const companyService = require("../services/companyService");
console.log("Loaded services/companyService in companyHandlers");
const productService = require("../services/productService");
console.log("Loaded services/productService in companyHandlers");
const referralService = require("../services/referralService");
console.log("After require referralService");
const logger = require("../../utils/logger");
console.log("After require logger");
const userService = require("../services/userService");
const notificationService = require("../services/notificationService");
const {
  getNotificationServiceInstance,
} = require("../services/notificationService");
const { t } = require("../../utils/localize");

function toDateSafe(x) {
  if (!x) return null;
  if (typeof x.toDate === "function") return x.toDate();
  if (typeof x === "string" || typeof x === "number") return new Date(x);
  return x instanceof Date ? x : null;
}

class CompanyHandlers {
  async handleCompanyRegistration(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user =
        await require("../services/userService").userService.getUserByTelegramId(
          telegramId
        );
      if (!user.canRegisterCompany && user.role !== "company_manager") {
        return ctx.reply(
          t(
            "msg__you_are_not_eligible_to_register_a_company_pl",
            {},
            userLanguage
          )
        );
      }
      // Check if already registered
      const existingCompany = await companyService.getCompanyByTelegramId(
        telegramId
      );
      if (existingCompany) {
        return ctx.reply(
          t(
            "msg__you_are_already_registered_as_a_company_use_c",
            {},
            userLanguage
          )
        );
      }
      ctx.session.registrationStep = "company_name";
      ctx.reply(
        t(
          "msg__company_registrationnnplease_enter_your_compa",
          {},
          userLanguage
        ),
        {
          parse_mode: "Markdown",
        }
      );
    } catch (error) {
      logger.error("Error in company registration:", error);
      ctx.reply(
        t("msg__registration_failed_please_try_again", {}, userLanguage)
      );
    }
  }

  async handleCompanyRegistrationStep(ctx) {
    try {
      const step = ctx.session.registrationStep;
      const text = ctx.message.text;
      const userLanguage =
        ctx.session?.language || ctx.from.language_code || "en";

      if (!ctx.session.companyData) {
        ctx.session.companyData = {};
      }

      switch (step) {
        case "company_name":
          ctx.session.companyData.name = text;
          ctx.session.registrationStep = "company_description";
          ctx.reply(t("msg_enter_company_description", {}, userLanguage));
          break;

        case "company_description":
          ctx.session.companyData.description = text;
          ctx.session.registrationStep = "company_website";
          ctx.reply(t("msg_enter_company_website", {}, userLanguage));
          break;

        case "company_website":
          ctx.session.companyData.website = text === "skip" ? null : text;
          ctx.session.registrationStep = "company_phone";
          ctx.reply(t("msg_enter_company_phone", {}, userLanguage));
          break;

        case "company_phone":
          ctx.session.companyData.phone = text;
          ctx.session.registrationStep = "commission_rate";
          ctx.reply(t("msg_enter_company_commission_rate", {}, userLanguage));
          break;

        case "commission_rate":
          const rate = parseFloat(text);
          if (isNaN(rate) || rate < 1 || rate > 50) {
            return ctx.reply(
              t("msg_enter_valid_commission_rate", {}, userLanguage)
            );
          }

          ctx.session.companyData.referrerCommissionRate = rate;

          // Show confirmation
          const confirmationMessage = `\n\ud83c\udfe2 *${t(
            "msg_company_registration_confirmation",
            {},
            userLanguage
          )}*\n\n\ud83d\udcdb ${t("msg_company_name", {}, userLanguage)}: ${
            ctx.session.companyData.name
          }\n\ud83d\udcdd ${t("msg_company_description", {}, userLanguage)}: ${
            ctx.session.companyData.description
          }\n\ud83c\udf10 ${t("msg_company_website", {}, userLanguage)}: ${
            ctx.session.companyData.website ||
            t("msg_not_set", {}, userLanguage)
          }\n\ud83d\udcde ${t("msg_company_phone", {}, userLanguage)}: ${
            ctx.session.companyData.phone
          }\n\ud83d\udcb0 ${t(
            "msg_company_commission_rate",
            {},
            userLanguage
          )}: ${rate}%\n\n${t("msg_is_information_correct", {}, userLanguage)}`;

          const buttons = [
            [
              Markup.button.callback(
                t("btn_confirm", {}, userLanguage),
                "confirm_company_registration"
              ),
            ],
            [
              Markup.button.callback(
                t("btn_cancel", {}, userLanguage),
                "cancel_company_registration"
              ),
            ],
          ];

          ctx.reply(confirmationMessage, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard(buttons),
          });
          break;
      }
    } catch (error) {
      logger.error("Error in registration step:", error);
      ctx.reply(
        t(
          "msg__registration_failed_please_try_again_with_reg",
          {},
          userLanguage
        )
      );
    }
  }

  async confirmCompanyRegistration(ctx) {
    try {
      const telegramId = ctx.from.id;
      const companyData = {
        ...ctx.session.companyData,
        telegramId,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
        status: "active", // Instantly active
        createdAt: new Date(),
      };
      // Register company in Firestore
      const company = await companyService.createCompany(companyData);
      // Clear session
      delete ctx.session.companyData;
      delete ctx.session.registrationStep;
      ctx.reply(
        t(
          "msg__company_registered_and_active_you_can_now_add",
          {},
          userLanguage
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
      await getNotificationServiceInstance().sendAdminActionNotification(
        "Company Registered",
        {
          company: companyData.name,
          owner: telegramId,
          time: new Date().toISOString(),
          details: JSON.stringify(companyData),
        }
      );
    } catch (error) {
      logger.error("Error confirming company registration:", error);
      ctx.reply(
        t("msg__registration_failed_please_try_again", {}, userLanguage)
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyDashboard(ctx) {
    try {
      ctx.session = {}; // Reset session
      const telegramId = ctx.from.id;
      const user = await userService.userService.getUserByTelegramId(
        telegramId
      );

      // Permission Check
      const canAccess =
        user.canRegisterCompany ||
        user.role === "admin" ||
        user.role === "company_manager";
      if (!canAccess) {
        return ctx.reply(
          "❌ You don't have permission to access this feature. Please register a company or contact an admin."
        );
      }

      // If admin, show list of all companies to manage
      if (user.role === "admin") {
        const allCompanies = await companyService.getAllCompanies();
        if (!allCompanies || allCompanies.length === 0) {
          return ctx.reply(
            t("msg_no_companies_found_in_the_system", {}, userLanguage)
          );
        }

        let message =
          "🏢 *Admin - Company Management*\n\nSelect a company to view its dashboard:\n\n";
        const buttons = allCompanies.map((comp) => {
          return [
            Markup.button.callback(comp.name, `admin_view_company_${comp.id}`),
          ];
        });

        buttons.push([
          Markup.button.callback("🔙 Back to Admin Panel", "admin_panel"),
        ]);

        return ctx.reply(message, {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        });
      }

      // If company owner, proceed to their dashboard
      const companies = await companyService.getCompaniesByOwner(telegramId);

      if (!companies || companies.length === 0) {
        return ctx.reply(
          "❌ You have not registered a company yet. Use the 'Register Company' button to start."
        );
      }

      const company = companies[0]; // Assuming one company per owner for now

      if (!company) {
        return ctx.reply(
          t(
            "msg__you_are_not_registered_as_a_company_use_regis",
            {},
            userLanguage
          )
        );
      }

      const dashboardMessage = `
🏢 *${company.name} Dashboard*

📊 Quick Stats:
• Products: ${company.totalProducts || 0}
• Active Referrers: ${company.activeReferrers || 0}
• Total Orders: ${company.totalOrders || 0}
• Balance: $${(company.billingBalance || 0).toFixed(2)}

What would you like to do?
      `;

      const buttons = [
        [
          Markup.button.callback(
            "📦 Manage Products",
            `manage_products_${company.id}`
          ),
          Markup.button.callback(
            "👥 Referrals",
            `company_referrals_${company.id}`
          ),
        ],
        [
          Markup.button.callback(
            "📊 Analytics",
            `company_analytics_${company.id}`
          ),
          Markup.button.callback(
            "⚙️ Settings",
            `company_settings_${company.id}`
          ),
        ],
        [
          Markup.button.callback(
            "💰 Withdrawal Requests",
            "company_withdrawal_requests"
          ),
        ],
      ];

      ctx.reply(dashboardMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing company dashboard:", error);
      ctx.reply(
        t("msg__failed_to_load_dashboard_please_try_again", {}, userLanguage)
      );
    }
  }

  async handleManageProducts(ctx) {
    try {
      const telegramId = ctx.from.id;
      const companyId =
        ctx.callbackQuery?.data.split("_")[2] ||
        (await companyService.getCompanyByTelegramId(telegramId))?.id;

      if (!companyId) {
        return ctx.reply(
          t(
            "msg_could_not_identify_the_company_please_go_back_",
            {},
            userLanguage
          )
        );
      }

      const products = await productService.getCompanyProducts(companyId);
      const company = await companyService.getCompanyById(companyId);

      let message = `📦 *Product Management for ${company.name}*\n\n`;
      if (products.length === 0) {
        message += "No products found. Add your first product!";
      } else {
        message += `You have ${products.length} product(s):\n\n`;
        products.forEach((product, index) => {
          message += `${index + 1}. ${product.title} - $${product.price}\n`;
        });
      }
      const buttons = [
        [Markup.button.callback("➕ Add Product", `add_product_${companyId}`)],
      ];
      products.forEach((product) => {
        buttons.push([
          Markup.button.callback(
            `📝 Edit: ${product.title}`,
            `edit_product_${product.id}`
          ),
          Markup.button.callback(
            `🗑️ Delete: ${product.title}`,
            `delete_product_${product.id}`
          ),
          Markup.button.callback(
            `💸 Sell: ${product.title}`,
            `sell_product_${product.id}`
          ),
          Markup.button.callback("✏️ Edit", `edit_product_${product.id}`),
          Markup.button.callback("📦 Archive", `archive_product_${product.id}`),
          Markup.button.callback("⭐ Feature", `feature_product_${product.id}`),
        ]);
      });
      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error managing products:", error);
      ctx.reply(
        t("msg__failed_to_load_products_please_try_again", {}, userLanguage)
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAddProduct(ctx) {
    try {
      const userLanguage =
        ctx.session?.language || ctx.from.language_code || "en";
      ctx.session.productCreation = {};
      ctx.session.productStep = "title";
      ctx.reply(t("msg_enter_product_name", {}, userLanguage), {
        parse_mode: "Markdown",
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting add product:", error);
      ctx.reply(t("msg__failed_to_start_product_creation", {}, userLanguage));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleProductCreationStep(ctx) {
    try {
      const step = ctx.session.productStep;
      const text = ctx.message.text;
      const userLanguage =
        ctx.session?.language || ctx.from.language_code || "en";

      if (!ctx.session.productCreation) {
        ctx.session.productCreation = {};
      }

      switch (step) {
        case "title":
          ctx.session.productCreation.title = text;
          ctx.session.productStep = "description";
          ctx.reply(t("msg_enter_product_description", {}, userLanguage));
          break;

        case "description":
          ctx.session.productCreation.description = text;
          ctx.session.productStep = "price";
          ctx.reply(t("msg_enter_product_price", {}, userLanguage));
          break;

        case "price":
          const price = parseFloat(text);
          if (isNaN(price) || price < 0) {
            return ctx.reply(t("msg_enter_valid_price", {}, userLanguage));
          }

          ctx.session.productCreation.price = price;
          ctx.session.productStep = "category";
          ctx.reply(t("msg_enter_product_category", {}, userLanguage));
          break;

        case "category":
          ctx.session.productCreation.category = text;

          // Show confirmation
          const product = ctx.session.productCreation;
          const confirmationMessage = `\n\ud83d\udce6 *${t(
            "msg_product_confirmation",
            {},
            userLanguage
          )}*\n\n\ud83d\udcdb ${t("msg_product_name", {}, userLanguage)}: ${
            product.title
          }\n\ud83d\udcdd ${t("msg_product_description", {}, userLanguage)}: ${
            product.description
          }\n\ud83d\udcb0 ${t("msg_product_price", {}, userLanguage)}: $${
            product.price
          }\n\ud83c\udff7\ufe0f ${t(
            "msg_product_category",
            {},
            userLanguage
          )}: ${product.category}\n\n${t(
            "msg_create_this_product",
            {},
            userLanguage
          )}`;
          const buttons = [
            [
              Markup.button.callback(
                t("btn_create_product", {}, userLanguage),
                "confirm_product_creation"
              ),
            ],
            [
              Markup.button.callback(
                t("btn_cancel", {}, userLanguage),
                "cancel_product_creation"
              ),
            ],
          ];
          ctx.reply(confirmationMessage, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard(buttons),
          });
          break;
      }
    } catch (error) {
      logger.error("Error in product creation step:", error);
      ctx.reply(
        t("msg__product_creation_failed_please_try_again", {}, userLanguage)
      );
    }
  }

  async confirmProductCreation(ctx) {
    try {
      const telegramId = ctx.from.id;
      const company = await companyService.getCompanyByTelegramId(telegramId);

      const productData = {
        ...ctx.session.productCreation,
        companyId: company.id,
      };

      const productId = await productService.createProduct(productData);

      // Clear session
      delete ctx.session.productCreation;
      delete ctx.session.productStep;

      ctx.reply(t("msg__product_created_successfully", {}, userLanguage));
      if (ctx.callbackQuery) ctx.answerCbQuery();
      await getNotificationServiceInstance().sendAdminActionNotification(
        "Product Added",
        {
          product: productData.title,
          company: company.name,
          owner: telegramId,
          time: new Date().toISOString(),
          details: JSON.stringify(productData),
        }
      );

      // Show updated product list
      this.handleManageProducts(ctx);
    } catch (error) {
      logger.error("Error confirming product creation:", error);
      ctx.reply(
        t("msg__product_creation_failed_please_try_again", {}, userLanguage)
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditProductSelect(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      const product = await productService.getProductById(productId);
      if (!product)
        return ctx.reply(t("msg__product_not_found", {}, userLanguage));
      ctx.session.editProductId = productId;
      ctx.session.editProductStep = "title";
      ctx.session.editProductData = { ...product };
      ctx.reply(
        t(
          "msg__edit_productnncurrent_title_producttitlennent",
          {},
          userLanguage
        ),
        { parse_mode: "Markdown" }
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error selecting product to edit:", error);
      ctx.reply(t("msg__failed_to_start_edit", {}, userLanguage));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditProductStep(ctx) {
    try {
      const step = ctx.session.editProductStep;
      const text = ctx.message.text;
      const userLanguage =
        ctx.session?.language || ctx.from.language_code || "en";
      if (!ctx.session.editProductData) return;
      switch (step) {
        case "title":
          if (text !== "skip") ctx.session.editProductData.title = text;
          ctx.session.editProductStep = "description";
          ctx.reply(
            t(
              "msg_current_description_ctxsessioneditproductdatad",
              {},
              userLanguage
            )
          );
          break;
        case "description":
          if (text !== "skip") ctx.session.editProductData.description = text;
          ctx.session.editProductStep = "price";
          ctx.reply(
            t(
              "msg_current_price_ctxsessioneditproductdatapricenn",
              {},
              userLanguage
            )
          );
          break;
        case "price":
          if (text !== "skip") {
            const price = parseFloat(text);
            if (isNaN(price) || price <= 0)
              return ctx.reply(
                t("msg__please_enter_a_valid_price", {}, userLanguage)
              );
            ctx.session.editProductData.price = price;
          }
          ctx.session.editProductStep = "category";
          ctx.reply(
            t(
              "msg_current_category_ctxsessioneditproductdatacate",
              {},
              userLanguage
            )
          );
          break;
        case "category":
          if (text !== "skip") ctx.session.editProductData.category = text;
          // Show confirmation
          const p = ctx.session.editProductData;
          ctx.reply(
            t(
              "msg_confirm_product_updatenntitle_ptitlendescripti",
              {},
              userLanguage
            ),
            { parse_mode: "Markdown" }
          );
          ctx.session.editProductStep = "confirm";
          break;
        case "confirm":
          if (text.toLowerCase() === "confirm") {
            await productService.updateProduct(
              ctx.session.editProductId,
              ctx.session.editProductData
            );
            ctx.reply(t("msg__product_updated_successfully", {}, userLanguage));
          } else {
            ctx.reply(t("msg__edit_cancelled", {}, userLanguage));
          }
          delete ctx.session.editProductId;
          delete ctx.session.editProductStep;
          delete ctx.session.editProductData;
          break;
      }
    } catch (error) {
      logger.error("Error editing product:", error);
      ctx.reply(
        t("msg__failed_to_edit_product_please_try_again", {}, userLanguage)
      );
    }
  }

  async handleDeleteProduct(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      ctx.session.deleteProductId = productId;
      ctx.reply(
        "⚠️ Are you sure you want to delete this product? Type 'delete' to confirm or 'cancel' to abort."
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting delete product:", error);
      ctx.reply(t("msg__failed_to_start_delete", {}, userLanguage));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleDeleteProductConfirm(ctx) {
    try {
      if (!ctx.session.deleteProductId) return;
      const text = ctx.message.text;
      if (text.toLowerCase() === "delete") {
        await productService.deleteProduct(ctx.session.deleteProductId);
        ctx.reply(t("msg__product_deleted_successfully", {}, userLanguage));
      } else {
        ctx.reply(t("msg__delete_cancelled", {}, userLanguage));
      }
      delete ctx.session.deleteProductId;
    } catch (error) {
      logger.error("Error confirming delete product:", error);
      ctx.reply(
        t("msg__failed_to_delete_product_please_try_again", {}, userLanguage)
      );
    }
  }

  async handleCompanyReferrals(ctx) {
    try {
      const companyId = ctx.callbackQuery.data.split("_")[2];
      const referralData = await companyService.getReferralData(companyId);

      const message = `
👥 *Referral Program Overview*

📊 Statistics:
• Total Referrers: ${referralData.totalReferrers}
• Total Orders: ${referralData.totalOrders}
• Total Revenue: $${referralData.totalRevenue.toFixed(2)}
• Commissions Paid: $${referralData.totalCommissions.toFixed(2)}

🏆 Top Referrers:
${referralData.topReferrers
  .slice(0, 5)
  .map(
    (ref, i) =>
      `${i + 1}. User ${ref.telegramId}: ${
        ref.referrals
      } orders, $${ref.revenue.toFixed(2)}`
  )
  .join("\n")}
      `;

      const buttons = [
        [
          Markup.button.callback(
            "📊 Detailed Analytics",
            `referral_analytics_${companyId}`
          ),
        ],
        [
          Markup.button.callback(
            "⚙️ Referral Settings",
            `referral_settings_${companyId}`
          ),
        ],
        [Markup.button.callback("🔙 Back to Dashboard", "company_dashboard")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing company referrals:", error);
      ctx.reply(
        t(
          "msg__failed_to_load_referral_data_please_try_again",
          {},
          userLanguage
        )
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyAnalytics(ctx) {
    try {
      const companyId = ctx.callbackQuery.data.split("_")[2];
      const summary = await companyService.getReferralSummary(companyId);

      const message = `
📊 *Analytics Dashboard*

📈 This Month:
• New Referrers: ${summary.thisMonth.newReferrers}
• Orders: ${summary.thisMonth.orders}
• Revenue: $${summary.thisMonth.revenue.toFixed(2)}
• Commissions: $${summary.thisMonth.commissions.toFixed(2)}

📊 Growth vs Last Month:
• Revenue: ${summary.growth.revenue > 0 ? "+" : ""}${summary.growth.revenue}%
• Referrers: ${summary.growth.referrers > 0 ? "+" : ""}${
        summary.growth.referrers
      }%

🎯 Key Metrics:
• Avg Order Value: $${summary.metrics.avgOrderValue}
• Conversion Rate: ${summary.metrics.conversionRate}%
• Customer Satisfaction: ${summary.metrics.satisfaction}/5

💰 Financial Overview:
• Total Revenue: $${summary.financial.totalRevenue.toFixed(2)}
• Total Commissions: $${summary.financial.totalCommissions.toFixed(2)}
• Platform Fees: $${summary.financial.platformFees.toFixed(2)}
• Net Profit: $${summary.financial.netProfit.toFixed(2)}
      `;

      const buttons = [
        [
          Markup.button.callback(
            "�� Detailed Reports",
            `detailed_reports_${companyId}`
          ),
        ],
        [Markup.button.callback("📈 Export Data", `export_data_${companyId}`)],
        [Markup.button.callback("🔙 Back to Dashboard", "company_dashboard")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing company analytics:", error);
      ctx.reply(
        t("msg__failed_to_load_analytics_please_try_again", {}, userLanguage)
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanySettings(ctx) {
    try {
      const companyId = ctx.callbackQuery.data.split("_")[2];
      const company = await companyService.getCompanyById(companyId);

      const message = `
⚙️ *Company Settings*

🏢 Company: ${company.name}
📝 Description: ${company.description}
🌐 Website: ${company.website || "Not set"}
📞 Phone: ${company.phone}
💰 Commission Rate: ${company.referrerCommissionRate}%
📧 Notifications: ${company.notifications ? "Enabled" : "Disabled"}
      `;

      const buttons = [
        [
          Markup.button.callback(
            "✏️ Edit Profile",
            `edit_company_profile_${companyId}`
          ),
        ],
        [
          Markup.button.callback(
            "💰 Commission Rate",
            `edit_commission_rate_${companyId}`
          ),
        ],
        [
          Markup.button.callback(
            "🔔 Notifications",
            `notification_settings_${companyId}`
          ),
        ],
        [Markup.button.callback("🔙 Back to Dashboard", "company_dashboard")],
      ];

      ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing company settings:", error);
      ctx.reply(
        t("msg__failed_to_load_settings_please_try_again", {}, userLanguage)
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditCompanyProfile(ctx) {
    try {
      const telegramId = ctx.from.id;
      const company = await companyService.getCompanyByTelegramId(telegramId);
      if (!company)
        return ctx.reply(t("msg__company_not_found", {}, userLanguage));
      ctx.session.editCompanyStep = "name";
      ctx.session.editCompanyData = { ...company };
      ctx.reply(
        t(
          "msg__edit_company_profilenncurrent_name_companynam",
          {},
          userLanguage
        ),
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      logger.error("Error starting company profile edit:", error);
      ctx.reply(t("msg__failed_to_start_profile_edit", {}, userLanguage));
    }
  }

  async handleEditCompanyProfileStep(ctx) {
    try {
      const step = ctx.session.editCompanyStep;
      const text = ctx.message.text;
      const userLanguage =
        ctx.session?.language || ctx.from.language_code || "en";
      if (!ctx.session.editCompanyData) return;
      switch (step) {
        case "name":
          if (text !== "skip") ctx.session.editCompanyData.name = text;
          ctx.session.editCompanyStep = "description";
          ctx.reply(
            t(
              "msg_current_description_ctxsessioneditcompanydatad",
              {},
              userLanguage
            )
          );
          break;
        case "description":
          if (text !== "skip") ctx.session.editCompanyData.description = text;
          ctx.session.editCompanyStep = "website";
          ctx.reply(
            t(
              "msg_current_website_ctxsessioneditcompanydatawebsi",
              {},
              userLanguage
            )
          );
          break;
        case "website":
          if (text !== "skip") ctx.session.editCompanyData.website = text;
          ctx.session.editCompanyStep = "phone";
          ctx.reply(
            t(
              "msg_current_phone_ctxsessioneditcompanydataphonenn",
              {},
              userLanguage
            )
          );
          break;
        case "phone":
          if (text !== "skip") ctx.session.editCompanyData.phone = text;
          ctx.session.editCompanyStep = "commission_rate";
          ctx.reply(
            t(
              "msg_current_commission_rate_ctxsessioneditcompanyd",
              {},
              userLanguage
            )
          );
          break;
        case "commission_rate":
          if (text !== "skip") {
            const rate = parseFloat(text);
            if (isNaN(rate) || rate < 1 || rate > 50)
              return ctx.reply(
                t(
                  "msg__please_enter_a_valid_commission_rate_150",
                  {},
                  userLanguage
                )
              );
            ctx.session.editCompanyData.referrerCommissionRate = rate;
          }
          // Show confirmation
          const c = ctx.session.editCompanyData;
          ctx.reply(
            t(
              "msg_confirm_company_profile_updatennname_cnamendes",
              {},
              userLanguage
            ),
            { parse_mode: "Markdown" }
          );
          ctx.session.editCompanyStep = "confirm";
          break;
        case "confirm":
          if (text.toLowerCase() === "confirm") {
            await companyService.updateCompany(
              ctx.session.editCompanyData.id,
              ctx.session.editCompanyData
            );
            ctx.reply(
              t("msg__company_profile_updated_successfully", {}, userLanguage)
            );
          } else {
            ctx.reply(t("msg__edit_cancelled", {}, userLanguage));
          }
          delete ctx.session.editCompanyStep;
          delete ctx.session.editCompanyData;
          break;
      }
    } catch (error) {
      logger.error("Error editing company profile:", error);
      ctx.reply(
        t(
          "msg__failed_to_edit_company_profile_please_try_aga",
          {},
          userLanguage
        )
      );
    }
  }

  // Cancel handlers
  async handleCancelCompanyRegistration(ctx) {
    delete ctx.session.companyData;
    delete ctx.session.registrationStep;
    ctx.reply(t("msg__company_registration_cancelled", {}, userLanguage));
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handleCancelProductCreation(ctx) {
    delete ctx.session.productCreation;
    delete ctx.session.productStep;
    ctx.reply(t("msg__product_creation_cancelled", {}, userLanguage));
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handleSellProductStart(ctx) {
    ctx.session.sellProductStep = "search";
    ctx.reply(
      t("msg__enter_product_name_or_keyword_to_search", {}, userLanguage)
    );
  }

  async handleSellProductStep(ctx) {
    try {
    const step = ctx.session.sellProductStep;
    const text = ctx.message.text;
    const userLanguage =
      ctx.session?.language || ctx.from.language_code || "en";

      if (!ctx.session.sellProductData) {
        ctx.session.sellProductData = {};
      }

    switch (step) {
      case "search":
        // Search products for this company
        const company = await companyService.getCompanyByTelegramId(
          ctx.from.id
        );
        const products = await companyService.getCompanyProducts(company.id);
        const matches = products.filter((p) =>
          p.title.toLowerCase().includes(text.toLowerCase())
        );
        if (!matches.length)
          return ctx.reply(
            t("msg__no_products_found_try_another_keyword", {}, userLanguage)
          );
        ctx.session.sellProductData.matches = matches;
        ctx.session.sellProductStep = "select";
        let msg = "Select a product to sell:\n";
        matches.forEach((p, i) => {
          msg += `${i + 1}. ${p.title} ($${p.price}) - Qty: ${
            p.quantity ?? "N/A"
          }\n`;
        });
        ctx.reply(msg + "\nSend the product number:");
        break;
      case "select":
        const idx = parseInt(text) - 1;
        const matchList = ctx.session.sellProductData.matches || [];
        if (isNaN(idx) || idx < 0 || idx >= matchList.length)
          return ctx.reply(t("msg__invalid_selection", {}, userLanguage));
        ctx.session.sellProductData.product = matchList[idx];
        ctx.session.sellProductStep = "buyer_username";
        ctx.reply(
          t("msg_enter_buyer_telegram_username_without_", {}, userLanguage)
        );
        break;
      case "buyer_username":
          // Validate username format
          if (!text.startsWith("@")) {
            return ctx.reply(
              t(
                "msg__please_enter_a_valid_username_starting_with",
            {},
            userLanguage
          )
        );
          }
          ctx.session.sellProductData.buyerUsername = text;
          ctx.session.sellProductStep = "quantity";
          ctx.reply(
            t("msg__please_enter_the_quantity_to_sell", {}, userLanguage)
          );
          break;

        case "quantity":
          const quantity = parseInt(text);
          if (isNaN(quantity) || quantity <= 0) {
            return ctx.reply(
              t("msg__please_enter_a_valid_quantity", {}, userLanguage)
            );
          }
          ctx.session.sellProductData.quantity = quantity;
          ctx.session.sellProductStep = "price";
          ctx.reply(t("msg__please_enter_the_sale_price", {}, userLanguage));
          break;

        case "price":
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) {
            return ctx.reply(
              t("msg__please_enter_a_valid_price", {}, userLanguage)
            );
          }
          ctx.session.sellProductData.price = price;

          // Calculate total
          const total =
            ctx.session.sellProductData.quantity *
            ctx.session.sellProductData.price;

        ctx.reply(
          t(
              "msg__sale_summary",
              {
                product: ctx.session.sellProductData.product.title,
                buyer: ctx.session.sellProductData.buyerUsername,
                quantity: ctx.session.sellProductData.quantity,
                price: ctx.session.sellProductData.price,
                total: total,
              },
            userLanguage
            ),
            {
              parse_mode: "Markdown",
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("✅ Confirm Sale", "confirm_sale")],
                [Markup.button.callback("❌ Cancel", "cancel_sale")],
              ]),
            }
          );
        break;

      default:
          ctx.reply(t("msg__invalid_step_please_try_again", {}, userLanguage));
          break;
      }
    } catch (error) {
      logger.error("Error in sell product step:", error);
      ctx.reply(
        t("msg__something_went_wrong_please_try_again", {}, userLanguage)
      );
    }
  }

  async handleSellProduct(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      ctx.session.sellProductId = productId;
      ctx.session.sellStep = "user";
      ctx.reply(
        t("msg_is_this_sale_with_a_referral_code_yesno", {}, userLanguage)
      );
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting sell flow:", error);
      ctx.reply(t("msg__failed_to_start_sell_flow", {}, userLanguage));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSellProductStep(ctx) {
    try {
      if (!ctx.session.sellProductId || !ctx.session.sellStep) return;
      const productId = ctx.session.sellProductId;
      const step = ctx.session.sellStep;
      const text = ctx.message.text.trim();
      const userLanguage =
        ctx.session?.language || ctx.from.language_code || "en";
      if (step === "user") {
        // Lookup user by Telegram ID or phone
        let user = null;
        if (/^\d{5,}$/.test(text)) {
          user = await userService.getUserByTelegramId(text);
        } else {
          user = await userService.getUserByPhone(text);
        }
        if (!user) {
          ctx.reply(
            t(
              "msg__user_not_found_enter_a_valid_telegram_id_or_p",
              {},
              userLanguage
            )
          );
          return;
        }
        ctx.session.sellUserId = user.telegramId;
        ctx.session.sellStep = "confirm";
        const product = await productService.getProductById(productId);
        ctx.reply(
          t(
            "msg_confirm_sale_of_producttitle_productprice_to_u",
            {},
            userLanguage
          ),
          { parse_mode: "Markdown" }
        );
        return;
      }
      if (step === "confirm") {
        if (text.toLowerCase() === "confirm") {
          // Create order for user
          const product = await productService.getProductById(productId);
          // Record the sale as a referral
          await referralService.createReferral({
            referrerTelegramId: null, // No referrer for direct sales
            buyerTelegramId: ctx.session.sellUserId,
            companyId: product.companyId,
            productId: productId,
            amount: product.price,
            referralCode: null,
            status: "completed",
          });
          ctx.reply(
            t("msg__sale_completed_and_user_notified", {}, userLanguage)
          );
          // Notify user
          await notificationService.sendNotification(
            ctx.session.sellUserId,
            `🎉 You have a new purchase: ${product.title}!`
          );
          // Notify admins
          const adminIds = await userService.getAdminTelegramIds();
          for (const adminId of adminIds) {
            await notificationService.sendNotification(
              adminId,
              `Company ${ctx.from.id} sold ${product.title} to user ${ctx.session.sellUserId}.`
            );
          }
        } else {
          ctx.reply(t("msg__sale_cancelled", {}, userLanguage));
        }
        delete ctx.session.sellProductId;
        delete ctx.session.sellStep;
        delete ctx.session.sellUserId;
      }
    } catch (error) {
      logger.error("Error in sell flow:", error);
      ctx.reply(t("msg__failed_to_complete_sale", {}, userLanguage));
    }
  }

  async handleCompanyWithdrawalRequests(ctx) {
    try {
      const telegramId = ctx.from.id;
      const userLanguage = ctx.session?.language || "en";

      // Get company owned by this user
      const company = await companyService.getCompanyByTelegramId(telegramId);
      if (!company) {
        return ctx.reply(
          t("msg__you_are_not_registered_as_a_company", {}, userLanguage)
        );
      }

      // Get pending withdrawal requests for this company
      const adminService = require("../services/adminService");
      const pendingWithdrawals =
        await adminService.getPendingCompanyWithdrawals();
      const companyWithdrawals = pendingWithdrawals.filter(
        (w) => w.companyId === company.id
      );

      if (companyWithdrawals.length === 0) {
        return ctx.reply(
          "💰 *Withdrawal Requests*\n\nNo pending withdrawal requests for your company.",
          {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "🔙 Back to Dashboard",
                  "company_dashboard"
                ),
              ],
            ]),
          }
        );
      }

      let msg = `💰 *Withdrawal Requests*\n\n`;
      const buttons = [];

      for (const withdrawal of companyWithdrawals) {
        const date = new Date(withdrawal.createdAt).toLocaleDateString();
        msg += `💰 *$${withdrawal.amount.toFixed(2)}*\n`;
        msg += `📝 Reason: ${withdrawal.reason}\n`;
        msg += `👤 Requested by: Admin ${withdrawal.requestedBy}\n`;
        msg += `📅 Date: ${date}\n\n`;

        buttons.push([
          Markup.button.callback(
            `✅ Approve $${withdrawal.amount.toFixed(2)}`,
            `company_approve_withdrawal_${withdrawal.id}`
          ),
        ]);

        buttons.push([
          Markup.button.callback(
            `❌ Deny $${withdrawal.amount.toFixed(2)}`,
            `company_deny_withdrawal_${withdrawal.id}`
          ),
        ]);
      }

      buttons.push([
        Markup.button.callback("🔙 Back to Dashboard", "company_dashboard"),
      ]);

      ctx.reply(msg, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(buttons),
      });

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error in company withdrawal requests:", error);
      ctx.reply("❌ Failed to load withdrawal requests.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyApproveWithdrawal(ctx, withdrawalId) {
    try {
      const telegramId = ctx.from.id;
      const userLanguage = ctx.session?.language || "en";

      // Get company owned by this user
      const company = await companyService.getCompanyByTelegramId(telegramId);
      if (!company) {
        return ctx.reply(
          t("msg__you_are_not_registered_as_a_company", {}, userLanguage)
        );
      }

      const adminService = require("../services/adminService");
      await adminService.companyApproveWithdrawal(withdrawalId, telegramId);

      ctx.reply(
        `✅ *Withdrawal Approved*\n\n` +
          `The withdrawal request has been approved and admins have been notified.`,
        {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🔙 Back to Requests",
                "company_withdrawal_requests"
              ),
            ],
          ]),
        }
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error approving company withdrawal:", error);
      ctx.reply("❌ Failed to approve withdrawal.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyDenyWithdrawal(ctx, withdrawalId) {
    try {
      const telegramId = ctx.from.id;
      const userLanguage = ctx.session?.language || "en";

      // Get company owned by this user
      const company = await companyService.getCompanyByTelegramId(telegramId);
      if (!company) {
        return ctx.reply(
          t("msg__you_are_not_registered_as_a_company", {}, userLanguage)
        );
      }

      ctx.session.denyWithdrawalId = withdrawalId;
      ctx.session.denyWithdrawalStep = "reason";

      ctx.reply(
        `❌ *Deny Withdrawal Request*\n\n` +
          `Please enter the reason for denying this withdrawal request:`,
        {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🔙 Back to Requests",
                "company_withdrawal_requests"
              ),
            ],
          ]),
        }
      );

      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error denying company withdrawal:", error);
      ctx.reply("❌ Failed to deny withdrawal.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleCompanyDenyWithdrawalReason(ctx) {
    try {
      const telegramId = ctx.from.id;
      const userLanguage = ctx.session?.language || "en";

      const reason = ctx.message.text;
      if (!reason || reason.trim().length < 3) {
        return ctx.reply(
          "❌ Please enter a valid reason (at least 3 characters)."
        );
      }

      const withdrawalId = ctx.session.denyWithdrawalId;

      const adminService = require("../services/adminService");
      await adminService.companyDenyWithdrawal(
        withdrawalId,
        telegramId,
        reason
      );

      // Clear session
      delete ctx.session.denyWithdrawalId;
      delete ctx.session.denyWithdrawalStep;

      ctx.reply(
        `❌ *Withdrawal Denied*\n\n` +
          `The withdrawal request has been denied.\n` +
          `Reason: ${reason}`,
        {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🔙 Back to Requests",
                "company_withdrawal_requests"
              ),
            ],
          ]),
        }
      );
    } catch (error) {
      logger.error("Error processing denial reason:", error);
      ctx.reply("❌ Failed to deny withdrawal.");
    }
  }
}

console.log("End of companyHandlers.js");
module.exports = new CompanyHandlers();
