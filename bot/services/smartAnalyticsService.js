/**
 * 🚀 SMART ANALYTICS SERVICE
 * Caches analytics data to prevent massive database queries
 */

class SmartAnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
    this.maxCacheSize = 100;
  }

  /**
   * Get cached analytics or fetch from database
   */
  async getAnalytics() {
    const cacheKey = 'analytics:global';
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🎯 Analytics cache HIT');
        return cached.data;
      }
    }

    console.log('💾 Analytics cache MISS - fetching from DB');
    const start = Date.now();
    
    try {
      // Use smart batching instead of fetching ALL data
      const [userCount, companyCount, referralCount] = await Promise.all([
        this.getUserCount(),
        this.getCompanyCount(), 
        this.getReferralCount()
      ]);

      const analytics = {
        totalUsers: userCount,
        totalCompanies: companyCount,
        totalReferrals: referralCount,
        lastUpdated: new Date().toISOString()
      };

      this.cache.set(cacheKey, {
        data: analytics,
        timestamp: Date.now()
      });

      const time = Date.now() - start;
      console.log(`✅ Analytics fetched in ${time}ms`);
      return analytics;
    } catch (error) {
      console.error('❌ Analytics fetch failed:', error.message);
      throw error;
    }
  }

  /**
   * Get user count efficiently (uses count aggregation when available)
   */
  async getUserCount() {
    const cacheKey = 'count:users';
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🎯 User count cache HIT');
        return cached.data;
      }
    }

    console.log('💾 User count cache MISS - querying DB');
    const databaseService = require('../config/database');
    
    // 🚀 QUOTA-SAVING: Use count() instead of select() to avoid full collection scan
    const snapshot = await databaseService.users().count().get();
    const count = snapshot.data().count;
    
    this.cache.set(cacheKey, {
      data: count,
      timestamp: Date.now()
    });
    
    console.log(`✅ User count: ${count}`);
    return count;
  }

  /**
   * Get company count efficiently (uses count aggregation when available)
   */
  async getCompanyCount() {
    const cacheKey = 'count:companies';
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🎯 Company count cache HIT');
        return cached.data;
      }
    }

    console.log('💾 Company count cache MISS - querying DB');
    const databaseService = require('../config/database');
    
    // 🚀 QUOTA-SAVING: Use count() instead of select() to avoid full collection scan
    const snapshot = await databaseService.companies().count().get();
    const count = snapshot.data().count;
    
    this.cache.set(cacheKey, {
      data: count,
      timestamp: Date.now()
    });
    
    console.log(`✅ Company count: ${count}`);
    return count;
  }

  /**
   * Get referral count efficiently (uses count aggregation when available)
   */
  async getReferralCount() {
    const cacheKey = 'count:referrals';
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🎯 Referral count cache HIT');
        return cached.data;
      }
    }

    console.log('💾 Referral count cache MISS - querying DB');
    const databaseService = require('../config/database');
    
    // 🚀 QUOTA-SAVING: Use count() instead of select() to avoid full collection scan
    const snapshot = await databaseService.referrals().count().get();
    const count = snapshot.data().count;
    
    this.cache.set(cacheKey, {
      data: count,
      timestamp: Date.now()
    });
    
    console.log(`✅ Referral count: ${count}`);
    return count;
  }

  /**
   * Get cached leaderboard
   */
  async getLeaderboard(limit = 10) {
    const cacheKey = `leaderboard:${limit}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🎯 Leaderboard cache HIT');
        return cached.data;
      }
    }

    console.log('💾 Leaderboard cache MISS - fetching from DB');
    const start = Date.now();
    
    try {
      const databaseService = require('../config/database');
      const snapshot = await databaseService.users()
        .orderBy("referral_count", "desc")
        .limit(limit)
        .get();
      
      const leaderboard = snapshot.docs.map((doc, index) => ({
        rank: index + 1,
        id: doc.id,
        name: doc.data().name || 'Anonymous',
        referralCount: doc.data().referral_count || 0
      }));

      this.cache.set(cacheKey, {
        data: leaderboard,
        timestamp: Date.now()
      });

      const time = Date.now() - start;
      console.log(`✅ Leaderboard fetched in ${time}ms`);
      return leaderboard;
    } catch (error) {
      console.error('❌ Leaderboard fetch failed:', error.message);
      throw error;
    }
  }

  /**
   * Get cached user stats
   */
  async getUserStats(userId) {
    const cacheKey = `userstats:${userId}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`🎯 User stats cache HIT for ${userId}`);
        return cached.data;
      }
    }

    console.log(`💾 User stats cache MISS for ${userId} - fetching from DB`);
    const start = Date.now();
    
    try {
      const referralService = require('./referralService');
      const stats = await referralService.getReferralStats(userId);
      
      this.cache.set(cacheKey, {
        data: stats,
        timestamp: Date.now()
      });

      const time = Date.now() - start;
      console.log(`✅ User stats fetched in ${time}ms`);
      return stats;
    } catch (error) {
      console.error(`❌ User stats fetch failed for ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Invalidate cache for specific user
   */
  invalidateUser(userId) {
    const keys = [`userstats:${userId}`];
    keys.forEach(key => this.cache.delete(key));
    console.log(`🗑️ Invalidated cache for user ${userId}`);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Cleared all analytics cache');
  }

  /**
   * Get cache statistics
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
      memoryUsage: `${Math.round(JSON.stringify([...this.cache.values()]).length / 1024)}KB`
    };
  }
}

// Create singleton instance
const smartAnalyticsService = new SmartAnalyticsService();

module.exports = smartAnalyticsService;
