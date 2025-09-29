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

// Export the service and initialization function
module.exports = {
    initializeSmartOptimizer,
    getSmartService,
    // Convenience methods for quick access
    getUser: (telegramId) => getSmartService().getUser(telegramId),
    createOrUpdateUser: (userData) => getSmartService().createOrUpdateUser(userData),
    updateUser: (telegramId, updateData) => getSmartService().updateUser(telegramId, updateData),
    getAllUsers: () => getSmartService().getAllUsers(),
    getUserCount: () => getSmartService().getUserCount(),
    getCompany: (companyId) => getSmartService().getCompany(companyId),
    createCompany: (companyData) => getSmartService().createCompany(companyData),
    getTopReferrers: (limit) => getSmartService().getTopReferrers(limit),
    createReferral: (referralData) => getSmartService().createReferral(referralData),
    getProduct: (productId) => getSmartService().getProduct(productId),
    getAllProducts: () => getSmartService().getAllProducts(),
    createOrder: (orderData) => getSmartService().createOrder(orderData),
    getOrder: (orderId) => getSmartService().getOrder(orderId),
    batchUpdateUsers: (updates) => getSmartService().batchUpdateUsers(updates),
    // Performance monitoring
    getPerformanceStats: () => getSmartService().getPerformanceStats(),
    getQuotaStatus: () => getSmartService().getQuotaStatus(),
    getCacheStats: () => getSmartService().getCacheStats(),
    // Maintenance
    performMaintenance: () => getSmartService().performMaintenance(),
    clearCache: () => getSmartService().clearCache()
};
