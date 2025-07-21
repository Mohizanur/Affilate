const logger = require("../../utils/logger");

class NotificationService {
  constructor(bot) {
    this.bot = bot;
  }

  async sendNotification(userId, message, options = {}) {
    try {
      const userService = require('./userService').userService;
      const user = await userService.getUserByTelegramId(userId);

      if (!user) {
        logger.warn(`User not found for notification: ${userId}`);
        return false;
      }

      // Check if user has notifications enabled for this type
      const notificationType = options.type || "general";
      if (
        user.notifications &&
        user.notifications[notificationType] === false
      ) {
        logger.info(
          `Notification disabled for user ${userId}, type: ${notificationType}`
        );
        return false;
      }

      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...options,
      });

      logger.info(`Notification sent to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error sending notification to user ${userId}:`, error);
      return false;
    }
  }

  async sendBulkNotification(userIds, message, options = {}) {
    try {
      const userService = require('./userService');
      const results = [];

      for (const userId of userIds) {
        const result = await this.sendNotification(userId, message, options);
        results.push({ userId, success: result });

        // Add delay to avoid rate limiting
        await this.delay(100);
      }

      return results;
    } catch (error) {
      logger.error("Error sending bulk notification:", error);
      throw error;
    }
  }

  async notifyOrderStatusUpdate(orderId, status, userId) {
    try {
      const userService = require('./userService');
      let message = "";

      switch (status) {
        case "approved":
          message = `✅ <b>Order Approved!</b>\n\nYour order #${orderId.slice(
            0,
            8
          )} has been approved and is being processed.\n\nThank you for your purchase!`;
          break;
        case "rejected":
          message = `❌ <b>Order Rejected</b>\n\nYour order #${orderId.slice(
            0,
            8
          )} has been rejected.\n\nPlease contact support for more information.`;
          break;
        case "completed":
          message = `🎉 <b>Order Completed!</b>\n\nYour order #${orderId.slice(
            0,
            8
          )} has been completed successfully.\n\nWe hope you're satisfied with your purchase!`;
          break;
        default:
          message = `📋 <b>Order Update</b>\n\nYour order #${orderId.slice(
            0,
            8
          )} status has been updated to: ${status}`;
      }

      await this.sendNotification(userId, message, { type: "orders" });
    } catch (error) {
      logger.error("Error sending order status notification:", error);
    }
  }

  async notifyPayoutStatusUpdate(payoutId, status, userId, amount) {
    try {
      const userService = require('./userService');
      let message = "";

      switch (status) {
        case "approved":
          message = `✅ <b>Payout Approved!</b>\n\nYour payout request of $${amount} has been approved and will be processed within 24-48 hours.\n\nPayout ID: #${payoutId.slice(
            0,
            8
          )}`;
          break;
        case "rejected":
          message = `❌ <b>Payout Rejected</b>\n\nYour payout request of $${amount} has been rejected and the amount has been refunded to your balance.\n\nPayout ID: #${payoutId.slice(
            0,
            8
          )}\n\nPlease contact support for more information.`;
          break;
        case "completed":
          message = `🎉 <b>Payout Completed!</b>\n\nYour payout of $${amount} has been successfully processed.\n\nPayout ID: #${payoutId.slice(
            0,
            8
          )}`;
          break;
        default:
          message = `💰 <b>Payout Update</b>\n\nYour payout request status has been updated to: ${status}\n\nAmount: $${amount}\nPayout ID: #${payoutId.slice(
            0,
            8
          )}`;
      }

      await this.sendNotification(userId, message, { type: "payouts" });
    } catch (error) {
      logger.error("Error sending payout status notification:", error);
    }
  }

  async notifyNewReferral(referrerId, customerName, productTitle, commission) {
    try {
      const userService = require('./userService');
      const message = `🎉 <b>New Referral!</b>\n\n${customerName} just purchased "${productTitle}" using your referral link!\n\n💰 Commission earned: $${commission.toFixed(
        2
      )}\n\nKeep up the great work!`;

      await this.sendNotification(referrerId, message, { type: "referrals" });
    } catch (error) {
      logger.error("Error sending new referral notification:", error);
    }
  }

  async notifyNewOrder(
    companyOwnerId,
    orderId,
    productTitle,
    customerName,
    amount
  ) {
    try {
      const userService = require('./userService');
      const message = `🛒 <b>New Order Received!</b>\n\nProduct: ${productTitle}\nCustomer: ${customerName}\nAmount: $${amount}\nOrder ID: #${orderId.slice(
        0,
        8
      )}\n\nPlease review and process this order.`;

      await this.sendNotification(companyOwnerId, message, { type: "orders" });
    } catch (error) {
      logger.error("Error sending new order notification:", error);
    }
  }

  async notifyLowBalance(userId, currentBalance) {
    try {
      const userService = require('./userService');
      const message = `⚠️ <b>Low Balance Alert</b>\n\nYour referral balance is running low: $${currentBalance.toFixed(
        2
      )}\n\nKeep referring customers to earn more commissions!`;

      await this.sendNotification(userId, message, { type: "balance" });
    } catch (error) {
      logger.error("Error sending low balance notification:", error);
    }
  }

  async notifySystemMaintenance(message, userIds = null) {
    try {
      const userService = require('./userService');
      const maintenanceMessage = `🔧 <b>System Maintenance</b>\n\n${message}`;

      if (userIds) {
        await this.sendBulkNotification(userIds, maintenanceMessage, {
          type: "system",
        });
      } else {
        // Send to all users
        const allUsers = await userService.getAllUsers();
        const allUserIds = allUsers.map((user) => user.telegram_id);
        await this.sendBulkNotification(allUserIds, maintenanceMessage, {
          type: "system",
        });
      }
    } catch (error) {
      logger.error("Error sending system maintenance notification:", error);
    }
  }

  async notifyPromotionalOffer(userId, title, description, discount) {
    try {
      const userService = require('./userService');
      const message = `🎁 <b>${title}</b>\n\n${description}\n\n💰 Discount: ${discount}%\n\nDon't miss out on this limited-time offer!`;

      await this.sendNotification(userId, message, { type: "promotions" });
    } catch (error) {
      logger.error("Error sending promotional notification:", error);
    }
  }

  async notifyAdminAlert(adminIds, alertType, message) {
    try {
      const userService = require('./userService');
      const alertMessage = `🚨 <b>Admin Alert - ${alertType}</b>\n\n${message}`;

      await this.sendBulkNotification(adminIds, alertMessage, {
        type: "admin",
      });
    } catch (error) {
      logger.error("Error sending admin alert:", error);
    }
  }

  async scheduleNotification(userId, message, scheduleTime, options = {}) {
    try {
      const userService = require('./userService');
      const delay = scheduleTime.getTime() - Date.now();

      if (delay <= 0) {
        // Send immediately if scheduled time is in the past
        return await this.sendNotification(userId, message, options);
      }

      setTimeout(async () => {
        await this.sendNotification(userId, message, options);
      }, delay);

      logger.info(
        `Notification scheduled for user ${userId} at ${scheduleTime}`
      );
      return true;
    } catch (error) {
      logger.error("Error scheduling notification:", error);
      return false;
    }
  }

  async sendWelcomeMessage(userId, firstName) {
    try {
      const userService = require('./userService');
      const message = `🎉 <b>Welcome to our Referral Platform, ${firstName}!</b>\n\nThank you for joining us! Here's what you can do:\n\n🛍️ Browse products and make purchases\n💰 Earn commissions by referring others\n🏢 Register your company to sell products\n📊 Track your earnings and referrals\n\nUse /help to see all available commands.\n\nHappy earning! 🚀`;

      await this.sendNotification(userId, message, { type: "welcome" });
    } catch (error) {
      logger.error("Error sending welcome message:", error);
    }
  }

  async sendDailyEarningsReport(userId, dailyEarnings, totalEarnings) {
    try {
      const userService = require('./userService');
      const message = `📊 <b>Daily Earnings Report</b>\n\n💰 Today's earnings: $${dailyEarnings.toFixed(
        2
      )}\n💎 Total earnings: $${totalEarnings.toFixed(
        2
      )}\n\nKeep up the great work!`;

      await this.sendNotification(userId, message, { type: "reports" });
    } catch (error) {
      logger.error("Error sending daily earnings report:", error);
    }
  }

  async sendWeeklyReport(userId, weeklyStats) {
    try {
      const userService = require('./userService');
      const message = `📈 <b>Weekly Report</b>\n\n🔗 Referrals this week: ${
        weeklyStats.referrals
      }\n💰 Earnings this week: $${weeklyStats.earnings.toFixed(
        2
      )}\n🛒 Orders generated: ${weeklyStats.orders}\n📊 Conversion rate: ${
        weeklyStats.conversionRate
      }%\n\nGreat job this week! 🎉`;

      await this.sendNotification(userId, message, { type: "reports" });
    } catch (error) {
      logger.error("Error sending weekly report:", error);
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Notification preferences management
  async updateNotificationPreferences(userId, preferences) {
    try {
      const userService = require('./userService');
      await userService.updateNotificationPreferences(userId, preferences);
      logger.info(`Notification preferences updated for user ${userId}`);
      return true;
    } catch (error) {
      logger.error("Error updating notification preferences:", error);
      return false;
    }
  }

  async getNotificationPreferences(userId) {
    try {
      const userService = require('./userService');
      const user = await userService.getUserByTelegramId(userId);
      return (
        user?.notifications || {
          orders: true,
          payouts: true,
          referrals: true,
          company: true,
          promotions: true,
          reports: true,
          system: true,
        }
      );
    } catch (error) {
      logger.error("Error getting notification preferences:", error);
      return null;
    }
  }

  async sendAdminNotification(message, meta = {}) {
    const userService = require('./userService');
    const adminIds = await userService.getAdminTelegramIds();
    for (const adminId of adminIds) {
      await this.sendNotification(adminId, message, { ...meta, admin: true });
      logger.info(`Admin notified: ${adminId} - ${message}`);
    }
  }

  async sendAllAdminsNotification(message, meta = {}) {
    return this.sendAdminNotification(message, meta);
  }

  async sendAdminActionNotification(action, details, meta = {}) {
    try {
      const userService = require('./userService').userService;
      // Get all admin Telegram IDs
      const adminIds = await userService.getAdminTelegramIds();
      let message = `🚨 <b>Action:</b> ${action}\n`;
      for (const key in details) {
        message += `<b>${key}:</b> ${details[key]}\n`;
      }
      // If message is too long, send a summary with a button
      if (message.length > 3500) {
        const summary = message.slice(0, 3400) + '\n...';
        const buttons = {
          reply_markup: {
            inline_keyboard: [[{ text: 'View Details', callback_data: `admin_action_details_${Date.now()}` }]]
          },
          parse_mode: 'HTML'
        };
        for (const adminId of adminIds) {
          await this.bot.telegram.sendMessage(adminId, summary, buttons);
        }
      } else {
        for (const adminId of adminIds) {
          await this.bot.telegram.sendMessage(adminId, message, { parse_mode: 'HTML' });
        }
      }
    } catch (error) {
      logger.error('Error sending admin action notification:', error);
    }
  }
}

let notificationServiceInstance = null;
function setNotificationServiceInstance(instance) {
  notificationServiceInstance = instance;
}
function getNotificationServiceInstance() {
  return notificationServiceInstance;
}

module.exports = {
  NotificationService,
  setNotificationServiceInstance,
  getNotificationServiceInstance
};
