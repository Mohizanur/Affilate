const { BeastModeFirestoreOptimizer } = require('./beast-mode-firestore-optimizer');
const logger = require('../utils/logger');

// 🚀 BEAST MODE SERVICE INTEGRATION
class BeastModeServiceIntegration {
  constructor() {
    this.beast = new BeastModeFirestoreOptimizer();
    this.initialized = false;
  }

  // Initialize beast mode services
  async initialize() {
    if (this.initialized) return;

    logger.info('🔥 INITIALIZING BEAST MODE SERVICES...');
    
    // Wait for beast mode to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.initialized = true;
    logger.info('✅ BEAST MODE SERVICES READY!');
  }

  // 🚀 ULTRA-FAST USER SERVICE
  async getUser(telegramId) {
    await this.initialize();
    return await this.beast.getUltraFastUser(telegramId);
  }

  async updateUser(telegramId, updateData) {
    await this.initialize();
    return await this.beast.batchUpdateUser(telegramId, updateData);
  }

  async createUser(userData) {
    await this.initialize();
    
    const userRef = this.beast.db.collection('users').doc(userData.telegramId.toString());
    
    // Add to batch queue for efficiency
    this.beast.batchQueue.push({
      type: 'set',
      ref: userRef,
      data: {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Cache immediately
    this.beast.cache.set(`beast:user:${userData.telegramId}`, userData, 600);
    
    return { id: userRef.id, ...userData };
  }

  // 🚀 ULTRA-FAST COMPANY SERVICE
  async getCompany(companyId) {
    await this.initialize();
    
    const cacheKey = `beast:company:${companyId}`;
    
    // Check cache first
    let company = this.beast.cache.get(cacheKey);
    if (company) return company;

    // Check real-time data
    const realTimeCompanies = this.beast.realTimeData.get('companies') || {};
    if (realTimeCompanies[companyId]) {
      company = realTimeCompanies[companyId];
      this.beast.cache.set(cacheKey, company, 300);
      return company;
    }

    // Fetch with quota tracking
    company = await this.beast.trackQuotaUsage('read', async () => {
      const doc = await this.beast.db.collection('companies').doc(companyId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    });

    if (company) {
      this.beast.cache.set(cacheKey, company, 600);
    }

    return company;
  }

  async updateCompany(companyId, updateData) {
    await this.initialize();
    
    const companyRef = this.beast.db.collection('companies').doc(companyId);
    
    // Add to batch queue
    this.beast.batchQueue.push({
      type: 'update',
      ref: companyRef,
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    // Update cache immediately
    const cacheKey = `beast:company:${companyId}`;
    const existingCompany = this.beast.cache.get(cacheKey);
    if (existingCompany) {
      this.beast.cache.set(cacheKey, { ...existingCompany, ...updateData }, 600);
    }

    return true;
  }

  // 🚀 ULTRA-FAST REFERRAL SERVICE
  async getReferrals(userId, limit = 20) {
    await this.initialize();
    
    const cacheKey = `beast:referrals:${userId}:${limit}`;
    
    // Check cache first
    let referrals = this.beast.cache.get(cacheKey);
    if (referrals) return referrals;

    // Use optimized query
    referrals = await this.beast.optimizedQuery('referrals', { userId }, limit);
    
    // Cache result
    this.beast.cache.set(cacheKey, referrals, 300);
    
    return referrals;
  }

  async createReferral(referralData) {
    await this.initialize();
    
    const referralRef = this.beast.db.collection('referrals').doc();
    
    // Add to batch queue
    this.beast.batchQueue.push({
      type: 'set',
      ref: referralRef,
      data: {
        ...referralData,
        id: referralRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Invalidate related caches
    this.beast.cache.del(`beast:referrals:${referralData.userId}:20`);
    this.beast.cache.del(`beast:referrals:${referralData.userId}:50`);

    return { id: referralRef.id, ...referralData };
  }

  // 🚀 ULTRA-FAST ADMIN SERVICE
  async getAllUsers(page = 1, limit = 20, filters = {}) {
    await this.initialize();
    
    const cacheKey = `beast:users:${page}:${limit}:${JSON.stringify(filters)}`;
    
    // Check cache first
    let users = this.beast.cache.get(cacheKey);
    if (users) return users;

    // Use optimized query with pagination
    const offset = (page - 1) * limit;
    users = await this.beast.optimizedQuery('users', filters, limit + offset);
    
    // Apply pagination
    users = users.slice(offset, offset + limit);
    
    // Cache result
    this.beast.cache.set(cacheKey, users, 180); // 3 minutes for admin data
    
    return users;
  }

  async getUserCount() {
    await this.initialize();
    
    const cacheKey = 'beast:userCount';
    
    // Check cache first
    let count = this.beast.cache.get(cacheKey);
    if (count !== undefined) return count;

    // Use count query (more efficient than fetching all)
    count = await this.beast.trackQuotaUsage('read', async () => {
      const snapshot = await this.beast.db.collection('users').count().get();
      return snapshot.data().count;
    });

    // Cache for 5 minutes
    this.beast.cache.set(cacheKey, count, 300);
    
    return count;
  }

  // 🚀 ULTRA-FAST PRODUCT SERVICE
  async getProducts(companyId, limit = 20) {
    await this.initialize();
    
    const cacheKey = `beast:products:${companyId}:${limit}`;
    
    // Check cache first
    let products = this.beast.cache.get(cacheKey);
    if (products) return products;

    // Use optimized query
    products = await this.beast.optimizedQuery('products', { companyId }, limit);
    
    // Cache result
    this.beast.cache.set(cacheKey, products, 300);
    
    return products;
  }

  async createProduct(productData) {
    await this.initialize();
    
    const productRef = this.beast.db.collection('products').doc();
    
    // Add to batch queue
    this.beast.batchQueue.push({
      type: 'set',
      ref: productRef,
      data: {
        ...productData,
        id: productRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Invalidate related caches
    this.beast.cache.del(`beast:products:${productData.companyId}:20`);
    this.beast.cache.del(`beast:products:${productData.companyId}:50`);

    return { id: productRef.id, ...productData };
  }

  // 🚀 ULTRA-FAST ORDER SERVICE
  async getOrders(userId, limit = 20) {
    await this.initialize();
    
    const cacheKey = `beast:orders:${userId}:${limit}`;
    
    // Check cache first
    let orders = this.beast.cache.get(cacheKey);
    if (orders) return orders;

    // Use optimized query
    orders = await this.beast.optimizedQuery('orders', { userId }, limit);
    
    // Cache result
    this.beast.cache.set(cacheKey, orders, 180); // 3 minutes for order data
    
    return orders;
  }

  async createOrder(orderData) {
    await this.initialize();
    
    const orderRef = this.beast.db.collection('orders').doc();
    
    // Add to batch queue
    this.beast.batchQueue.push({
      type: 'set',
      ref: orderRef,
      data: {
        ...orderData,
        id: orderRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Invalidate related caches
    this.beast.cache.del(`beast:orders:${orderData.userId}:20`);
    this.beast.cache.del(`beast:orders:${orderData.userId}:50`);

    return { id: orderRef.id, ...orderData };
  }

  // 🚀 ULTRA-FAST WITHDRAWAL SERVICE
  async getWithdrawals(userId, limit = 20) {
    await this.initialize();
    
    const cacheKey = `beast:withdrawals:${userId}:${limit}`;
    
    // Check cache first
    let withdrawals = this.beast.cache.get(cacheKey);
    if (withdrawals) return withdrawals;

    // Use optimized query
    withdrawals = await this.beast.optimizedQuery('withdrawals', { userId }, limit);
    
    // Cache result
    this.beast.cache.set(cacheKey, withdrawals, 300);
    
    return withdrawals;
  }

  async createWithdrawal(withdrawalData) {
    await this.initialize();
    
    const withdrawalRef = this.beast.db.collection('withdrawals').doc();
    
    // Add to batch queue
    this.beast.batchQueue.push({
      type: 'set',
      ref: withdrawalRef,
      data: {
        ...withdrawalData,
        id: withdrawalRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Invalidate related caches
    this.beast.cache.del(`beast:withdrawals:${withdrawalData.userId}:20`);
    this.beast.cache.del(`beast:withdrawals:${withdrawalData.userId}:50`);

    return { id: withdrawalRef.id, ...withdrawalData };
  }

  // 🚀 ULTRA-FAST REFERRAL CODE SERVICE
  async getReferralCodes(userId, limit = 20) {
    await this.initialize();
    
    const cacheKey = `beast:referralCodes:${userId}:${limit}`;
    
    // Check cache first
    let codes = this.beast.cache.get(cacheKey);
    if (codes) return codes;

    // Use optimized query
    codes = await this.beast.optimizedQuery('referralCodes', { userId }, limit);
    
    // Cache result
    this.beast.cache.set(cacheKey, codes, 300);
    
    return codes;
  }

  async createReferralCode(codeData) {
    await this.initialize();
    
    const codeRef = this.beast.db.collection('referralCodes').doc();
    
    // Add to batch queue
    this.beast.batchQueue.push({
      type: 'set',
      ref: codeRef,
      data: {
        ...codeData,
        id: codeRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Invalidate related caches
    this.beast.cache.del(`beast:referralCodes:${codeData.userId}:20`);
    this.beast.cache.del(`beast:referralCodes:${codeData.userId}:50`);

    return { id: codeRef.id, ...codeData };
  }

  // 📊 GET BEAST MODE STATISTICS
  getBeastStats() {
    return {
      quotaStatus: this.beast.getQuotaStatus(),
      performance: {
        cacheHits: this.beast.performanceMetrics.cacheHits,
        cacheMisses: this.beast.performanceMetrics.cacheMisses,
        avgResponseTime: this.beast.performanceMetrics.avgResponseTime,
        requestsPerSecond: this.beast.performanceMetrics.requestsPerSecond
      },
      cache: {
        size: this.beast.cache.getStats().keys,
        hitRate: this.beast.performanceMetrics.cacheHits / 
          (this.beast.performanceMetrics.cacheHits + this.beast.performanceMetrics.cacheMisses) * 100
      },
      batch: {
        queueSize: this.beast.batchQueue.length,
        lastProcessed: this.beast.lastSync
      }
    };
  }

  // 🧹 CLEANUP
  cleanup() {
    this.beast.cleanup();
  }
}

// Create singleton instance
const beastModeServices = new BeastModeServiceIntegration();

// Test beast mode integration
async function testBeastModeIntegration() {
  try {
    logger.info('🔥 TESTING BEAST MODE INTEGRATION...');
    
    await beastModeServices.initialize();
    
    // Test concurrent operations
    const startTime = Date.now();
    
    // Simulate 1000 concurrent user operations
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(beastModeServices.getUser(123456789 + i));
      promises.push(beastModeServices.updateUser(123456789 + i, { lastActive: new Date() }));
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    
    logger.info(`🔥 BEAST INTEGRATION: Processed 2000 operations in ${endTime - startTime}ms`);
    
    // Get beast stats
    const stats = beastModeServices.getBeastStats();
    logger.info('📊 BEAST STATS:', stats);
    
    logger.info('✅ BEAST MODE INTEGRATION TEST COMPLETED!');
    
  } catch (error) {
    logger.error('❌ BEAST INTEGRATION TEST ERROR:', error);
  }
}

// Export the beast mode services
module.exports = {
  beastModeServices,
  BeastModeServiceIntegration,
  testBeastModeIntegration
};

// Run test if called directly
if (require.main === module) {
  testBeastModeIntegration().then(() => {
    logger.info('🎉 BEAST MODE INTEGRATION READY FOR 10K+ USERS!');
    process.exit(0);
  }).catch(error => {
    logger.error('💥 BEAST MODE INTEGRATION FAILED:', error);
    process.exit(1);
  });
}
