console.log("Entering services/orderService.js");
const databaseService = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const logger = require("../../utils/logger");
const notificationService = require('./notificationService');
const { getNotificationServiceInstance } = require('./notificationService');

class OrderService {
  // Helper: Get order doc and data, throw if not found
  async _getOrderOrThrow(orderId) {
    const orderDoc = await databaseService.orders().doc(orderId).get();
    if (!orderDoc.exists) throw new Error('Order not found');
    return { orderDoc, order: orderDoc.data() };
  }
  // Helper: Get company doc and data, throw if not found
  async _getCompanyOrThrow(companyId) {
    const companyDoc = await databaseService.companies().doc(companyId).get();
    if (!companyDoc.exists) throw new Error('Company not found');
    return { companyDoc, company: companyDoc.data() };
  }
  // Helper: Get user doc and data, throw if not found
  async _getUserOrThrow(telegramId) {
    const userDoc = await databaseService.users().doc(telegramId.toString()).get();
    if (!userDoc.exists) throw new Error('User not found');
    return { userDoc, user: userDoc.data() };
  }

  async createOrder(orderData) {
    try {
      const {
        userId,
        productId,
        companyId,
        amount,
        referralCode,
        customerInfo,
      } = orderData;
      const orderId = uuidv4();
      let referrerId = null;
      let userDiscount = 0;
      let referrerReward = 0;
      // Referral logic
      if (referralCode) {
        const referralService = require('./referralService');
        const result = await referralService.validateReferralCode({ code: referralCode, companyId, buyerTelegramId: userId });
        if (result.valid) {
          referrerId = result.referrerId;
          referrerReward = amount * 0.02;
          userDiscount = amount * 0.01;
        }
      }
      const orderDoc = {
        id: orderId,
          userId,
          productId,
          companyId,
          amount,
        referralCode: referralCode || null,
        referrerId,
        referrerReward,
        userDiscount,
        customerInfo,
        status: 'approved',
        createdAt: new Date(),
      };
      await databaseService.orders().doc(orderId).set(orderDoc);
      // Notify buyer and referrer
      // if (referrerId) {
      //   await notificationService.sendNotification(referrerId, `You earned a 2% reward for referring a buyer.`, { type: 'order', action: 'commission', orderId, amount: referrerReward });
      // }
      await notificationService.sendNotification(userId, `Your purchase is complete!${userDiscount ? ` You received a 1% discount.` : ''}`, { type: 'order', action: 'approved', orderId });
      logger.info(`Order created: ${orderId} (user: ${userId}, product: ${productId}, referrer: ${referrerId})`);
      return { id: orderId, ...orderDoc };
    } catch (error) {
      logger.error('Error creating order (Firestore):', error);
      throw error;
    }
  }

  async getOrderById(orderId) {
    try {
      const doc = await databaseService.orders().doc(orderId).get();
      if (!doc.exists) throw new Error("Order not found");
      const order = doc.data();
      // Get product, company, user, referral code info
      const [productDoc, companyDoc, userDoc] = await Promise.all([
        databaseService.getDb().collection('products').doc(order.productId).get(),
        databaseService.companies().doc(order.companyId).get(),
        databaseService.users().doc(order.userId.toString()).get(),
      ]);
      const product = productDoc.exists ? productDoc.data() : {};
      const company = companyDoc.exists ? companyDoc.data() : {};
      const user = userDoc.exists ? userDoc.data() : {};
      // Referral code info (optional)
      let referralCode = null;
      if (order.referralCodeId) {
        const refCodeDoc = await databaseService.referralCodes().doc(order.referralCodeId).get();
        referralCode = refCodeDoc.exists ? refCodeDoc.data() : null;
      }
      return {
        ...order,
        product_title: product.title || null,
        product_price: product.price || null,
        company_name: company.name || null,
        commission_rate: company.commission_rate || null,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        phone_number: user.phone_number || null,
        referral_code: referralCode ? referralCode.code : null,
      };
    } catch (error) {
      logger.error("Error getting order by ID (Firestore):", error);
      throw error;
    }
  }

  async getUserOrders(userId) {
    try {
      const ordersSnap = await databaseService.orders().where("userId", "==", userId).orderBy("createdAt", "desc").get();
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Attach product, company, referral code info
      for (const order of orders) {
        const [productDoc, companyDoc] = await Promise.all([
          databaseService.getDb().collection('products').doc(order.productId).get(),
          databaseService.companies().doc(order.companyId).get(),
        ]);
        order.product_title = productDoc.exists ? productDoc.data().title : null;
        order.product_price = productDoc.exists ? productDoc.data().price : null;
        order.company_name = companyDoc.exists ? companyDoc.data().name : null;
        order.commission_rate = companyDoc.exists ? companyDoc.data().commission_rate : null;
        if (order.referralCodeId) {
          const refCodeDoc = await databaseService.referralCodes().doc(order.referralCodeId).get();
          order.referral_code = refCodeDoc.exists ? refCodeDoc.data().code : null;
        }
      }
      return orders;
    } catch (error) {
      logger.error("Error getting user orders (Firestore):", error);
      throw error;
    }
  }

  async getCompanyOrders(companyId) {
    try {
      const ordersSnap = await databaseService.orders().where("companyId", "==", companyId).orderBy("createdAt", "desc").get();
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Attach product, user, referral code info
      for (const order of orders) {
        const [productDoc, userDoc] = await Promise.all([
          databaseService.getDb().collection('products').doc(order.productId).get(),
          databaseService.users().doc(order.userId.toString()).get(),
        ]);
        order.product_title = productDoc.exists ? productDoc.data().title : null;
        order.product_price = productDoc.exists ? productDoc.data().price : null;
        order.first_name = userDoc.exists ? userDoc.data().first_name : null;
        order.last_name = userDoc.exists ? userDoc.data().last_name : null;
        order.phone_number = userDoc.exists ? userDoc.data().phone_number : null;
        if (order.referralCodeId) {
          const refCodeDoc = await databaseService.referralCodes().doc(order.referralCodeId).get();
          order.referral_code = refCodeDoc.exists ? refCodeDoc.data().code : null;
        }
      }
      return orders;
    } catch (error) {
      logger.error("Error getting company orders (Firestore):", error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, status, notes = null, approverTelegramId = null) {
    try {
      const orderRef = databaseService.orders().doc(orderId);
      const orderDoc = await orderRef.get();
      if (!orderDoc.exists) throw new Error('Order not found');
      const order = orderDoc.data();
      // If approving, check that approver is company owner
      if (status === 'approved' && approverTelegramId) {
        const companyDoc = await databaseService.companies().doc(order.companyId).get();
        if (!companyDoc.exists) throw new Error('Company not found');
        const company = companyDoc.data();
        if (company.telegramId !== approverTelegramId) {
          throw new Error('Only the company owner can approve this order.');
        }
      }
      await orderRef.update({ status, admin_notes: notes, updatedAt: new Date() });
      const updatedDoc = await orderRef.get();
      if (!updatedDoc.exists) throw new Error('Order not found');
      // If order is approved, update referral balance
      if (status === 'approved') {
        await this.processApprovedOrder(orderId);
        await notificationService.sendNotification(order.userId, `✅ Your order has been approved!`, { type: 'order', action: 'approved', orderId });
        await notificationService.sendNotification(order.companyId, `✅ Order approved.`, { type: 'order', action: 'approved', orderId });
        logger.info(`Order approved: ${orderId}`);
      } else if (status === 'rejected') {
        await notificationService.sendNotification(order.userId, `❌ Your order was rejected.`, { type: 'order', action: 'rejected', orderId });
        await notificationService.sendNotification(order.companyId, `❌ Order rejected.`, { type: 'order', action: 'rejected', orderId });
        logger.info(`Order rejected: ${orderId}`);
      }
      logger.info(`Order status updated: ${orderId} to ${status}`);
      return { id: orderId, ...updatedDoc.data() };
    } catch (error) {
      logger.error('Error updating order status (Firestore):', error);
      throw error;
    }
  }

  async processApprovedOrder(orderId) {
    try {
      const orderRef = databaseService.orders().doc(orderId);
      const orderDoc = await orderRef.get();
      if (!orderDoc.exists) throw new Error('Order not found');
      const order = orderDoc.data();
      // Get company
      const companyDoc = await databaseService.companies().doc(order.companyId).get();
      if (!companyDoc.exists) throw new Error('Company not found');
      const company = companyDoc.data();
      // Get referrer (if any)
      let referrer = null;
      if (order.referralCode) {
        const prefix = order.referralCode.split('-')[0];
        const usersSnap = await databaseService.users().where(`referralCodes.${prefix}`, '==', order.referralCode).get();
        if (!usersSnap.empty) referrer = usersSnap.docs[0].data();
      }
      // Calculate referral/discount info for record only
      const amount = order.amount;
      const referrerCommission = amount * 0.02; // 2% for referrer
      const userDiscount = amount * 0.01; // 1% discount for referred user
      // Record referral/discount info in order (no payout, no balance update)
      await orderRef.update({
        referrerCommission,
        userDiscount,
        referralProcessed: true
      });
      // Notify company and referrer
      if (referrer) {
        await notificationService.sendNotification(referrer.telegramId, `You earned a 2% reward for referring a buyer to ${company.name}.`, { type: 'order', action: 'commission', orderId, amount: referrerCommission });
      }
      await notificationService.sendNotification(company.telegramId, `Order ${orderId} approved.`, { type: 'order', action: 'approved', orderId });
    } catch (error) {
      logger.error('Error processing approved order (Firestore):', error);
      throw error;
    }
  }

  async processPurchase(telegramId, productId, referralCode = null, paymentMethod = 'stripe', paymentDetails = {}) {
    try {
      // Fetch product and company
      const productDoc = await databaseService.getDb().collection('products').doc(productId).get();
      if (!productDoc.exists) throw new Error('Product not found');
      const product = productDoc.data();
      const companyDoc = await databaseService.companies().doc(product.companyId).get();
      if (!companyDoc.exists) throw new Error('Company not found');
      const company = companyDoc.data();
      // Extra validation: product must belong to company
      if (referralCode) {
        // Validate referral code and company membership
        const userDoc = await databaseService.users().doc(telegramId.toString()).get();
        if (!userDoc.exists) throw new Error('User not found');
        const user = userDoc.data();
        if (!user.joinedCompanies || !user.joinedCompanies.includes(product.companyId)) {
          throw new Error('You must join the company before using a referral code for it.');
        }
        // Validate referral code prefix matches company
        const prefix = referralCode.split('-')[0];
        if (prefix !== company.codePrefix) {
          throw new Error('Referral code does not match this company.');
        }
      }
      // Prepare order data
      const orderData = {
        userId: telegramId,
        productId,
        companyId: product.companyId,
        amount: product.price,
        referralCode: referralCode || null,
        status: 'pending',
        createdAt: new Date(),
        paymentMethod,
        paymentDetails,
      };
      // Create order in Firestore
      const orderRef = await databaseService.orders().add(orderData);
      const orderId = orderRef.id;

      // Payment gateway integration
      let paymentResult = null;
      if (paymentMethod === 'stripe') {
        const session = await stripeService.createCheckoutSession(product, telegramId, orderId);
        paymentResult = { status: 'initiated', gateway: 'stripe', sessionUrl: session.url, sessionId: session.id };
      } else if (paymentMethod === 'cbe') {
        const cbeResult = await cbeService.initiatePayment(product, telegramId, orderId);
        paymentResult = cbeResult;
      } else if (paymentMethod === 'telebirr') {
        const telebirrResult = await telebirrService.initiatePayment(product, telegramId, orderId);
        paymentResult = telebirrResult;
      } else {
        throw new Error('Unsupported payment method');
      }

      // Update order with payment initiation result
      await databaseService.orders().doc(orderId).update({ paymentResult });
      // After purchase is submitted
      await getNotificationServiceInstance().sendNotification(telegramId, `🛒 Your purchase has been submitted and is pending approval.`, { type: 'order', action: 'request', orderId });
      // Notify all admins
      try {
        const adminIds = await require('./userService').getAdminTelegramIds();
        if (adminIds.length > 0) {
          const msg = `🔔 New purchase by ${telegramId} for product ${productId} (amount: $${product.price})`;
          await getNotificationServiceInstance().sendBulkNotification(adminIds, msg, { type: 'order', action: 'admin_alert', orderId });
        }
      } catch (e) { logger.error('Error notifying admins of new purchase:', e); }
      return { orderId, paymentResult };
    } catch (error) {
      logger.error('Error processing purchase:', error);
      throw error;
    }
  }

  async getPendingOrders() {
    try {
      const ordersSnap = await databaseService.orders().where("status", "==", "pending").orderBy("createdAt", "asc").get();
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Attach product, company, user, referral code info
      for (const order of orders) {
        const [productDoc, companyDoc] = await Promise.all([
          databaseService.getDb().collection('products').doc(order.productId).get(),
          databaseService.companies().doc(order.companyId).get(),
        ]);
        order.product_title = productDoc.exists ? productDoc.data().title : null;
        order.product_price = productDoc.exists ? productDoc.data().price : null;
        order.company_name = companyDoc.exists ? companyDoc.data().name : null;
        order.commission_rate = companyDoc.exists ? companyDoc.data().commission_rate : null;
        if (order.referralCodeId) {
          const refCodeDoc = await databaseService.referralCodes().doc(order.referralCodeId).get();
          order.referral_code = refCodeDoc.exists ? refCodeDoc.data().code : null;
        }
      }
      return orders;
    } catch (error) {
      logger.error("Error getting pending orders:", error);
      throw error;
    }
  }

  async getOrderStats() {
    try {
      const [total, pending, approved, rejected, totalValue, pendingValue] =
        await Promise.all([
          databaseService.orders().get(),
          databaseService.orders().where("status", "==", "pending").get(),
          databaseService.orders().where("status", "==", "approved").get(),
          databaseService.orders().where("status", "==", "rejected").get(),
          databaseService.orders().select("amount").get(),
          databaseService.orders().where("status", "==", "pending").select("amount").get(),
        ]);

      return {
        total: total.docs.length,
        pending: pending.docs.length,
        approved: approved.docs.length,
        rejected: rejected.docs.length,
        totalValue: total.docs.reduce((sum, doc) => sum + doc.data().amount, 0),
        pendingValue: pending.docs.reduce((sum, doc) => sum + doc.data().amount, 0),
      };
    } catch (error) {
      logger.error("Error getting order stats:", error);
      throw error;
    }
  }

  async searchOrders(query) {
    try {
      const ordersSnap = await databaseService.orders().where("id", "==", query).get();
      if (ordersSnap.empty) {
        const ordersSnap2 = await databaseService.orders().where("productId", "==", query).get();
        if (ordersSnap2.empty) {
          const ordersSnap3 = await databaseService.orders().where("companyId", "==", query).get();
          if (ordersSnap3.empty) {
            const ordersSnap4 = await databaseService.orders().where("userId", "==", query).get();
            if (ordersSnap4.empty) {
              const ordersSnap5 = await databaseService.orders().where("referralCode", "==", query).get();
              if (ordersSnap5.empty) {
                return [];
              }
              return ordersSnap5.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            return ordersSnap4.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }
          return ordersSnap3.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        return ordersSnap2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      return ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error("Error searching orders:", error);
      throw error;
    }
  }

  async getOrdersByStatus(status) {
    try {
      const ordersSnap = await databaseService.orders().where("status", "==", status).orderBy("createdAt", "desc").get();
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Attach product, company, user, referral code info
      for (const order of orders) {
        const [productDoc, companyDoc] = await Promise.all([
          databaseService.getDb().collection('products').doc(order.productId).get(),
          databaseService.companies().doc(order.companyId).get(),
        ]);
        order.product_title = productDoc.exists ? productDoc.data().title : null;
        order.product_price = productDoc.exists ? productDoc.data().price : null;
        order.company_name = companyDoc.exists ? companyDoc.data().name : null;
        order.commission_rate = companyDoc.exists ? companyDoc.data().commission_rate : null;
        if (order.referralCodeId) {
          const refCodeDoc = await databaseService.referralCodes().doc(order.referralCodeId).get();
          order.referral_code = refCodeDoc.exists ? refCodeDoc.data().code : null;
        }
      }
      return orders;
    } catch (error) {
      logger.error("Error getting orders by status:", error);
      throw error;
    }
  }

  async getRecentOrders(limit = 10) {
    try {
      const ordersSnap = await databaseService.orders().orderBy("createdAt", "desc").limit(limit).get();
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Attach product, company, user info
      for (const order of orders) {
        const [productDoc, companyDoc] = await Promise.all([
          databaseService.getDb().collection('products').doc(order.productId).get(),
          databaseService.companies().doc(order.companyId).get(),
        ]);
        order.product_title = productDoc.exists ? productDoc.data().title : null;
        order.product_price = productDoc.exists ? productDoc.data().price : null;
        order.company_name = companyDoc.exists ? companyDoc.data().name : null;
        order.commission_rate = companyDoc.exists ? companyDoc.data().commission_rate : null;
        if (order.referralCodeId) {
          const refCodeDoc = await databaseService.referralCodes().doc(order.referralCodeId).get();
          order.referral_code = refCodeDoc.exists ? refCodeDoc.data().code : null;
        }
      }
      return orders;
    } catch (error) {
      logger.error("Error getting recent orders:", error);
      throw error;
    }
  }

  async getOrdersByDateRange(startDate, endDate) {
    try {
      const ordersSnap = await databaseService.orders().where("createdAt", ">=", startDate).where("createdAt", "<=", endDate).orderBy("createdAt", "desc").get();
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Attach product, company, user info
      for (const order of orders) {
        const [productDoc, companyDoc] = await Promise.all([
          databaseService.getDb().collection('products').doc(order.productId).get(),
          databaseService.companies().doc(order.companyId).get(),
        ]);
        order.product_title = productDoc.exists ? productDoc.data().title : null;
        order.product_price = productDoc.exists ? productDoc.data().price : null;
        order.company_name = companyDoc.exists ? companyDoc.data().name : null;
        order.commission_rate = companyDoc.exists ? companyDoc.data().commission_rate : null;
        if (order.referralCodeId) {
          const refCodeDoc = await databaseService.referralCodes().doc(order.referralCodeId).get();
          order.referral_code = refCodeDoc.exists ? refCodeDoc.data().code : null;
        }
      }
      return orders;
    } catch (error) {
      logger.error("Error getting orders by date range:", error);
      throw error;
    }
  }

  async attachProofToOrder(orderId, fileId) {
    try {
      const orderRef = databaseService.orders().doc(orderId);
      await orderRef.update({ proofFileId: fileId, proofUploadedAt: new Date() });
      const orderDoc = await orderRef.get();
      if (orderDoc.exists) {
        const order = orderDoc.data();
        await notificationService.sendNotification(order.userId, `📎 Your proof of purchase has been received.`, { type: 'order', action: 'proof', orderId });
        await notificationService.sendNotification(order.companyId, `📎 Proof of purchase uploaded for order.`, { type: 'order', action: 'proof', orderId });
        logger.info(`Proof uploaded for order: ${orderId}`);
      }
    } catch (error) {
      logger.error('Error attaching proof to order:', error);
      throw error;
    }
  }
}

module.exports = new OrderService();
console.log("Exiting services/orderService.js");
