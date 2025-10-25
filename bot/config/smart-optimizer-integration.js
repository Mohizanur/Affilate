const SmartProductionIntegration = require('../../scripts/smart-production-integration');

/**
 * SMART OPTIMIZER INTEGRATION FOR YOUR BOT
 * 
 * This file integrates the Smart Realistic Optimizer into your bot
 * Replace your existing service calls with these optimized versions
 */

let smartService = null;

const initializeSmartOptimizer = async () => {
    try {
        if (!smartService) {
            console.log('🚀 Initializing Smart Realistic Optimizer...');
            smartService = new SmartProductionIntegration();
            console.log('✅ Smart Optimizer initialized successfully');
        }
        return smartService;
    } catch (error) {
        console.error('❌ Failed to initialize Smart Optimizer:', error.message);
        throw error;
    }
};

const getSmartService = () => {
    if (!smartService) {
        throw new Error('Smart Optimizer not initialized. Call initializeSmartOptimizer() first.');
    }
    return smartService;
};

// EMERGENCY: Disabled all convenience methods to prevent automatic initialization
// Export the service and initialization function
module.exports = {
    initializeSmartOptimizer,
    getSmartService,
    // Convenience methods disabled to prevent Firebase queries
    getUser: (telegramId) => { throw new Error('Smart Optimizer disabled'); },
    createOrUpdateUser: (userData) => { throw new Error('Smart Optimizer disabled'); },
    updateUser: (telegramId, updateData) => { throw new Error('Smart Optimizer disabled'); },
    getAllUsers: () => { throw new Error('Smart Optimizer disabled'); },
    getUserCount: () => { throw new Error('Smart Optimizer disabled'); },
    getCompany: (companyId) => { throw new Error('Smart Optimizer disabled'); },
    createCompany: (companyData) => { throw new Error('Smart Optimizer disabled'); },
    getTopReferrers: (limit) => { throw new Error('Smart Optimizer disabled'); },
    createReferral: (referralData) => { throw new Error('Smart Optimizer disabled'); },
    getProduct: (productId) => { throw new Error('Smart Optimizer disabled'); },
    getAllProducts: () => { throw new Error('Smart Optimizer disabled'); },
    createOrder: (orderData) => { throw new Error('Smart Optimizer disabled'); },
    getOrder: (orderId) => { throw new Error('Smart Optimizer disabled'); },
    batchUpdateUsers: (updates) => { throw new Error('Smart Optimizer disabled'); },
    // Performance monitoring - return dummy data
    getPerformanceStats: () => ({ cacheHitRate: 0, avgResponseTime: 0, cacheStats: { keys: 0 } }),
    getQuotaStatus: () => ({ reads: 0, writes: 0, cacheHitRate: 0, avgResponseTime: 0, uptime: 0 }),
    getCacheStats: () => ({ totalKeys: 0, maxKeys: 0, ttl: 0, memoryUsage: {} }),
    // Maintenance
    performMaintenance: () => Promise.resolve(),
    clearCache: () => console.log('⚠️ Smart Optimizer disabled, cache clear ignored')
};
