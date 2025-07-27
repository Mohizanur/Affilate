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
      if (!user.canRegisterCompany) {
        return ctx.reply(
          "❌ You are not eligible to register a company. Please contact an admin to request access."
        );
      }
      // Check if already registered
      const existingCompany = await companyService.getCompanyByTelegramId(
        telegramId
      );
      if (existingCompany) {
        return ctx.reply(
          "✅ You are already registered as a company. Use /company_dashboard to access your dashboard."
        );
      }
      ctx.session.registrationStep = "company_name";
      ctx.reply(
        "🏢 *Company Registration*\n\nPlease enter your company name:",
        {
          parse_mode: "Markdown",
        }
      );
    } catch (error) {
      logger.error("Error in company registration:", error);
      ctx.reply("❌ Registration failed. Please try again.");
    }
  }

  async handleCompanyRegistrationStep(ctx) {
    try {
      const step = ctx.session.registrationStep;
      const text = ctx.message.text;

      if (!ctx.session.companyData) {
        ctx.session.companyData = {};
      }

      switch (step) {
        case "company_name":
          ctx.session.companyData.name = text;
          ctx.session.registrationStep = "company_description";
          ctx.reply("📝 Please provide a brief description of your company:");
          break;

        case "company_description":
          ctx.session.companyData.description = text;
          ctx.session.registrationStep = "company_website";
          ctx.reply("🌐 Please enter your company website (or type 'skip'):");
          break;

        case "company_website":
          ctx.session.companyData.website = text === "skip" ? null : text;
          ctx.session.registrationStep = "company_phone";
          ctx.reply("📞 Please enter your company phone number:");
          break;

        case "company_phone":
          ctx.session.companyData.phone = text;
          ctx.session.registrationStep = "commission_rate";
          ctx.reply(
            "💰 Please set your referrer commission rate (percentage, e.g., 10 for 10%):"
          );
          break;

        case "commission_rate":
          const rate = parseFloat(text);
          if (isNaN(rate) || rate < 1 || rate > 50) {
            return ctx.reply(
              "❌ Please enter a valid commission rate between 1% and 50%:"
            );
          }

          ctx.session.companyData.referrerCommissionRate = rate;

          // Show confirmation
          const confirmationMessage = `
🏢 *Company Registration Confirmation*

📛 Name: ${ctx.session.companyData.name}
📝 Description: ${ctx.session.companyData.description}
🌐 Website: ${ctx.session.companyData.website || "Not provided"}
📞 Phone: ${ctx.session.companyData.phone}
💰 Commission Rate: ${rate}%

Is this information correct?
          `;

          const buttons = [
            [
              Markup.button.callback(
                "✅ Confirm",
                "confirm_company_registration"
              ),
            ],
            [
              Markup.button.callback(
                "❌ Cancel",
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
        "❌ Registration failed. Please try again with /register_company"
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
        "🎉 Company registered and active! You can now add products and manage your dashboard."
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
      ctx.reply("❌ Registration failed. Please try again.");
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
      const canAccess = user.canRegisterCompany || user.role === "admin";
      if (!canAccess) {
        return ctx.reply(
          "❌ You don't have permission to access this feature. Please register a company or contact an admin."
        );
      }
      
      // If admin, show list of all companies to manage
      if (user.role === "admin") {
        const allCompanies = await companyService.getAllCompanies();
        if (!allCompanies || allCompanies.length === 0) {
          return ctx.reply("No companies found in the system.");
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
          "❌ You are not registered as a company. Use /register_company first."
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
      ];

      ctx.reply(dashboardMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error("Error showing company dashboard:", error);
      ctx.reply("❌ Failed to load dashboard. Please try again.");
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
          "Could not identify the company. Please go back to the dashboard."
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
      ctx.reply("❌ Failed to load products. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleAddProduct(ctx) {
    try {
      ctx.session.productCreation = {};
      ctx.session.productStep = "title";

      ctx.reply("📦 *Add New Product*\n\nPlease enter the product title:", {
        parse_mode: "Markdown",
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting add product:", error);
      ctx.reply("❌ Failed to start product creation.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleProductCreationStep(ctx) {
    try {
      const step = ctx.session.productStep;
      const text = ctx.message.text;

      if (!ctx.session.productCreation) {
        ctx.session.productCreation = {};
      }

      switch (step) {
        case "title":
          ctx.session.productCreation.title = text;
          ctx.session.productStep = "description";
          ctx.reply("📝 Please enter the product description:");
          break;

        case "description":
          ctx.session.productCreation.description = text;
          ctx.session.productStep = "price";
          ctx.reply(
            "💰 Please enter the product price (numbers only, e.g., 29.99):"
          );
          break;

        case "price":
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) {
            return ctx.reply("❌ Please enter a valid price (numbers only):");
          }

          ctx.session.productCreation.price = price;
          ctx.session.productStep = "category";
          ctx.reply("🏷️ Please enter the product category:");
          break;

        case "category":
          ctx.session.productCreation.category = text;

          // Show confirmation
          const product = ctx.session.productCreation;
          const confirmationMessage = `
📦 *Product Confirmation*

📛 Title: ${product.title}
📝 Description: ${product.description}
💰 Price: $${product.price}
🏷️ Category: ${product.category}

Create this product?
          `;

          const buttons = [
            [
              Markup.button.callback(
                "✅ Create Product",
                "confirm_product_creation"
              ),
            ],
            [Markup.button.callback("❌ Cancel", "cancel_product_creation")],
          ];

          ctx.reply(confirmationMessage, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard(buttons),
          });
          break;
      }
    } catch (error) {
      logger.error("Error in product creation step:", error);
      ctx.reply("❌ Product creation failed. Please try again.");
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

      ctx.reply("✅ Product created successfully!");
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
      ctx.reply("❌ Product creation failed. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditProductSelect(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
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
      logger.error("Error selecting product to edit:", error);
      ctx.reply("❌ Failed to start edit.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditProductStep(ctx) {
    try {
      const step = ctx.session.editProductStep;
      const text = ctx.message.text;
      if (!ctx.session.editProductData) return;
      switch (step) {
        case "title":
          if (text !== "skip") ctx.session.editProductData.title = text;
          ctx.session.editProductStep = "description";
          ctx.reply(
            `Current Description: ${ctx.session.editProductData.description}\n\nEnter new description or type 'skip':`
          );
          break;
        case "description":
          if (text !== "skip") ctx.session.editProductData.description = text;
          ctx.session.editProductStep = "price";
          ctx.reply(
            `Current Price: $${ctx.session.editProductData.price}\n\nEnter new price or type 'skip':`
          );
          break;
        case "price":
          if (text !== "skip") {
            const price = parseFloat(text);
            if (isNaN(price) || price <= 0)
              return ctx.reply("❌ Please enter a valid price:");
            ctx.session.editProductData.price = price;
          }
          ctx.session.editProductStep = "category";
          ctx.reply(
            `Current Category: ${ctx.session.editProductData.category}\n\nEnter new category or type 'skip':`
          );
          break;
        case "category":
          if (text !== "skip") ctx.session.editProductData.category = text;
          // Show confirmation
          const p = ctx.session.editProductData;
          ctx.reply(
            `*Confirm Product Update*\n\nTitle: ${p.title}\nDescription: ${p.description}\nPrice: $${p.price}\nCategory: ${p.category}\n\nType 'confirm' to save or 'cancel' to abort.`,
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
            ctx.reply("✅ Product updated successfully!");
          } else {
            ctx.reply("❌ Edit cancelled.");
          }
          delete ctx.session.editProductId;
          delete ctx.session.editProductStep;
          delete ctx.session.editProductData;
          break;
      }
    } catch (error) {
      logger.error("Error editing product:", error);
      ctx.reply("❌ Failed to edit product. Please try again.");
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
      ctx.reply("❌ Failed to start delete.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleDeleteProductConfirm(ctx) {
    try {
      if (!ctx.session.deleteProductId) return;
      const text = ctx.message.text;
      if (text.toLowerCase() === "delete") {
        await productService.deleteProduct(ctx.session.deleteProductId);
        ctx.reply("✅ Product deleted successfully!");
      } else {
        ctx.reply("❌ Delete cancelled.");
      }
      delete ctx.session.deleteProductId;
    } catch (error) {
      logger.error("Error confirming delete product:", error);
      ctx.reply("❌ Failed to delete product. Please try again.");
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
      ctx.reply("❌ Failed to load referral data. Please try again.");
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
      ctx.reply("❌ Failed to load analytics. Please try again.");
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
      ctx.reply("❌ Failed to load settings. Please try again.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleEditCompanyProfile(ctx) {
    try {
      const telegramId = ctx.from.id;
      const company = await companyService.getCompanyByTelegramId(telegramId);
      if (!company) return ctx.reply("❌ Company not found.");
      ctx.session.editCompanyStep = "name";
      ctx.session.editCompanyData = { ...company };
      ctx.reply(
        `🏢 *Edit Company Profile*\n\nCurrent Name: ${company.name}\n\nEnter new name or type 'skip' to keep unchanged:`,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      logger.error("Error starting company profile edit:", error);
      ctx.reply("❌ Failed to start profile edit.");
    }
  }

  async handleEditCompanyProfileStep(ctx) {
    try {
      const step = ctx.session.editCompanyStep;
      const text = ctx.message.text;
      if (!ctx.session.editCompanyData) return;
      switch (step) {
        case "name":
          if (text !== "skip") ctx.session.editCompanyData.name = text;
          ctx.session.editCompanyStep = "description";
          ctx.reply(
            `Current Description: ${ctx.session.editCompanyData.description}\n\nEnter new description or type 'skip':`
          );
          break;
        case "description":
          if (text !== "skip") ctx.session.editCompanyData.description = text;
          ctx.session.editCompanyStep = "website";
          ctx.reply(
            `Current Website: ${
              ctx.session.editCompanyData.website || "Not set"
            }\n\nEnter new website or type 'skip':`
          );
          break;
        case "website":
          if (text !== "skip") ctx.session.editCompanyData.website = text;
          ctx.session.editCompanyStep = "phone";
          ctx.reply(
            `Current Phone: ${ctx.session.editCompanyData.phone}\n\nEnter new phone or type 'skip':`
          );
          break;
        case "phone":
          if (text !== "skip") ctx.session.editCompanyData.phone = text;
          ctx.session.editCompanyStep = "commission_rate";
          ctx.reply(
            `Current Commission Rate: ${ctx.session.editCompanyData.referrerCommissionRate}%\n\nEnter new commission rate (1-50) or type 'skip':`
          );
          break;
        case "commission_rate":
          if (text !== "skip") {
            const rate = parseFloat(text);
            if (isNaN(rate) || rate < 1 || rate > 50)
              return ctx.reply(
                "❌ Please enter a valid commission rate (1-50):"
              );
            ctx.session.editCompanyData.referrerCommissionRate = rate;
          }
          // Show confirmation
          const c = ctx.session.editCompanyData;
          ctx.reply(
            `*Confirm Company Profile Update*\n\nName: ${c.name}\nDescription: ${c.description}\nWebsite: ${c.website}\nPhone: ${c.phone}\nCommission Rate: ${c.referrerCommissionRate}%\n\nType 'confirm' to save or 'cancel' to abort.`,
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
            ctx.reply("✅ Company profile updated successfully!");
          } else {
            ctx.reply("❌ Edit cancelled.");
          }
          delete ctx.session.editCompanyStep;
          delete ctx.session.editCompanyData;
          break;
      }
    } catch (error) {
      logger.error("Error editing company profile:", error);
      ctx.reply("❌ Failed to edit company profile. Please try again.");
    }
  }

  // Cancel handlers
  async handleCancelCompanyRegistration(ctx) {
    delete ctx.session.companyData;
    delete ctx.session.registrationStep;
    ctx.reply("❌ Company registration cancelled.");
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handleCancelProductCreation(ctx) {
    delete ctx.session.productCreation;
    delete ctx.session.productStep;
    ctx.reply("❌ Product creation cancelled.");
    if (ctx.callbackQuery) ctx.answerCbQuery();
  }

  async handleSellProductStart(ctx) {
    ctx.session.sellProductStep = "search";
    ctx.reply("🔎 Enter product name or keyword to search:");
  }

  async handleSellProductStep(ctx) {
    const step = ctx.session.sellProductStep;
    const text = ctx.message.text;
    if (!ctx.session.sellProductData) ctx.session.sellProductData = {};
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
          return ctx.reply("❌ No products found. Try another keyword.");
        ctx.session.sellProductData.matches = matches;
        ctx.session.sellProductStep = "select";
        let msg = "Select a product to sell:\n";
        matches.forEach((p, i) => {
          msg += `${i + 1}. ${p.title} ($${p.price})\n`;
        });
        ctx.reply(msg + "\nSend the product number:");
        break;
      case "select":
        const idx = parseInt(text) - 1;
        const matchList = ctx.session.sellProductData.matches || [];
        if (isNaN(idx) || idx < 0 || idx >= matchList.length)
          return ctx.reply("❌ Invalid selection.");
        ctx.session.sellProductData.product = matchList[idx];
        ctx.session.sellProductStep = "buyer_username";
        ctx.reply("Enter buyer Telegram username (without @):");
        break;
      case "buyer_username":
        ctx.session.sellProductData.buyerUsername = text.replace(/^@/, "");
        ctx.session.sellProductStep = "buyer_phone";
        ctx.reply("Enter buyer phone number:");
        break;
      case "buyer_phone":
        ctx.session.sellProductData.buyerPhone = text;
        ctx.session.sellProductStep = "confirm";
        const p = ctx.session.sellProductData.product;
        ctx.reply(
          `Confirm sale of ${p.title} ($${p.price}) to @${ctx.session.sellProductData.buyerUsername} (${ctx.session.sellProductData.buyerPhone})? Type "confirm" to proceed or "cancel" to abort.`
        );
        break;
      case "confirm":
        if (text.trim().toLowerCase() !== "confirm") {
          ctx.reply("❌ Sale cancelled.");
          ctx.session.sellProductStep = null;
          ctx.session.sellProductData = null;
          return;
        }
        // Generate unique referral code for buyer
        const companyId = ctx.session.sellProductData.product.companyId;
        const buyerUsername = ctx.session.sellProductData.buyerUsername;
        const buyerPhone = ctx.session.sellProductData.buyerPhone;
        const product = ctx.session.sellProductData.product;
        const referralService = require("../services/referralService");
        const userService = require("../services/userService");
        const buyer = await userService.getUserByUsername(
          buyerUsername,
          ctx.from
        );
        // Update user info if changed
        if (buyer && ctx.from) {
          const updates = {};
          if (
            ctx.from.username &&
            ctx.from.username.toLowerCase() !== buyer.username
          )
            updates.username = ctx.from.username.toLowerCase();
          if (
            ctx.from.first_name &&
            ctx.from.first_name !== buyer.firstName &&
            ctx.from.first_name !== buyer.first_name
          )
            updates.first_name = ctx.from.first_name;
          if (
            ctx.from.last_name &&
            ctx.from.last_name !== buyer.lastName &&
            ctx.from.last_name !== buyer.last_name
          )
            updates.last_name = ctx.from.last_name;
          if (Object.keys(updates).length > 0) {
            await userService.updateUser(buyer.telegramId, updates);
          }
        }
        const code = await referralService.generateReferralCode(
          companyId,
          buyer.telegramId
        );
        // Record the sale (order)
        await require("../services/orderService").createOrder({
          userId: buyer.telegramId,
          productId: product.id,
          companyId,
          amount: product.price,
          referralCode: null,
          customerInfo: { username: buyerUsername, phone: buyerPhone },
          status: "approved",
          createdAt: new Date(),
        });
        // Notify buyer
        ctx.telegram.sendMessage(
          buyer.telegramId,
          `🎉 You bought ${product.title} from ${company.name}! Your referral code: ${code}`
        );
        ctx.reply("✅ Sale recorded and referral code sent to buyer.");
        ctx.session.sellProductStep = null;
        ctx.session.sellProductData = null;
        break;
      default:
        ctx.reply("❌ Invalid step. Please start again.");
        ctx.session.sellProductStep = null;
        ctx.session.sellProductData = null;
    }
  }

  // Add handler for sell_product callback
  async handleSellProduct(ctx) {
    try {
      const productId = ctx.callbackQuery.data.split("_")[2];
      ctx.session.sellProductId = productId;
      ctx.session.sellStep = "user";
      ctx.reply("Is this sale with a referral code? (Yes/No):");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error starting sell flow:", error);
      ctx.reply("❌ Failed to start sell flow.");
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }

  async handleSellProductStep(ctx) {
    try {
      if (!ctx.session.sellProductId || !ctx.session.sellStep) return;
      const productId = ctx.session.sellProductId;
      const step = ctx.session.sellStep;
      const text = ctx.message.text.trim();
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
            "❌ User not found. Enter a valid Telegram ID or phone number:"
          );
          return;
        }
        ctx.session.sellUserId = user.telegramId;
        ctx.session.sellStep = "confirm";
        const product = await productService.getProductById(productId);
        ctx.reply(
          `Confirm sale of *${product.title}* ($${product.price}) to @${
            user.username || user.telegramId
          }?\nType 'confirm' to proceed or 'cancel' to abort.`,
          { parse_mode: "Markdown" }
        );
        return;
      }
      if (step === "confirm") {
        if (text.toLowerCase() === "confirm") {
          // Create order for user
          const product = await productService.getProductById(productId);
          const orderData = {
            userId: ctx.session.sellUserId,
            productId: productId,
            companyId: product.companyId,
            amount: product.price,
            referralCode: null,
            customerInfo: {},
          };
          await require("../services/orderService").createOrder(orderData);
          ctx.reply("✅ Sale completed and user notified!");
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
          ctx.reply("❌ Sale cancelled.");
        }
        delete ctx.session.sellProductId;
        delete ctx.session.sellStep;
        delete ctx.session.sellUserId;
      }
    } catch (error) {
      logger.error("Error in sell flow:", error);
      ctx.reply("❌ Failed to complete sale.");
    }
  }
}

console.log("End of companyHandlers.js");
module.exports = new CompanyHandlers();
