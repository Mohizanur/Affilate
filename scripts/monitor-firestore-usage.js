const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

// Firestore usage monitoring class
class FirestoreUsageMonitor {
  constructor() {
    this.usageStats = {
      reads: 0,
      writes: 0,
      deletes: 0,
      networkBytes: 0,
      startTime: Date.now(),
      lastReset: Date.now()
    };
    
    this.quotaLimits = {
      reads: 50000, // Free tier daily limit
      writes: 20000, // Free tier daily limit
      deletes: 20000, // Free tier daily limit
      networkBytes: 10 * 1024 * 1024 // 10MB daily limit
    };
    
    this.performanceMetrics = {
      queryTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
    
    // Start monitoring
    this.startMonitoring();
  }

  // Start monitoring Firestore usage
  startMonitoring() {
    logger.info('📊 Starting Firestore usage monitoring...');
    
    // Monitor every 5 minutes
    setInterval(() => {
      this.logUsageStats();
    }, 5 * 60 * 1000);
    
    // Reset daily stats at midnight
    this.scheduleDailyReset();
    
    // Monitor performance every minute
    setInterval(() => {
      this.logPerformanceMetrics();
    }, 60 * 1000);
  }

  // Record a read operation
  recordRead(bytes = 0) {
    this.usageStats.reads++;
    this.usageStats.networkBytes += bytes;
    this.checkQuotaLimits();
  }

  // Record a write operation
  recordWrite(bytes = 0) {
    this.usageStats.writes++;
    this.usageStats.networkBytes += bytes;
    this.checkQuotaLimits();
  }

  // Record a delete operation
  recordDelete() {
    this.usageStats.deletes++;
    this.checkQuotaLimits();
  }

  // Record query performance
  recordQueryTime(duration) {
    this.performanceMetrics.queryTimes.push(duration);
    
    // Keep only last 1000 query times
    if (this.performanceMetrics.queryTimes.length > 1000) {
      this.performanceMetrics.queryTimes.shift();
    }
  }

  // Record cache hit/miss
  recordCacheHit() {
    this.performanceMetrics.cacheHits++;
  }

  recordCacheMiss() {
    this.performanceMetrics.cacheMisses++;
  }

  // Record error
  recordError() {
    this.performanceMetrics.errors++;
  }

  // Check quota limits and alert if exceeded
  checkQuotaLimits() {
    const readPercentage = (this.usageStats.reads / this.quotaLimits.reads) * 100;
    const writePercentage = (this.usageStats.writes / this.quotaLimits.writes) * 100;
    const deletePercentage = (this.usageStats.deletes / this.quotaLimits.deletes) * 100;
    const networkPercentage = (this.usageStats.networkBytes / this.quotaLimits.networkBytes) * 100;

    // Alert at 80% usage
    if (readPercentage >= 80) {
      logger.warn(`⚠️ Firestore reads at ${readPercentage.toFixed(1)}% of daily limit`);
    }
    if (writePercentage >= 80) {
      logger.warn(`⚠️ Firestore writes at ${writePercentage.toFixed(1)}% of daily limit`);
    }
    if (deletePercentage >= 80) {
      logger.warn(`⚠️ Firestore deletes at ${deletePercentage.toFixed(1)}% of daily limit`);
    }
    if (networkPercentage >= 80) {
      logger.warn(`⚠️ Firestore network usage at ${networkPercentage.toFixed(1)}% of daily limit`);
    }

    // Alert at 100% usage
    if (readPercentage >= 100) {
      logger.error(`🚨 Firestore reads exceeded daily limit!`);
    }
    if (writePercentage >= 100) {
      logger.error(`🚨 Firestore writes exceeded daily limit!`);
    }
    if (deletePercentage >= 100) {
      logger.error(`🚨 Firestore deletes exceeded daily limit!`);
    }
    if (networkPercentage >= 100) {
      logger.error(`🚨 Firestore network usage exceeded daily limit!`);
    }
  }

  // Log current usage statistics
  logUsageStats() {
    const uptime = Date.now() - this.usageStats.startTime;
    const uptimeHours = uptime / (1000 * 60 * 60);
    
    const readPercentage = (this.usageStats.reads / this.quotaLimits.reads) * 100;
    const writePercentage = (this.usageStats.writes / this.quotaLimits.writes) * 100;
    const deletePercentage = (this.usageStats.deletes / this.quotaLimits.deletes) * 100;
    const networkPercentage = (this.usageStats.networkBytes / this.quotaLimits.networkBytes) * 100;

    logger.info('📊 Firestore Usage Statistics:', {
      uptime: `${uptimeHours.toFixed(1)} hours`,
      reads: {
        count: this.usageStats.reads,
        limit: this.quotaLimits.reads,
        percentage: `${readPercentage.toFixed(1)}%`,
        rate: `${(this.usageStats.reads / uptimeHours).toFixed(1)}/hour`
      },
      writes: {
        count: this.usageStats.writes,
        limit: this.quotaLimits.writes,
        percentage: `${writePercentage.toFixed(1)}%`,
        rate: `${(this.usageStats.writes / uptimeHours).toFixed(1)}/hour`
      },
      deletes: {
        count: this.usageStats.deletes,
        limit: this.quotaLimits.deletes,
        percentage: `${deletePercentage.toFixed(1)}%`,
        rate: `${(this.usageStats.deletes / uptimeHours).toFixed(1)}/hour`
      },
      network: {
        bytes: this.formatBytes(this.usageStats.networkBytes),
        limit: this.formatBytes(this.quotaLimits.networkBytes),
        percentage: `${networkPercentage.toFixed(1)}%`
      }
    });
  }

  // Log performance metrics
  logPerformanceMetrics() {
    const totalQueries = this.performanceMetrics.queryTimes.length;
    if (totalQueries === 0) return;

    const avgQueryTime = this.performanceMetrics.queryTimes.reduce((a, b) => a + b, 0) / totalQueries;
    const maxQueryTime = Math.max(...this.performanceMetrics.queryTimes);
    const minQueryTime = Math.min(...this.performanceMetrics.queryTimes);

    const totalCacheRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (this.performanceMetrics.cacheHits / totalCacheRequests) * 100 : 0;

    logger.info('⚡ Firestore Performance Metrics:', {
      queries: {
        total: totalQueries,
        avgTime: `${avgQueryTime.toFixed(2)}ms`,
        maxTime: `${maxQueryTime.toFixed(2)}ms`,
        minTime: `${minQueryTime.toFixed(2)}ms`
      },
      cache: {
        hits: this.performanceMetrics.cacheHits,
        misses: this.performanceMetrics.cacheMisses,
        hitRate: `${cacheHitRate.toFixed(1)}%`
      },
      errors: this.performanceMetrics.errors
    });
  }

  // Schedule daily reset of usage statistics
  scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyStats();
      // Schedule next reset
      this.scheduleDailyReset();
    }, timeUntilMidnight);
  }

  // Reset daily usage statistics
  resetDailyStats() {
    logger.info('🔄 Resetting daily Firestore usage statistics');
    
    // Archive current stats
    const archivedStats = {
      ...this.usageStats,
      endTime: Date.now(),
      duration: Date.now() - this.usageStats.lastReset
    };
    
    // Log archived stats
    logger.info('📈 Daily Firestore Usage Summary:', archivedStats);
    
    // Reset stats
    this.usageStats = {
      reads: 0,
      writes: 0,
      deletes: 0,
      networkBytes: 0,
      startTime: Date.now(),
      lastReset: Date.now()
    };
    
    // Reset performance metrics
    this.performanceMetrics = {
      queryTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  }

  // Get current usage statistics
  getUsageStats() {
    return {
      ...this.usageStats,
      uptime: Date.now() - this.usageStats.startTime,
      readPercentage: (this.usageStats.reads / this.quotaLimits.reads) * 100,
      writePercentage: (this.usageStats.writes / this.quotaLimits.writes) * 100,
      deletePercentage: (this.usageStats.deletes / this.quotaLimits.deletes) * 100,
      networkPercentage: (this.usageStats.networkBytes / this.quotaLimits.networkBytes) * 100
    };
  }

  // Get performance metrics
  getPerformanceMetrics() {
    const totalQueries = this.performanceMetrics.queryTimes.length;
    const avgQueryTime = totalQueries > 0 ? this.performanceMetrics.queryTimes.reduce((a, b) => a + b, 0) / totalQueries : 0;
    const totalCacheRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (this.performanceMetrics.cacheHits / totalCacheRequests) * 100 : 0;

    return {
      ...this.performanceMetrics,
      avgQueryTime,
      cacheHitRate,
      totalQueries
    };
  }

  // Format bytes to human readable format
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Analyze collection sizes
  async analyzeCollectionSizes() {
    try {
      logger.info('🔍 Analyzing Firestore collection sizes...');
      
      const collections = ['users', 'companies', 'referrals', 'referralCodes', 'orders', 'withdrawals'];
      const analysis = {};
      
      for (const collectionName of collections) {
        try {
          const snapshot = await db.collection(collectionName).count().get();
          const count = snapshot.data().count;
          analysis[collectionName] = count;
        } catch (error) {
          logger.error(`Error analyzing collection ${collectionName}:`, error);
          analysis[collectionName] = 'Error';
        }
      }
      
      logger.info('📊 Collection Analysis:', analysis);
      return analysis;
      
    } catch (error) {
      logger.error('Error analyzing collections:', error);
      throw error;
    }
  }

  // Generate optimization recommendations
  generateRecommendations() {
    const stats = this.getUsageStats();
    const performance = this.getPerformanceMetrics();
    const recommendations = [];
    
    // Read optimization recommendations
    if (stats.readPercentage > 70) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Reads',
        issue: 'High read usage detected',
        recommendations: [
          'Implement pagination for all collection queries',
          'Add Firestore indexes for common query patterns',
          'Optimize cache hit rates',
          'Use projection to fetch only needed fields'
        ]
      });
    }
    
    // Write optimization recommendations
    if (stats.writePercentage > 70) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Writes',
        issue: 'High write usage detected',
        recommendations: [
          'Use batch operations for multiple writes',
          'Implement write batching and queuing',
          'Optimize update operations to minimize data transfer',
          'Use transactions for critical operations'
        ]
      });
    }
    
    // Performance recommendations
    if (performance.avgQueryTime > 1000) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        issue: 'Slow query performance detected',
        recommendations: [
          'Review and optimize query patterns',
          'Add missing Firestore indexes',
          'Implement query result caching',
          'Consider denormalization for frequently accessed data'
        ]
      });
    }
    
    if (performance.cacheHitRate < 50) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Cache',
        issue: 'Low cache hit rate detected',
        recommendations: [
          'Implement cache warming strategies',
          'Optimize cache key patterns',
          'Increase cache TTL for frequently accessed data',
          'Review cache invalidation strategies'
        ]
      });
    }
    
    return recommendations;
  }
}

// Test the monitoring system
async function testMonitoring() {
  try {
    logger.info('🧪 Testing Firestore usage monitoring...');
    
    const monitor = new FirestoreUsageMonitor();
    
    // Simulate some operations
    monitor.recordRead(1024); // 1KB read
    monitor.recordWrite(512);  // 512B write
    monitor.recordDelete();
    monitor.recordQueryTime(150);
    monitor.recordCacheHit();
    monitor.recordCacheMiss();
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get stats
    const usageStats = monitor.getUsageStats();
    const performanceMetrics = monitor.getPerformanceMetrics();
    
    logger.info('📊 Test Usage Stats:', usageStats);
    logger.info('⚡ Test Performance Metrics:', performanceMetrics);
    
    // Generate recommendations
    const recommendations = monitor.generateRecommendations();
    logger.info('💡 Test Recommendations:', recommendations);
    
    // Analyze collections
    await monitor.analyzeCollectionSizes();
    
    logger.info('✅ Firestore monitoring test completed');
    
  } catch (error) {
    logger.error('❌ Error testing Firestore monitoring:', error);
  }
}

// Export the monitoring class
module.exports = {
  FirestoreUsageMonitor,
  testMonitoring
};

// Run test if called directly
if (require.main === module) {
  testMonitoring().then(() => {
    logger.info('🎉 Firestore monitoring test completed');
    process.exit(0);
  }).catch(error => {
    logger.error('💥 Firestore monitoring test failed:', error);
    process.exit(1);
  });
}
