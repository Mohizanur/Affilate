const cluster = require('cluster');
const os = require('os');
const logger = require("../../utils/logger");

/**
 * 🚀 LOAD BALANCER & HORIZONTAL SCALING SYSTEM
 * 
 * This system provides load balancing and horizontal scaling
 * for handling massive concurrent requests across multiple processes.
 */

class LoadBalancer {
  constructor() {
    this.workers = new Map();
    this.workerStats = new Map();
    this.isMaster = cluster.isMaster;
    this.workerCount = 0;
    this.maxWorkers = process.env.MAX_WORKERS || os.cpus().length;
    this.minWorkers = process.env.MIN_WORKERS || 2;
    
    // Load balancing strategies
    this.strategies = {
      roundRobin: 'round-robin',
      leastConnections: 'least-connections',
      weightedRoundRobin: 'weighted-round-robin',
      ipHash: 'ip-hash',
      random: 'random'
    };
    
    this.currentStrategy = process.env.LOAD_BALANCE_STRATEGY || 'least-connections';
    this.requestCount = 0;
    this.lastWorkerIndex = 0;
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      requestsPerWorker: new Map(),
      avgResponseTime: new Map(),
      errorRate: new Map(),
      workerRestarts: 0,
      loadDistribution: new Map()
    };
    
    this.initialize();
  }

  /**
   * Initialize load balancer
   */
  initialize() {
    if (this.isMaster) {
      this.initializeMaster();
    } else {
      this.initializeWorker();
    }
  }

  /**
   * Initialize master process
   */
  initializeMaster() {
    logger.info(`🚀 Load Balancer Master initialized (PID: ${process.pid})`);
    
    // Start initial workers
    this.spawnWorkers();
    
    // Set up worker event handlers
    cluster.on('fork', this.handleWorkerFork.bind(this));
    cluster.on('online', this.handleWorkerOnline.bind(this));
    cluster.on('listening', this.handleWorkerListening.bind(this));
    cluster.on('disconnect', this.handleWorkerDisconnect.bind(this));
    cluster.on('exit', this.handleWorkerExit.bind(this));
    
    // Start monitoring
    this.startMonitoring();
    
    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Initialize worker process
   */
  initializeWorker() {
    logger.info(`🔧 Worker ${process.pid} initialized`);
    
    // Set up worker-specific optimizations
    this.optimizeWorker();
    
    // Handle worker-specific events
    process.on('message', this.handleWorkerMessage.bind(this));
    process.on('uncaughtException', this.handleWorkerError.bind(this));
    process.on('unhandledRejection', this.handleWorkerRejection.bind(this));
  }

  /**
   * Spawn workers
   */
  spawnWorkers() {
    const targetWorkers = Math.max(this.minWorkers, Math.min(this.maxWorkers, os.cpus().length));
    
    for (let i = 0; i < targetWorkers; i++) {
      this.spawnWorker();
    }
    
    logger.info(`👥 Spawned ${targetWorkers} workers`);
  }

  /**
   * Spawn a single worker
   */
  spawnWorker() {
    const worker = cluster.fork();
    const workerId = worker.id;
    
    this.workers.set(workerId, {
      process: worker,
      id: workerId,
      pid: worker.process.pid,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      isHealthy: true,
      load: 0
    });
    
    this.workerStats.set(workerId, {
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      lastUpdate: Date.now()
    });
    
    this.workerCount++;
    
    logger.info(`👤 Worker ${workerId} spawned (PID: ${worker.process.pid})`);
  }

  /**
   * Handle worker fork event
   */
  handleWorkerFork(worker) {
    logger.info(`🔧 Worker ${worker.id} forked`);
  }

  /**
   * Handle worker online event
   */
  handleWorkerOnline(worker) {
    const workerInfo = this.workers.get(worker.id);
    if (workerInfo) {
      workerInfo.isHealthy = true;
      workerInfo.lastActivity = Date.now();
    }
    
    logger.info(`✅ Worker ${worker.id} is online`);
  }

  /**
   * Handle worker listening event
   */
  handleWorkerListening(worker, address) {
    logger.info(`👂 Worker ${worker.id} listening on ${address.address}:${address.port}`);
  }

  /**
   * Handle worker disconnect event
   */
  handleWorkerDisconnect(worker) {
    const workerInfo = this.workers.get(worker.id);
    if (workerInfo) {
      workerInfo.isHealthy = false;
    }
    
    logger.warn(`⚠️ Worker ${worker.id} disconnected`);
  }

  /**
   * Handle worker exit event
   */
  handleWorkerExit(worker, code, signal) {
    const workerInfo = this.workers.get(worker.id);
    if (workerInfo) {
      workerInfo.isHealthy = false;
    }
    
    this.metrics.workerRestarts++;
    
    if (signal) {
      logger.warn(`💀 Worker ${worker.id} killed by signal: ${signal}`);
    } else if (code !== 0) {
      logger.error(`💥 Worker ${worker.id} exited with code: ${code}`);
    } else {
      logger.info(`👋 Worker ${worker.id} exited gracefully`);
    }
    
    // Restart worker if needed
    if (!worker.exitedAfterDisconnect && this.workerCount < this.maxWorkers) {
      logger.info(`🔄 Restarting worker ${worker.id}`);
      setTimeout(() => {
        this.spawnWorker();
      }, 1000);
    }
  }

  /**
   * Handle worker message
   */
  handleWorkerMessage(message) {
    if (message.type === 'stats') {
      this.updateWorkerStats(message.workerId, message.stats);
    } else if (message.type === 'request') {
      this.handleWorkerRequest(message.workerId, message.request);
    }
  }

  /**
   * Handle worker error
   */
  handleWorkerError(error) {
    logger.error(`❌ Worker ${process.pid} error:`, error);
    
    // Send error to master
    if (process.send) {
      process.send({
        type: 'error',
        workerId: process.pid,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Handle worker rejection
   */
  handleWorkerRejection(reason, promise) {
    logger.error(`❌ Worker ${process.pid} unhandled rejection:`, reason);
    
    // Send rejection to master
    if (process.send) {
      process.send({
        type: 'rejection',
        workerId: process.pid,
        reason: reason.toString()
      });
    }
  }

  /**
   * Select worker for request
   */
  selectWorker(request = {}) {
    const healthyWorkers = Array.from(this.workers.values())
      .filter(worker => worker.isHealthy);
    
    if (healthyWorkers.length === 0) {
      throw new Error('No healthy workers available');
    }
    
    switch (this.currentStrategy) {
      case this.strategies.roundRobin:
        return this.selectWorkerRoundRobin(healthyWorkers);
      case this.strategies.leastConnections:
        return this.selectWorkerLeastConnections(healthyWorkers);
      case this.strategies.weightedRoundRobin:
        return this.selectWorkerWeightedRoundRobin(healthyWorkers);
      case this.strategies.ipHash:
        return this.selectWorkerIPHash(healthyWorkers, request.ip);
      case this.strategies.random:
        return this.selectWorkerRandom(healthyWorkers);
      default:
        return this.selectWorkerLeastConnections(healthyWorkers);
    }
  }

  /**
   * Round-robin worker selection
   */
  selectWorkerRoundRobin(workers) {
    this.lastWorkerIndex = (this.lastWorkerIndex + 1) % workers.length;
    return workers[this.lastWorkerIndex];
  }

  /**
   * Least connections worker selection
   */
  selectWorkerLeastConnections(workers) {
    return workers.reduce((least, current) => 
      current.load < least.load ? current : least
    );
  }

  /**
   * Weighted round-robin worker selection
   */
  selectWorkerWeightedRoundRobin(workers) {
    // Weight based on CPU cores and current load
    const weightedWorkers = workers.map(worker => ({
      worker: worker,
      weight: Math.max(1, 10 - worker.load) // Higher weight for less loaded workers
    }));
    
    const totalWeight = weightedWorkers.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const weightedWorker of weightedWorkers) {
      random -= weightedWorker.weight;
      if (random <= 0) {
        return weightedWorker.worker;
      }
    }
    
    return workers[0]; // Fallback
  }

  /**
   * IP hash worker selection
   */
  selectWorkerIPHash(workers, ip) {
    if (!ip) {
      return this.selectWorkerRandom(workers);
    }
    
    const hash = this.hashString(ip);
    const index = hash % workers.length;
    return workers[index];
  }

  /**
   * Random worker selection
   */
  selectWorkerRandom(workers) {
    const index = Math.floor(Math.random() * workers.length);
    return workers[index];
  }

  /**
   * Hash string for consistent distribution
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Distribute request to worker
   */
  distributeRequest(request) {
    try {
      const worker = this.selectWorker(request);
      
      // Update worker load
      worker.load++;
      worker.requestCount++;
      worker.lastActivity = Date.now();
      
      // Update metrics
      this.metrics.totalRequests++;
      this.updateLoadDistribution(worker.id);
      
      return worker;
    } catch (error) {
      logger.error('Error distributing request:', error);
      throw error;
    }
  }

  /**
   * Update worker statistics
   */
  updateWorkerStats(workerId, stats) {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.avgResponseTime = stats.avgResponseTime;
      workerInfo.errorCount = stats.errorCount;
      workerInfo.load = stats.activeRequests;
    }
    
    const workerStats = this.workerStats.get(workerId);
    if (workerStats) {
      workerStats.requests = stats.totalRequests;
      workerStats.errors = stats.errorCount;
      workerStats.avgResponseTime = stats.avgResponseTime;
      workerStats.lastUpdate = Date.now();
    }
  }

  /**
   * Update load distribution
   */
  updateLoadDistribution(workerId) {
    const current = this.metrics.loadDistribution.get(workerId) || 0;
    this.metrics.loadDistribution.set(workerId, current + 1);
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    // EMERGENCY: Disable ALL load balancer monitoring to stop quota leak
    // setInterval(() => {
    //   this.performHealthCheck();
    // }, 30000);
    
    // setInterval(() => {
    //   this.collectStatistics();
    // }, 10000);
    
    // setInterval(() => {
    //   this.rebalanceWorkers();
    // }, 300000);
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [workerId, workerInfo] of this.workers) {
      if (now - workerInfo.lastActivity > inactiveThreshold) {
        logger.warn(`⚠️ Worker ${workerId} appears inactive`);
        workerInfo.isHealthy = false;
      }
    }
  }

  /**
   * Collect statistics
   */
  collectStatistics() {
    // Request statistics from all workers
    for (const [workerId, workerInfo] of this.workers) {
      if (workerInfo.isHealthy && workerInfo.process.connected) {
        workerInfo.process.send({
          type: 'request_stats',
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Rebalance workers
   */
  rebalanceWorkers() {
    const healthyWorkers = Array.from(this.workers.values())
      .filter(worker => worker.isHealthy);
    
    const avgLoad = healthyWorkers.reduce((sum, worker) => sum + worker.load, 0) / healthyWorkers.length;
    
    // Scale up if average load is high
    if (avgLoad > 80 && this.workerCount < this.maxWorkers) {
      logger.info('📈 Scaling up workers due to high load');
      this.spawnWorker();
    }
    
    // Scale down if average load is low
    if (avgLoad < 20 && this.workerCount > this.minWorkers) {
      logger.info('📉 Scaling down workers due to low load');
      this.scaleDownWorkers();
    }
  }

  /**
   * Scale down workers
   */
  scaleDownWorkers() {
    const workers = Array.from(this.workers.values())
      .filter(worker => worker.isHealthy)
      .sort((a, b) => a.load - b.load);
    
    if (workers.length > this.minWorkers) {
      const workerToKill = workers[0];
      logger.info(`🔪 Killing worker ${workerToKill.id} for scaling down`);
      workerToKill.process.kill('SIGTERM');
    }
  }

  /**
   * Optimize worker process
   */
  optimizeWorker() {
    // Set worker-specific optimizations
    process.env.WORKER_ID = process.pid;
    process.env.WORKER_INDEX = cluster.worker.id;
    
    // EMERGENCY: Disable GC to stop quota leak
    // if (global.gc) {
    //   setInterval(() => {
    //     global.gc();
    //   }, 30000); // GC every 30 seconds
    }
    
    // Set up worker statistics collection
    this.setupWorkerStatsCollection();
  }

  /**
   * Setup worker statistics collection
   */
  setupWorkerStatsCollection() {
    const stats = {
      totalRequests: 0,
      errorCount: 0,
      avgResponseTime: 0,
      activeRequests: 0,
      startTime: Date.now()
    };
    
    // EMERGENCY: Disable stats sending to stop quota leak
    // setInterval(() => {
    //   if (process.send) {
        process.send({
          type: 'stats',
          workerId: process.pid,
          stats: stats
        });
      }
    }, 10000);
    
    // Expose stats for external access
    global.workerStats = stats;
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
      
      // Stop accepting new connections
      for (const [workerId, workerInfo] of this.workers) {
        workerInfo.process.send({ type: 'shutdown' });
      }
      
      // Wait for workers to finish
      setTimeout(() => {
        for (const [workerId, workerInfo] of this.workers) {
          workerInfo.process.kill('SIGKILL');
        }
        process.exit(0);
      }, 10000); // 10 second timeout
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get load balancer statistics
   */
  getStats() {
    const healthyWorkers = Array.from(this.workers.values())
      .filter(worker => worker.isHealthy);
    
    const totalLoad = healthyWorkers.reduce((sum, worker) => sum + worker.load, 0);
    const avgLoad = healthyWorkers.length > 0 ? totalLoad / healthyWorkers.length : 0;
    
    return {
      isMaster: this.isMaster,
      strategy: this.currentStrategy,
      workers: {
        total: this.workerCount,
        healthy: healthyWorkers.length,
        unhealthy: this.workerCount - healthyWorkers.length
      },
      load: {
        total: totalLoad,
        average: avgLoad.toFixed(2),
        distribution: Object.fromEntries(this.metrics.loadDistribution)
      },
      metrics: {
        totalRequests: this.metrics.totalRequests,
        workerRestarts: this.metrics.workerRestarts,
        requestsPerWorker: Object.fromEntries(this.metrics.requestsPerWorker)
      },
      workers: Array.from(this.workers.values()).map(worker => ({
        id: worker.id,
        pid: worker.pid,
        isHealthy: worker.isHealthy,
        load: worker.load,
        requestCount: worker.requestCount,
        errorCount: worker.errorCount,
        avgResponseTime: worker.avgResponseTime,
        uptime: Date.now() - worker.createdAt
      }))
    };
  }

  /**
   * Change load balancing strategy
   */
  changeStrategy(strategy) {
    if (Object.values(this.strategies).includes(strategy)) {
      this.currentStrategy = strategy;
      logger.info(`🔄 Load balancing strategy changed to: ${strategy}`);
    } else {
      throw new Error(`Invalid load balancing strategy: ${strategy}`);
    }
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId) {
    return this.workers.get(workerId);
  }

  /**
   * Kill specific worker
   */
  killWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.process.kill('SIGTERM');
      logger.info(`🔪 Worker ${workerId} killed`);
    }
  }

  /**
   * Restart specific worker
   */
  restartWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.process.kill('SIGTERM');
      setTimeout(() => {
        this.spawnWorker();
      }, 1000);
      logger.info(`🔄 Worker ${workerId} restarted`);
    }
  }
}

// Export singleton instance
const loadBalancer = new LoadBalancer();
module.exports = loadBalancer;


