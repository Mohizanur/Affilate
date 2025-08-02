const performanceMonitor = require("../bot/config/performance");
const cacheService = require("../bot/config/cache");
const telegramOptimizer = require("../bot/config/telegramOptimizer");
const logger = require("../utils/logger");

async function runBeastModeTest() {
  console.log("🔥 BEAST MODE PERFORMANCE TEST STARTING...");
  console.log("=" * 50);

  // Test 1: Cache Performance
  console.log("\n📊 Test 1: Cache Performance");
  const startTime = Date.now();

  // Simulate 10,000 cache operations
  for (let i = 0; i < 10000; i++) {
    const userData = {
      id: `user_${i}`,
      telegramId: i,
      username: `user${i}`,
      firstName: `User${i}`,
      lastName: `Test${i}`,
      balance: Math.random() * 1000,
      role: "user",
      isAdmin: false,
      canRegisterCompany: true,
      language: "en",
    };

    cacheService.setUser(i, userData);
    const retrieved = cacheService.getUser(i);

    if (i % 1000 === 0) {
      console.log(`  ✅ Processed ${i} cache operations`);
    }
  }

  const cacheTime = Date.now() - startTime;
  console.log(`  ⚡ Cache operations completed in ${cacheTime}ms`);
  console.log(
    `  📈 Average: ${(cacheTime / 10000).toFixed(2)}ms per operation`
  );

  // Test 2: Concurrent Request Simulation
  console.log("\n🚀 Test 2: Concurrent Request Simulation");
  const concurrentStart = Date.now();

  const concurrentPromises = [];
  for (let i = 0; i < 1000; i++) {
    concurrentPromises.push(
      new Promise(async (resolve) => {
        performanceMonitor.startRequest();

        // Simulate user request processing
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100)
        );

        performanceMonitor.endRequest(i);
        resolve();
      })
    );
  }

  await Promise.all(concurrentPromises);
  const concurrentTime = Date.now() - concurrentStart;
  console.log(`  ⚡ 1000 concurrent requests processed in ${concurrentTime}ms`);

  // Test 3: Memory Usage
  console.log("\n💾 Test 3: Memory Usage");
  const memUsage = process.memoryUsage();
  console.log(
    `  📊 Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
  );
  console.log(
    `  📊 Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
  );
  console.log(
    `  📊 External: ${Math.round(memUsage.external / 1024 / 1024)}MB`
  );
  console.log(`  📊 RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);

  // Test 4: Performance Stats
  console.log("\n📈 Test 4: Performance Statistics");
  const stats = performanceMonitor.getStats();
  console.log(`  ⏱️  Uptime: ${stats.uptime}s`);
  console.log(`  🎯 Cache Hit Rate: ${stats.cacheHitRate}`);
  console.log(`  📊 Cache Hits: ${stats.cacheHits}`);
  console.log(`  📊 Cache Misses: ${stats.cacheMisses}`);
  console.log(`  🗄️  DB Queries: ${stats.dbQueries}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  console.log(`  📱 Telegram API Calls: ${stats.telegramApiCalls}`);
  console.log(
    `  📱 Telegram API Success Rate: ${stats.telegramApiSuccessRate}`
  );
  console.log(`  🔄 Concurrent Requests: ${stats.concurrentRequests}`);
  console.log(`  🔄 Max Concurrent Requests: ${stats.maxConcurrentRequests}`);

  // Test 5: Telegram Optimizer
  console.log("\n🤖 Test 5: Telegram API Optimizer");
  const optimizerStats = telegramOptimizer.getQueueStats();
  console.log(`  📊 Queue Length: ${optimizerStats.queueLength}`);
  console.log(`  📊 Calls This Second: ${optimizerStats.callsThisSecond}`);
  console.log(`  📊 Calls This Minute: ${optimizerStats.callsThisMinute}`);
  console.log(`  📊 Max Calls/Second: ${optimizerStats.maxCallsPerSecond}`);
  console.log(`  📊 Max Calls/Minute: ${optimizerStats.maxCallsPerMinute}`);

  // Performance Assessment
  console.log("\n🎯 BEAST MODE PERFORMANCE ASSESSMENT");
  console.log("=" * 50);

  const cacheHitRate = parseFloat(stats.cacheHitRate);
  const telegramSuccessRate = parseFloat(stats.telegramApiSuccessRate);
  const avgCacheTime = cacheTime / 10000;
  const avgConcurrentTime = concurrentTime / 1000;

  let performanceScore = 0;
  let recommendations = [];

  // Score cache performance
  if (cacheHitRate > 80) {
    performanceScore += 25;
    console.log("  ✅ Cache Hit Rate: EXCELLENT (>80%)");
  } else if (cacheHitRate > 60) {
    performanceScore += 15;
    console.log("  ⚠️  Cache Hit Rate: GOOD (60-80%)");
    recommendations.push("Consider increasing cache TTL for better hit rates");
  } else {
    console.log("  ❌ Cache Hit Rate: NEEDS IMPROVEMENT (<60%)");
    recommendations.push("Cache hit rate is low - review cache strategy");
  }

  // Score response times
  if (avgCacheTime < 1) {
    performanceScore += 25;
    console.log("  ✅ Cache Response Time: EXCELLENT (<1ms)");
  } else if (avgCacheTime < 5) {
    performanceScore += 15;
    console.log("  ⚠️  Cache Response Time: GOOD (1-5ms)");
  } else {
    console.log("  ❌ Cache Response Time: NEEDS IMPROVEMENT (>5ms)");
    recommendations.push(
      "Cache response time is slow - review cache implementation"
    );
  }

  // Score concurrent processing
  if (avgConcurrentTime < 50) {
    performanceScore += 25;
    console.log("  ✅ Concurrent Processing: EXCELLENT (<50ms avg)");
  } else if (avgConcurrentTime < 100) {
    performanceScore += 15;
    console.log("  ⚠️  Concurrent Processing: GOOD (50-100ms avg)");
  } else {
    console.log("  ❌ Concurrent Processing: NEEDS IMPROVEMENT (>100ms avg)");
    recommendations.push(
      "Concurrent processing is slow - review async handling"
    );
  }

  // Score Telegram API
  if (telegramSuccessRate > 95) {
    performanceScore += 25;
    console.log("  ✅ Telegram API Success Rate: EXCELLENT (>95%)");
  } else if (telegramSuccessRate > 90) {
    performanceScore += 15;
    console.log("  ⚠️  Telegram API Success Rate: GOOD (90-95%)");
  } else {
    console.log("  ❌ Telegram API Success Rate: NEEDS IMPROVEMENT (<90%)");
    recommendations.push("Telegram API errors detected - review rate limiting");
  }

  console.log(`\n🏆 OVERALL PERFORMANCE SCORE: ${performanceScore}/100`);

  if (performanceScore >= 90) {
    console.log(
      "  🚀 BEAST MODE ACHIEVED! Your bot is optimized for maximum performance!"
    );
  } else if (performanceScore >= 75) {
    console.log("  ⚡ GOOD PERFORMANCE! Minor optimizations may help.");
  } else if (performanceScore >= 60) {
    console.log("  ⚠️  ACCEPTABLE PERFORMANCE! Consider optimizations.");
  } else {
    console.log("  ❌ PERFORMANCE NEEDS IMPROVEMENT! Review optimizations.");
  }

  if (recommendations.length > 0) {
    console.log("\n💡 RECOMMENDATIONS:");
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  console.log("\n🔥 BEAST MODE TEST COMPLETE!");
}

if (require.main === module) {
  runBeastModeTest().catch(console.error);
}

module.exports = { runBeastModeTest };
