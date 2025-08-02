const performanceMonitor = require("../bot/config/performance");
const cacheService = require("../bot/config/cache");
const logger = require("../utils/logger");

// Performance optimization script
async function optimizePerformance() {
  console.log("🔧 Running performance optimization...");

  // Get current performance stats
  const stats = performanceMonitor.getStats();

  console.log("📊 Current Performance Stats:");
  console.log(`- Uptime: ${stats.uptime}s`);
  console.log(`- Cache Hit Rate: ${stats.cacheHitRate}`);
  console.log(`- Database Queries: ${stats.dbQueries}`);
  console.log(`- Errors: ${stats.errors}`);

  // Log response times
  console.log("\n⏱️ Response Times:");
  Object.keys(stats.responseTimes).forEach((operation) => {
    const opStats = stats.responseTimes[operation];
    console.log(
      `- ${operation}: ${opStats.avgTime.toFixed(2)}ms avg (${
        opStats.count
      } calls)`
    );
  });

  // Cache statistics
  console.log("\n💾 Cache Statistics:");
  console.log(`- User Cache Keys: ${cacheService.userCache.keys().length}`);
  console.log(
    `- Company Cache Keys: ${cacheService.companyCache.keys().length}`
  );
  console.log(`- Stats Cache Keys: ${cacheService.statsCache.keys().length}`);

  // Memory usage
  const memUsage = process.memoryUsage();
  console.log("\n🧠 Memory Usage:");
  console.log(`- Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(
    `- Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
  );
  console.log(`- RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);

  // Performance recommendations
  console.log("\n💡 Performance Recommendations:");

  if (stats.cacheHitRate < 70) {
    console.log(
      "- ⚠️ Cache hit rate is low. Consider increasing cache TTL or optimizing cache keys."
    );
  }

  if (stats.dbQueries > 1000) {
    console.log(
      "- ⚠️ High database query count. Consider implementing more aggressive caching."
    );
  }

  if (stats.errors > 10) {
    console.log("- ⚠️ High error count. Check error logs for issues.");
  }

  // Check for slow operations
  Object.keys(stats.responseTimes).forEach((operation) => {
    const opStats = stats.responseTimes[operation];
    if (opStats.avgTime > 1000) {
      console.log(
        `- ⚠️ Slow operation detected: ${operation} (${opStats.avgTime.toFixed(
          2
        )}ms avg)`
      );
    }
  });

  // Memory optimization
  if (memUsage.heapUsed > 500 * 1024 * 1024) {
    // 500MB
    console.log(
      "- ⚠️ High memory usage. Consider implementing memory cleanup."
    );
  }

  console.log("\n✅ Performance optimization check complete!");
}

// Run optimization if called directly
if (require.main === module) {
  optimizePerformance().catch(console.error);
}

module.exports = { optimizePerformance };
