const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

/**
 * 🎯 PERFORMANCE VALIDATION & REGRESSION TESTING
 * 
 * This system provides comprehensive performance validation
 * and regression testing to ensure consistent performance.
 */

class PerformanceValidationSystem {
  constructor() {
    this.config = {
      validationThresholds: {
        responseTime: { warning: 200, error: 500 },
        errorRate: { warning: 2, error: 5 },
        throughput: { warning: 800, error: 500 },
        memoryUsage: { warning: 80, error: 90 },
        cpuUsage: { warning: 70, error: 85 }
      },
      regressionThresholds: {
        responseTime: 20, // 20% increase
        errorRate: 1, // 1% increase
        throughput: 15, // 15% decrease
        memoryUsage: 10, // 10% increase
        cpuUsage: 15 // 15% increase
      },
      testSuites: [
        { name: 'api', iterations: 100, timeout: 5000 },
        { name: 'database', iterations: 50, timeout: 10000 },
        { name: 'cache', iterations: 200, timeout: 3000 },
        { name: 'concurrency', iterations: 10, timeout: 30000 }
      ]
    };
    
    this.baseline = null;
    this.results = [];
    this.validationFile = path.join(__dirname, 'validation-results.json');
    this.baselineFile = path.join(__dirname, 'performance-baseline.json');
  }

  /**
   * Run comprehensive performance validation
   */
  async runValidation() {
    console.log('🎯 Starting Performance Validation');
    console.log('==================================');
    
    try {
      // Load baseline
      await this.loadBaseline();
      
      // Run validation tests
      const results = {
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        tests: {}
      };
      
      // Run each test suite
      for (const suite of this.config.testSuites) {
        console.log(`\n📊 Running ${suite.name.toUpperCase()} validation...`);
        results.tests[suite.name] = await this.runTestSuite(suite);
      }
      
      // Calculate overall score
      results.overallScore = this.calculateOverallScore(results.tests);
      
      // Check for regressions
      if (this.baseline) {
        results.regressions = this.detectRegressions(results.tests);
      }
      
      // Generate recommendations
      results.recommendations = this.generateRecommendations(results.tests, results.regressions || []);
      
      // Save results
      await this.saveResults(results);
      
      // Display results
      this.displayResults(results);
      
      return results;
      
    } catch (error) {
      console.error('❌ Performance validation failed:', error);
      throw error;
    }
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(suite) {
    const startTime = performance.now();
    const results = {
      name: suite.name,
      iterations: suite.iterations,
      results: [],
      summary: {}
    };
    
    try {
      // Run test iterations
      for (let i = 0; i < suite.iterations; i++) {
        const iterationStart = performance.now();
        
        try {
          // Run specific test based on suite name
          const testResult = await this.runSpecificTest(suite.name);
          
          const iterationEnd = performance.now();
          const duration = iterationEnd - iterationStart;
          
          results.results.push({
            iteration: i + 1,
            duration,
            success: true,
            metrics: testResult
          });
          
        } catch (error) {
          const iterationEnd = performance.now();
          const duration = iterationEnd - iterationStart;
          
          results.results.push({
            iteration: i + 1,
            duration,
            success: false,
            error: error.message
          });
        }
        
        // Small delay between iterations
        await this.sleep(10);
      }
      
      // Calculate summary
      results.summary = this.calculateTestSummary(results.results);
      
      const endTime = performance.now();
      results.totalDuration = endTime - startTime;
      
      console.log(`  ✅ ${suite.name} validation complete: ${results.summary.avgResponseTime.toFixed(2)}ms avg, ${results.summary.errorRate.toFixed(2)}% errors`);
      
      return results;
      
    } catch (error) {
      console.error(`  ❌ ${suite.name} validation failed:`, error);
      throw error;
    }
  }

  /**
   * Run specific test based on suite name
   */
  async runSpecificTest(testName) {
    switch (testName) {
      case 'api':
        return await this.testAPI();
      case 'database':
        return await this.testDatabase();
      case 'cache':
        return await this.testCache();
      case 'concurrency':
        return await this.testConcurrency();
      default:
        throw new Error(`Unknown test: ${testName}`);
    }
  }

  /**
   * Test API performance
   */
  async testAPI() {
    const startTime = performance.now();
    
    // Simulate API calls
    const endpoints = ['/health', '/api/users', '/api/companies', '/api/stats'];
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    
    // Simulate API response time
    const responseTime = this.simulateAPIResponseTime(endpoint);
    await this.sleep(responseTime);
    
    const endTime = performance.now();
    
    return {
      responseTime: endTime - startTime,
      endpoint,
      success: true
    };
  }

  /**
   * Test database performance
   */
  async testDatabase() {
    const startTime = performance.now();
    
    // Simulate database operations
    const operations = ['select', 'insert', 'update', 'delete'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    // Simulate database response time
    const responseTime = this.simulateDatabaseResponseTime(operation);
    await this.sleep(responseTime);
    
    const endTime = performance.now();
    
    return {
      responseTime: endTime - startTime,
      operation,
      success: true
    };
  }

  /**
   * Test cache performance
   */
  async testCache() {
    const startTime = performance.now();
    
    // Simulate cache operations
    const operations = ['get', 'set', 'delete'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    // Simulate cache response time
    const responseTime = this.simulateCacheResponseTime(operation);
    await this.sleep(responseTime);
    
    const endTime = performance.now();
    
    return {
      responseTime: endTime - startTime,
      operation,
      success: true
    };
  }

  /**
   * Test concurrency performance
   */
  async testConcurrency() {
    const startTime = performance.now();
    
    // Simulate concurrent operations
    const concurrentOperations = 10;
    const promises = [];
    
    for (let i = 0; i < concurrentOperations; i++) {
      promises.push(this.simulateConcurrentOperation());
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    
    return {
      responseTime: endTime - startTime,
      concurrentOperations,
      success: true
    };
  }

  /**
   * Simulate API response time
   */
  simulateAPIResponseTime(endpoint) {
    const endpointTimes = {
      '/health': 5,
      '/api/users': 50,
      '/api/companies': 30,
      '/api/stats': 100
    };
    
    const baseTime = endpointTimes[endpoint] || 25;
    const variance = Math.random() * 20;
    return baseTime + variance;
  }

  /**
   * Simulate database response time
   */
  simulateDatabaseResponseTime(operation) {
    const operationTimes = {
      'select': 20,
      'insert': 40,
      'update': 35,
      'delete': 30
    };
    
    const baseTime = operationTimes[operation] || 25;
    const variance = Math.random() * 15;
    return baseTime + variance;
  }

  /**
   * Simulate cache response time
   */
  simulateCacheResponseTime(operation) {
    const operationTimes = {
      'get': 2,
      'set': 5,
      'delete': 3
    };
    
    const baseTime = operationTimes[operation] || 3;
    const variance = Math.random() * 2;
    return baseTime + variance;
  }

  /**
   * Simulate concurrent operation
   */
  async simulateConcurrentOperation() {
    const delay = Math.random() * 100 + 50; // 50-150ms
    await this.sleep(delay);
    return delay;
  }

  /**
   * Calculate test summary
   */
  calculateTestSummary(results) {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    const summary = {
      totalIterations: results.length,
      successfulIterations: successfulResults.length,
      failedIterations: failedResults.length,
      errorRate: (failedResults.length / results.length) * 100,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      throughput: 0
    };
    
    if (successfulResults.length > 0) {
      const responseTimes = successfulResults.map(r => r.duration);
      summary.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      summary.maxResponseTime = Math.max(...responseTimes);
      summary.minResponseTime = Math.min(...responseTimes);
      summary.throughput = (successfulResults.length / (summary.avgResponseTime / 1000)) * 1000;
    }
    
    return summary;
  }

  /**
   * Calculate overall score
   */
  calculateOverallScore(tests) {
    let totalScore = 0;
    let maxScore = 0;
    
    for (const [testName, testResult] of Object.entries(tests)) {
      const score = this.calculateTestScore(testResult.summary);
      totalScore += score;
      maxScore += 100;
    }
    
    return {
      score: Math.round((totalScore / maxScore) * 100),
      maxScore: 100,
      breakdown: Object.fromEntries(
        Object.entries(tests).map(([name, result]) => [name, this.calculateTestScore(result.summary)])
      )
    };
  }

  /**
   * Calculate test score
   */
  calculateTestScore(summary) {
    let score = 100;
    
    // Deduct points for high error rate
    if (summary.errorRate > 5) score -= 30;
    else if (summary.errorRate > 2) score -= 15;
    
    // Deduct points for high response time
    if (summary.avgResponseTime > 500) score -= 25;
    else if (summary.avgResponseTime > 200) score -= 15;
    
    // Deduct points for low throughput
    if (summary.throughput < 500) score -= 20;
    else if (summary.throughput < 800) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(currentTests) {
    const regressions = [];
    
    for (const [testName, currentTest] of Object.entries(currentTests)) {
      const baselineTest = this.baseline.tests[testName];
      
      if (baselineTest) {
        const regression = this.compareTestResults(baselineTest.summary, currentTest.summary);
        
        if (regression.hasRegression) {
          regressions.push({
            test: testName,
            ...regression
          });
        }
      }
    }
    
    return regressions;
  }

  /**
   * Compare test results
   */
  compareTestResults(baseline, current) {
    const regression = {
      hasRegression: false,
      metrics: {}
    };
    
    // Check response time regression
    const responseTimeIncrease = ((current.avgResponseTime - baseline.avgResponseTime) / baseline.avgResponseTime) * 100;
    if (responseTimeIncrease > this.config.regressionThresholds.responseTime) {
      regression.hasRegression = true;
      regression.metrics.responseTime = {
        baseline: baseline.avgResponseTime,
        current: current.avgResponseTime,
        increase: responseTimeIncrease
      };
    }
    
    // Check error rate regression
    const errorRateIncrease = current.errorRate - baseline.errorRate;
    if (errorRateIncrease > this.config.regressionThresholds.errorRate) {
      regression.hasRegression = true;
      regression.metrics.errorRate = {
        baseline: baseline.errorRate,
        current: current.errorRate,
        increase: errorRateIncrease
      };
    }
    
    // Check throughput regression
    const throughputDecrease = ((baseline.throughput - current.throughput) / baseline.throughput) * 100;
    if (throughputDecrease > this.config.regressionThresholds.throughput) {
      regression.hasRegression = true;
      regression.metrics.throughput = {
        baseline: baseline.throughput,
        current: current.throughput,
        decrease: throughputDecrease
      };
    }
    
    return regression;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(tests, regressions) {
    const recommendations = [];
    
    // Check for validation failures
    for (const [testName, testResult] of Object.entries(tests)) {
      const summary = testResult.summary;
      
      if (summary.errorRate > this.config.validationThresholds.errorRate.error) {
        recommendations.push({
          type: 'error_rate',
          priority: 'high',
          test: testName,
          message: `Error rate ${summary.errorRate.toFixed(2)}% exceeds threshold ${this.config.validationThresholds.errorRate.error}%`
        });
      }
      
      if (summary.avgResponseTime > this.config.validationThresholds.responseTime.error) {
        recommendations.push({
          type: 'response_time',
          priority: 'high',
          test: testName,
          message: `Response time ${summary.avgResponseTime.toFixed(2)}ms exceeds threshold ${this.config.validationThresholds.responseTime.error}ms`
        });
      }
      
      if (summary.throughput < this.config.validationThresholds.throughput.error) {
        recommendations.push({
          type: 'throughput',
          priority: 'high',
          test: testName,
          message: `Throughput ${summary.throughput.toFixed(2)} req/sec below threshold ${this.config.validationThresholds.throughput.error} req/sec`
        });
      }
    }
    
    // Check for regressions
    for (const regression of (regressions || [])) {
      recommendations.push({
        type: 'regression',
        priority: 'high',
        test: regression.test,
        message: `Performance regression detected in ${regression.test}`,
        details: regression.metrics
      });
    }
    
    return recommendations;
  }

  /**
   * Load baseline
   */
  async loadBaseline() {
    try {
      const data = await fs.readFile(this.baselineFile, 'utf8');
      this.baseline = JSON.parse(data);
      console.log('📊 Performance baseline loaded');
    } catch (error) {
      console.log('📊 No performance baseline found');
    }
  }

  /**
   * Save results
   */
  async saveResults(results) {
    try {
      // Load existing results
      let existingResults = [];
      try {
        const data = await fs.readFile(this.validationFile, 'utf8');
        existingResults = JSON.parse(data);
      } catch (error) {
        // File doesn't exist, start with empty array
      }
      
      // Add new results
      existingResults.push(results);
      
      // Keep only last 10 results
      if (existingResults.length > 10) {
        existingResults = existingResults.slice(-10);
      }
      
      // Save results
      await fs.writeFile(this.validationFile, JSON.stringify(existingResults, null, 2));
      
      // Update baseline if this is a good run
      if (results.overallScore.score >= 80 && results.regressions.length === 0) {
        await this.updateBaseline(results);
      }
      
      console.log('💾 Validation results saved');
      
    } catch (error) {
      console.error('❌ Failed to save results:', error);
    }
  }

  /**
   * Update baseline
   */
  async updateBaseline(results) {
    try {
      const baseline = {
        timestamp: results.timestamp,
        version: results.version,
        environment: results.environment,
        tests: results.tests
      };
      
      await fs.writeFile(this.baselineFile, JSON.stringify(baseline, null, 2));
      console.log('📊 Performance baseline updated');
    } catch (error) {
      console.error('❌ Failed to update baseline:', error);
    }
  }

  /**
   * Display results
   */
  displayResults(results) {
    console.log('\n📊 PERFORMANCE VALIDATION RESULTS');
    console.log('==================================');
    
    console.log(`\n🏆 Overall Score: ${results.overallScore.score}/100`);
    
    if (results.overallScore.score >= 90) {
      console.log('🎉 EXCELLENT - Performance is outstanding!');
    } else if (results.overallScore.score >= 80) {
      console.log('✅ GOOD - Performance is acceptable');
    } else if (results.overallScore.score >= 70) {
      console.log('⚠️ FAIR - Performance needs improvement');
    } else {
      console.log('❌ POOR - Performance is unacceptable');
    }
    
    // Display test breakdown
    console.log('\n📈 Test Breakdown:');
    for (const [testName, score] of Object.entries(results.overallScore.breakdown)) {
      console.log(`  ${testName.toUpperCase()}: ${score}/100`);
    }
    
    // Display regressions
    if (results.regressions && results.regressions.length > 0) {
      console.log('\n⚠️ Performance Regressions:');
      for (const regression of results.regressions) {
        console.log(`  ${regression.test.toUpperCase()}:`);
        for (const [metric, data] of Object.entries(regression.metrics)) {
          if (metric === 'responseTime') {
            console.log(`    Response Time: ${data.baseline.toFixed(2)}ms → ${data.current.toFixed(2)}ms (+${data.increase.toFixed(2)}%)`);
          } else if (metric === 'errorRate') {
            console.log(`    Error Rate: ${data.baseline.toFixed(2)}% → ${data.current.toFixed(2)}% (+${data.increase.toFixed(2)}%)`);
          } else if (metric === 'throughput') {
            console.log(`    Throughput: ${data.baseline.toFixed(2)} → ${data.current.toFixed(2)} (-${data.decrease.toFixed(2)}%)`);
          }
        }
      }
    }
    
    // Display recommendations
    if (results.recommendations && results.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const recommendation of results.recommendations) {
        console.log(`  ${recommendation.priority.toUpperCase()}: ${recommendation.message}`);
      }
    }
    
    console.log(`\n📅 Validation Date: ${results.timestamp}`);
    console.log(`🔧 Version: ${results.version}`);
    console.log(`🌍 Environment: ${results.environment}`);
  }

  /**
   * Run regression test
   */
  async runRegressionTest() {
    console.log('🔄 Running Regression Test');
    console.log('==========================');
    
    if (!this.baseline) {
      console.log('❌ No baseline found. Run validation first to create a baseline.');
      return;
    }
    
    const results = await this.runValidation();
    
    if (results.regressions.length > 0) {
      console.log(`\n❌ ${results.regressions.length} regression(s) detected!`);
      return false;
    } else {
      console.log('\n✅ No regressions detected!');
      return true;
    }
  }

  /**
   * Get validation history
   */
  async getValidationHistory() {
    try {
      const data = await fs.readFile(this.validationFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
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
module.exports = PerformanceValidationSystem;

// Run if called directly
if (require.main === module) {
  const validation = new PerformanceValidationSystem();
  validation.runValidation().catch(console.error);
}
