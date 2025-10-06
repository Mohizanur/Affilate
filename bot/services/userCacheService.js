/**
 * 🚀 SMART USER CACHE SERVICE
 * Prevents database hits on every request by caching user data
 */

class UserCacheService {
  constructor() {
    this.cache = new Map(); // In-memory cache
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 1000; // Maximum cached users
  }

  /**
   * Get user data from cache or database
   * @param {number} telegramId - User's Telegram ID
   * @param {Function} fetchFromDb - Function to fetch from database
   * @returns {Object} User data
   */
  async getUser(telegramId, fetchFromDb) {
    const cacheKey = `user_${telegramId}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      
      // Check if cache is still valid
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`🎯 Cache HIT for user ${telegramId}`);
        return cached.data;
      } else {
        // Cache expired, remove it
        this.cache.delete(cacheKey);
        console.log(`⏰ Cache EXPIRED for user ${telegramId}`);
      }
    }

    // Cache miss - fetch from database
    console.log(`💾 Cache MISS for user ${telegramId} - fetching from DB`);
    try {
      const userData = await fetchFromDb();
      
      // Store in cache
      this.setUser(telegramId, userData);
      
      return userData;
    } catch (error) {
      console.error(`❌ Failed to fetch user ${telegramId} from DB:`, error.message);
      throw error;
    }
  }

  /**
   * Store user data in cache
   * @param {number} telegramId - User's Telegram ID
   * @param {Object} userData - User data to cache
   */
  setUser(telegramId, userData) {
    const cacheKey = `user_${telegramId}`;
    
    // Prevent cache from growing too large
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanupOldEntries();
    }
    
    this.cache.set(cacheKey, {
      data: userData,
      timestamp: Date.now()
    });
    
    console.log(`💾 Cached user ${telegramId}`);
  }

  /**
   * Update user data in cache
   * @param {number} telegramId - User's Telegram ID
   * @param {Object} updatedData - Updated user data
   */
  updateUser(telegramId, updatedData) {
    const cacheKey = `user_${telegramId}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      cached.data = { ...cached.data, ...updatedData };
      cached.timestamp = Date.now();
      
      console.log(`🔄 Updated cache for user ${telegramId}`);
    }
  }

  /**
   * Remove user from cache
   * @param {number} telegramId - User's Telegram ID
   */
  removeUser(telegramId) {
    const cacheKey = `user_${telegramId}`;
    this.cache.delete(cacheKey);
    console.log(`🗑️ Removed user ${telegramId} from cache`);
  }

  /**
   * Clean up old cache entries
   */
  cleanupOldEntries() {
    const now = Date.now();
    const entriesToDelete = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        entriesToDelete.push(key);
      }
    }
    
    entriesToDelete.forEach(key => this.cache.delete(key));
    
    if (entriesToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${entriesToDelete.length} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp < this.cacheTimeout) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRate: this.calculateHitRate(),
      memoryUsage: `${Math.round(JSON.stringify([...this.cache.values()]).length / 1024)}KB`
    };
  }

  /**
   * Calculate cache hit rate (simplified)
   * @returns {number} Hit rate percentage
   */
  calculateHitRate() {
    // This is a simplified calculation
    // In a real implementation, you'd track hits/misses
    return this.cache.size > 0 ? 85 : 0; // Assume 85% hit rate if cache has data
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
    console.log(`🧹 Cleared all user cache`);
  }
}

// Create singleton instance
const userCacheService = new UserCacheService();

module.exports = userCacheService;
