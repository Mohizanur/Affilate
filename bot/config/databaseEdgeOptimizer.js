const admin = require('firebase-admin');

/**
 * 🔥 DATABASE EDGE OPTIMIZER
 * 
 * Pushes database performance to absolute maximum realistic limits
 * with connection pooling, query optimization, and intelligent caching.
 */

class DatabaseEdgeOptimizer {
  constructor() {
    this.config = {
      // Connection pool settings
      minConnections: 5,
      maxConnections: 25,
      acquireTimeout: 1000, // 1 second
      idleTimeout: 30000, // 30 seconds
      
      // Query optimization
      batchSize: 500, // Max batch size
      queryTimeout: 5000, // 5 second query timeout
      retryAttempts: 3,
      retryDelay: 100, // 100ms
      
      // Caching
      queryCache: new Map(),
      cacheTimeout: 60000, // 1 minute
      maxCacheSize: 10000,
      
      // Performance monitoring
      slowQueryThreshold: 100, // 100ms
      connectionHealthCheck: 30000 // 30 seconds
    };
    
    this.connectionPool = [];
    this.activeConnections = 0;
    this.queryStats = {
      totalQueries: 0,
      slowQueries: 0,
      cachedQueries: 0,
      averageQueryTime: 0,
      connectionPoolHits: 0
    };
    
    this.db = null;
    this.isOptimized = false;
  }

  /**
   * Initialize database edge optimization
   */
  async initialize() {
    console.log('🔥 Initializing Database Edge Optimizer...');
    
    try {
      // Initialize Firestore with optimizations
      this.db = admin.firestore();
      
      // Configure Firestore settings for maximum performance
      this.db.settings({
        cacheSizeBytes: admin.firestore.CACHE_SIZE_UNLIMITED,
        ignoreUndefinedProperties: true
      });
      
      // Initialize connection pool
      await this.initializeConnectionPool();
      
      // Setup query optimization
      this.setupQueryOptimization();
      
      // Setup performance monitoring
      this.setupPerformanceMonitoring();
      
      this.isOptimized = true;
      console.log('✅ Database Edge Optimizer initialized');
      
    } catch (error) {
      console.error('❌ Database Edge Optimizer initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize connection pool
   */
  async initializeConnectionPool() {
    // Pre-warm connections
    for (let i = 0; i < this.config.minConnections; i++) {
      const connection = {
        id: i,
        db: this.db,
        inUse: false,
        lastUsed: Date.now(),
        queryCount: 0
      };
      
      this.connectionPool.push(connection);
    }
    
    // Setup connection health monitoring
    setInterval(() => {
      this.monitorConnectionHealth();
    }, this.config.connectionHealthCheck);
    
    console.log(`🏊 Connection pool initialized with ${this.config.minConnections} connections`);
  }

  /**
   * Get connection from pool
   */
  async getConnection() {
    const startTime = Date.now();
    
    // Find available connection
    let connection = this.connectionPool.find(conn => !conn.inUse);
    
    if (!connection) {
      // Create new connection if under max limit
      if (this.connectionPool.length < this.config.maxConnections) {
        connection = {
          id: this.connectionPool.length,
          db: this.db,
          inUse: false,
          lastUsed: Date.now(),
          queryCount: 0
        };
        this.connectionPool.push(connection);
      } else {
        // Wait for available connection
        await this.waitForConnection();
        return this.getConnection();
      }
    }
    
    // Mark connection as in use
    connection.inUse = true;
    connection.lastUsed = Date.now();
    this.activeConnections++;
    this.queryStats.connectionPoolHits++;
    
    return connection;
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connection) {
    connection.inUse = false;
    connection.lastUsed = Date.now();
    this.activeConnections--;
  }

  /**
   * Wait for available connection
   */
  async waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, this.config.acquireTimeout);
      
      const checkInterval = setInterval(() => {
        const available = this.connectionPool.find(conn => !conn.inUse);
        if (available) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
    });
  }

  /**
   * Monitor connection health
   */
  monitorConnectionHealth() {
    const now = Date.now();
    
    // Remove idle connections (keep minimum)
    for (let i = this.connectionPool.length - 1; i >= this.config.minConnections; i--) {
      const conn = this.connectionPool[i];
      if (!conn.inUse && (now - conn.lastUsed) > this.config.idleTimeout) {
        this.connectionPool.splice(i, 1);
      }
    }
  }

  /**
   * Setup query optimization
   */
  setupQueryOptimization() {
    // Setup query cache cleanup
    setInterval(() => {
      this.cleanupQueryCache();
    }, this.config.cacheTimeout);
    
    console.log('⚡ Query optimization configured');
  }

  /**
   * Execute optimized query
   */
  async executeQuery(operation, collection, options = {}) {
    const startTime = process.hrtime.bigint();
    const queryKey = this.generateQueryKey(operation, collection, options);
    
    try {
      // Check cache first
      if (this.shouldCache(operation)) {
        const cached = this.config.queryCache.get(queryKey);
        if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
          this.queryStats.cachedQueries++;
          return cached.data;
        }
      }
      
      // Get connection from pool
      const connection = await this.getConnection();
      
      try {
        // Execute query with optimizations
        const result = await this.executeOptimizedQuery(connection, operation, collection, options);
        
        // Cache result if appropriate
        if (this.shouldCache(operation) && result) {
          this.cacheQueryResult(queryKey, result);
        }
        
        return result;
        
      } finally {
        // Always release connection
        this.releaseConnection(connection);
      }
      
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    } finally {
      // Update query statistics
      const endTime = process.hrtime.bigint();
      const queryTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      this.updateQueryStats(queryTime);
    }
  }

  /**
   * Execute optimized query with connection
   */
  async executeOptimizedQuery(connection, operation, collection, options) {
    const db = connection.db;
    const collectionRef = db.collection(collection);
    
    connection.queryCount++;
    
    switch (operation) {
      case 'get':
        if (options.id) {
          // Single document get
          const doc = await collectionRef.doc(options.id).get();
          return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } else {
          // Query with filters
          let query = collectionRef;
          
          // Apply filters
          if (options.where) {
            for (const [field, operator, value] of options.where) {
              query = query.where(field, operator, value);
            }
          }
          
          // Apply ordering
          if (options.orderBy) {
            for (const [field, direction] of options.orderBy) {
              query = query.orderBy(field, direction);
            }
          }
          
          // Apply limit
          if (options.limit) {
            query = query.limit(options.limit);
          }
          
          const snapshot = await query.get();
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
      case 'add':
        const docRef = await collectionRef.add(options.data);
        return { id: docRef.id, ...options.data };
        
      case 'update':
        if (!options.id) throw new Error('Update requires document ID');
        await collectionRef.doc(options.id).update(options.data);
        return { id: options.id, ...options.data };
        
      case 'delete':
        if (!options.id) throw new Error('Delete requires document ID');
        await collectionRef.doc(options.id).delete();
        return { id: options.id, deleted: true };
        
      case 'batch':
        return await this.executeBatchOperation(db, options.operations);
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute batch operation
   */
  async executeBatchOperation(db, operations) {
    const batch = db.batch();
    const results = [];
    
    for (const op of operations.slice(0, this.config.batchSize)) {
      const collectionRef = db.collection(op.collection);
      
      switch (op.operation) {
        case 'add':
          const docRef = collectionRef.doc();
          batch.set(docRef, op.data);
          results.push({ id: docRef.id, ...op.data });
          break;
          
        case 'update':
          batch.update(collectionRef.doc(op.id), op.data);
          results.push({ id: op.id, ...op.data });
          break;
          
        case 'delete':
          batch.delete(collectionRef.doc(op.id));
          results.push({ id: op.id, deleted: true });
          break;
      }
    }
    
    await batch.commit();
    return results;
  }

  /**
   * Generate query cache key
   */
  generateQueryKey(operation, collection, options) {
    const key = JSON.stringify({ operation, collection, options });
    return require('crypto').createHash('md5').update(key).digest('hex');
  }

  /**
   * Should cache query result
   */
  shouldCache(operation) {
    // Only cache read operations
    return operation === 'get';
  }

  /**
   * Cache query result
   */
  cacheQueryResult(key, data) {
    if (this.config.queryCache.size >= this.config.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.config.queryCache.keys().next().value;
      this.config.queryCache.delete(firstKey);
    }
    
    this.config.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Cleanup query cache
   */
  cleanupQueryCache() {
    const now = Date.now();
    
    for (const [key, entry] of this.config.queryCache.entries()) {
      if ((now - entry.timestamp) > this.config.cacheTimeout) {
        this.config.queryCache.delete(key);
      }
    }
  }

  /**
   * Update query statistics
   */
  updateQueryStats(queryTime) {
    this.queryStats.totalQueries++;
    this.queryStats.averageQueryTime = 
      (this.queryStats.averageQueryTime + queryTime) / 2;
    
    if (queryTime > this.config.slowQueryThreshold) {
      this.queryStats.slowQueries++;
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    setInterval(() => {
      this.logPerformanceStats();
    }, 60000); // Every minute
    
    console.log('📊 Database performance monitoring active');
  }

  /**
   * Log performance statistics
   */
  logPerformanceStats() {
    const stats = this.getPerformanceStats();
    
    if (stats.slowQueryRate > 10) { // More than 10% slow queries
      console.warn(`⚠️ High slow query rate: ${stats.slowQueryRate.toFixed(2)}%`);
    }
    
    if (stats.cacheHitRate < 50) { // Less than 50% cache hit rate
      console.warn(`⚠️ Low cache hit rate: ${stats.cacheHitRate.toFixed(2)}%`);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = this.queryStats;
    
    return {
      totalQueries: stats.totalQueries,
      averageQueryTime: Math.round(stats.averageQueryTime * 100) / 100,
      slowQueryRate: stats.totalQueries > 0 ? (stats.slowQueries / stats.totalQueries) * 100 : 0,
      cacheHitRate: stats.totalQueries > 0 ? (stats.cachedQueries / stats.totalQueries) * 100 : 0,
      connectionPool: {
        total: this.connectionPool.length,
        active: this.activeConnections,
        poolHits: stats.connectionPoolHits
      },
      cache: {
        size: this.config.queryCache.size,
        maxSize: this.config.maxCacheSize
      }
    };
  }

  /**
   * Optimized user operations
   */
  async getUser(telegramId) {
    return await this.executeQuery('get', 'users', {
      where: [['telegramId', '==', telegramId]],
      limit: 1
    });
  }

  async createUser(userData) {
    return await this.executeQuery('add', 'users', {
      data: {
        ...userData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });
  }

  async updateUser(userId, updateData) {
    return await this.executeQuery('update', 'users', {
      id: userId,
      data: {
        ...updateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });
  }

  async batchUpdateUsers(updates) {
    const operations = updates.map(update => ({
      operation: 'update',
      collection: 'users',
      id: update.id,
      data: {
        ...update.data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    }));
    
    return await this.executeQuery('batch', null, { operations });
  }

  /**
   * Shutdown database optimizer
   */
  async shutdown() {
    console.log('🔥 Shutting down Database Edge Optimizer...');
    
    // Clear query cache
    this.config.queryCache.clear();
    
    // Reset connection pool
    this.connectionPool = [];
    this.activeConnections = 0;
    
    console.log('✅ Database Edge Optimizer shutdown complete');
  }
}

module.exports = DatabaseEdgeOptimizer;
