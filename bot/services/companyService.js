const databaseService = require("../config/database");
const cacheService = require("../config/cache");
const { v4: uuidv4 } = require("uuid");
const logger = require("../../utils/logger");
const { getNotificationServiceInstance } = require("./notificationService");
const validator = require("validator");

// Helper to generate a unique code prefix (2 uppercase letters)
function generateCodePrefix(name) {
  let prefix = (name || "")
    .replace(/[^A-Za-z]/g, "")
    .substring(0, 2)
    .toUpperCase();
  if (prefix.length < 2) {
    prefix = Math.random().toString(36).substr(2, 2).toUpperCase();
  }
  return prefix;
}

// Helper: Get company doc and data, throw if not found
async function _getCompanyOrThrow(companyId) {
  const companyDoc = await databaseService.companies().doc(companyId).get();
  if (!companyDoc.exists) throw new Error("Company not found");
  return { companyDoc, company: companyDoc.data() };
}

// Register a new company
async function registerCompany({
  name,
  description,
  offer = null,
  telegramId,
  email,
  phone,
}) {
  try {
    if (!name || !description || !telegramId)
      throw new Error("Name, description, and Telegram ID are required.");
    if (typeof telegramId !== "number")
      throw new Error("telegramId must be a number");
    if (email && !validator.isEmail(email))
      throw new Error("Invalid email format.");
    if (phone && !validator.isMobilePhone(phone + "", "any"))
      throw new Error("Invalid phone number format.");
    let codePrefix = generateCodePrefix(name);
    let exists = true;
    while (exists) {
      const snap = await databaseService
        .companies()
        .where("codePrefix", "==", codePrefix)
        .get();
      exists = !snap.empty;
      if (exists) codePrefix = generateCodePrefix(name + Math.random());
    }
    const companyId = Math.random().toString(36).substr(2, 8).toUpperCase();
    const companyData = {
      name,
      description,
      offer: offer || null,
      telegramId, // must be a number
      codePrefix,
      id: companyId,
      createdAt: new Date(),
      active: true,
      products: [],
      billingBalance: 0,
      settings: {},
      status: "active",
      email,
      phone,
    };
    await databaseService.companies().doc(companyId).set(companyData);
    logger.info(`Company registered: ${companyId}`);
    return companyData;
  } catch (error) {
    logger.error("Error registering company:", error);
    throw error;
  }
}

class CompanyService {
  async createCompany(companyData) {
    try {
      const userService = require("./userService").userService;
      const user = await userService.getUserByTelegramId(
        companyData.telegramId
      );
      if (!user.canRegisterCompany)
        throw new Error("User is not eligible to register a company.");
      if (
        !companyData.name ||
        !companyData.description ||
        !companyData.telegramId
      )
        throw new Error("Name, description, and Telegram ID are required.");
      if (typeof companyData.telegramId !== "number")
        throw new Error("telegramId must be a number");
      if (companyData.email && !validator.isEmail(companyData.email))
        throw new Error("Invalid email format.");
      if (
        companyData.phone &&
        !validator.isMobilePhone(companyData.phone + "", "any")
      )
        throw new Error("Invalid phone number format.");
      const companyId = uuidv4();
      const doc = {
        ...companyData,
        offer: companyData.offer || null,
        id: companyId,
        createdAt: new Date(),
        status: "active",
      };
      await databaseService.companies().doc(companyId).set(doc);
      await getNotificationServiceInstance().sendNotification(
        companyData.telegramId,
        "🏢 Company created and active!",
        { type: "company", action: "create", companyId }
      );
      logger.info(`Company created: ${companyId}`);
      return doc;
    } catch (error) {
      logger.error("Error creating company:", error);
      throw error;
    }
  }

  async getCompanyByTelegramId(telegramId) {
    try {
      const snap = await databaseService
        .companies()
        .where("telegramId", "==", telegramId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (error) {
      logger.error("Error getting company by telegram ID:", error);
      throw error;
    }
  }

  async getCompanyById(companyId) {
    try {
      // Check cache first
      const cached = cacheService.getCompany(companyId);
      if (cached) {
        return cached;
      }

      const doc = await databaseService.companies().doc(companyId).get();
      if (!doc.exists) return null;

      const companyData = { id: doc.id, ...doc.data() };
      // Cache the result
      cacheService.setCompany(companyId, companyData);
      return companyData;
    } catch (error) {
      logger.error("Error getting company by ID:", error);
      throw error;
    }
  }

  async getAllCompanies() {
    try {
      const snap = await databaseService
        .companies()
        .orderBy("createdAt", "desc")
        .get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error("Error getting all companies:", error);
      throw error;
    }
  }

  async getAllCompaniesForUser() {
    try {
      const snap = await databaseService
        .companies()
        .orderBy("createdAt", "desc")
        .get();
      return snap.docs.map((doc) => {
        const d = doc.data();
        let statusBadge = "";
        if (d.status === "approved" || d.status === "active")
          statusBadge = "✅ Active";
        else statusBadge = "";
        return { id: doc.id, ...d, statusBadge };
      });
    } catch (error) {
      logger.error("Error getting all companies for user:", error);
      throw error;
    }
  }

  async getCompaniesByCategory(category) {
    try {
      const snap = await databaseService
        .companies()
        .where("category", "==", category)
        .orderBy("createdAt", "desc")
        .get();
      return snap.docs.map((doc) => {
        const d = doc.data();
        let statusBadge = "";
        if (d.status === "approved" || d.status === "active")
          statusBadge = "✅ Active";
        else statusBadge = "";
        return { id: doc.id, ...d, statusBadge };
      });
    } catch (error) {
      logger.error("Error getting companies by category:", error);
      throw error;
    }
  }

  async updateCompany(companyId, updateData, updaterTelegramId) {
    try {
      const ref = databaseService.companies().doc(companyId);
      const docSnap = await ref.get();
      if (!docSnap.exists) throw new Error("Company not found");
      const company = docSnap.data();
      if (company.telegramId !== updaterTelegramId)
        throw new Error("Only the company owner can update this company.");
      if (updateData.email && !validator.isEmail(updateData.email))
        throw new Error("Invalid email format.");
      if (
        updateData.phone &&
        !validator.isMobilePhone(updateData.phone + "", "any")
      )
        throw new Error("Invalid phone number format.");
      await ref.update({ ...updateData, updatedAt: new Date() });
      const updatedDoc = await ref.get();
      if (!updatedDoc.exists) throw new Error("Company not found");
      await getNotificationServiceInstance().sendNotification(
        company.telegramId,
        "🏢 Company profile updated.",
        { type: "company", action: "update", companyId }
      );
      logger.info(`Company updated: ${companyId}`);
      return { id: updatedDoc.id, ...updatedDoc.data() };
    } catch (error) {
      logger.error("Error updating company:", error);
      throw error;
    }
  }

  async updateCommissionRate(companyId, commissionRate, adminTelegramId) {
    try {
      const ref = databaseService.companies().doc(companyId);
      const doc = await ref.get();
      if (!doc.exists) throw new Error("Company not found");
      const company = doc.data();
      if (company.telegramId !== adminTelegramId)
        throw new Error("Only the company owner can update commission rate.");
      await ref.update({ commissionRate, updatedAt: new Date() });
      const updatedDoc = await ref.get();
      if (!updatedDoc.exists) throw new Error("Company not found");
      await getNotificationServiceInstance().sendNotification(
        company.telegramId,
        `💸 Commission rate updated to: ${commissionRate}%`,
        { type: "company", action: "commission", companyId, commissionRate }
      );
      logger.info(
        `Commission rate updated: ${companyId} to ${commissionRate} by admin ${adminTelegramId}`
      );
      return { id: updatedDoc.id, ...updatedDoc.data() };
    } catch (error) {
      logger.error("Error updating commission rate:", error);
      throw error;
    }
  }

  async getCompanyProducts(companyId) {
    try {
      const snap = await databaseService
        .getDb()
        .collection("products")
        .where("companyId", "==", companyId)
        .orderBy("createdAt", "desc")
        .get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error("Error getting company products:", error);
      throw error;
    }
  }

  async getCompanyStats(companyId) {
    try {
      const [productsSnap] = await Promise.all([
        databaseService
          .getDb()
          .collection("products")
          .where("companyId", "==", companyId)
          .get(),
      ]);
      const totalProducts = productsSnap.size;
      let totalRevenue = 0;
      // The original code had ordersSnap here, but orders are removed.
      // If totalRevenue is still needed, it would require a different data source or calculation.
      // For now, setting it to 0 as there are no orders.
      return {
        totalProducts,
        totalRevenue,
      };
    } catch (error) {
      logger.error("Error getting company stats:", error);
      throw error;
    }
  }

  async searchCompanies(query) {
    try {
      const snap = await databaseService.companies().get();
      const q = query.toLowerCase();
      return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (c) =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.category && c.category.toLowerCase().includes(q))
        );
    } catch (error) {
      logger.error("Error searching companies:", error);
      throw error;
    }
  }

  async getCompanyCategories() {
    try {
      const snap = await databaseService
        .companies()
        .where("status", "==", "approved")
        .get();
      const categories = new Set();
      snap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.category) categories.add(d.category);
      });
      return Array.from(categories);
    } catch (error) {
      logger.error("Error getting company categories:", error);
      throw error;
    }
  }

  async getCompaniesByOwner(telegramId) {
    const snap = await databaseService
      .companies()
      .where("telegramId", "==", telegramId)
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createProduct(productData, creatorTelegramId) {
    try {
      const company = await this.getCompanyById(productData.companyId);
      if (!company) throw new Error("Company not found");
      if (company.telegramId !== creatorTelegramId)
        throw new Error("Only the company owner can add products.");
      const productId = uuidv4();
      const doc = { ...productData, id: productId, createdAt: new Date() };
      // Build admin notification message/buttons with productId
      const msg = `🔔 <b>New product added</b>\n\n<b>Title:</b> ${
        productData.title
      }\n<b>Description:</b> ${productData.description}\n<b>Price:</b> $${
        productData.price
      }\n<b>Category:</b> ${productData.category}\n<b>Company:</b> ${
        company.name || productData.companyId
      }\n<b>Added by:</b> ${creatorTelegramId}\n<b>Created:</b> ${doc.createdAt.toLocaleString()}\n\n<b>Approve or reject this product below.</b>`;
      const { Markup } = require("telegraf");
      const buttons = [
        [
          Markup.button.callback("✅ Approve", `approve_product_${productId}`),
          Markup.button.callback("❌ Reject", `reject_product_${productId}`),
        ],
      ];
      // Notify user
      await getNotificationServiceInstance().sendNotification(
        creatorTelegramId,
        "🛍️ Your product has been added!",
        { type: "product", action: "create", productId }
      );
      // Notify all admins
      try {
        const userServiceModule = require("./userService");
        const adminIds =
          await userServiceModule.userService.getAdminTelegramIds();
        console.log("[ADMIN NOTIFY] Product add:", { adminIds, msg });
        logger.info(
          `[ADMIN NOTIFY] Product add: ${JSON.stringify({ adminIds, msg })}`
        );
        if (adminIds.length > 0) {
          for (const adminId of adminIds) {
            await getNotificationServiceInstance().sendNotification(
              adminId,
              msg,
              { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) }
            );
          }
          console.log("[ADMIN NOTIFY] Product add: sent");
        } else {
          console.log("[ADMIN NOTIFY] Product add: no admin IDs found");
        }
      } catch (e) {
        logger.error("Error notifying admins of new product:", e);
        console.error("Error notifying admins of new product:", e);
      }
      await require("../config/database")
        .getDb()
        .collection("products")
        .doc(productId)
        .set(doc);
      logger.info(`Product created: ${productId}`);
      return doc;
    } catch (error) {
      logger.error("Error creating product:", error);
      throw error;
    }
  }

  async deleteCompany(companyId, deleterTelegramId) {
    try {
      const ref = databaseService.companies().doc(companyId);
      const docSnap = await ref.get();
      if (!docSnap.exists) throw new Error("Company not found");
      const company = docSnap.data();
      if (company.telegramId !== deleterTelegramId)
        throw new Error("Only the company owner can delete this company.");
      // Delete all products belonging to this company
      const productsSnap = await databaseService
        .getDb()
        .collection("products")
        .where("companyId", "==", companyId)
        .get();
      const batch = databaseService.getDb().batch();
      productsSnap.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      // Delete the company document
      await ref.delete();
      await getNotificationServiceInstance().sendNotification(
        company.telegramId,
        "🗑️ Company deleted.",
        { type: "company", action: "delete", companyId }
      );
      logger.info(`Company deleted: ${companyId}`);
      return true;
    } catch (error) {
      logger.error("Error deleting company:", error);
      throw error;
    }
  }

  async processCompanyWithdrawal(companyId, amount) {
    try {
      const companyRef = databaseService.companies().doc(companyId);
      const companyDoc = await companyRef.get();

      if (!companyDoc.exists) {
        throw new Error("Company not found");
      }

      const company = companyDoc.data();
      const currentBalance = company.billingBalance || 0;

      if (currentBalance < amount) {
        throw new Error("Insufficient balance for withdrawal");
      }

      // Update company balance
      const newBalance = currentBalance - amount;
      await companyRef.update({
        billingBalance: newBalance,
        lastWithdrawal: {
          amount,
          date: new Date(),
        },
      });

      // Create withdrawal record
      const withdrawalRecord = {
        companyId,
        amount,
        status: "processed",
        processedAt: new Date(),
        processedBy: "admin",
      };

      await databaseService
        .getDb()
        .collection("company_withdrawals")
        .add(withdrawalRecord);

      logger.info(`Company withdrawal processed: ${companyId} - $${amount}`);

      return {
        success: true,
        newBalance,
        withdrawalAmount: amount,
      };
    } catch (error) {
      logger.error("Error processing company withdrawal:", error);
      throw error;
    }
  }
}

console.log("End of companyService.js (restored Firestore version)");
module.exports = new CompanyService();
