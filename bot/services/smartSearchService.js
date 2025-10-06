/**
 * 🚀 SMART SEARCH SERVICE
 * Efficient user search without fetching all users
 */

class SmartSearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 50;
  }

  /**
   * Smart user search with caching and pagination
   */
  async searchUsers(query, limit = 20) {
    const cacheKey = `search:${query.toLowerCase()}:${limit}`;
    
    // Check cache first
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`🎯 Search cache HIT for: "${query}"`);
        return cached.data;
      }
    }

    console.log(`💾 Search cache MISS for: "${query}" - searching DB`);
    const start = Date.now();
    
    try {
      const databaseService = require('../config/database');
      
      // Use Firestore's built-in search capabilities instead of fetching all users
      const results = await this.performEfficientSearch(query, limit);
      
      this.searchCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      const time = Date.now() - start;
      console.log(`✅ Search completed in ${time}ms, found ${results.length} results`);
      return results;
    } catch (error) {
      console.error(`❌ Search failed for "${query}":`, error.message);
      throw error;
    }
  }

  /**
   * Perform efficient search using Firestore queries
   */
  async performEfficientSearch(query, limit) {
    const databaseService = require('../config/database');
    const q = query.toLowerCase();
    
    // Try different search strategies
    const searchPromises = [];
    
    // Search by username (most common)
    if (q.length >= 2) {
      searchPromises.push(
        databaseService.users()
          .where('username', '>=', q)
          .where('username', '<=', q + '\uf8ff')
          .limit(limit)
          .get()
      );
    }
    
    // Search by phone number (if it looks like a phone)
    if (/^\d+$/.test(q) && q.length >= 5) {
      searchPromises.push(
        databaseService.users()
          .where('phone_number', '==', q)
          .limit(limit)
          .get()
      );
    }
    
    // Search by user ID (if it looks like a Telegram ID)
    if (/^\d+$/.test(q) && q.length >= 8) {
      searchPromises.push(
        databaseService.users()
          .where('telegramId', '==', parseInt(q))
          .limit(limit)
          .get()
      );
    }
    
    // Execute searches in parallel
    const results = await Promise.all(searchPromises);
    
    // Combine and deduplicate results
    const userMap = new Map();
    results.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const userData = { id: doc.id, ...doc.data() };
        userMap.set(doc.id, userData);
      });
    });
    
    return Array.from(userMap.values()).slice(0, limit);
  }

  /**
   * Search users by exact criteria
   */
  async searchUsersByCriteria(criteria) {
    const cacheKey = `search:criteria:${JSON.stringify(criteria)}`;
    
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🎯 Criteria search cache HIT');
        return cached.data;
      }
    }

    console.log('💾 Criteria search cache MISS - searching DB');
    const start = Date.now();
    
    try {
      const databaseService = require('../config/database');
      let query = databaseService.users();
      
      // Build query based on criteria
      if (criteria.role) {
        query = query.where('role', '==', criteria.role);
      }
      if (criteria.isAdmin !== undefined) {
        query = query.where('isAdmin', '==', criteria.isAdmin);
      }
      if (criteria.phoneVerified !== undefined) {
        query = query.where('phoneVerified', '==', criteria.phoneVerified);
      }
      if (criteria.limit) {
        query = query.limit(criteria.limit);
      }
      
      const snapshot = await query.get();
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.searchCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      const time = Date.now() - start;
      console.log(`✅ Criteria search completed in ${time}ms, found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('❌ Criteria search failed:', error.message);
      throw error;
    }
  }

  /**
   * Get admin users efficiently
   */
  async getAdminUsers() {
    return await this.searchUsersByCriteria({
      isAdmin: true,
      limit: 50
    });
  }

  /**
   * Get verified users efficiently
   */
  async getVerifiedUsers(limit = 100) {
    return await this.searchUsersByCriteria({
      phoneVerified: true,
      limit
    });
  }

  /**
   * Clear search cache
   */
  clearCache() {
    this.searchCache.clear();
    console.log('🧹 Cleared all search cache');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp < this.cacheTimeout) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      totalEntries: this.searchCache.size,
      validEntries,
      expiredEntries,
      memoryUsage: `${Math.round(JSON.stringify([...this.searchCache.values()]).length / 1024)}KB`
    };
  }
}

// Create singleton instance
const smartSearchService = new SmartSearchService();

module.exports = smartSearchService;
