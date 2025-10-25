const admin = require('firebase-admin');
const NodeCache = require('node-cache');

/**
 * SMART REALISTIC OPTIMIZATION - PRODUCTION READY
 * 
 * This system achieves maximum realistic performance while staying:
 * - Legal and compliant with Firebase ToS
 * - Production-ready and maintainable
 * - Lightning-fast with real-time data
 * - Efficient within free tier quota limits
 * - Scalable for thousands of users
 */

class SmartRealisticOptimizer {
    constructor() {
        this.db = admin.firestore();
        this.cache = new NodeCache({
            stdTTL: 300, // 5 minutes default
            checkperiod: 60, // Check every minute
            maxKeys: 10000, // Realistic cache size
            useClones: false,
            deleteOnExpire: true
        });
        
        this.performanceMetrics = {
            cacheHits: 0,
            cacheMisses: 0,
            dbReads: 0,
            dbWrites: 0,
            responseTimes: [],
            quotaUsage: {
                reads: 0,
                writes: 0,
                deletes: 0,
                network: 0
            }
        };
        
        this.quotaLimits = {
            reads: 50000, // Free tier daily limit
            writes: 20000,
            deletes: 20000,
            network: 10 * 1024 * 1024 // 10MB daily
        };
        
        this.startupTime = Date.now();
        this.setupQuotaMonitoring();
    }

    /**
     * SMART QUOTA MONITORING
     * Tracks usage and automatically adjusts strategies
     */
    setupQuotaMonitoring() {
        // EMERGENCY: Disabled to stop quota bleeding
        // setInterval(() => {
        //     this.analyzeQuotaUsage();
        // }, 60000); // Check every minute
        
        // Reset daily at midnight
        // setInterval(() => {
        //     const now = new Date();
        //     if (now.getHours() === 0 && now.getMinutes() === 0) {
        //         this.resetDailyQuota();
        //     }
        // }, 60000);
    }

    analyzeQuotaUsage() {
        const readPercentage = (this.performanceMetrics.quotaUsage.reads / this.quotaLimits.reads) * 100;
        const writePercentage = (this.performanceMetrics.quotaUsage.writes / this.quotaLimits.writes) * 100;
        
        // Dynamic cache adjustment based on quota usage
        if (readPercentage > 80) {
            this.enableAggressiveCaching();
        } else if (readPercentage < 50) {
            this.enableNormalCaching();
        }
        
        // Log quota status
        if (readPercentage > 90 || writePercentage > 90) {
            console.warn(`⚠️ QUOTA WARNING: Reads ${readPercentage.toFixed(1)}%, Writes ${writePercentage.toFixed(1)}%`);
        }
    }

    enableAggressiveCaching() {
        this.cache.flushAll();
        this.cache.options.stdTTL = 1800; // 30 minutes
        this.cache.options.maxKeys = 15000;
        console.log('🚀 ENABLED AGGRESSIVE CACHING - Quota protection active');
    }

    enableNormalCaching() {
        this.cache.options.stdTTL = 300; // 5 minutes
        this.cache.options.maxKeys = 10000;
        console.log('✅ NORMAL CACHING - Optimal performance mode');
    }

    resetDailyQuota() {
        this.performanceMetrics.quotaUsage = {
            reads: 0,
            writes: 0,
            deletes: 0,
            network: 0
        };
        console.log('🔄 Daily quota reset - Fresh start');
    }

    /**
     * INTELLIGENT CACHING STRATEGY
     * Context-aware caching with smart invalidation
     */
    async getCachedOrFetch(key, fetchFunction, ttl = null) {
        const cacheKey = `smart_${key}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached) {
            this.performanceMetrics.cacheHits++;
            return cached;
        }
        
        this.performanceMetrics.cacheMisses++;
        const data = await fetchFunction();
        
        // Smart TTL based on data type
        const smartTTL = ttl || this.getSmartTTL(key, data);
        this.cache.set(cacheKey, data, smartTTL);
        
        return data;
    }

    getSmartTTL(key, data) {
        // User data: 2 minutes (frequently changing)
        if (key.includes('user') || key.includes('profile')) return 120;
        
        // Company data: 5 minutes (moderately changing)
        if (key.includes('company')) return 300;
        
        // Product data: 10 minutes (rarely changing)
        if (key.includes('product')) return 600;
        
        // Referral data: 3 minutes (moderately changing)
        if (key.includes('referral')) return 180;
        
        // Admin data: 1 minute (highly dynamic)
        if (key.includes('admin')) return 60;
        
        return 300; // Default 5 minutes
    }

    /**
     * EFFICIENT QUERY OPTIMIZATION
     * Uses pagination, projection, and smart limits
     */
    async getUsersPaginated(limit = 50, startAfter = null) {
        const cacheKey = `users_paginated_${limit}_${startAfter || 'start'}`;
        
        return this.getCachedOrFetch(cacheKey, async () => {
            let query = this.db.collection('users')
                .orderBy('createdAt', 'desc')
                .limit(limit);
            
            if (startAfter) {
                query = query.startAfter(startAfter);
            }
            
            const snapshot = await query.get();
            this.performanceMetrics.quotaUsage.reads += snapshot.docs.length;
            
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            return {
                users,
                lastDoc: snapshot.docs[snapshot.docs.length - 1],
                hasMore: snapshot.docs.length === limit
            };
        }, 180); // 3 minutes for user lists
    }

    async getTopReferrers(limit = 20) {
        const cacheKey = `top_referrers_${limit}`;
        
        return this.getCachedOrFetch(cacheKey, async () => {
            // Use projection to fetch only needed fields
            const snapshot = await this.db.collection('users')
                .select('telegramId', 'username', 'referralCount', 'totalEarnings')
                .orderBy('referralCount', 'desc')
                .limit(limit)
                .get();
            
            this.performanceMetrics.quotaUsage.reads += snapshot.docs.length;
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }, 300); // 5 minutes for leaderboards
    }

    async getUserCount() {
        const cacheKey = 'user_count';
        
        return this.getCachedOrFetch(cacheKey, async () => {
            // Use count() instead of fetching all documents
            const snapshot = await this.db.collection('users').count().get();
            this.performanceMetrics.quotaUsage.reads += 1; // Count query = 1 read
            
            return snapshot.data().count;
        }, 600); // 10 minutes for counts
    }

    /**
     * BATCH OPERATIONS FOR EFFICIENCY
     * Groups multiple operations to reduce write counts
     */
    async batchUpdateUsers(updates) {
        if (updates.length === 0) return;
        
        const batch = this.db.batch();
        const batchSize = 500; // Firestore batch limit
        
        for (let i = 0; i < updates.length; i += batchSize) {
            const batchUpdates = updates.slice(i, i + batchSize);
            
            batchUpdates.forEach(({ userId, data }) => {
                const userRef = this.db.collection('users').doc(userId);
                batch.update(userRef, {
                    ...data,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await batch.commit();
            this.performanceMetrics.quotaUsage.writes += batchUpdates.length;
            
            // Small delay between batches to avoid overwhelming
            if (i + batchSize < updates.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // Invalidate related cache
        this.cache.del('users_paginated_*');
        this.cache.del('user_count');
    }

    /**
     * REAL-TIME DATA SYNC
     * Keeps critical data fresh without excessive queries
     */
    async syncCriticalData() {
        const criticalCollections = ['users', 'companies', 'referrals'];
        
        for (const collection of criticalCollections) {
            try {
                // Only sync recent documents to stay within quota
                const snapshot = await this.db.collection(collection)
                    .orderBy('updatedAt', 'desc')
                    .limit(100) // Limit to recent 100
                    .get();
                
                this.performanceMetrics.quotaUsage.reads += snapshot.docs.length;
                
                // Update cache with fresh data
                snapshot.docs.forEach(doc => {
                    const cacheKey = `${collection}_${doc.id}`;
                    this.cache.set(cacheKey, {
                        id: doc.id,
                        ...doc.data()
                    }, this.getSmartTTL(collection, doc.data()));
                });
                
            } catch (error) {
                console.error(`Error syncing ${collection}:`, error.message);
            }
        }
    }

    /**
     * PERFORMANCE MONITORING
     * Tracks real metrics for optimization
     */
    recordResponseTime(operation, duration) {
        this.performanceMetrics.responseTimes.push({
            operation,
            duration,
            timestamp: Date.now()
        });
        
        // Keep only last 1000 measurements
        if (this.performanceMetrics.responseTimes.length > 1000) {
            this.performanceMetrics.responseTimes = this.performanceMetrics.responseTimes.slice(-1000);
        }
    }

    getPerformanceStats() {
        const avgResponseTime = this.performanceMetrics.responseTimes.length > 0
            ? this.performanceMetrics.responseTimes.reduce((sum, rt) => sum + rt.duration, 0) / this.performanceMetrics.responseTimes.length
            : 0;
        
        const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
            ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
            : 0;
        
        const readQuotaPercentage = (this.performanceMetrics.quotaUsage.reads / this.quotaLimits.reads) * 100;
        const writeQuotaPercentage = (this.performanceMetrics.quotaUsage.writes / this.quotaLimits.writes) * 100;
        
        return {
            uptime: Date.now() - this.startupTime,
            cacheHitRate: cacheHitRate.toFixed(2),
            avgResponseTime: avgResponseTime.toFixed(2),
            quotaUsage: {
                reads: `${this.performanceMetrics.quotaUsage.reads}/${this.quotaLimits.reads} (${readQuotaPercentage.toFixed(1)}%)`,
                writes: `${this.performanceMetrics.quotaUsage.writes}/${this.quotaLimits.writes} (${writeQuotaPercentage.toFixed(1)}%)`,
                deletes: `${this.performanceMetrics.quotaUsage.deletes}/${this.quotaLimits.deletes}`,
                network: `${(this.performanceMetrics.quotaUsage.network / (1024 * 1024)).toFixed(2)}MB/${(this.quotaLimits.network / (1024 * 1024)).toFixed(2)}MB`
            },
            cacheStats: {
                keys: this.cache.keys().length,
                maxKeys: this.cache.options.maxKeys,
                ttl: this.cache.options.stdTTL
            }
        };
    }

    /**
     * SELF-HEALING MECHANISMS
     * Automatic recovery and optimization
     */
    async performMaintenance() {
        try {
            // Memory cleanup
            if (this.cache.keys().length > this.cache.options.maxKeys * 0.9) {
                this.cache.flushAll();
                console.log('🧹 Cache cleared - Memory optimization');
            }
            
            // Sync critical data
            await this.syncCriticalData();
            
            // Log performance stats
            const stats = this.getPerformanceStats();
            console.log('📊 Performance Stats:', JSON.stringify(stats, null, 2));
            
        } catch (error) {
            console.error('Maintenance error:', error.message);
        }
    }

    /**
     * STARTUP OPTIMIZATION
     * Pre-loads frequently accessed data
     */
    async warmupCache() {
        console.log('🔥 Warming up cache...');
        
        try {
            // Skip cache warmup to prevent quota exhaustion
            console.log('🛡️ Skipping cache warmup to preserve quota');
            return;
            
            // Pre-load user count (DISABLED)
            // await this.getUserCount();
            
            // Pre-load top referrers (DISABLED)
            // await this.getTopReferrers();
            
            // Pre-load first page of users (DISABLED)
            // await this.getUsersPaginated(20);
            
            console.log('✅ Cache warmup complete');
        } catch (error) {
            console.error('Cache warmup error:', error.message);
        }
    }

    /**
     * GRACEFUL SHUTDOWN
     * Saves state and cleans up resources
     */
    async shutdown() {
        console.log('🔄 Shutting down optimizer gracefully...');
        
        // Save final metrics
        const finalStats = this.getPerformanceStats();
        console.log('📊 Final Performance Stats:', JSON.stringify(finalStats, null, 2));
        
        // Clear cache
        this.cache.flushAll();
        
        console.log('✅ Optimizer shutdown complete');
    }
}

// Export the optimizer
module.exports = SmartRealisticOptimizer;

// EMERGENCY: Disabled auto-start to stop quota bleeding
// if (require.main === module) {
//     const optimizer = new SmartRealisticOptimizer();
//     
//     // Start maintenance cycle
//     setInterval(() => {
//         optimizer.performMaintenance();
//     }, 300000); // Every 5 minutes
//     
//     // Graceful shutdown
//     process.on('SIGINT', async () => {
//         await optimizer.shutdown();
//         process.exit(0);
//     });
//     
//     process.on('SIGTERM', async () => {
//         await optimizer.shutdown();
//         process.exit(0);
//     });
//     
//     console.log('🚀 Smart Realistic Optimizer started');
//     console.log('📊 Maintenance cycle: Every 5 minutes');
//     console.log('🔄 Auto-sync: Every 5 minutes');
//     console.log('💾 Cache size: 10,000 keys');
//     console.log('⚡ Default TTL: 5 minutes');
// }
