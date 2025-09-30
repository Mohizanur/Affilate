const cacheService = require("../config/cache");

module.exports = async (ctx) => {
  try {
    const stats = cacheService.getCacheHealth();
    const keys = cacheService.getKeys();
    
    const message = `
⚡ **Cache System Status**

📊 **Cache Statistics:**
• User Cache: ${keys.userCache.length} keys (${stats.userCache.hitRate.toFixed(1)}% hit rate)
• Company Cache: ${keys.companyCache.length} keys (${stats.companyCache.hitRate.toFixed(1)}% hit rate)
• Stats Cache: ${keys.statsCache.length} keys (${stats.statsCache.hitRate.toFixed(1)}% hit rate)
• Session Cache: ${keys.sessionCache.length} keys (${stats.sessionCache.hitRate.toFixed(1)}% hit rate)
• Rate Limit Cache: ${keys.rateLimitCache.length} keys (${stats.rateLimitCache.hitRate.toFixed(1)}% hit rate)
• Instant Cache: ${keys.instantCache.length} keys (${stats.instantCache.hitRate.toFixed(1)}% hit rate)

🎯 **Overall Performance:**
• Total Keys: ${stats.totalKeys.toLocaleString()}
• Average Hit Rate: ${stats.avgHitRate.toFixed(1)}%
• Cache Health: ${stats.healthScore}/100

${stats.healthScore < 70 ? '⚠️ **Warning:** Cache performance could be improved!' : '✅ **Status:** Cache system is performing optimally'}
    `;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Error in cache command:", error);
    await ctx.reply("❌ Error retrieving cache status.");
  }
};
