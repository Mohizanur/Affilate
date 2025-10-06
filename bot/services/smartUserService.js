/**
 * 🚀 SMART USER SERVICE
 * Uses caching to avoid database hits on every request
 */

const userCacheService = require('./userCacheService');
const userService = require('./userService').userService;

class SmartUserService {
  /**
   * Get user by Telegram ID with smart caching
   * @param {number} telegramId - User's Telegram ID
   * @returns {Object} User data
   */
  async getUserByTelegramId(telegramId) {
    return await userCacheService.getUser(
      telegramId,
      () => userService.getUserByTelegramId(telegramId)
    );
  }

  /**
   * Create user and cache it
   * @param {Object} userData - User data to create
   * @returns {Object} Created user
   */
  async createUser(userData) {
    const user = await userService.createUser(userData);
    
    // Cache the newly created user
    if (user && user.telegramId) {
      userCacheService.setUser(user.telegramId, user);
    }
    
    return user;
  }

  /**
   * Update user and refresh cache
   * @param {number} telegramId - User's Telegram ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated user
   */
  async updateUser(telegramId, updateData) {
    const user = await userService.updateUser(telegramId, updateData);
    
    // Update cache with new data
    if (user) {
      userCacheService.updateUser(telegramId, user);
    }
    
    return user;
  }

  /**
   * Delete user and remove from cache
   * @param {number} telegramId - User's Telegram ID
   * @returns {boolean} Success status
   */
  async deleteUser(telegramId) {
    const success = await userService.deleteUser(telegramId);
    
    if (success) {
      userCacheService.removeUser(telegramId);
    }
    
    return success;
  }

  /**
   * Get user with fallback to database if cache fails
   * @param {number} telegramId - User's Telegram ID
   * @returns {Object} User data
   */
  async getUserWithFallback(telegramId) {
    try {
      return await this.getUserByTelegramId(telegramId);
    } catch (error) {
      console.error(`❌ Cache failed for user ${telegramId}, falling back to DB:`, error.message);
      
      // Fallback to direct database call
      try {
        const user = await userService.getUserByTelegramId(telegramId);
        if (user) {
          userCacheService.setUser(telegramId, user);
        }
        return user;
      } catch (dbError) {
        console.error(`❌ Database fallback also failed for user ${telegramId}:`, dbError.message);
        throw dbError;
      }
    }
  }

  /**
   * Check if user is admin (cached)
   * @param {number} telegramId - User's Telegram ID
   * @returns {boolean} Is admin
   */
  async isAdmin(telegramId) {
    const user = await this.getUserByTelegramId(telegramId);
    return user && (user.role === 'admin' || user.isAdmin === true);
  }

  /**
   * Check if user is verified (cached)
   * @param {number} telegramId - User's Telegram ID
   * @returns {boolean} Is verified
   */
  async isVerified(telegramId) {
    const user = await this.getUserByTelegramId(telegramId);
    return user && (user.phoneVerified || user.phone_verified);
  }

  /**
   * Get user language (cached)
   * @param {number} telegramId - User's Telegram ID
   * @returns {string} User language
   */
  async getUserLanguage(telegramId) {
    const user = await this.getUserByTelegramId(telegramId);
    return user?.language || 'en';
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return userCacheService.getStats();
  }

  /**
   * Clear user cache
   */
  clearCache() {
    userCacheService.clearCache();
  }

  /**
   * Invalidate user cache (force refresh on next request)
   * @param {number} telegramId - User's Telegram ID
   */
  invalidateUser(telegramId) {
    userCacheService.removeUser(telegramId);
  }
}

// Create singleton instance
const smartUserService = new SmartUserService();

module.exports = smartUserService;
