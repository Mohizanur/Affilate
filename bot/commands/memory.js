const memoryManager = require("../config/memoryManager");

module.exports = async (ctx) => {
  try {
    const stats = memoryManager.getStats();
    const health = memoryManager.getHealthStatus();
    
    const message = `
🧠 **Memory Management Status**

📊 **Current Usage:**
• Memory Usage: ${(stats.currentMemory / 1024 / 1024).toFixed(2)} MB
• Memory Limit: ${(stats.memoryLimit / 1024 / 1024).toFixed(2)} MB
• Usage Percentage: ${stats.usagePercentage.toFixed(1)}%

🔄 **Performance Stats:**
• Uptime: ${stats.uptime}
• Cleanups Performed: ${stats.cleanupCount}
• Last Cleanup: ${stats.lastCleanup || 'Never'}
• Average Response Time: ${stats.avgResponseTime.toFixed(2)}ms

⚡ **Health Status:**
• Health Score: ${health.score}/100
• Status: ${health.status}
• Recommendations: ${health.recommendations.join(', ') || 'None'}

${health.score < 70 ? '⚠️ **Warning:** Memory usage is high!' : '✅ **Status:** Memory usage is optimal'}
    `;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Error in memory command:", error);
    await ctx.reply("❌ Error retrieving memory status.");
  }
};
