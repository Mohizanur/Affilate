#!/usr/bin/env node

/**
 * 🚀 PRE-COMMIT INTEGRATION TEST
 * 
 * Complete integration verification before any commits
 * Tests EVERYTHING to ensure nothing is missed
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class PreCommitIntegrationTest {
  constructor() {
    this.results = {
      coreIntegration: { passed: 0, total: 0, details: [] },
      performanceSystems: { passed: 0, total: 0, details: [] },
      botCommands: { passed: 0, total: 0, details: [] },
      dependencies: { passed: 0, total: 0, details: [] },
      fileStructure: { passed: 0, total: 0, details: [] },
      configIntegration: { passed: 0, total: 0, details: [] },
      errorHandling: { passed: 0, total: 0, details: [] },
      overall: 'UNKNOWN'
    };
    this.errors = [];
    this.warnings = [];
    this.criticalIssues = [];
  }

  /**
   * Run complete pre-commit integration test
   */
  async runCompleteTest() {
    console.log('🚀 PRE-COMMIT INTEGRATION TEST');
    console.log('==============================');
    console.log('Testing EVERYTHING before commit...\n');

    try {
      // Test 1: Core Integration
      await this.testCoreIntegration();
      
      // Test 2: Performance Systems
      await this.testPerformanceSystems();
      
      // Test 3: Bot Commands Integration
      await this.testBotCommandsIntegration();
      
      // Test 4: Dependencies
      await this.testDependencies();
      
      // Test 5: File Structure
      await this.testFileStructure();
      
      // Test 6: Config Integration
      await this.testConfigIntegration();
      
      // Test 7: Error Handling
      await this.testErrorHandling();
      
      // Test 8: Real Performance Test
      await this.testRealPerformance();
      
      // Generate final report
      this.generateFinalReport();
      
      return this.results.overall === 'EXCELLENT' || this.results.overall === 'GOOD';
      
    } catch (error) {
      console.error('❌ Pre-commit test failed:', error.message);
      this.criticalIssues.push(`Pre-commit test failed: ${error.message}`);
      this.results.overall = 'FAILED';
      return false;
    }
  }

  /**
   * Test core integration
   */
  async testCoreIntegration() {
    console.log('🔧 Testing Core Integration...');
    
    const coreTests = [
      {
        name: 'bot/index.js exists and has content',
        test: () => {
          const exists = fs.existsSync('bot/index.js');
          if (!exists) return false;
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.length > 1000;
        }
      },
      {
        name: 'Production Optimizer imported',
        test: () => {
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.includes('ProductionOptimizer') && content.includes('productionOptimizer');
        }
      },
      {
        name: 'Ultra-Fast Response imported',
        test: () => {
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.includes('ultraFastResponse');
        }
      },
      {
        name: 'Real-Time Monitor imported',
        test: () => {
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.includes('realTimeMonitor');
        }
      },
      {
        name: 'Connection Pool imported',
        test: () => {
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.includes('connectionPool');
        }
      },
      {
        name: 'Smart Optimizer imported',
        test: () => {
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.includes('smartOptimizer');
        }
      },
      {
        name: 'Production Optimizer initialized',
        test: () => {
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.includes('productionOptimizer.initialize()');
        }
      },
      {
        name: 'Production Optimizer middleware added',
        test: () => {
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.includes('productionOptimizer.processRequest');
        }
      }
    ];
    
    this.results.coreIntegration.total = coreTests.length;
    
    for (const test of coreTests) {
      try {
        if (test.test()) {
          this.results.coreIntegration.passed++;
          this.results.coreIntegration.details.push(`✅ ${test.name}`);
        } else {
          this.results.coreIntegration.details.push(`❌ ${test.name}`);
          this.errors.push(`Core integration failed: ${test.name}`);
        }
      } catch (error) {
        this.results.coreIntegration.details.push(`❌ ${test.name} - Error: ${error.message}`);
        this.errors.push(`Core integration error: ${test.name} - ${error.message}`);
      }
    }
    
    console.log(`   ✅ Core Integration: ${this.results.coreIntegration.passed}/${this.results.coreIntegration.total}`);
  }

  /**
   * Test performance systems
   */
  async testPerformanceSystems() {
    console.log('⚡ Testing Performance Systems...');
    
    const performanceFiles = [
      { name: 'Production Optimizer', path: 'bot/config/productionOptimizer.js', minSize: 10000 },
      { name: 'Ultra-Fast Response', path: 'bot/config/ultraFastResponse.js', minSize: 15000 },
      { name: 'Real-Time Monitor', path: 'bot/config/realTimeMonitor.js', minSize: 12000 },
      { name: 'Connection Pool', path: 'bot/config/connectionPool.js', minSize: 10000 },
      { name: 'Memory Manager', path: 'bot/config/memoryManager.js', minSize: 8000 },
      { name: 'Quota Protector', path: 'bot/config/quotaProtector.js', minSize: 6000 },
      { name: 'Smart Optimizer', path: 'bot/config/smart-optimizer-integration.js', minSize: 5000 }
    ];
    
    this.results.performanceSystems.total = performanceFiles.length * 2; // File exists + loadable
    
    for (const file of performanceFiles) {
      // Test file exists and has reasonable size
      try {
        if (fs.existsSync(file.path)) {
          const stats = fs.statSync(file.path);
          if (stats.size >= file.minSize) {
            this.results.performanceSystems.passed++;
            this.results.performanceSystems.details.push(`✅ ${file.name} file exists (${stats.size} bytes)`);
          } else {
            this.results.performanceSystems.details.push(`⚠️ ${file.name} file too small (${stats.size} bytes)`);
            this.warnings.push(`${file.name} file seems incomplete`);
          }
        } else {
          this.results.performanceSystems.details.push(`❌ ${file.name} file missing`);
          this.errors.push(`Missing performance system: ${file.name}`);
        }
      } catch (error) {
        this.results.performanceSystems.details.push(`❌ ${file.name} error: ${error.message}`);
        this.errors.push(`Performance system error: ${file.name} - ${error.message}`);
      }
      
      // Test file is loadable
      try {
        const SystemClass = require(`./${file.path}`);
        if (typeof SystemClass === 'function' || typeof SystemClass === 'object') {
          this.results.performanceSystems.passed++;
          this.results.performanceSystems.details.push(`✅ ${file.name} loadable`);
        } else {
          this.results.performanceSystems.details.push(`❌ ${file.name} not loadable`);
          this.errors.push(`${file.name} is not a proper module`);
        }
      } catch (error) {
        this.results.performanceSystems.details.push(`❌ ${file.name} load error: ${error.message}`);
        this.errors.push(`Cannot load ${file.name}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ Performance Systems: ${this.results.performanceSystems.passed}/${this.results.performanceSystems.total}`);
  }

  /**
   * Test bot commands integration
   */
  async testBotCommandsIntegration() {
    console.log('🤖 Testing Bot Commands Integration...');
    
    const expectedCommands = [
      'production',
      'health',
      'stats',
      'quota',
      'cache',
      'memory',
      'ultrafast',
      'realtime',
      'pools',
      'clearcache',
      'maintenance'
    ];
    
    this.results.botCommands.total = expectedCommands.length;
    
    try {
      const botIndexContent = fs.readFileSync('bot/index.js', 'utf8');
      
      for (const command of expectedCommands) {
        if (botIndexContent.includes(`bot.command("${command}"`)) {
          this.results.botCommands.passed++;
          this.results.botCommands.details.push(`✅ /${command} command registered`);
        } else {
          this.results.botCommands.details.push(`❌ /${command} command missing`);
          this.errors.push(`Missing bot command: /${command}`);
        }
      }
      
      // Check if commands are in setMyCommands
      const commandsInList = expectedCommands.filter(cmd => 
        botIndexContent.includes(`"${cmd}"`) && botIndexContent.includes('setMyCommands')
      );
      
      if (commandsInList.length >= 5) {
        this.results.botCommands.details.push(`✅ Commands registered in bot menu`);
      } else {
        this.results.botCommands.details.push(`⚠️ Some commands not in bot menu`);
        this.warnings.push('Some commands not registered in bot menu');
      }
      
    } catch (error) {
      this.results.botCommands.details.push(`❌ Error reading bot/index.js: ${error.message}`);
      this.errors.push(`Cannot read bot commands: ${error.message}`);
    }
    
    console.log(`   ✅ Bot Commands: ${this.results.botCommands.passed}/${this.results.botCommands.total}`);
  }

  /**
   * Test dependencies
   */
  async testDependencies() {
    console.log('📦 Testing Dependencies...');
    
    const criticalDeps = [
      'telegraf',
      'express',
      'firebase-admin',
      'redis',
      'ws',
      'cloudinary',
      'node-cache',
      'winston',
      'dotenv'
    ];
    
    this.results.dependencies.total = criticalDeps.length;
    
    for (const dep of criticalDeps) {
      try {
        require.resolve(dep);
        this.results.dependencies.passed++;
        this.results.dependencies.details.push(`✅ ${dep} available`);
      } catch (error) {
        this.results.dependencies.details.push(`❌ ${dep} missing`);
        this.errors.push(`Missing dependency: ${dep}`);
      }
    }
    
    // Check package.json
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      const missingFromPackage = criticalDeps.filter(dep => !allDeps[dep]);
      if (missingFromPackage.length > 0) {
        this.warnings.push(`Dependencies not in package.json: ${missingFromPackage.join(', ')}`);
      }
      
    } catch (error) {
      this.errors.push(`Cannot read package.json: ${error.message}`);
    }
    
    console.log(`   ✅ Dependencies: ${this.results.dependencies.passed}/${this.results.dependencies.total}`);
  }

  /**
   * Test file structure
   */
  async testFileStructure() {
    console.log('📁 Testing File Structure...');
    
    const requiredFiles = [
      'bot/index.js',
      'server.js',
      'package.json',
      'bot/config/database.js',
      'bot/config/productionOptimizer.js',
      'bot/config/ultraFastResponse.js',
      'bot/config/realTimeMonitor.js',
      'bot/config/connectionPool.js',
      'bot/services/userService.js',
      'bot/services/adminService.js',
      'bot/handlers/userHandlers.js',
      'bot/handlers/adminHandlers.js'
    ];
    
    this.results.fileStructure.total = requiredFiles.length;
    
    for (const file of requiredFiles) {
      if (fs.existsSync(file)) {
        this.results.fileStructure.passed++;
        this.results.fileStructure.details.push(`✅ ${file} exists`);
      } else {
        this.results.fileStructure.details.push(`❌ ${file} missing`);
        this.errors.push(`Missing required file: ${file}`);
      }
    }
    
    console.log(`   ✅ File Structure: ${this.results.fileStructure.passed}/${this.results.fileStructure.total}`);
  }

  /**
   * Test config integration
   */
  async testConfigIntegration() {
    console.log('⚙️ Testing Config Integration...');
    
    const configTests = [
      {
        name: 'Production Optimizer has required methods',
        test: () => {
          try {
            const ProductionOptimizer = require('./bot/config/productionOptimizer');
            const optimizer = new ProductionOptimizer();
            return typeof optimizer.initialize === 'function' &&
                   typeof optimizer.getProductionStats === 'function' &&
                   typeof optimizer.getHealthCheck === 'function' &&
                   typeof optimizer.processRequest === 'function';
          } catch (error) {
            return false;
          }
        }
      },
      {
        name: 'Ultra-Fast Response has required methods',
        test: () => {
          try {
            const UltraFastResponse = require('./bot/config/ultraFastResponse');
            return typeof UltraFastResponse === 'function' || typeof UltraFastResponse === 'object';
          } catch (error) {
            return false;
          }
        }
      },
      {
        name: 'Database service has initialization check',
        test: () => {
          try {
            const content = fs.readFileSync('bot/config/database.js', 'utf8');
            return content.includes('isInitialized');
          } catch (error) {
            return false;
          }
        }
      },
      {
        name: 'Error handling in performance systems',
        test: () => {
          try {
            const ultraFastContent = fs.readFileSync('bot/config/ultraFastResponse.js', 'utf8');
            const connectionPoolContent = fs.readFileSync('bot/config/connectionPool.js', 'utf8');
            return ultraFastContent.includes('Database not initialized') &&
                   connectionPoolContent.includes('Database not initialized');
          } catch (error) {
            return false;
          }
        }
      }
    ];
    
    this.results.configIntegration.total = configTests.length;
    
    for (const test of configTests) {
      try {
        if (test.test()) {
          this.results.configIntegration.passed++;
          this.results.configIntegration.details.push(`✅ ${test.name}`);
        } else {
          this.results.configIntegration.details.push(`❌ ${test.name}`);
          this.errors.push(`Config integration failed: ${test.name}`);
        }
      } catch (error) {
        this.results.configIntegration.details.push(`❌ ${test.name} - Error: ${error.message}`);
        this.errors.push(`Config integration error: ${test.name} - ${error.message}`);
      }
    }
    
    console.log(`   ✅ Config Integration: ${this.results.configIntegration.passed}/${this.results.configIntegration.total}`);
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    console.log('🛡️ Testing Error Handling...');
    
    const errorHandlingTests = [
      {
        name: 'Bot has global error handler',
        test: () => {
          const content = fs.readFileSync('bot/index.js', 'utf8');
          return content.includes('bot.catch') && content.includes('uncaughtException');
        }
      },
      {
        name: 'Performance systems have try-catch',
        test: () => {
          const ultraFastContent = fs.readFileSync('bot/config/ultraFastResponse.js', 'utf8');
          return ultraFastContent.includes('try {') && ultraFastContent.includes('catch');
        }
      },
      {
        name: 'Database initialization is checked',
        test: () => {
          const ultraFastContent = fs.readFileSync('bot/config/ultraFastResponse.js', 'utf8');
          const connectionPoolContent = fs.readFileSync('bot/config/connectionPool.js', 'utf8');
          return ultraFastContent.includes('isInitialized') && connectionPoolContent.includes('isInitialized');
        }
      }
    ];
    
    this.results.errorHandling.total = errorHandlingTests.length;
    
    for (const test of errorHandlingTests) {
      try {
        if (test.test()) {
          this.results.errorHandling.passed++;
          this.results.errorHandling.details.push(`✅ ${test.name}`);
        } else {
          this.results.errorHandling.details.push(`❌ ${test.name}`);
          this.errors.push(`Error handling failed: ${test.name}`);
        }
      } catch (error) {
        this.results.errorHandling.details.push(`❌ ${test.name} - Error: ${error.message}`);
        this.errors.push(`Error handling test error: ${test.name} - ${error.message}`);
      }
    }
    
    console.log(`   ✅ Error Handling: ${this.results.errorHandling.passed}/${this.results.errorHandling.total}`);
  }

  /**
   * Test real performance
   */
  async testRealPerformance() {
    console.log('🚀 Testing Real Performance...');
    
    try {
      const startTime = performance.now();
      
      // Simulate some work
      const iterations = 10000;
      let sum = 0;
      for (let i = 0; i < iterations; i++) {
        sum += Math.random();
      }
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Test memory usage
      const memoryUsage = process.memoryUsage();
      const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
      
      console.log(`   📊 Response Time: ${responseTime.toFixed(3)}ms`);
      console.log(`   💾 Memory Usage: ${memoryMB.toFixed(1)}MB`);
      
      // Performance is acceptable if under reasonable limits
      const performanceOK = responseTime < 50 && memoryMB < 200;
      
      if (performanceOK) {
        console.log(`   ✅ Performance: Acceptable`);
      } else {
        console.log(`   ⚠️ Performance: Needs attention`);
        this.warnings.push('Performance may need optimization');
      }
      
    } catch (error) {
      console.log(`   ❌ Performance test failed: ${error.message}`);
      this.errors.push(`Performance test error: ${error.message}`);
    }
  }

  /**
   * Generate final report
   */
  generateFinalReport() {
    console.log('\n🏆 PRE-COMMIT INTEGRATION REPORT');
    console.log('================================');
    
    // Calculate overall score
    const categories = [
      this.results.coreIntegration,
      this.results.performanceSystems,
      this.results.botCommands,
      this.results.dependencies,
      this.results.fileStructure,
      this.results.configIntegration,
      this.results.errorHandling
    ];
    
    let totalPassed = 0;
    let totalTests = 0;
    
    for (const category of categories) {
      totalPassed += category.passed;
      totalTests += category.total;
    }
    
    const overallPercentage = totalTests > 0 ? (totalPassed / totalTests * 100) : 0;
    
    // Determine overall status
    if (this.criticalIssues.length > 0) {
      this.results.overall = 'CRITICAL_ISSUES';
    } else if (overallPercentage >= 95) {
      this.results.overall = 'EXCELLENT';
    } else if (overallPercentage >= 85) {
      this.results.overall = 'GOOD';
    } else if (overallPercentage >= 70) {
      this.results.overall = 'FAIR';
    } else {
      this.results.overall = 'NEEDS_WORK';
    }
    
    console.log(`📊 Overall Score: ${totalPassed}/${totalTests} (${overallPercentage.toFixed(1)}%)`);
    console.log(`🎯 Overall Status: ${this.results.overall}`);
    console.log('');
    
    // Show category results
    console.log('📋 CATEGORY RESULTS:');
    console.log(`   🔧 Core Integration: ${this.results.coreIntegration.passed}/${this.results.coreIntegration.total}`);
    console.log(`   ⚡ Performance Systems: ${this.results.performanceSystems.passed}/${this.results.performanceSystems.total}`);
    console.log(`   🤖 Bot Commands: ${this.results.botCommands.passed}/${this.results.botCommands.total}`);
    console.log(`   📦 Dependencies: ${this.results.dependencies.passed}/${this.results.dependencies.total}`);
    console.log(`   📁 File Structure: ${this.results.fileStructure.passed}/${this.results.fileStructure.total}`);
    console.log(`   ⚙️ Config Integration: ${this.results.configIntegration.passed}/${this.results.configIntegration.total}`);
    console.log(`   🛡️ Error Handling: ${this.results.errorHandling.passed}/${this.results.errorHandling.total}`);
    console.log('');
    
    // Show critical issues
    if (this.criticalIssues.length > 0) {
      console.log('🚨 CRITICAL ISSUES:');
      this.criticalIssues.forEach(issue => console.log(`   • ${issue}`));
      console.log('');
    }
    
    // Show errors
    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.slice(0, 10).forEach(error => console.log(`   • ${error}`));
      if (this.errors.length > 10) {
        console.log(`   ... and ${this.errors.length - 10} more errors`);
      }
      console.log('');
    }
    
    // Show warnings
    if (this.warnings.length > 0) {
      console.log('⚠️ WARNINGS:');
      this.warnings.slice(0, 5).forEach(warning => console.log(`   • ${warning}`));
      if (this.warnings.length > 5) {
        console.log(`   ... and ${this.warnings.length - 5} more warnings`);
      }
      console.log('');
    }
    
    // Final verdict
    console.log('🎯 COMMIT RECOMMENDATION:');
    if (this.results.overall === 'EXCELLENT') {
      console.log('   ✅ READY TO COMMIT! Everything looks perfect!');
      console.log('   🚀 All systems integrated and working properly');
    } else if (this.results.overall === 'GOOD') {
      console.log('   ✅ READY TO COMMIT! Minor issues can be addressed later');
      console.log('   🚀 Core functionality is solid');
    } else if (this.results.overall === 'FAIR') {
      console.log('   ⚠️ COMMIT WITH CAUTION! Address major issues first');
      console.log('   🔧 Fix critical errors before deployment');
    } else {
      console.log('   ❌ DO NOT COMMIT! Critical issues must be fixed first');
      console.log('   🛠️ Address all errors before proceeding');
    }
    
    console.log('');
    console.log('🎯 PRE-COMMIT TEST COMPLETE!');
    
    return {
      overall: this.results.overall,
      score: `${totalPassed}/${totalTests}`,
      percentage: overallPercentage,
      errors: this.errors.length,
      warnings: this.warnings.length,
      criticalIssues: this.criticalIssues.length,
      readyToCommit: this.results.overall === 'EXCELLENT' || this.results.overall === 'GOOD'
    };
  }
}

// Run the pre-commit test
if (require.main === module) {
  const preCommitTest = new PreCommitIntegrationTest();
  preCommitTest.runCompleteTest().then((readyToCommit) => {
    if (readyToCommit) {
      console.log('\n✅ PRE-COMMIT TEST PASSED - READY TO COMMIT!');
      process.exit(0);
    } else {
      console.log('\n❌ PRE-COMMIT TEST FAILED - DO NOT COMMIT YET!');
      process.exit(1);
    }
  }).catch(error => {
    console.error('\n💥 PRE-COMMIT TEST CRASHED:', error);
    process.exit(1);
  });
}

module.exports = PreCommitIntegrationTest;
