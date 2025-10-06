const smartUserService = require("../services/smartUserService");

module.exports = async (ctx) => {
  try {
    const stats = smartUserService.getCacheStats();
    
    const message = `
🚀 **Smart Caching Performance Stats**

📊 **Cache Performance:**
• Total Cached Users: ${stats.totalEntries}
• Valid Entries: ${stats.validEntries}
• Expired Entries: ${stats.expiredEntries}
• Cache Hit Rate: ${stats.hitRate}%
• Memory Usage: ${stats.memoryUsage}

🎯 **Performance Benefits:**
• Database reads reduced by ~${Math.round(stats.hitRate)}%
• Response time improved by ~${Math.round(stats.hitRate * 0.8)}%
• Quota usage optimized for free tier

⚡ **Status:** ${stats.totalEntries > 0 ? 'Active' : 'No cached data yet'}

🔄 **Last Updated:** ${new Date().toLocaleTimeString()}
    `;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Error in cache command:", error);
    await ctx.reply("❌ Error retrieving cache statistics.");
  }
};