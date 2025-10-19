/**
 * 🧠 SMART CACHE SYSTEM
 * Intelligent caching with zero database calls and automatic optimization
 */

class SmartCacheSystem {
  constructor() {
    this.caches = new Map();
    this.accessPatterns = new Map();
    this.optimizationRules = new Map();
    
    // Auto-optimization settings
    this.settings = {
      maxCacheSize: 2000,
      defaultTTL: 300000, // 5 minutes
      hotDataTTL: 1800000, // 30 minutes
      coldDataTTL: 60000, // 1 minute
      accessThreshold: 3, // Access count to consider data "hot"
      autoOptimize: true,
      optimizeInterval: 300000 // 5 minutes
    };
    
    // Performance tracking
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0,
      totalDeletes: 0,
      optimizationRuns: 0
    };
    
    this.initializeAutoOptimization();
    console.log('🧠 Smart Cache System initialized');
  }

  /**
   * Initialize automatic optimization
   */
  initializeAutoOptimization() {
    if (!this.settings.autoOptimize) return;
    
    setInterval(() => {
      this.performAutoOptimization();
    }, this.settings.optimizeInterval);
    
    console.log('⚡ Auto-optimization started (5-minute intervals)');
  }

  /**
   * Perform automatic optimization
   */
  performAutoOptimization() {
    try {
      // Analyze access patterns
      this.analyzeAccessPatterns();
      
      // Optimize cache sizes
      this.optimizeCacheSizes();
      
      // Clean up old data
      this.cleanupOldData();
      
      // Update optimization rules
      this.updateOptimizationRules();
      
      this.stats.optimizationRuns++;
      console.log('🧠 Smart cache optimization completed');
    } catch (error) {
      console.error('❌ Cache optimization error:', error.message);
    }
  }

  /**
   * Analyze access patterns
   */
  analyzeAccessPatterns() {
    const now = Date.now();
    const analysisWindow = 1800000; // 30 minutes
    
    for (const [key, pattern] of this.accessPatterns.entries()) {
      // Remove old access records
      pattern.accesses = pattern.accesses.filter(time => now - time < analysisWindow);
      
      // Update access frequency
      pattern.frequency = pattern.accesses.length / (analysisWindow / 60000); // accesses per minute
      
      // Determine data temperature
      if (pattern.frequency > 2) {
        pattern.temperature = 'hot';
      } else if (pattern.frequency > 0.5) {
        pattern.temperature = 'warm';
      } else {
        pattern.temperature = 'cold';
      }
    }
  }

  /**
   * Optimize cache sizes
   */
  optimizeCacheSizes() {
    for (const [cacheName, cache] of this.caches.entries()) {
      if (cache.size > this.settings.maxCacheSize) {
        // Remove least recently used items
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        const toRemove = entries.slice(0, entries.length - this.settings.maxCacheSize);
        toRemove.forEach(([key]) => cache.delete(key));
        
        console.log(`🧹 Cache '${cacheName}' optimized: removed ${toRemove.length} old entries`);
      }
    }
  }

  /**
   * Clean up old data
   */
  cleanupOldData() {
    const now = Date.now();
    
    for (const [cacheName, cache] of this.caches.entries()) {
      const toDelete = [];
      
      for (const [key, value] of cache.entries()) {
        const age = now - value.timestamp;
        const ttl = value.ttl || this.settings.defaultTTL;
        
        if (age > ttl) {
          toDelete.push(key);
        }
      }
      
      toDelete.forEach(key => cache.delete(key));
      
      if (toDelete.length > 0) {
        console.log(`🧹 Cache '${cacheName}' cleaned: removed ${toDelete.length} expired entries`);
      }
    }
  }

  /**
   * Update optimization rules
   */
  updateOptimizationRules() {
    for (const [key, pattern] of this.accessPatterns.entries()) {
      // Update TTL based on access pattern
      if (pattern.temperature === 'hot') {
        this.optimizationRules.set(key, { ttl: this.settings.hotDataTTL, priority: 'high' });
      } else if (pattern.temperature === 'warm') {
        this.optimizationRules.set(key, { ttl: this.settings.defaultTTL, priority: 'medium' });
      } else {
        this.optimizationRules.set(key, { ttl: this.settings.coldDataTTL, priority: 'low' });
      }
    }
  }

  /**
   * Get cache instance
   */
  getCache(name) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Map());
      console.log(`📦 Created new cache: ${name}`);
    }
    return this.caches.get(name);
  }

  /**
   * Smart get with automatic optimization
   */
  get(cacheName, key) {
    const cache = this.getCache(cacheName);
    const cached = cache.get(key);
    
    if (cached) {
      // Update access tracking
      cached.lastAccessed = Date.now();
      cached.accessCount = (cached.accessCount || 0) + 1;
      
      // Track access pattern
      this.trackAccess(key);
      
      this.stats.totalHits++;
      return cached.data;
    }
    
    this.stats.totalMisses++;
    return null;
  }

  /**
   * Smart set with automatic optimization
   */
  set(cacheName, key, data, customTTL = null) {
    const cache = this.getCache(cacheName);
    
    // Determine TTL based on optimization rules
    let ttl = customTTL || this.settings.defaultTTL;
    const rule = this.optimizationRules.get(key);
    if (rule && !customTTL) {
      ttl = rule.ttl;
    }
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now()
    });
    
    this.stats.totalSets++;
    
    // Track access pattern
    this.trackAccess(key);
  }

  /**
   * Track access pattern
   */
  trackAccess(key) {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, {
        accesses: [],
        frequency: 0,
        temperature: 'cold'
      });
    }
    
    const pattern = this.accessPatterns.get(key);
    pattern.accesses.push(Date.now());
    
    // Keep only recent accesses (last 30 minutes)
    const now = Date.now();
    pattern.accesses = pattern.accesses.filter(time => now - time < 1800000);
  }

  /**
   * Smart delete
   */
  delete(cacheName, key) {
    const cache = this.getCache(cacheName);
    const deleted = cache.delete(key);
    
    if (deleted) {
      this.stats.totalDeletes++;
      this.accessPatterns.delete(key);
      this.optimizationRules.delete(key);
    }
    
    return deleted;
  }

  /**
   * Clear cache
   */
  clear(cacheName = null) {
    if (cacheName) {
      const cache = this.getCache(cacheName);
      cache.clear();
      console.log(`🧹 Cache '${cacheName}' cleared`);
    } else {
      this.caches.clear();
      this.accessPatterns.clear();
      this.optimizationRules.clear();
      console.log('🧹 All caches cleared');
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalEntries = Array.from(this.caches.values())
      .reduce((sum, cache) => sum + cache.size, 0);
    
    const hitRate = this.stats.totalHits + this.stats.totalMisses > 0 ?
      (this.stats.totalHits / (this.stats.totalHits + this.stats.totalMisses) * 100).toFixed(2) : 0;
    
    return {
      totalCaches: this.caches.size,
      totalEntries,
      hitRate: `${hitRate}%`,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      totalSets: this.stats.totalSets,
      totalDeletes: this.stats.totalDeletes,
      optimizationRuns: this.stats.optimizationRuns,
      accessPatterns: this.accessPatterns.size,
      optimizationRules: this.optimizationRules.size
    };
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights() {
    const insights = {
      hotData: 0,
      warmData: 0,
      coldData: 0,
      cacheEfficiency: 0,
      memoryUsage: 0
    };
    
    // Analyze data temperature
    for (const pattern of this.accessPatterns.values()) {
      if (pattern.temperature === 'hot') insights.hotData++;
      else if (pattern.temperature === 'warm') insights.warmData++;
      else insights.coldData++;
    }
    
    // Calculate cache efficiency
    const totalAccesses = this.stats.totalHits + this.stats.totalMisses;
    insights.cacheEfficiency = totalAccesses > 0 ? 
      (this.stats.totalHits / totalAccesses * 100).toFixed(2) : 0;
    
    // Estimate memory usage
    insights.memoryUsage = Array.from(this.caches.values())
      .reduce((sum, cache) => sum + cache.size, 0);
    
    return insights;
  }

  /**
   * Force optimization
   */
  forceOptimization() {
    console.log('🚀 Forcing smart cache optimization...');
    this.performAutoOptimization();
    console.log('✅ Smart cache optimization completed');
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    return {
      initialized: true,
      autoOptimization: this.settings.autoOptimize,
      totalCaches: this.caches.size,
      stats: this.getStats(),
      insights: this.getPerformanceInsights(),
      settings: this.settings
    };
  }
}

// Export singleton instance
const smartCacheSystem = new SmartCacheSystem();

module.exports = smartCacheSystem;
