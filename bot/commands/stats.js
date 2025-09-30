const performanceLogger = require("../config/performanceLogger");
const smartOptimizer = require("../config/smart-optimizer-integration");

module.exports = async (ctx) => {
  try {
    const performanceStats = performanceLogger.getStats();
    const optimizerStats = smartOptimizer.getStats ? smartOptimizer.getStats() : null;
    
    let message = `
📊 **Bot Performance Statistics**

🚀 **System Performance:**
• Uptime: ${performanceStats.uptime || 'Unknown'}
• Total Requests: ${performanceStats.totalRequests?.toLocaleString() || '0'}
• Average Response Time: ${performanceStats.avgResponseTime?.toFixed(2) || '0'}ms
• Success Rate: ${performanceStats.successRate?.toFixed(1) || '0'}%
• Error Rate: ${performanceStats.errorRate?.toFixed(1) || '0'}%

📈 **Recent Activity:**
• Requests Last Hour: ${performanceStats.recentRequests || '0'}
• Peak Concurrent Users: ${performanceStats.peakConcurrent || '0'}
• Database Queries: ${performanceStats.dbQueries?.toLocaleString() || '0'}
    `;
    
    if (optimizerStats) {
      message += `
🎯 **Smart Optimizer:**
• Cache Hit Rate: ${optimizerStats.cacheHitRate?.toFixed(1) || '0'}%
• Optimized Operations: ${optimizerStats.optimizedOps?.toLocaleString() || '0'}
• Performance Boost: ${optimizerStats.performanceBoost?.toFixed(1) || '0'}%
      `;
    }
    
    message += `
✅ **Status:** All systems operational
🔄 **Last Updated:** ${new Date().toLocaleTimeString()}
    `;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Error in stats command:", error);
    await ctx.reply("❌ Error retrieving performance statistics.");
  }
};
