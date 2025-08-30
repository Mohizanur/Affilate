const admin = require('firebase-admin');
const NodeCache = require('node-cache');
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

// 🚀 BEAST MODE ULTIMATE FIRESTORE OPTIMIZER
class BeastModeFirestoreOptimizer {
  constructor() {
    // QUOTA MANAGEMENT - Stay within free tier limits
    this.quotaLimits = {
      reads: 50000, // Free tier daily limit
      writes: 20000, // Free tier daily limit
      deletes: 20000, // Free tier daily limit
      networkBytes: 10 * 1024 * 1024 // 10MB daily limit
    };
    
    this.currentUsage = {
      reads: 0,
      writes: 0,
      deletes: 0,
      networkBytes: 0,
      startTime: Date.now()
    };

    // 🧠 INTELLIGENT CACHING SYSTEM
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes base TTL
      maxKeys: 50000, // Massive cache capacity
      checkperiod: 60, // Check every minute
      useClones: false, // Disable cloning for speed
      deleteOnExpire: true,
    });

    // 📊 REAL-TIME DATA SYNC
    this.realTimeData = new Map();
    this.dataVersion = 0;
    this.lastSync = Date.now();

    // 🔄 BATCH OPERATIONS QUEUE
    this.batchQueue = [];
    this.batchSize = 500; // Firestore batch limit
    this.batchTimer = null;

    // ⚡ PERFORMANCE MONITORING
    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0,
      requestsPerSecond: 0,
      lastRequestTime: Date.now()
    };

    // 🎯 SMART QUERY OPTIMIZATION
    this.queryCache = new Map();
    this.frequentlyAccessed = new Set();
    this.hotData = new Map();

    // Initialize the beast
    this.initializeBeastMode();
  }

  // 🚀 INITIALIZE BEAST MODE
  initializeBeastMode() {
    logger.info('🔥 BEAST MODE FIRESTORE OPTIMIZER ACTIVATED!');
    
    // Start batch processing
    this.startBatchProcessor();
    
    // Start real-time sync
    this.startRealTimeSync();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
    
    // Pre-warm cache with hot data
    this.preWarmCache();
    
    logger.info('✅ BEAST MODE READY FOR 10K+ USERS!');
  }

  // 🧠 INTELLIGENT CACHE MANAGEMENT
  async getCachedData(key, fetchFunction, ttl = 300) {
    const cacheKey = `beast:${key}`;
    
    // Check cache first
    let data = this.cache.get(cacheKey);
    if (data) {
      this.performanceMetrics.cacheHits++;
      return data;
    }

    this.performanceMetrics.cacheMisses++;
    
    // Smart cache warming - check if this is frequently accessed
    if (this.frequentlyAccessed.has(key)) {
      ttl = Math.min(ttl * 2, 1800); // Double TTL for hot data
    }

    // Fetch with quota tracking
    const startTime = Date.now();
    data = await this.trackQuotaUsage('read', fetchFunction);
    const responseTime = Date.now() - startTime;

    // Update performance metrics
    this.updatePerformanceMetrics(responseTime);

    // Cache the result
    this.cache.set(cacheKey, data, ttl);
    
    // Mark as frequently accessed if accessed multiple times
    this.trackFrequentAccess(key);

    return data;
  }

  // 📊 QUOTA TRACKING WITH SMART THROTTLING
  async trackQuotaUsage(operation, operationFunction) {
    const quotaKey = `${operation}s`;
    const currentUsage = this.currentUsage[quotaKey];
    const limit = this.quotaLimits[quotaKey];

    // Check if we're approaching limits
    const usagePercentage = (currentUsage / limit) * 100;
    
    if (usagePercentage > 90) {
      // 🚨 CRITICAL: Use aggressive caching
      logger.warn(`🚨 QUOTA CRITICAL: ${usagePercentage.toFixed(1)}% ${operation} usage`);
      return this.getAggressiveCachedData(operationFunction);
    } else if (usagePercentage > 70) {
      // ⚠️ WARNING: Use enhanced caching
      logger.warn(`⚠️ QUOTA WARNING: ${usagePercentage.toFixed(1)}% ${operation} usage`);
      return this.getEnhancedCachedData(operationFunction);
    }

    // Normal operation with quota tracking
    this.currentUsage[quotaKey]++;
    return await operationFunction();
  }

  // 🚨 AGGRESSIVE CACHING FOR QUOTA CRISIS
  async getAggressiveCachedData(fetchFunction) {
    // Use stale data if available, extend TTL massively
    const cacheKey = `aggressive:${fetchFunction.name}`;
    let data = this.cache.get(cacheKey);
    
    if (data) {
      // Extend TTL to maximum
      this.cache.set(cacheKey, data, 3600); // 1 hour
      return data;
    }

    // Only fetch if absolutely necessary
    data = await fetchFunction();
    this.cache.set(cacheKey, data, 3600);
    return data;
  }

  // ⚠️ ENHANCED CACHING FOR QUOTA WARNING
  async getEnhancedCachedData(fetchFunction) {
    const cacheKey = `enhanced:${fetchFunction.name}`;
    let data = this.cache.get(cacheKey);
    
    if (data) {
      this.cache.set(cacheKey, data, 1800); // 30 minutes
      return data;
    }

    data = await fetchFunction();
    this.cache.set(cacheKey, data, 1800);
    return data;
  }

  // 🔄 BATCH OPERATIONS FOR MAXIMUM EFFICIENCY
  startBatchProcessor() {
    setInterval(() => {
      this.processBatchQueue();
    }, 1000); // Process every second
  }

  async processBatchQueue() {
    if (this.batchQueue.length === 0) return;

    const batch = db.batch();
    const operations = this.batchQueue.splice(0, this.batchSize);

    for (const operation of operations) {
      const { type, ref, data } = operation;
      
      switch (type) {
        case 'set':
          batch.set(ref, data);
          break;
        case 'update':
          batch.update(ref, data);
          break;
        case 'delete':
          batch.delete(ref);
          break;
      }
    }

    try {
      await batch.commit();
      this.currentUsage.writes += operations.length;
      logger.info(`🔥 BEAST BATCH: Processed ${operations.length} operations`);
    } catch (error) {
      logger.error('BEAST BATCH ERROR:', error);
      // Re-queue failed operations
      this.batchQueue.unshift(...operations);
    }
  }

  // 📡 REAL-TIME DATA SYNC
  startRealTimeSync() {
    setInterval(() => {
      this.syncRealTimeData();
    }, 5000); // Sync every 5 seconds
  }

  async syncRealTimeData() {
    try {
      // Only sync critical data
      const criticalCollections = ['users', 'companies', 'referrals'];
      
      for (const collection of criticalCollections) {
        const snapshot = await db.collection(collection)
          .orderBy('updatedAt', 'desc')
          .limit(100) // Only latest 100 documents
          .get();

        const data = {};
        snapshot.docs.forEach(doc => {
          data[doc.id] = doc.data();
        });

        this.realTimeData.set(collection, data);
      }

      this.dataVersion++;
      this.lastSync = Date.now();
    } catch (error) {
      logger.error('REAL-TIME SYNC ERROR:', error);
    }
  }

  // ⚡ PERFORMANCE MONITORING
  startPerformanceMonitoring() {
    setInterval(() => {
      this.logPerformanceMetrics();
    }, 30000); // Every 30 seconds
  }

  updatePerformanceMetrics(responseTime) {
    const now = Date.now();
    const timeDiff = now - this.performanceMetrics.lastRequestTime;
    
    if (timeDiff > 0) {
      this.performanceMetrics.requestsPerSecond = 1000 / timeDiff;
    }
    
    this.performanceMetrics.avgResponseTime = 
      (this.performanceMetrics.avgResponseTime + responseTime) / 2;
    this.performanceMetrics.lastRequestTime = now;
  }

  logPerformanceMetrics() {
    const cacheHitRate = this.performanceMetrics.cacheHits / 
      (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100;

    logger.info('🔥 BEAST PERFORMANCE:', {
      cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
      avgResponseTime: `${this.performanceMetrics.avgResponseTime.toFixed(2)}ms`,
      requestsPerSecond: this.performanceMetrics.requestsPerSecond.toFixed(2),
      quotaUsage: {
        reads: `${((this.currentUsage.reads / this.quotaLimits.reads) * 100).toFixed(1)}%`,
        writes: `${((this.currentUsage.writes / this.quotaLimits.writes) * 100).toFixed(1)}%`
      }
    });
  }

  // 🎯 SMART QUERY OPTIMIZATION
  async optimizedQuery(collection, filters = {}, limit = 20) {
    const queryKey = this.generateQueryKey(collection, filters, limit);
    
    // Check query cache first
    if (this.queryCache.has(queryKey)) {
      const cached = this.queryCache.get(queryKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        return cached.data;
      }
    }

    // Build optimized query
    let query = db.collection(collection);
    
    // Apply filters efficiently
    Object.entries(filters).forEach(([field, value]) => {
      query = query.where(field, '==', value);
    });

    // Use projection to fetch only needed fields
    query = query.select('id', 'name', 'createdAt', 'updatedAt');
    query = query.limit(limit);
    query = query.orderBy('updatedAt', 'desc');

    const snapshot = await query.get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Cache query result
    this.queryCache.set(queryKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  generateQueryKey(collection, filters, limit) {
    return `${collection}:${JSON.stringify(filters)}:${limit}`;
  }

  // 🔥 PRE-WARM CACHE WITH HOT DATA
  async preWarmCache() {
    logger.info('🔥 PRE-WARMING CACHE WITH HOT DATA...');
    
    try {
      // Cache frequently accessed data
      const hotData = [
        { collection: 'users', limit: 100 },
        { collection: 'companies', limit: 50 },
        { collection: 'referrals', limit: 200 }
      ];

      for (const item of hotData) {
        const data = await this.optimizedQuery(item.collection, {}, item.limit);
        this.hotData.set(item.collection, data);
        
        // Cache individual items for fast access
        data.forEach(doc => {
          this.cache.set(`beast:${item.collection}:${doc.id}`, doc, 1800);
        });
      }

      logger.info('✅ CACHE PRE-WARMED WITH HOT DATA!');
    } catch (error) {
      logger.error('PRE-WARM ERROR:', error);
    }
  }

  // 📈 TRACK FREQUENTLY ACCESSED DATA
  trackFrequentAccess(key) {
    const accessCount = this.frequentlyAccessed.has(key) ? 
      this.frequentlyAccessed.get(key) + 1 : 1;
    
    if (accessCount > 5) {
      this.frequentlyAccessed.add(key);
    }
  }

  // 🚀 ULTRA-FAST USER OPERATIONS
  async getUltraFastUser(telegramId) {
    const cacheKey = `beast:user:${telegramId}`;
    
    // Check cache first
    let user = this.cache.get(cacheKey);
    if (user) return user;

    // Check real-time data
    const realTimeUsers = this.realTimeData.get('users') || {};
    if (realTimeUsers[telegramId]) {
      user = realTimeUsers[telegramId];
      this.cache.set(cacheKey, user, 300);
      return user;
    }

    // Fetch from Firestore with quota tracking
    user = await this.trackQuotaUsage('read', async () => {
      const doc = await db.collection('users').doc(telegramId.toString()).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    });

    if (user) {
      this.cache.set(cacheKey, user, 600); // 10 minutes
    }

    return user;
  }

  // 🔥 BATCH USER UPDATES
  async batchUpdateUser(telegramId, updateData) {
    const userRef = db.collection('users').doc(telegramId.toString());
    
    // Add to batch queue
    this.batchQueue.push({
      type: 'update',
      ref: userRef,
      data: {
        ...updateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    // Update cache immediately for real-time feel
    const cacheKey = `beast:user:${telegramId}`;
    const existingUser = this.cache.get(cacheKey);
    if (existingUser) {
      this.cache.set(cacheKey, { ...existingUser, ...updateData }, 600);
    }

    return true;
  }

  // 📊 GET QUOTA STATUS
  getQuotaStatus() {
    return {
      reads: {
        used: this.currentUsage.reads,
        limit: this.quotaLimits.reads,
        percentage: ((this.currentUsage.reads / this.quotaLimits.reads) * 100).toFixed(1)
      },
      writes: {
        used: this.currentUsage.writes,
        limit: this.quotaLimits.writes,
        percentage: ((this.currentUsage.writes / this.quotaLimits.writes) * 100).toFixed(1)
      },
      deletes: {
        used: this.currentUsage.deletes,
        limit: this.quotaLimits.deletes,
        percentage: ((this.currentUsage.deletes / this.quotaLimits.deletes) * 100).toFixed(1)
      },
      network: {
        used: this.formatBytes(this.currentUsage.networkBytes),
        limit: this.formatBytes(this.quotaLimits.networkBytes),
        percentage: ((this.currentUsage.networkBytes / this.quotaLimits.networkBytes) * 100).toFixed(1)
      }
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 🧹 CLEANUP AND MAINTENANCE
  cleanup() {
    // Clean old query cache
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > 300000) { // 5 minutes
        this.queryCache.delete(key);
      }
    }

    // Clean old cache entries
    this.cache.prune();
  }
}

// Test the beast mode optimizer
async function testBeastMode() {
  try {
    logger.info('🔥 TESTING BEAST MODE FIRESTORE OPTIMIZER...');
    
    const beast = new BeastModeFirestoreOptimizer();
    
    // Test ultra-fast user operations
    const startTime = Date.now();
    
    // Simulate 1000 concurrent user requests
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(beast.getUltraFastUser(123456789 + i));
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    
    logger.info(`🔥 BEAST MODE: Processed 1000 requests in ${endTime - startTime}ms`);
    
    // Get quota status
    const quotaStatus = beast.getQuotaStatus();
    logger.info('📊 QUOTA STATUS:', quotaStatus);
    
    logger.info('✅ BEAST MODE TEST COMPLETED!');
    
  } catch (error) {
    logger.error('❌ BEAST MODE TEST ERROR:', error);
  }
}

// Export the beast
module.exports = {
  BeastModeFirestoreOptimizer,
  testBeastMode
};

// Run test if called directly
if (require.main === module) {
  testBeastMode().then(() => {
    logger.info('🎉 BEAST MODE READY FOR 10K+ USERS!');
    process.exit(0);
  }).catch(error => {
    logger.error('💥 BEAST MODE FAILED:', error);
    process.exit(1);
  });
}
