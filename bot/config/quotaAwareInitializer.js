/**
 * 🛡️ QUOTA-AWARE INITIALIZER
 * 
 * Prevents quota exhaustion during system initialization
 * Only the master process does database initialization
 */

const logger = require("../../utils/logger");

class QuotaAwareInitializer {
  constructor() {
    this.isInitialized = false;
    this.initializationData = new Map();
    this.cluster = require('cluster');
  }

  /**
   * Initialize with quota protection
   */
  async initialize() {
    try {
      // Only master process should do database initialization
      if (this.cluster.isMaster) {
        logger.info("🛡️ Master process: Performing quota-safe database initialization");
        await this.performMasterInitialization();
        this.isInitialized = true;
      } else {
        logger.info("👷 Worker process: Skipping database initialization to save quota");
        // Workers get pre-computed data from master or use fallbacks
        this.useWorkerFallbacks();
        this.isInitialized = true;
      }
    } catch (error) {
      logger.error("Error in quota-aware initialization:", error.message);
      // Continue with fallbacks
      this.useWorkerFallbacks();
      this.isInitialized = true;
    }
  }

  /**
   * Master process does minimal database queries
   */
  async performMasterInitialization() {
    try {
      const databaseService = require("./database");
      
      if (!databaseService.isInitialized || !databaseService.isInitialized()) {
        logger.info("🛡️ Database not ready - using fallback initialization");
        return;
      }

      // MINIMAL queries - only what's absolutely necessary
      logger.info("🛡️ Performing minimal database queries to save quota");
      
      // Get just 10 recent users instead of 100
      const recentUsers = await databaseService.users()
        .orderBy("last_active", "desc")
        .limit(10)  // Reduced from 100 to 10
        .get();
      
      // Get just 5 companies instead of 50
      const companies = await databaseService.companies()
        .limit(5)  // Reduced from 50 to 5
        .get();
      
      // Store minimal data for workers
      this.initializationData.set('users', recentUsers.docs.map(doc => doc.data()));
      this.initializationData.set('companies', companies.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      logger.info(`🛡️ Master initialization complete: ${recentUsers.size} users, ${companies.size} companies`);
      
    } catch (error) {
      logger.error("Error in master initialization:", error.message);
      // Continue with fallbacks
    }
  }

  /**
   * Workers use fallback data to avoid quota usage
   */
  useWorkerFallbacks() {
    logger.info("👷 Worker using fallback initialization data");
    
    // Set fallback data that doesn't require database
    this.initializationData.set('users', []);
    this.initializationData.set('companies', []);
    this.initializationData.set('stats', {
      totalUsers: 0,
      totalCompanies: 0,
      totalReferrals: 0
    });
    this.initializationData.set('leaderboard', []);
  }

  /**
   * Get initialization data
   */
  getData(key) {
    return this.initializationData.get(key) || [];
  }

  /**
   * Check if we should skip database operations
   */
  shouldSkipDatabaseOps() {
    // Workers should skip database operations during initialization
    return this.cluster.isWorker;
  }

  /**
   * Get quota-safe cache data
   */
  getQuotaSafeCacheData() {
    return {
      users: this.getData('users'),
      companies: this.getData('companies'),
      stats: this.getData('stats'),
      leaderboard: this.getData('leaderboard')
    };
  }
}

// Singleton instance
const quotaAwareInitializer = new QuotaAwareInitializer();

module.exports = quotaAwareInitializer;
