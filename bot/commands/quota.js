const quotaProtector = require("../config/quotaProtector");

module.exports = async (ctx) => {
  try {
    const status = quotaProtector.getStatus();
    const usage = quotaProtector.getUsage();
    
    const message = `
🛡️ **Quota Protection Status**

📊 **Daily Usage:**
• Reads: ${usage.reads.toLocaleString()} / ${status.dailyLimits.reads.toLocaleString()} (${((usage.reads / status.dailyLimits.reads) * 100).toFixed(1)}%)
• Writes: ${usage.writes.toLocaleString()} / ${status.dailyLimits.writes.toLocaleString()} (${((usage.writes / status.dailyLimits.writes) * 100).toFixed(1)}%)
• Deletes: ${usage.deletes.toLocaleString()} / ${status.dailyLimits.deletes.toLocaleString()} (${((usage.deletes / status.dailyLimits.deletes) * 100).toFixed(1)}%)

🔄 **Current Strategy:** ${status.currentStrategy}
⚡ **Emergency Mode:** ${status.emergencyMode ? 'ACTIVE' : 'Inactive'}
🎯 **Health Score:** ${status.healthScore}/100

${status.healthScore < 70 ? '⚠️ **Warning:** High quota usage detected!' : '✅ **Status:** All systems optimal'}
    `;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Error in quota command:", error);
    await ctx.reply("❌ Error retrieving quota status.");
  }
};
