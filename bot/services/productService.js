
const databaseService = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const logger = require("../../utils/logger");
const { getNotificationServiceInstance } = require("./notificationService");

class ProductService {
  // Helper: Get company doc and data, throw if not found, and check owner
  async _getCompanyOrThrow(companyId, telegramId) {
    const companyDoc = await databaseService.companies().doc(companyId).get();
    if (!companyDoc.exists) throw new Error("Company not found");
    const company = companyDoc.data();
    if (telegramId && company.telegramId !== telegramId)
      throw new Error("Only the company owner can perform this action.");
    return { companyDoc, company };
  }

  async createProduct(productData, creatorTelegramId) {
    try {
      const {
        companyId,
        title,
        description,
        price,
        category,
        imageUrl,
        contactInfo,
      } = productData;
      // Use _getCompanyOrThrow for permission check
      const { company } = await this._getCompanyOrThrow(
        companyId,
        creatorTelegramId
      );
      // Validation
      if (!title || !price)
        throw new Error("Product title and price are required.");
      // Check for duplicate title
      const dupSnap = await databaseService
        .getDb()
        .collection("products")
        .where("companyId", "==", companyId)
        .where("title", "==", title)
        .limit(1)
        .get();
      if (!dupSnap.empty)
        throw new Error(
          "A product with this title already exists for your company."
        );
      const productId = uuidv4();
      logger.info(
        `[DEBUG] createProduct: Creating product with ID ${productId}`
      );
      const productDoc = databaseService
        .getDb()
        .collection("products")
        .doc(productId);
      await productDoc.set({
        id: productId,
        companyId,
        title,
        description,
        price,
        category,
        imageUrl: imageUrl || null,
        contactInfo: contactInfo || null,
        createdAt: new Date(),
        status: productData.status || "instock",
        quantity: productData.quantity || 0,
      });
      // Notify company owner
      await getNotificationServiceInstance().sendNotification(
        company.telegramId,
        `✅ Product "${title}" created successfully.`,
        { type: "product", action: "create", productId }
      );
      return { id: productId, ...productData };
    } catch (error) {
      logger.error("Error creating product:", error);
      throw error;
    }
  }

  async getProductById(productId) {
    try {
      const productDoc = await databaseService
        .getDb()
        .collection("products")
        .doc(productId)
        .get();
      if (!productDoc.exists) {
        return null;
      }
      const productData = { id: productDoc.id, ...productDoc.data() };

      // Also fetch company data to ensure it's active and get the name
      if (productData.companyId) {
        const companyDoc = await databaseService
          .getDb()
          .collection("companies")
          .doc(productData.companyId)
          .get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          productData.companyName = companyData.name;
          productData.companyStatus = companyData.status;
        }
      }

      return productData;
    } catch (error) {
      logger.error("Error getting product by ID:", error);
      throw error;
    }
  }

  async getAllProducts(limit = 20, offset = 0) {
    try {
      const productsSnap = await databaseService
        .getDb()
        .collection("products")
        .limit(limit)
        .get();
      const products = [];
      for (const doc of productsSnap.docs) {
        const product = doc.data();
        // Get company info
        const companyDoc = await databaseService
          .companies()
          .doc(product.companyId)
          .get();
        const company = companyDoc.exists ? companyDoc.data() : {};
        let companyStatusBadge = "";
        if (company.status === "approved") companyStatusBadge = "✅ Approved";
        else if (company.status === "pending")
          companyStatusBadge = "⏳ Pending";
        else if (company.status === "rejected")
          companyStatusBadge = "❌ Rejected";
        else companyStatusBadge = "❔ Unknown";
        let statusBadge = "";
        if (product.status === "approved") statusBadge = "✅ Approved";
        else if (product.status === "pending") statusBadge = "⏳ Pending";
        else if (product.status === "rejected") statusBadge = "❌ Rejected";
        else statusBadge = "❔ Unknown";
        products.push({
          ...product,
          id: doc.id,
          company_name: company.name || "Unknown Company",
          commission_rate: company.commission_rate || 0,
          company_status: company.status,
          company_statusBadge: companyStatusBadge,
          statusBadge,
        });
      }
      return products;
    } catch (error) {
      logger.error("Error getting all products:", error);
      throw error;
    }
  }

  async getProductsByCategory(category, limit = 20, offset = 0) {
    try {
      const result = await databaseService.query(
        `SELECT p.*, c.name as company_name, c.commission_rate
         FROM products p
         JOIN companies c ON p.company_id = c.id
         WHERE p.category = $1 AND c.status = 'approved'
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [category, limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting products by category:", error);
      throw error;
    }
  }

  async getProductsByCompany(companyId) {
    try {
      const productsSnap = await databaseService
        .getDb()
        .collection("products")
        .where("companyId", "==", companyId)
        .get();
      const products = [];
      for (const doc of productsSnap.docs) {
        const product = doc.data();
        product.id = doc.id;
        products.push(product);
      }
      return products;
    } catch (error) {
      logger.error("Error getting products by company:", error);
      throw error;
    }
  }

  async updateProduct(productId, updateData, updaterTelegramId) {
    try {
      const { title, description, price, category, imageUrl, contactInfo } =
        updateData;
      // Use _getCompanyOrThrow for permission check
      const prod = await this.getProductById(productId);
      if (!prod) throw new Error("Product not found");
      const { company } = await this._getCompanyOrThrow(
        prod.company_id,
        updaterTelegramId
      );
      // Validation
      if (!title || !price)
        throw new Error("Product title and price are required.");
      // Check for duplicate title (exclude self)
      const dup = await databaseService.query(
        "SELECT 1 FROM products WHERE company_id = $1 AND title = $2 AND id != $3",
        [prod.company_id, title, productId]
      );
      if (dup.rows.length > 0)
        throw new Error(
          "A product with this title already exists for your company."
        );
      const result = await databaseService.query(
        `UPDATE products 
         SET title = $1, description = $2, price = $3, category = $4, 
             image_url = $5, contact_info = $6, updated_at = NOW()
         WHERE id = $7 
         RETURNING *`,
        [
          title,
          description,
          price,
          category,
          imageUrl,
          JSON.stringify(contactInfo),
          productId,
        ]
      );
      if (result.rows.length === 0) {
        throw new Error("Product not found");
      }
      // Notify company owner
      await getNotificationServiceInstance().sendNotification(
        company.telegramId,
        `✏️ Product "${title}" updated successfully.`,
        { type: "product", action: "update", productId }
      );
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating product:", error);
      throw error;
    }
  }

  async deleteProduct(productId, deleterTelegramId) {
    try {
      // Use _getCompanyOrThrow for permission check
      const prod = await this.getProductById(productId);
      if (!prod) throw new Error("Product not found");
      const { company } = await this._getCompanyOrThrow(
        prod.company_id,
        deleterTelegramId
      );
      const result = await databaseService.query(
        "DELETE FROM products WHERE id = $1 RETURNING *",
        [productId]
      );
      if (result.rows.length === 0) {
        throw new Error("Product not found");
      }
      // Notify company owner
      await getNotificationServiceInstance().sendNotification(
        company.telegramId,
        `🗑️ Product "${prod.title}" deleted.`,
        { type: "product", action: "delete", productId }
      );
      return result.rows[0];
    } catch (error) {
      logger.error("Error deleting product:", error);
      throw error;
    }
  }

  async searchProducts(query, limit = 20, offset = 0) {
    try {
      const result = await databaseService.query(
        `SELECT p.*, c.name as company_name, c.commission_rate
         FROM products p
         JOIN companies c ON p.company_id = c.id
         WHERE (p.title ILIKE $1 OR p.description ILIKE $1 OR p.category ILIKE $1)
         AND c.status = 'approved'
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [`%${query}%`, limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error("Error searching products:", error);
      throw error;
    }
  }

  async getProductCategories() {
    try {
      const result = await databaseService.query(
        `SELECT DISTINCT p.category 
         FROM products p
         JOIN companies c ON p.company_id = c.id
         WHERE c.status = 'approved'
         ORDER BY p.category`
      );
      return result.rows.map((row) => row.category);
    } catch (error) {
      logger.error("Error getting product categories:", error);
      throw error;
    }
  }

  async getProductStats(productId) {
    try {
      const [orders, referrals, revenue] = await Promise.all([
        databaseService.query(
          "SELECT COUNT(*) FROM orders WHERE product_id = $1",
          [productId]
        ),
        databaseService.query(
          "SELECT COUNT(*) FROM referrals WHERE product_id = $1",
          [productId]
        ),
        databaseService.query(
          "SELECT COALESCE(SUM(amount), 0) FROM orders WHERE product_id = $1 AND status = 'approved'",
          [productId]
        ),
      ]);

      return {
        totalOrders: parseInt(orders.rows[0].count),
        totalReferrals: parseInt(referrals.rows[0].count),
        totalRevenue: parseFloat(revenue.rows[0].coalesce),
      };
    } catch (error) {
      logger.error("Error getting product stats:", error);
      throw error;
    }
  }

  async getPopularProducts(limit = 10) {
    try {
      const result = await databaseService.query(
        `SELECT p.*, c.name as company_name, c.commission_rate, COUNT(o.id) as order_count
         FROM products p
         JOIN companies c ON p.company_id = c.id
         LEFT JOIN orders o ON p.id = o.product_id
         WHERE c.status = 'approved'
         GROUP BY p.id, c.name, c.commission_rate
         ORDER BY order_count DESC, p.created_at DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting popular products:", error);
      throw error;
    }
  }

  async getRecentProducts(limit = 10) {
    try {
      const result = await databaseService.query(
        `SELECT p.*, c.name as company_name, c.commission_rate
         FROM products p
         JOIN companies c ON p.company_id = c.id
         WHERE c.status = 'approved'
         ORDER BY p.created_at DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting recent products:", error);
      throw error;
    }
  }

  async getProductsByPriceRange(minPrice, maxPrice, limit = 20, offset = 0) {
    try {
      const result = await databaseService.query(
        `SELECT p.*, c.name as company_name, c.commission_rate
         FROM products p
         JOIN companies c ON p.company_id = c.id
         WHERE p.price >= $1 AND p.price <= $2 AND c.status = 'approved'
         ORDER BY p.price ASC
         LIMIT $3 OFFSET $4`,
        [minPrice, maxPrice, limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting products by price range:", error);
      throw error;
    }
  }

  // Firestore-based update for product management UI
  async updateProductFirestore(productId, updateData) {
    if (!productId || typeof productId !== "string") {
      throw new Error("Invalid productId for updateProductFirestore");
    }
    return databaseService
      .getDb()
      .collection("products")
      .doc(productId)
      .update(updateData);
  }

  // Firestore-based delete for product management UI
  async deleteProductFirestore(productId) {
    if (!productId || typeof productId !== "string") {
      throw new Error("Invalid productId for deleteProductFirestore");
    }
    return databaseService
      .getDb()
      .collection("products")
      .doc(productId)
      .delete();
  }

  async getAllActiveProductsWithCompany() {
    const db = databaseService.getDb();
    const productsSnapshot = await db
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();
    if (productsSnapshot.empty) {
      return [];
    }

    const products = [];
    for (const doc of productsSnapshot.docs) {
      const productData = { id: doc.id, ...doc.data() };

      // Exclude out of stock or quantity 0
      if (
        productData.status === "out_of_stock" ||
        productData.quantity === 0
      ) {
        continue;
      }

      // Ensure there is a companyId to look up
      if (productData.companyId) {
        const companyDoc = await db
          .collection("companies")
          .doc(productData.companyId)
          .get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          // Only include products from active companies
          if (companyData.status === "active") {
            productData.companyName = companyData.name;
            products.push(productData);
          }
        }
      }
    }
    return products;
  }
}

module.exports = new ProductService();

