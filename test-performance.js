#!/usr/bin/env node

/**
 * 🚀 PERFORMANCE TEST RUNNER
 * 
 * Simple script to run performance tests and validate claims.
 * This is the main entry point for testing the bot's performance.
 */

const ComprehensiveTestRunner = require('./tests/run-all-tests');

async function main() {
  console.log('🚀 Bot Performance Testing Suite');
  console.log('================================');
  console.log('');
  console.log('This will test the bot\'s performance claims and provide');
  console.log('a realistic assessment of its capabilities.');
  console.log('');

  const args = process.argv.slice(2);
  const runner = new ComprehensiveTestRunner();

  try {
    let results;

    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }

    if (args.includes('--quick')) {
      console.log('⚡ Running quick performance tests (recommended for first run)...');
      results = await runner.runQuickTests();
    } else if (args.includes('--full')) {
      console.log('🔥 Running full performance test suite (includes stress testing)...');
      console.log('⚠️  Warning: This may take 10-15 minutes and use significant resources.');
      results = await runner.runFullTests();
    } else if (args.includes('--monitoring')) {
      console.log('📊 Running tests with real-time monitoring dashboard...');
      console.log('🌐 Dashboard will be available at http://localhost:3001');
      results = await runner.runAllTests({ enableMonitoring: true });
    } else {
      console.log('🎯 Running standard performance tests...');
      results = await runner.runAllTests();
    }

    // Final assessment
    console.log('\n' + '='.repeat(50));
    console.log('🏆 FINAL ASSESSMENT');
    console.log('='.repeat(50));

    const score = results.overallScore;
    const grade = results.summary.performanceGrade;

    console.log(`\n📊 Overall Performance Score: ${score}/100 (${grade})`);

    if (score >= 80) {
      console.log('✅ VERDICT: The performance improvements are REAL and EFFECTIVE!');
      console.log('');
      console.log('🎉 Your bot is ready for production with:');
      console.log('   - Solid performance optimizations');
      console.log('   - Good caching strategies');
      console.log('   - Reliable error handling');
      console.log('   - Acceptable response times');
    } else if (score >= 60) {
      console.log('⚠️  VERDICT: The improvements are GOOD but need more work.');
      console.log('');
      console.log('🔧 Your bot shows promise but needs:');
      console.log('   - Additional performance tuning');
      console.log('   - Better error handling');
      console.log('   - Cache optimization');
      console.log('   - Response time improvements');
    } else {
      console.log('❌ VERDICT: The performance claims are NOT YET PROVEN.');
      console.log('');
      console.log('🚨 Your bot needs significant work:');
      console.log('   - Major performance issues');
      console.log('   - Critical bottlenecks');
      console.log('   - Unreliable under load');
      console.log('   - Not ready for production');
    }

    console.log('\n💡 Next Steps:');
    if (results.recommendations.length > 0) {
      const topRecs = results.recommendations.slice(0, 3);
      topRecs.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.message || rec.description}`);
      });
    } else {
      console.log('   - Monitor performance in production');
      console.log('   - Continue optimizing based on real usage');
      console.log('   - Set up automated performance testing');
    }

    console.log('\n📈 Want to improve? Run with --full for detailed analysis.');
    console.log('📊 Want real-time monitoring? Run with --monitoring.');

    // Exit with appropriate code
    process.exit(score >= 70 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Performance testing failed:', error.message);
    console.log('\n🔧 This might indicate:');
    console.log('   - System resource constraints');
    console.log('   - Missing dependencies');
    console.log('   - Configuration issues');
    console.log('');
    console.log('💡 Try running with --quick for a lighter test.');
    process.exit(1);
  }
}

function showHelp() {
  console.log('Usage: node test-performance.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --quick      Run quick tests only (recommended for first run)');
  console.log('  --full       Run full test suite including stress testing');
  console.log('  --monitoring Run with real-time monitoring dashboard');
  console.log('  --help, -h   Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node test-performance.js --quick');
  console.log('  node test-performance.js --full');
  console.log('  node test-performance.js --monitoring');
  console.log('');
  console.log('The test will provide a realistic assessment of your bot\'s');
  console.log('performance capabilities and validate any performance claims.');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, showHelp };
