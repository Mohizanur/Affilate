const SmartRealisticOptimizer = require('./smart-realistic-optimizer');
const admin = require('firebase-admin');

/**
 * SMART PRODUCTION INTEGRATION
 * 
 * This service acts as a drop-in replacement for your existing services,
 * routing all calls through the SmartRealisticOptimizer for maximum efficiency.
 * 
 * Features:
 * - Zero code changes required in your existing handlers
 * - Automatic optimization of all database operations
 * - Real-time performance monitoring
 * - Quota protection and management
 */

class SmartProductionIntegration {
    constructor() {
        this.optimizer = new SmartRealisticOptimizer();
        this.startupTime = Date.now();
        
        // Start the optimizer
        this.initializeOptimizer();
        
        console.log('🚀 Smart Production Integration initialized');
    }

    async initializeOptimizer() {
        try {
            // Warm up cache on startup
            await this.optimizer.warmupCache();
            
            // Start maintenance cycle
            setInterval(() => {
                this.optimizer.performMaintenance();
            }, 300000); // Every 5 minutes
            
            console.log('✅ Optimizer initialization complete');
        } catch (error) {
            console.error('❌ Optimizer initialization failed:', error.message);
        }
    }

    /**
     * USER SERVICE INTEGRATION
     * Optimized user operations with smart caching
     */
    async getUser(telegramId) {
        const startTime = Date.now();
        
        try {
            const result = await this.optimizer.getCachedOrFetch(
                `user_${telegramId}`,
                async () => {
                    const snapshot = await this.optimizer.db.collection('users')
                        .where('telegramId', '==', telegramId)
                        .limit(1)
                        .get();
                    
                    if (snapshot.empty) return null;
                    
                    const doc = snapshot.docs[0];
                    this.optimizer.performanceMetrics.quotaUsage.reads += 1;
                    
                    return {
                        id: doc.id,
                        ...doc.data()
                    };
                },
                120 // 2 minutes for user data
            );
            
            this.optimizer.recordResponseTime('getUser', Date.now() - startTime);
            return result;
            
        } catch (error) {
            console.error('Error in getUser:', error.message);
            throw error;
        }
    }

    async createOrUpdateUser(userData) {
        const startTime = Date.now();
        
        try {
            const userRef = this.optimizer.db.collection('users').doc();
            const userId = userRef.id;
            
            const userDoc = {
                id: userId,
                ...userData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await userRef.set(userDoc);
            this.optimizer.performanceMetrics.quotaUsage.writes += 1;
            
            // Invalidate related cache
            this.optimizer.cache.del(`user_${userData.telegramId}`);
            this.optimizer.cache.del('user_count');
            this.optimizer.cache.del('users_paginated_*');
            
            this.optimizer.recordResponseTime('createOrUpdateUser', Date.now() - startTime);
            return userDoc;
            
        } catch (error) {
            console.error('Error in createOrUpdateUser:', error.message);
            throw error;
        }
    }

    async updateUser(telegramId, updateData) {
        const startTime = Date.now();
        
        try {
            const user = await this.getUser(telegramId);
            if (!user) throw new Error('User not found');
            
            const userRef = this.optimizer.db.collection('users').doc(user.id);
            await userRef.update({
                ...updateData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            this.optimizer.performanceMetrics.quotaUsage.writes += 1;
            
            // Invalidate related cache
            this.optimizer.cache.del(`user_${telegramId}`);
            this.optimizer.cache.del('users_paginated_*');
            
            this.optimizer.recordResponseTime('updateUser', Date.now() - startTime);
            return { ...user, ...updateData };
            
        } catch (error) {
            console.error('Error in updateUser:', error.message);
            throw error;
        }
    }

    async getAllUsers() {
        const startTime = Date.now();
        
        try {
            // Use paginated approach instead of fetching all
            const result = await this.optimizer.getUsersPaginated(100);
            
            this.optimizer.recordResponseTime('getAllUsers', Date.now() - startTime);
            return result.users;
            
        } catch (error) {
            console.error('Error in getAllUsers:', error.message);
            throw error;
        }
    }

    async getUserCount() {
        const startTime = Date.now();
        
        try {
            const result = await this.optimizer.getUserCount();
            
            this.optimizer.recordResponseTime('getUserCount', Date.now() - startTime);
            return result;
            
        } catch (error) {
            console.error('Error in getUserCount:', error.message);
            throw error;
        }
    }

    /**
     * COMPANY SERVICE INTEGRATION
     * Optimized company operations
     */
    async getCompany(companyId) {
        const startTime = Date.now();
        
        try {
            const result = await this.optimizer.getCachedOrFetch(
                `company_${companyId}`,
                async () => {
                    const doc = await this.optimizer.db.collection('companies').doc(companyId).get();
                    
                    if (!doc.exists) return null;
                    
                    this.optimizer.performanceMetrics.quotaUsage.reads += 1;
                    
                    return {
                        id: doc.id,
                        ...doc.data()
                    };
                },
                300 // 5 minutes for company data
            );
            
            this.optimizer.recordResponseTime('getCompany', Date.now() - startTime);
            return result;
            
        } catch (error) {
            console.error('Error in getCompany:', error.message);
            throw error;
        }
    }

    async createCompany(companyData) {
        const startTime = Date.now();
        
        try {
            const companyRef = this.optimizer.db.collection('companies').doc();
            const companyId = companyRef.id;
            
            const companyDoc = {
                id: companyId,
                ...companyData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await companyRef.set(companyDoc);
            this.optimizer.performanceMetrics.quotaUsage.writes += 1;
            
            // Invalidate related cache
            this.optimizer.cache.del(`company_${companyId}`);
            
            this.optimizer.recordResponseTime('createCompany', Date.now() - startTime);
            return companyDoc;
            
        } catch (error) {
            console.error('Error in createCompany:', error.message);
            throw error;
        }
    }

    /**
     * REFERRAL SERVICE INTEGRATION
     * Optimized referral operations
     */
    async getTopReferrers(limit = 20) {
        const startTime = Date.now();
        
        try {
            const result = await this.optimizer.getTopReferrers(limit);
            
            this.optimizer.recordResponseTime('getTopReferrers', Date.now() - startTime);
            return result;
            
        } catch (error) {
            console.error('Error in getTopReferrers:', error.message);
            throw error;
        }
    }

    async createReferral(referralData) {
        const startTime = Date.now();
        
        try {
            const referralRef = this.optimizer.db.collection('referrals').doc();
            const referralId = referralRef.id;
            
            const referralDoc = {
                id: referralId,
                ...referralData,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await referralRef.set(referralDoc);
            this.optimizer.performanceMetrics.quotaUsage.writes += 1;
            
            // Invalidate related cache
            this.optimizer.cache.del('top_referrers_*');
            
            this.optimizer.recordResponseTime('createReferral', Date.now() - startTime);
            return referralDoc;
            
        } catch (error) {
            console.error('Error in createReferral:', error.message);
            throw error;
        }
    }

    /**
     * PRODUCT SERVICE INTEGRATION
     * Optimized product operations
     */
    async getProduct(productId) {
        const startTime = Date.now();
        
        try {
            const result = await this.optimizer.getCachedOrFetch(
                `product_${productId}`,
                async () => {
                    const doc = await this.optimizer.db.collection('products').doc(productId).get();
                    
                    if (!doc.exists) return null;
                    
                    this.optimizer.performanceMetrics.quotaUsage.reads += 1;
                    
                    return {
                        id: doc.id,
                        ...doc.data()
                    };
                },
                600 // 10 minutes for product data
            );
            
            this.optimizer.recordResponseTime('getProduct', Date.now() - startTime);
            return result;
            
        } catch (error) {
            console.error('Error in getProduct:', error.message);
            throw error;
        }
    }

    async getAllProducts() {
        const startTime = Date.now();
        
        try {
            const result = await this.optimizer.getCachedOrFetch(
                'all_products',
                async () => {
                    const snapshot = await this.optimizer.db.collection('products')
                        .orderBy('createdAt', 'desc')
                        .limit(100) // Limit to prevent quota issues
                        .get();
                    
                    this.optimizer.performanceMetrics.quotaUsage.reads += snapshot.docs.length;
                    
                    return snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                },
                600 // 10 minutes for product lists
            );
            
            this.optimizer.recordResponseTime('getAllProducts', Date.now() - startTime);
            return result;
            
        } catch (error) {
            console.error('Error in getAllProducts:', error.message);
            throw error;
        }
    }

    /**
     * ORDER SERVICE INTEGRATION
     * Optimized order operations
     */
    async createOrder(orderData) {
        const startTime = Date.now();
        
        try {
            const orderRef = this.optimizer.db.collection('orders').doc();
            const orderId = orderRef.id;
            
            const orderDoc = {
                id: orderId,
                ...orderData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await orderRef.set(orderDoc);
            this.optimizer.performanceMetrics.quotaUsage.writes += 1;
            
            this.optimizer.recordResponseTime('createOrder', Date.now() - startTime);
            return orderDoc;
            
        } catch (error) {
            console.error('Error in createOrder:', error.message);
            throw error;
        }
    }

    async getOrder(orderId) {
        const startTime = Date.now();
        
        try {
            const result = await this.optimizer.getCachedOrFetch(
                `order_${orderId}`,
                async () => {
                    const doc = await this.optimizer.db.collection('orders').doc(orderId).get();
                    
                    if (!doc.exists) return null;
                    
                    this.optimizer.performanceMetrics.quotaUsage.reads += 1;
                    
                    return {
                        id: doc.id,
                        ...doc.data()
                    };
                },
                180 // 3 minutes for order data
            );
            
            this.optimizer.recordResponseTime('getOrder', Date.now() - startTime);
            return result;
            
        } catch (error) {
            console.error('Error in getOrder:', error.message);
            throw error;
        }
    }

    /**
     * BATCH OPERATIONS
     * Efficient bulk updates
     */
    async batchUpdateUsers(updates) {
        const startTime = Date.now();
        
        try {
            await this.optimizer.batchUpdateUsers(updates);
            
            this.optimizer.recordResponseTime('batchUpdateUsers', Date.now() - startTime);
            return { success: true, updated: updates.length };
            
        } catch (error) {
            console.error('Error in batchUpdateUsers:', error.message);
            throw error;
        }
    }

    /**
     * PERFORMANCE MONITORING
     * Real-time stats and metrics
     */
    getPerformanceStats() {
        return this.optimizer.getPerformanceStats();
    }

    getQuotaStatus() {
        const stats = this.optimizer.getPerformanceStats();
        return {
            reads: stats.quotaUsage.reads,
            writes: stats.quotaUsage.writes,
            cacheHitRate: stats.cacheHitRate,
            avgResponseTime: stats.avgResponseTime,
            uptime: stats.uptime
        };
    }

    /**
     * MAINTENANCE AND UTILITIES
     */
    async performMaintenance() {
        return this.optimizer.performMaintenance();
    }

    async warmupCache() {
        return this.optimizer.warmupCache();
    }

    async shutdown() {
        return this.optimizer.shutdown();
    }

    /**
     * CACHE MANAGEMENT
     */
    clearCache() {
        this.optimizer.cache.flushAll();
        console.log('🧹 Cache cleared');
    }

    getCacheStats() {
        const keys = this.optimizer.cache.keys();
        return {
            totalKeys: keys.length,
            maxKeys: this.optimizer.cache.options.maxKeys,
            ttl: this.optimizer.cache.options.stdTTL,
            memoryUsage: process.memoryUsage()
        };
    }
}

// Export the integration service
module.exports = SmartProductionIntegration;

// Auto-start if run directly
if (require.main === module) {
    const integration = new SmartProductionIntegration();
    
    console.log('🚀 Smart Production Integration Service Started');
    console.log('📊 Performance monitoring active');
    console.log('💾 Smart caching enabled');
    console.log('🔄 Auto-maintenance every 5 minutes');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🔄 Shutting down gracefully...');
        await integration.shutdown();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\n🔄 Shutting down gracefully...');
        await integration.shutdown();
        process.exit(0);
    });
}
