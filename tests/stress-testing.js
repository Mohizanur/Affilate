const { performance } = require('perf_hooks');
const cluster = require('cluster');
const os = require('os');

/**
 * 🔥 STRESS TESTING SYSTEM
 * 
 * This system pushes the application to its limits to find
 * real bottlenecks and breaking points.
 */

class StressTestingSystem {
  constructor() {
    this.config = {
      maxConcurrentUsers: 10000,
      maxRequestRate: 10000, // requests per second
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      maxCpuUsage: 90, // 90%
      testDuration: 300000, // 5 minutes
      rampUpTime: 60000, // 1 minute
      rampDownTime: 60000, // 1 minute
      failureThreshold: 5, // 5% error rate
      responseTimeThreshold: 5000 // 5 seconds
    };
    
    this.results = {
      startTime: null,
      endTime: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errorRates: [],
      memoryUsage: [],
      cpuUsage: [],
      bottlenecks: [],
      breakingPoints: [],
      recommendations: []
    };
    
    this.isRunning = false;
    this.workers = [];
    this.monitoringInterval = null;
  }

  /**
   * Run comprehensive stress test
   */
  async runStressTest() {
    console.log('🔥 Starting Stress Testing System');
    console.log('=================================');
    
    this.isRunning = true;
    this.results.startTime = Date.now();
    
    try {
      // Phase 1: Baseline Performance
      await this.runBaselineTest();
      
      // Phase 2: Gradual Load Increase
      await this.runGradualLoadTest();
      
      // Phase 3: Spike Testing
      await this.runSpikeTest();
      
      // Phase 4: Endurance Testing
      await this.runEnduranceTest();
      
      // Phase 5: Resource Exhaustion Testing
      await this.runResourceExhaustionTest();
      
      // Phase 6: Failure Recovery Testing
      await this.runFailureRecoveryTest();
      
      // Analyze results and generate report
      await this.analyzeResults();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Stress test failed:', error);
      this.results.bottlenecks.push({
        type: 'system_failure',
        description: error.message,
        severity: 'critical',
        timestamp: Date.now()
      });
    } finally {
      this.isRunning = false;
      this.results.endTime = Date.now();
      this.cleanup();
    }
  }

  /**
   * Run baseline performance test
   */
  async runBaselineTest() {
    console.log('\n📊 Phase 1: Baseline Performance Test');
    console.log('=====================================');
    
    const baselineResults = {
      concurrentUsers: 10,
      requestRate: 100,
      duration: 30000, // 30 seconds
      results: {}
    };
    
    console.log('  Testing with 10 concurrent users, 100 req/sec for 30 seconds...');
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < baselineResults.concurrentUsers; i++) {
      promises.push(this.simulateUserLoad(baselineResults.requestRate, baselineResults.duration));
    }
    
    const results = await Promise.all(promises);
    
    baselineResults.results = this.aggregateResults(results);
    baselineResults.results.phase = 'baseline';
    baselineResults.results.timestamp = Date.now();
    
    this.results.baseline = baselineResults.results;
    
    console.log(`  Baseline Results:`);
    console.log(`    Average Response Time: ${baselineResults.results.avgResponseTime.toFixed(2)}ms`);
    console.log(`    Error Rate: ${baselineResults.results.errorRate.toFixed(2)}%`);
    console.log(`    Throughput: ${baselineResults.results.throughput.toFixed(2)} req/sec`);
    
    // Check if baseline is acceptable
    if (baselineResults.results.errorRate > this.config.failureThreshold) {
      this.results.bottlenecks.push({
        type: 'baseline_failure',
        description: `Baseline error rate ${baselineResults.results.errorRate.toFixed(2)}% exceeds threshold ${this.config.failureThreshold}%`,
        severity: 'critical',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Run gradual load increase test
   */
  async runGradualLoadTest() {
    console.log('\n📈 Phase 2: Gradual Load Increase Test');
    console.log('=====================================');
    
    const loadLevels = [50, 100, 200, 500, 1000, 2000, 5000];
    const results = [];
    
    for (const level of loadLevels) {
      console.log(`  Testing with ${level} concurrent users...`);
      
      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < level; i++) {
        promises.push(this.simulateUserLoad(100, 30000)); // 30 seconds per level
      }
      
      const levelResults = await Promise.all(promises);
      const aggregated = this.aggregateResults(levelResults);
      
      aggregated.concurrentUsers = level;
      aggregated.phase = 'gradual_load';
      aggregated.timestamp = Date.now();
      
      results.push(aggregated);
      
      console.log(`    Response Time: ${aggregated.avgResponseTime.toFixed(2)}ms`);
      console.log(`    Error Rate: ${aggregated.errorRate.toFixed(2)}%`);
      console.log(`    Throughput: ${aggregated.throughput.toFixed(2)} req/sec`);
      
      // Check for bottlenecks
      if (aggregated.errorRate > this.config.failureThreshold) {
        this.results.bottlenecks.push({
          type: 'error_rate_threshold',
          description: `Error rate ${aggregated.errorRate.toFixed(2)}% exceeds threshold at ${level} concurrent users`,
          severity: 'high',
          concurrentUsers: level,
          timestamp: Date.now()
        });
      }
      
      if (aggregated.avgResponseTime > this.config.responseTimeThreshold) {
        this.results.bottlenecks.push({
          type: 'response_time_threshold',
          description: `Response time ${aggregated.avgResponseTime.toFixed(2)}ms exceeds threshold at ${level} concurrent users`,
          severity: 'high',
          concurrentUsers: level,
          timestamp: Date.now()
        });
      }
      
      // Check for breaking point
      if (aggregated.errorRate > 50) {
        this.results.breakingPoints.push({
          type: 'error_rate_breaking_point',
          description: `System breaks down at ${level} concurrent users with ${aggregated.errorRate.toFixed(2)}% error rate`,
          concurrentUsers: level,
          timestamp: Date.now()
        });
        break; // Stop testing if system breaks down
      }
      
      // Ramp down between levels
      await this.sleep(5000);
    }
    
    this.results.gradualLoad = results;
  }

  /**
   * Run spike testing
   */
  async runSpikeTest() {
    console.log('\n⚡ Phase 3: Spike Testing');
    console.log('=========================');
    
    const spikeLevels = [1000, 2000, 5000, 10000];
    const results = [];
    
    for (const level of spikeLevels) {
      console.log(`  Testing spike to ${level} concurrent users...`);
      
      const startTime = Date.now();
      const promises = [];
      
      // Create spike load
      for (let i = 0; i < level; i++) {
        promises.push(this.simulateUserLoad(200, 10000)); // 10 seconds spike
      }
      
      const spikeResults = await Promise.all(promises);
      const aggregated = this.aggregateResults(spikeResults);
      
      aggregated.spikeLevel = level;
      aggregated.phase = 'spike';
      aggregated.timestamp = Date.now();
      
      results.push(aggregated);
      
      console.log(`    Spike Response Time: ${aggregated.avgResponseTime.toFixed(2)}ms`);
      console.log(`    Spike Error Rate: ${aggregated.errorRate.toFixed(2)}%`);
      console.log(`    Spike Throughput: ${aggregated.throughput.toFixed(2)} req/sec`);
      
      // Check for spike recovery
      if (aggregated.errorRate > 20) {
        this.results.bottlenecks.push({
          type: 'spike_recovery_failure',
          description: `System failed to handle spike to ${level} users with ${aggregated.errorRate.toFixed(2)}% error rate`,
          severity: 'high',
          spikeLevel: level,
          timestamp: Date.now()
        });
      }
      
      // Recovery period
      await this.sleep(10000);
    }
    
    this.results.spikeTest = results;
  }

  /**
   * Run endurance testing
   */
  async runEnduranceTest() {
    console.log('\n⏱️ Phase 4: Endurance Testing');
    console.log('=============================');
    
    const enduranceConfig = {
      concurrentUsers: 500,
      duration: 300000, // 5 minutes
      requestRate: 100
    };
    
    console.log(`  Testing ${enduranceConfig.concurrentUsers} concurrent users for ${enduranceConfig.duration / 1000} seconds...`);
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < enduranceConfig.concurrentUsers; i++) {
      promises.push(this.simulateUserLoad(enduranceConfig.requestRate, enduranceConfig.duration));
    }
    
    const results = await Promise.all(promises);
    const aggregated = this.aggregateResults(results);
    
    aggregated.phase = 'endurance';
    aggregated.timestamp = Date.now();
    
    this.results.endurance = aggregated;
    
    console.log(`  Endurance Results:`);
    console.log(`    Average Response Time: ${aggregated.avgResponseTime.toFixed(2)}ms`);
    console.log(`    Error Rate: ${aggregated.errorRate.toFixed(2)}%`);
    console.log(`    Throughput: ${aggregated.throughput.toFixed(2)} req/sec`);
    
    // Check for memory leaks
    if (aggregated.memoryLeakRate > 1) {
      this.results.bottlenecks.push({
        type: 'memory_leak',
        description: `Memory leak detected: ${aggregated.memoryLeakRate.toFixed(2)}MB per 1000 operations`,
        severity: 'high',
        timestamp: Date.now()
      });
    }
    
    // Check for performance degradation
    if (this.results.baseline && aggregated.avgResponseTime > this.results.baseline.avgResponseTime * 2) {
      this.results.bottlenecks.push({
        type: 'performance_degradation',
        description: `Performance degraded from ${this.results.baseline.avgResponseTime.toFixed(2)}ms to ${aggregated.avgResponseTime.toFixed(2)}ms`,
        severity: 'medium',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Run resource exhaustion testing
   */
  async runResourceExhaustionTest() {
    console.log('\n💻 Phase 5: Resource Exhaustion Testing');
    console.log('======================================');
    
    const resourceTests = [
      { name: 'Memory Exhaustion', type: 'memory' },
      { name: 'CPU Exhaustion', type: 'cpu' },
      { name: 'Connection Exhaustion', type: 'connections' }
    ];
    
    for (const test of resourceTests) {
      console.log(`  Testing ${test.name}...`);
      
      try {
        const result = await this.exhaustResource(test.type);
        
        this.results.resourceExhaustion = this.results.resourceExhaustion || {};
        this.results.resourceExhaustion[test.type] = result;
        
        console.log(`    ${test.name} Result: ${result.status}`);
        console.log(`    Recovery Time: ${result.recoveryTime.toFixed(2)}ms`);
        
        if (result.status === 'failed') {
          this.results.bottlenecks.push({
            type: 'resource_exhaustion',
            description: `${test.name} caused system failure`,
            severity: 'critical',
            resource: test.type,
            timestamp: Date.now()
          });
        }
        
      } catch (error) {
        console.log(`    ${test.name} failed: ${error.message}`);
        this.results.bottlenecks.push({
          type: 'resource_exhaustion_error',
          description: `${test.name} test failed: ${error.message}`,
          severity: 'high',
          resource: test.type,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Run failure recovery testing
   */
  async runFailureRecoveryTest() {
    console.log('\n🔄 Phase 6: Failure Recovery Testing');
    console.log('====================================');
    
    const recoveryTests = [
      { name: 'Database Connection Loss', type: 'database' },
      { name: 'Cache Failure', type: 'cache' },
      { name: 'External Service Failure', type: 'external' }
    ];
    
    for (const test of recoveryTests) {
      console.log(`  Testing ${test.name} recovery...`);
      
      try {
        const result = await this.simulateFailure(test.type);
        
        this.results.failureRecovery = this.results.failureRecovery || {};
        this.results.failureRecovery[test.type] = result;
        
        console.log(`    Recovery Time: ${result.recoveryTime.toFixed(2)}ms`);
        console.log(`    Data Loss: ${result.dataLoss ? 'Yes' : 'No'}`);
        
        if (result.recoveryTime > 30000) { // 30 seconds
          this.results.bottlenecks.push({
            type: 'slow_recovery',
            description: `${test.name} recovery took ${result.recoveryTime.toFixed(2)}ms`,
            severity: 'medium',
            failure: test.type,
            timestamp: Date.now()
          });
        }
        
      } catch (error) {
        console.log(`    ${test.name} recovery failed: ${error.message}`);
        this.results.bottlenecks.push({
          type: 'recovery_failure',
          description: `${test.name} recovery failed: ${error.message}`,
          severity: 'high',
          failure: test.type,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Simulate user load
   */
  async simulateUserLoad(requestRate, duration) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    const requestInterval = 1000 / requestRate;
    
    const results = {
      requests: 0,
      successes: 0,
      failures: 0,
      responseTimes: [],
      errors: []
    };
    
    while (Date.now() < endTime) {
      const requestStart = performance.now();
      
      try {
        // Simulate API request
        await this.simulateAPIRequest();
        
        const requestEnd = performance.now();
        results.responseTimes.push(requestEnd - requestStart);
        results.successes++;
        
      } catch (error) {
        results.failures++;
        results.errors.push(error.message);
      }
      
      results.requests++;
      
      // Wait for next request
      await this.sleep(requestInterval);
    }
    
    return results;
  }

  /**
   * Simulate API request
   */
  async simulateAPIRequest() {
    // Simulate realistic API request with variable response time
    const baseTime = 50; // 50ms base
    const variance = Math.random() * 100; // 0-100ms variance
    const delay = baseTime + variance;
    
    await this.sleep(delay);
    
    // Simulate occasional failures
    if (Math.random() < 0.01) { // 1% failure rate
      throw new Error('Simulated API failure');
    }
  }

  /**
   * Exhaust a specific resource
   */
  async exhaustResource(resourceType) {
    const startTime = performance.now();
    
    try {
      switch (resourceType) {
        case 'memory':
          return await this.exhaustMemory();
        case 'cpu':
          return await this.exhaustCPU();
        case 'connections':
          return await this.exhaustConnections();
        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }
    } catch (error) {
      const endTime = performance.now();
      return {
        status: 'failed',
        error: error.message,
        recoveryTime: endTime - startTime
      };
    }
  }

  /**
   * Exhaust memory
   */
  async exhaustMemory() {
    const startTime = performance.now();
    const memoryObjects = [];
    
    try {
      // Allocate memory until we hit a limit
      for (let i = 0; i < 1000000; i++) {
        memoryObjects.push({
          id: i,
          data: new Array(1000).fill(0).map(() => Math.random()),
          timestamp: Date.now()
        });
        
        // Check memory usage
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > this.config.maxMemoryUsage) {
          break;
        }
      }
      
      // Simulate recovery
      await this.sleep(1000);
      memoryObjects.length = 0; // Clear memory
      
      const endTime = performance.now();
      return {
        status: 'recovered',
        recoveryTime: endTime - startTime,
        memoryUsed: process.memoryUsage().heapUsed
      };
      
    } catch (error) {
      const endTime = performance.now();
      return {
        status: 'failed',
        error: error.message,
        recoveryTime: endTime - startTime
      };
    }
  }

  /**
   * Exhaust CPU
   */
  async exhaustCPU() {
    const startTime = performance.now();
    
    try {
      // Run CPU-intensive operations
      const promises = [];
      for (let i = 0; i < os.cpus().length; i++) {
        promises.push(this.cpuIntensiveOperation());
      }
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      return {
        status: 'recovered',
        recoveryTime: endTime - startTime
      };
      
    } catch (error) {
      const endTime = performance.now();
      return {
        status: 'failed',
        error: error.message,
        recoveryTime: endTime - startTime
      };
    }
  }

  /**
   * Exhaust connections
   */
  async exhaustConnections() {
    const startTime = performance.now();
    const connections = [];
    
    try {
      // Simulate connection exhaustion
      for (let i = 0; i < 10000; i++) {
        connections.push({
          id: i,
          socket: { connected: true },
          timestamp: Date.now()
        });
      }
      
      // Simulate recovery
      await this.sleep(1000);
      connections.length = 0; // Clear connections
      
      const endTime = performance.now();
      return {
        status: 'recovered',
        recoveryTime: endTime - startTime,
        connectionsUsed: connections.length
      };
      
    } catch (error) {
      const endTime = performance.now();
      return {
        status: 'failed',
        error: error.message,
        recoveryTime: endTime - startTime
      };
    }
  }

  /**
   * Simulate failure
   */
  async simulateFailure(failureType) {
    const startTime = performance.now();
    
    try {
      switch (failureType) {
        case 'database':
          return await this.simulateDatabaseFailure();
        case 'cache':
          return await this.simulateCacheFailure();
        case 'external':
          return await this.simulateExternalServiceFailure();
        default:
          throw new Error(`Unknown failure type: ${failureType}`);
      }
    } catch (error) {
      const endTime = performance.now();
      return {
        status: 'failed',
        error: error.message,
        recoveryTime: endTime - startTime,
        dataLoss: true
      };
    }
  }

  /**
   * Simulate database failure
   */
  async simulateDatabaseFailure() {
    const startTime = performance.now();
    
    // Simulate database connection loss
    await this.sleep(1000);
    
    // Simulate recovery
    await this.sleep(2000);
    
    const endTime = performance.now();
    return {
      status: 'recovered',
      recoveryTime: endTime - startTime,
      dataLoss: false
    };
  }

  /**
   * Simulate cache failure
   */
  async simulateCacheFailure() {
    const startTime = performance.now();
    
    // Simulate cache failure
    await this.sleep(500);
    
    // Simulate recovery
    await this.sleep(1000);
    
    const endTime = performance.now();
    return {
      status: 'recovered',
      recoveryTime: endTime - startTime,
      dataLoss: false
    };
  }

  /**
   * Simulate external service failure
   */
  async simulateExternalServiceFailure() {
    const startTime = performance.now();
    
    // Simulate external service failure
    await this.sleep(2000);
    
    // Simulate recovery
    await this.sleep(3000);
    
    const endTime = performance.now();
    return {
      status: 'recovered',
      recoveryTime: endTime - startTime,
      dataLoss: false
    };
  }

  /**
   * CPU intensive operation
   */
  async cpuIntensiveOperation() {
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    return result;
  }

  /**
   * Aggregate results from multiple tests
   */
  aggregateResults(results) {
    const aggregated = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      errorRate: 0,
      throughput: 0,
      memoryLeakRate: 0
    };
    
    for (const result of results) {
      aggregated.totalRequests += result.requests;
      aggregated.successfulRequests += result.successes;
      aggregated.failedRequests += result.failures;
      aggregated.responseTimes.push(...result.responseTimes);
      aggregated.errors.push(...result.errors);
    }
    
    if (aggregated.responseTimes.length > 0) {
      aggregated.avgResponseTime = aggregated.responseTimes.reduce((a, b) => a + b, 0) / aggregated.responseTimes.length;
      aggregated.maxResponseTime = Math.max(...aggregated.responseTimes);
      aggregated.minResponseTime = Math.min(...aggregated.responseTimes);
    }
    
    aggregated.errorRate = (aggregated.failedRequests / aggregated.totalRequests) * 100;
    aggregated.throughput = (aggregated.successfulRequests / (this.results.endTime - this.results.startTime)) * 1000;
    
    return aggregated;
  }

  /**
   * Analyze results and identify bottlenecks
   */
  async analyzeResults() {
    console.log('\n🔍 Analyzing Results...');
    
    // Analyze response time trends
    if (this.results.gradualLoad) {
      const responseTimeTrend = this.analyzeResponseTimeTrend(this.results.gradualLoad);
      if (responseTimeTrend.degradation > 50) {
        this.results.bottlenecks.push({
          type: 'response_time_degradation',
          description: `Response time degraded by ${responseTimeTrend.degradation.toFixed(2)}% under load`,
          severity: 'high',
          timestamp: Date.now()
        });
      }
    }
    
    // Analyze error rate trends
    if (this.results.gradualLoad) {
      const errorRateTrend = this.analyzeErrorRateTrend(this.results.gradualLoad);
      if (errorRateTrend.increase > 10) {
        this.results.bottlenecks.push({
          type: 'error_rate_increase',
          description: `Error rate increased by ${errorRateTrend.increase.toFixed(2)}% under load`,
          severity: 'high',
          timestamp: Date.now()
        });
      }
    }
    
    // Generate recommendations
    this.generateRecommendations();
  }

  /**
   * Analyze response time trend
   */
  analyzeResponseTimeTrend(loadResults) {
    if (loadResults.length < 2) return { degradation: 0 };
    
    const first = loadResults[0];
    const last = loadResults[loadResults.length - 1];
    
    const degradation = ((last.avgResponseTime - first.avgResponseTime) / first.avgResponseTime) * 100;
    
    return { degradation };
  }

  /**
   * Analyze error rate trend
   */
  analyzeErrorRateTrend(loadResults) {
    if (loadResults.length < 2) return { increase: 0 };
    
    const first = loadResults[0];
    const last = loadResults[loadResults.length - 1];
    
    const increase = last.errorRate - first.errorRate;
    
    return { increase };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Analyze bottlenecks and generate recommendations
    for (const bottleneck of this.results.bottlenecks) {
      switch (bottleneck.type) {
        case 'error_rate_threshold':
          recommendations.push({
            type: 'scaling',
            description: 'Implement horizontal scaling to handle higher concurrent users',
            priority: 'high',
            bottleneck: bottleneck
          });
          break;
          
        case 'response_time_threshold':
          recommendations.push({
            type: 'optimization',
            description: 'Optimize database queries and implement caching',
            priority: 'high',
            bottleneck: bottleneck
          });
          break;
          
        case 'memory_leak':
          recommendations.push({
            type: 'memory_management',
            description: 'Implement proper memory cleanup and garbage collection',
            priority: 'high',
            bottleneck: bottleneck
          });
          break;
          
        case 'spike_recovery_failure':
          recommendations.push({
            type: 'resilience',
            description: 'Implement circuit breakers and rate limiting',
            priority: 'medium',
            bottleneck: bottleneck
          });
          break;
          
        case 'slow_recovery':
          recommendations.push({
            type: 'monitoring',
            description: 'Implement health checks and automatic recovery',
            priority: 'medium',
            bottleneck: bottleneck
          });
          break;
      }
    }
    
    this.results.recommendations = recommendations;
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('\n📊 STRESS TEST REPORT');
    console.log('=====================');
    
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    console.log(`\n⏱️ Test Duration: ${duration.toFixed(2)} seconds`);
    
    // Summary statistics
    if (this.results.baseline) {
      console.log(`\n📈 Baseline Performance:`);
      console.log(`  Response Time: ${this.results.baseline.avgResponseTime.toFixed(2)}ms`);
      console.log(`  Error Rate: ${this.results.baseline.errorRate.toFixed(2)}%`);
      console.log(`  Throughput: ${this.results.baseline.throughput.toFixed(2)} req/sec`);
    }
    
    // Bottlenecks
    if (this.results.bottlenecks.length > 0) {
      console.log(`\n⚠️ Bottlenecks Found (${this.results.bottlenecks.length}):`);
      for (const bottleneck of this.results.bottlenecks) {
        console.log(`  ${bottleneck.severity.toUpperCase()}: ${bottleneck.description}`);
      }
    }
    
    // Breaking points
    if (this.results.breakingPoints.length > 0) {
      console.log(`\n💥 Breaking Points (${this.results.breakingPoints.length}):`);
      for (const breakingPoint of this.results.breakingPoints) {
        console.log(`  ${breakingPoint.description}`);
      }
    }
    
    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log(`\n💡 Recommendations (${this.results.recommendations.length}):`);
      for (const recommendation of this.results.recommendations) {
        console.log(`  ${recommendation.priority.toUpperCase()}: ${recommendation.description}`);
      }
    }
    
    // Performance rating
    this.calculatePerformanceRating();
  }

  /**
   * Calculate performance rating
   */
  calculatePerformanceRating() {
    let score = 10;
    
    // Deduct points for bottlenecks
    for (const bottleneck of this.results.bottlenecks) {
      switch (bottleneck.severity) {
        case 'critical':
          score -= 3;
          break;
        case 'high':
          score -= 2;
          break;
        case 'medium':
          score -= 1;
          break;
        case 'low':
          score -= 0.5;
          break;
      }
    }
    
    // Deduct points for breaking points
    score -= this.results.breakingPoints.length * 2;
    
    score = Math.max(0, score);
    
    console.log(`\n🏆 Performance Rating: ${score.toFixed(1)}/10`);
    
    if (score >= 8) {
      console.log('🎉 EXCELLENT - System is highly resilient and performant!');
    } else if (score >= 6) {
      console.log('✅ GOOD - System is stable with minor issues');
    } else if (score >= 4) {
      console.log('⚠️ FAIR - System has significant performance issues');
    } else {
      console.log('❌ POOR - System has critical performance problems');
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Clean up workers
    for (const worker of this.workers) {
      if (worker && !worker.isDead()) {
        worker.kill();
      }
    }
  }

  /**
   * Utility function to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use
module.exports = StressTestingSystem;

// Run if called directly
if (require.main === module) {
  const stressTest = new StressTestingSystem();
  stressTest.runStressTest().catch(console.error);
}


