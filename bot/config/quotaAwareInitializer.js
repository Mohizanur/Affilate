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

      // EMERGENCY: Skip all database queries to stop quota leak
      logger.info("🛡️ EMERGENCY: Skipping database queries to stop quota leak");
      
      // Use empty fallback data instead of querying database
      this.initializationData.set('users', []);
      this.initializationData.set('companies', []);
      
      logger.info(`🛡️ Master initialization complete: 0 users, 0 companies (quota protection)`);
      
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
