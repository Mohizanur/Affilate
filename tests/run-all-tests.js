#!/usr/bin/env node

const LoadTestingSuite = require('./load-testing-suite');
const PerformanceBenchmarks = require('./performance-benchmarks');
const StressTestingSystem = require('./stress-testing');
const MonitoringDashboard = require('./monitoring-dashboard');
const GradualRolloutSystem = require('./gradual-rollout');
const PerformanceValidationSystem = require('./performance-validation');

/**
 * 🚀 COMPREHENSIVE TEST RUNNER
 * 
 * This runner executes all performance tests and validation
 * to provide a complete assessment of system performance.
 */

class ComprehensiveTestRunner {
  constructor() {
    this.results = {
      startTime: null,
      endTime: null,
      tests: {},
      overallScore: 0,
      recommendations: [],
      summary: {}
    };
    
    this.testSuites = [
      { name: 'benchmarks', class: PerformanceBenchmarks, enabled: true },
      { name: 'validation', class: PerformanceValidationSystem, enabled: true },
      { name: 'load_testing', class: LoadTestingSuite, enabled: true },
      { name: 'stress_testing', class: StressTestingSystem, enabled: false }, // Disabled by default (intensive)
      { name: 'monitoring', class: MonitoringDashboard, enabled: false } // Disabled by default (long-running)
    ];
  }

  /**
   * Run all enabled tests
   */
  async runAllTests(options = {}) {
    console.log('🚀 COMPREHENSIVE PERFORMANCE TEST SUITE');
    console.log('=======================================');
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log(`🔧 Node.js: ${process.version}`);
    console.log(`💻 Platform: ${process.platform} ${process.arch}`);
    
    this.results.startTime = Date.now();
    
    try {
      // Apply options
      if (options.enableStressTesting) {
        this.enableTest('stress_testing');
      }
      if (options.enableMonitoring) {
        this.enableTest('monitoring');
      }
      if (options.quick) {
        this.disableTest('load_testing');
        this.disableTest('stress_testing');
      }
      
      // Run enabled test suites
      for (const suite of this.testSuites) {
        if (suite.enabled) {
          console.log(`\n🔄 Running ${suite.name.toUpperCase()} tests...`);
          try {
            const testInstance = new suite.class();
            const result = await this.runTestSuite(testInstance, suite.name);
            this.results.tests[suite.name] = result;
            console.log(`✅ ${suite.name.toUpperCase()} tests completed`);
          } catch (error) {
            console.error(`❌ ${suite.name.toUpperCase()} tests failed:`, error.message);
            this.results.tests[suite.name] = {
              error: error.message,
              success: false
            };
          }
        } else {
          console.log(`⏭️ Skipping ${suite.name.toUpperCase()} tests (disabled)`);
        }
      }
      
      // Calculate overall results
      this.calculateOverallResults();
      
      // Generate comprehensive report
      this.generateComprehensiveReport();
      
      // Save results
      await this.saveResults();
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      this.results.endTime = Date.now();
    }
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(testInstance, suiteName) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (suiteName) {
        case 'benchmarks':
          result = await testInstance.runBenchmarks();
          break;
        case 'validation':
          result = await testInstance.runValidation();
          break;
        case 'load_testing':
          result = await testInstance.runLoadTest();
          break;
        case 'stress_testing':
          result = await testInstance.runStressTest();
          break;
        case 'monitoring':
          // Start monitoring dashboard (non-blocking)
          testInstance.initialize(3001);
          result = { status: 'started', port: 3001 };
          break;
        default:
          throw new Error(`Unknown test suite: ${suiteName}`);
      }
      
      const endTime = Date.now();
      
      return {
        success: true,
        duration: endTime - startTime,
        result
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      return {
        success: false,
        duration: endTime - startTime,
        error: error.message
      };
    }
  }

  /**
   * Calculate overall results
   */
  calculateOverallResults() {
    let totalScore = 0;
    let scoreCount = 0;
    const recommendations = [];
    
    // Process each test result
    for (const [testName, testResult] of Object.entries(this.results.tests)) {
      if (testResult.success && testResult.result) {
        const result = testResult.result;
        
        // Extract scores
        if (result.overallScore) {
          if (typeof result.overallScore === 'object' && result.overallScore.score) {
            totalScore += result.overallScore.score;
          } else if (typeof result.overallScore === 'number') {
            totalScore += result.overallScore;
          }
          scoreCount++;
        }
        
        // Extract recommendations
        if (result.recommendations) {
          recommendations.push(...result.recommendations.map(rec => ({
            ...rec,
            source: testName
          })));
        }
      }
    }
    
    // Calculate overall score
    this.results.overallScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    
    // Deduplicate and prioritize recommendations
    this.results.recommendations = this.deduplicateRecommendations(recommendations);
    
    // Generate summary
    this.results.summary = this.generateSummary();
  }

  /**
   * Generate summary
   */
  generateSummary() {
    const summary = {
      totalTests: Object.keys(this.results.tests).length,
      successfulTests: 0,
      failedTests: 0,
      totalDuration: this.results.endTime - this.results.startTime,
      performanceGrade: this.getPerformanceGrade(this.results.overallScore),
      keyMetrics: {},
      criticalIssues: []
    };
    
    // Count successful/failed tests
    for (const testResult of Object.values(this.results.tests)) {
      if (testResult.success) {
        summary.successfulTests++;
      } else {
        summary.failedTests++;
      }
    }
    
    // Extract key metrics
    if (this.results.tests.benchmarks?.result) {
      const benchmarks = this.results.tests.benchmarks.result;
      if (benchmarks.tests?.api) {
        summary.keyMetrics.avgApiResponseTime = this.calculateAverageApiResponseTime(benchmarks.tests.api);
      }
    }
    
    if (this.results.tests.validation?.result) {
      const validation = this.results.tests.validation.result;
      if (validation.tests) {
        summary.keyMetrics.validationScore = validation.overallScore?.score || 0;
      }
    }
    
    // Identify critical issues
    summary.criticalIssues = this.results.recommendations
      .filter(rec => rec.priority === 'high' || rec.severity === 'critical')
      .map(rec => rec.message || rec.description);
    
    return summary;
  }

  /**
   * Calculate average API response time
   */
  calculateAverageApiResponseTime(apiTests) {
    const responseTimes = [];
    
    for (const test of Object.values(apiTests)) {
      if (test.avgResponseTime) {
        responseTimes.push(test.avgResponseTime);
      }
    }
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
  }

  /**
   * Get performance grade
   */
  getPerformanceGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    if (score >= 60) return 'D+';
    if (score >= 55) return 'D';
    return 'F';
  }

  /**
   * Deduplicate recommendations
   */
  deduplicateRecommendations(recommendations) {
    const seen = new Set();
    const deduplicated = [];
    
    for (const rec of recommendations) {
      const key = `${rec.type || rec.category || 'general'}-${rec.message || rec.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(rec);
      }
    }
    
    // Sort by priority
    return deduplicated.sort((a, b) => {
      const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
      const aPriority = priorityOrder[a.priority || a.severity] || 4;
      const bPriority = priorityOrder[b.priority || b.severity] || 4;
      return aPriority - bPriority;
    });
  }

  /**
   * Generate comprehensive report
   */
  generateComprehensiveReport() {
    console.log('\n📊 COMPREHENSIVE PERFORMANCE REPORT');
    console.log('====================================');
    
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    console.log(`⏱️ Total Duration: ${duration.toFixed(2)} seconds`);
    console.log(`🏆 Overall Score: ${this.results.overallScore}/100 (${this.results.summary.performanceGrade})`);
    console.log(`✅ Successful Tests: ${this.results.summary.successfulTests}/${this.results.summary.totalTests}`);
    
    // Performance grade explanation
    this.explainPerformanceGrade();
    
    // Test results summary
    console.log('\n📈 Test Results Summary:');
    for (const [testName, testResult] of Object.entries(this.results.tests)) {
      const status = testResult.success ? '✅' : '❌';
      const duration = (testResult.duration / 1000).toFixed(2);
      console.log(`  ${status} ${testName.toUpperCase()}: ${duration}s`);
      
      if (testResult.result?.overallScore) {
        const score = typeof testResult.result.overallScore === 'object' 
          ? testResult.result.overallScore.score 
          : testResult.result.overallScore;
        console.log(`    Score: ${score}/100`);
      }
    }
    
    // Key metrics
    if (Object.keys(this.results.summary.keyMetrics).length > 0) {
      console.log('\n📊 Key Metrics:');
      for (const [metric, value] of Object.entries(this.results.summary.keyMetrics)) {
        console.log(`  ${metric}: ${typeof value === 'number' ? value.toFixed(2) : value}`);
      }
    }
    
    // Critical issues
    if (this.results.summary.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      for (const issue of this.results.summary.criticalIssues) {
        console.log(`  ❌ ${issue}`);
      }
    }
    
    // Top recommendations
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      const topRecommendations = this.results.recommendations.slice(0, 5);
      for (const rec of topRecommendations) {
        const priority = (rec.priority || rec.severity || 'medium').toUpperCase();
        const message = rec.message || rec.description;
        console.log(`  ${priority}: ${message}`);
      }
      
      if (this.results.recommendations.length > 5) {
        console.log(`  ... and ${this.results.recommendations.length - 5} more recommendations`);
      }
    }
    
    // Battle-tested assessment
    this.generateBattleTestedAssessment();
  }

  /**
   * Explain performance grade
   */
  explainPerformanceGrade() {
    const grade = this.results.summary.performanceGrade;
    const score = this.results.overallScore;
    
    console.log(`\n🎯 Performance Grade: ${grade}`);
    
    if (score >= 90) {
      console.log('🎉 EXCELLENT - Your system is battle-tested and production-ready!');
      console.log('   - Outstanding performance across all metrics');
      console.log('   - Minimal bottlenecks and excellent scalability');
      console.log('   - Ready for high-traffic production deployment');
    } else if (score >= 80) {
      console.log('✅ GOOD - Your system performs well with minor optimizations needed');
      console.log('   - Good performance with some room for improvement');
      console.log('   - Ready for production with monitoring');
      console.log('   - Consider addressing high-priority recommendations');
    } else if (score >= 70) {
      console.log('⚠️ FAIR - Your system needs significant improvements');
      console.log('   - Performance issues that could impact user experience');
      console.log('   - Requires optimization before production deployment');
      console.log('   - Focus on critical and high-priority issues');
    } else {
      console.log('❌ POOR - Your system has critical performance problems');
      console.log('   - Major performance issues that prevent production deployment');
      console.log('   - Immediate attention required for all critical issues');
      console.log('   - Consider architectural changes and optimization');
    }
  }

  /**
   * Generate battle-tested assessment
   */
  generateBattleTestedAssessment() {
    console.log('\n⚔️ BATTLE-TESTED ASSESSMENT');
    console.log('===========================');
    
    const score = this.results.overallScore;
    const criticalIssues = this.results.summary.criticalIssues.length;
    const hasStressTesting = this.results.tests.stress_testing?.success;
    const hasLoadTesting = this.results.tests.load_testing?.success;
    
    let battleTestedScore = 0;
    
    // Base score from performance
    if (score >= 90) battleTestedScore += 4;
    else if (score >= 80) battleTestedScore += 3;
    else if (score >= 70) battleTestedScore += 2;
    else if (score >= 60) battleTestedScore += 1;
    
    // Bonus for comprehensive testing
    if (hasLoadTesting) battleTestedScore += 2;
    if (hasStressTesting) battleTestedScore += 2;
    
    // Penalty for critical issues
    battleTestedScore -= Math.min(criticalIssues, 3);
    
    battleTestedScore = Math.max(0, Math.min(10, battleTestedScore));
    
    console.log(`🏆 Battle-Tested Score: ${battleTestedScore}/10`);
    
    if (battleTestedScore >= 9) {
      console.log('⚔️ BATTLE-HARDENED - Your system is truly battle-tested!');
      console.log('   ✅ Excellent performance under all conditions');
      console.log('   ✅ Comprehensive testing completed');
      console.log('   ✅ Ready for enterprise production deployment');
    } else if (battleTestedScore >= 7) {
      console.log('🛡️ BATTLE-READY - Your system is well-tested and reliable');
      console.log('   ✅ Good performance with comprehensive testing');
      console.log('   ⚠️ Minor issues to address');
      console.log('   ✅ Ready for production deployment');
    } else if (battleTestedScore >= 5) {
      console.log('⚔️ COMBAT-CAPABLE - Your system shows promise but needs work');
      console.log('   ⚠️ Performance issues under stress');
      console.log('   ⚠️ Limited testing coverage');
      console.log('   🔧 Requires optimization before battle deployment');
    } else {
      console.log('🏳️ NOT BATTLE-READY - Your system needs significant work');
      console.log('   ❌ Critical performance issues');
      console.log('   ❌ Insufficient testing');
      console.log('   🚫 Not ready for production deployment');
    }
    
    // Realistic expectations
    console.log('\n🎯 REALISTIC EXPECTATIONS:');
    console.log('==========================');
    console.log('✅ What you CAN expect:');
    console.log('   - Response times: 50-200ms (not microseconds)');
    console.log('   - Concurrency: 1,000-5,000 users (not 50,000)');
    console.log('   - Cache hit rate: 80-90% (not 99%)');
    console.log('   - Uptime: 99.5-99.9% (not 99.99%)');
    
    console.log('\n❌ What you CANNOT expect:');
    console.log('   - Microsecond response times (physically impossible)');
    console.log('   - Unlimited scaling without infrastructure');
    console.log('   - Zero downtime without proper architecture');
    console.log('   - Perfect performance without optimization');
  }

  /**
   * Save results
   */
  async saveResults() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const resultsFile = path.join(__dirname, 'comprehensive-test-results.json');
      await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));
      
      console.log(`\n💾 Results saved to: ${resultsFile}`);
    } catch (error) {
      console.error('❌ Failed to save results:', error);
    }
  }

  /**
   * Enable a test suite
   */
  enableTest(testName) {
    const suite = this.testSuites.find(s => s.name === testName);
    if (suite) {
      suite.enabled = true;
    }
  }

  /**
   * Disable a test suite
   */
  disableTest(testName) {
    const suite = this.testSuites.find(s => s.name === testName);
    if (suite) {
      suite.enabled = false;
    }
  }

  /**
   * Run quick tests only
   */
  async runQuickTests() {
    return await this.runAllTests({ quick: true });
  }

  /**
   * Run full tests including stress testing
   */
  async runFullTests() {
    return await this.runAllTests({ 
      enableStressTesting: true,
      enableMonitoring: false // Keep monitoring disabled for automated runs
    });
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const runner = new ComprehensiveTestRunner();
  
  let testPromise;
  
  if (args.includes('--quick')) {
    console.log('🚀 Running quick performance tests...');
    testPromise = runner.runQuickTests();
  } else if (args.includes('--full')) {
    console.log('🚀 Running full performance test suite...');
    testPromise = runner.runFullTests();
  } else if (args.includes('--monitoring')) {
    console.log('🚀 Running tests with monitoring dashboard...');
    testPromise = runner.runAllTests({ enableMonitoring: true });
  } else {
    console.log('🚀 Running standard performance tests...');
    testPromise = runner.runAllTests();
  }
  
  testPromise
    .then((results) => {
      console.log('\n🎉 All tests completed!');
      process.exit(results.overallScore >= 70 ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

// Export for use
module.exports = ComprehensiveTestRunner;
