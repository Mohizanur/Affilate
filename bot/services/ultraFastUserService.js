const databaseService = require("../config/database");
const cacheService = require("../config/cache");
const ultraFastResponse = require("../config/ultraFastResponse");
const connectionPool = require("../config/connectionPool");
const realTimeMonitor = require("../config/realTimeMonitor");
const { v4: uuidv4 } = require("uuid");
const logger = require("../../utils/logger");
const validator = require("validator");

/**
 * 🚀 ULTRA-FAST USER SERVICE
 * 
 * This service provides microsecond-level user operations using
 * advanced caching, connection pooling, and pre-computation.
 */

class UltraFastUserService {
  constructor() {
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize the ultra-fast user service
   */
  async initialize() {
    try {
      // Pre-warm user cache with common users
      await this.preWarmUserCache();
      this.isInitialized = true;
      logger.info("🚀 Ultra-Fast User Service initialized");
    } catch (error) {
      logger.error("Failed to initialize Ultra-Fast User Service:", error);
      throw error;
    }
  }

  /**
   * Pre-warm user cache for instant responses
   */
  async preWarmUserCache() {
    try {
      // Get most active users and cache them
      const activeUsers = await this.getMostActiveUsers(100);
      
      for (const user of activeUsers) {
        cacheService.setUser(user.telegram_id, user);
        ultraFastResponse.precomputedResponses.set(`user:${user.telegram_id}`, user);
      }
      
      logger.info(`🔥 Pre-warmed cache with ${activeUsers.length} active users`);
    } catch (error) {
      logger.error("Error pre-warming user cache:", error);
    }
  }

  /**
   * Get most active users
   */
  async getMostActiveUsers(limit = 100) {
    try {
      return await connectionPool.executeWithConnection('users', async (connection) => {
        const usersSnap = await connection.db.collection
          .orderBy("last_active", "desc")
          .limit(limit)
          .get();
        
        return usersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      });
    } catch (error) {
      logger.error("Error getting most active users:", error);
      return [];
    }
  }

  /**
   * Ultra-fast user lookup with multiple optimization layers
   */
  async getUserByTelegramId(telegramId) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Use ultra-fast response system
      const user = await ultraFastResponse.getUserUltraFast(telegramId);
      
      // Record performance metrics
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, !!user);
      
      return user;
    } catch (error) {
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, false);
      logger.error("Error in getUserByTelegramId:", error);
      throw error;
    }
  }

  /**
   * Ultra-fast user creation/update with batch optimization
   */
  async createOrUpdateUser(userData) {
    const startTime = process.hrtime.bigint();
    
    try {
      const { telegramId, firstName, lastName, username } = userData;
      
      // Check if user exists using ultra-fast lookup
      const existingUser = await this.getUserByTelegramId(telegramId);
      
      if (existingUser) {
        // Update existing user
        const updateData = {
          last_active: new Date(),
          ...(firstName && { first_name: firstName }),
          ...(lastName && { last_name: lastName }),
          ...(username && { username: username.toLowerCase() })
        };
        
        // Preserve important fields
        if (existingUser.canRegisterCompany !== undefined) {
          updateData.canRegisterCompany = existingUser.canRegisterCompany;
        }
        
        const result = await connectionPool.executeWithConnection('users', async (connection) => {
          await connection.db.query(telegramId.toString()).update(updateData);
          return { id: existingUser.id, ...existingUser, ...updateData };
        });
        
        // Update caches
        cacheService.setUser(telegramId, result);
        ultraFastResponse.precomputedResponses.set(`user:${telegramId}`, result);
        
        // Record performance
        const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        realTimeMonitor.recordRequest(responseTime, true);
        
        return result;
      } else {
        // Create new user
        const userId = uuidv4();
        const newUser = {
          id: userId,
          telegram_id: telegramId,
          first_name: firstName,
          last_name: lastName,
          username: username ? username.toLowerCase() : undefined,
          created_at: new Date(),
          last_active: new Date(),
        };
        
        const result = await connectionPool.executeWithConnection('users', async (connection) => {
          await connection.db.query(telegramId.toString()).set(newUser);
          return newUser;
        });
        
        // Update caches
        cacheService.setUser(telegramId, result);
        ultraFastResponse.precomputedResponses.set(`user:${telegramId}`, result);
        
        // Record performance
        const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        realTimeMonitor.recordRequest(responseTime, true);
        
        return result;
      }
    } catch (error) {
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, false);
      logger.error("Error in createOrUpdateUser:", error);
      throw error;
    }
  }

  /**
   * Ultra-fast phone verification with validation
   */
  async verifyPhone(telegramId, phoneNumber) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Validate phone number
      phoneNumber = (phoneNumber + "").trim();
      let normalizedPhone = phoneNumber.replace(/(?!^)[^\d]/g, "");
      
      if (!/^(\+?\d{10,})$/.test(normalizedPhone)) {
        throw new Error("Invalid phone number format.");
      }
      
      if (!normalizedPhone.startsWith("+")) {
        phoneNumber = "+" + normalizedPhone;
      } else {
        phoneNumber = normalizedPhone;
      }
      
      // Check for existing phone number
      const existing = await connectionPool.executeWithConnection('users', async (connection) => {
        const query = await connection.db.collection
          .where("phone_number", "==", phoneNumber)
          .get();
        return query;
      });
      
      if (!existing.empty) {
        const alreadyUsed = existing.docs.some(
          (doc) => doc.id !== telegramId.toString()
        );
        if (alreadyUsed) {
          throw new Error("This phone number is already registered with another account.");
        }
      }
      
      // Update user with verified phone
      const result = await connectionPool.executeWithConnection('users', async (connection) => {
        await connection.db.query(telegramId.toString()).update({
          phone_number: phoneNumber,
          phone_verified: true,
          phone_verified_at: new Date(),
        });
        
        const userDoc = await connection.db.query(telegramId.toString()).get();
        return { id: userDoc.id, ...userDoc.data() };
      });
      
      // Clear and update caches
      cacheService.clearUserCache(telegramId);
      cacheService.setUser(telegramId, result);
      ultraFastResponse.precomputedResponses.set(`user:${telegramId}`, result);
      
      // Record performance
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, true);
      
      logger.info(`Phone verified for user: ${telegramId}`);
      return result;
    } catch (error) {
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, false);
      logger.error("Error verifying phone:", error);
      throw error;
    }
  }

  /**
   * Ultra-fast leaderboard with pre-computation
   */
  async getGlobalLeaderboard(limit = 10) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Check pre-computed leaderboard first
      const precomputed = ultraFastResponse.precomputedResponses.get("leaderboard:global");
      if (precomputed && precomputed.length > 0) {
        const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        realTimeMonitor.recordRequest(responseTime, true);
        return precomputed.slice(0, limit);
      }
      
      // Compute leaderboard
      const result = await connectionPool.executeWithConnection('users', async (connection) => {
        const usersSnap = await connection.db.collection
          .orderBy("verifiedReferralCount", "desc")
          .limit(limit)
          .get();
        
        return usersSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            telegramId: d.telegramId,
            firstName: d.firstName,
            verifiedReferralCount: d.verifiedReferralCount || 0,
          };
        });
      });
      
      // Cache the result
      ultraFastResponse.precomputedResponses.set("leaderboard:global", result);
      
      // Record performance
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, true);
      
      return result;
    } catch (error) {
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, false);
      logger.error("Error getting global leaderboard:", error);
      throw error;
    }
  }

  /**
   * Ultra-fast user search with indexing
   */
  async searchUsers(query) {
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await connectionPool.executeWithConnection('users', async (connection) => {
        const usersSnap = await connection.db.collection.get();
        const q = query.toLowerCase();
        
        return usersSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(
            (u) =>
              (u.username && u.username.toLowerCase().includes(q)) ||
              (u.phone_number && u.phone_number.toLowerCase().includes(q)) ||
              (u.id && u.id.toLowerCase().includes(q))
          );
      });
      
      // Record performance
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, true);
      
      return result;
    } catch (error) {
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, false);
      logger.error("Error searching users:", error);
      throw error;
    }
  }

  /**
   * Ultra-fast user statistics
   */
  async getUserStats() {
    const startTime = process.hrtime.bigint();
    
    try {
      // Check pre-computed stats first
      const precomputed = ultraFastResponse.precomputedResponses.get("stats:global");
      if (precomputed) {
        const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        realTimeMonitor.recordRequest(responseTime, true);
        return precomputed;
      }
      
      // Compute stats
      const result = await connectionPool.executeWithConnection('users', async (connection) => {
        const usersSnap = await connection.db.collection.get();
        
        return {
          totalUsers: usersSnap.size,
          verifiedUsers: usersSnap.docs.filter(doc => doc.data().phone_verified).length,
          activeUsers: usersSnap.docs.filter(doc => {
            const lastActive = doc.data().last_active;
            return lastActive && lastActive.toDate() > new Date(Date.now() - 24 * 60 * 60 * 1000);
          }).length,
          timestamp: new Date()
        };
      });
      
      // Cache the result
      ultraFastResponse.precomputedResponses.set("stats:global", result);
      
      // Record performance
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, true);
      
      return result;
    } catch (error) {
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, false);
      logger.error("Error getting user stats:", error);
      throw error;
    }
  }

  /**
   * Ultra-fast batch operations
   */
  async batchUpdateUsers(updates) {
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await connectionPool.executeWithConnection('users', async (connection) => {
        const batch = connection.db.batch();
        
        for (const update of updates) {
          const { telegramId, updateData } = update;
          const userRef = connection.db.query(telegramId.toString());
          batch.update(userRef, {
            ...updateData,
            updatedAt: new Date()
          });
        }
        
        await batch.commit();
        return updates.length;
      });
      
      // Clear affected user caches
      for (const update of updates) {
        cacheService.clearUserCache(update.telegramId);
        ultraFastResponse.precomputedResponses.delete(`user:${update.telegramId}`);
      }
      
      // Record performance
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, true);
      
      return result;
    } catch (error) {
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      realTimeMonitor.recordRequest(responseTime, false);
      logger.error("Error in batch update users:", error);
      throw error;
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      service: "UltraFastUserService",
      isInitialized: this.isInitialized,
      cacheStats: cacheService.getCacheHealth(),
      ultraFastStats: ultraFastResponse.getPerformanceStats(),
      connectionPoolStats: connectionPool.getGlobalStats(),
      realTimeStats: realTimeMonitor.getPerformanceSummary()
    };
  }

  /**
   * Emergency cleanup
   */
  emergencyCleanup() {
    logger.warn("🚨 Emergency cleanup for UltraFastUserService");
    
    // Clear all caches
    cacheService.clearUserCache();
    ultraFastResponse.emergencyCleanup();
    
    logger.info("🧹 UltraFastUserService emergency cleanup completed");
  }
}

// Export singleton instance
const ultraFastUserService = new UltraFastUserService();
module.exports = ultraFastUserService;


