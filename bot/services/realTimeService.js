/**
 * 🎯 REAL-TIME SERVICE
 * 
 * Provides real-time data while respecting Firestore quota limits
 * - Smart quota management
 * - Real-time when quota available
 * - Intelligent caching when quota low
 */

const logger = require("../../utils/logger");
const smartQuotaManager = require("../config/smartQuotaManager");
const databaseService = require("../config/database");

class RealTimeService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize real-time service
   */
  async initialize() {
    try {
      this.isInitialized = true;
      logger.info("🎯 Real-Time Service initialized with smart quota management");
    } catch (error) {
      logger.error("Error initializing Real-Time Service:", error.message);
    }
  }

  /**
   * Get user data with real-time intelligence
   */
  async getUserData(telegramId, priority = 'normal') {
    const cacheKey = `user:${telegramId}`;
    
    return await smartQuotaManager.smartQuery(
      async () => {
        const userDoc = await databaseService.users().doc(telegramId).get();
        return userDoc.exists ? userDoc.data() : null;
      },
      cacheKey,
      300, // 5 minute cache
      priority
    );
  }

  /**
   * Get company data with real-time intelligence
   */
  async getCompanyData(companyId, priority = 'normal') {
    const cacheKey = `company:${companyId}`;
    
    return await smartQuotaManager.smartQuery(
      async () => {
        const companyDoc = await databaseService.companies().doc(companyId).get();
        return companyDoc.exists ? companyDoc.data() : null;
      },
      cacheKey,
      600, // 10 minute cache (companies change less)
      priority
    );
  }

  /**
   * Get recent users with quota awareness
   */
  async getRecentUsers(limit = 10, priority = 'normal') {
    const cacheKey = `users:recent:${limit}`;
    
    return await smartQuotaManager.smartQuery(
      async () => {
        const snapshot = await databaseService.users()
          .orderBy("last_active", "desc")
          .limit(limit)
          .get();
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      },
      cacheKey,
      180, // 3 minute cache for recent users
      priority
    );
  }

  /**
   * Get active companies with quota awareness
   */
  async getActiveCompanies(limit = 5, priority = 'normal') {
    const cacheKey = `companies:active:${limit}`;
    
    return await smartQuotaManager.smartQuery(
      async () => {
        const snapshot = await databaseService.companies()
          .where("status", "==", "active")
          .limit(limit)
          .get();
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      },
      cacheKey,
      300, // 5 minute cache
      priority
    );
  }

  /**
   * Get global stats with smart caching
   */
  async getGlobalStats(priority = 'normal') {
    const cacheKey = 'stats:global';
    
    return await smartQuotaManager.smartQuery(
      async () => {
        // Batch multiple queries efficiently
        // QUOTA-SAVING: Use count queries instead of fetching ALL data
        const queries = {
          totalUsers: () => databaseService.users().count().get(),
          totalCompanies: () => databaseService.companies().count().get(),
          totalReferrals: () => databaseService.referrals().count().get()
        };
        
        const results = await smartQuotaManager.batchQueries(queries, priority);
        
        return {
          totalUsers: results.totalUsers?.data?.().count || 0,
          totalCompanies: results.totalCompanies?.data?.().count || 0,
          totalReferrals: results.totalReferrals?.data?.().count || 0,
          lastUpdated: new Date().toISOString()
        };
      },
      cacheKey,
      600, // 10 minute cache for stats
      priority
    );
  }

  /**
   * Get leaderboard with quota intelligence
   */
  async getLeaderboard(limit = 10, priority = 'normal') {
    const cacheKey = `leaderboard:global:${limit}`;
    
    return await smartQuotaManager.smartQuery(
      async () => {
        const snapshot = await databaseService.users()
          .orderBy("referral_count", "desc")
          .limit(limit)
          .get();
        
        return snapshot.docs.map((doc, index) => ({
          rank: index + 1,
          id: doc.id,
          name: doc.data().name || 'Anonymous',
          referralCount: doc.data().referral_count || 0,
          earnings: doc.data().total_earnings || 0
        }));
      },
      cacheKey,
      300, // 5 minute cache
      priority
    );
  }

  /**
   * Force real-time update (uses quota)
   */
  async forceRealTimeUpdate(type, id = null) {
    try {
      let cacheKey, queryFunction;
      
      switch (type) {
        case 'user':
          cacheKey = `user:${id}`;
          queryFunction = async () => {
            const doc = await databaseService.users().doc(id).get();
            return doc.exists ? doc.data() : null;
          };
          break;
          
        case 'stats':
          cacheKey = 'stats:global';
          queryFunction = async () => {
            // QUOTA-SAVING: Use count queries instead of fetching ALL data
            const [users, companies, referrals] = await Promise.all([
              databaseService.users().count().get(),
              databaseService.companies().count().get(),
              databaseService.referrals().count().get()
            ]);
            
            return {
              totalUsers: users.data().count,
              totalCompanies: companies.data().count,
              totalReferrals: referrals.data().count,
              lastUpdated: new Date().toISOString()
            };
          };
          break;
          
        case 'leaderboard':
          cacheKey = 'leaderboard:global:10';
          queryFunction = async () => {
            const snapshot = await databaseService.users()
              .orderBy("referral_count", "desc")
              .limit(10)
              .get();
            
            return snapshot.docs.map((doc, index) => ({
              rank: index + 1,
              id: doc.id,
              name: doc.data().name || 'Anonymous',
              referralCount: doc.data().referral_count || 0
            }));
          };
          break;
          
        default:
          throw new Error(`Unknown update type: ${type}`);
      }
      
      return await smartQuotaManager.forceRealTimeUpdate(queryFunction, cacheKey, 'high');
      
    } catch (error) {
      logger.error(`Failed to force real-time update for ${type}:`, error.message);
      throw error;
    }
  }

  /**
   * Get quota status for monitoring
   */
  getQuotaStatus() {
    return smartQuotaManager.getQuotaStatus();
  }

  /**
   * Check if real-time data is available
   */
  isRealTimeAvailable(priority = 'normal') {
    return smartQuotaManager.canMakeRead(priority);
  }

  /**
   * Get service health
   */
  getServiceHealth() {
    const quotaStatus = this.getQuotaStatus();
    
    return {
      status: quotaStatus.daily.percentage < 90 ? 'healthy' : 'quota_limited',
      realTimeAvailable: this.isRealTimeAvailable(),
      quotaUsage: {
        daily: `${quotaStatus.daily.percentage.toFixed(1)}%`,
        minute: `${quotaStatus.minute.percentage.toFixed(1)}%`
      },
      strategy: quotaStatus.strategy,
      timeToReset: quotaStatus.timeToReset
    };
  }

  /**
   * Batch get multiple data types efficiently
   */
  async batchGetData(requests, priority = 'normal') {
    const results = {};
    
    for (const request of requests) {
      try {
        switch (request.type) {
          case 'user':
            results[request.key] = await this.getUserData(request.id, priority);
            break;
          case 'company':
            results[request.key] = await this.getCompanyData(request.id, priority);
            break;
          case 'stats':
            results[request.key] = await this.getGlobalStats(priority);
            break;
          case 'leaderboard':
            results[request.key] = await this.getLeaderboard(request.limit || 10, priority);
            break;
          default:
            results[request.key] = null;
        }
      } catch (error) {
        logger.error(`Batch request failed for ${request.key}:`, error.message);
        results[request.key] = null;
      }
    }
    
    return results;
  }
}

// Singleton instance
const realTimeService = new RealTimeService();

module.exports = realTimeService;
