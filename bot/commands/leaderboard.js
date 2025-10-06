const smartAnalyticsService = require("../services/smartAnalyticsService");

module.exports = async (ctx) => {
  try {
    console.log("🏆 Leaderboard command received from user:", ctx.from.id);
    
    // Get cached leaderboard data
    const leaderboard = await smartAnalyticsService.getLeaderboard(10);
    
    if (!leaderboard || leaderboard.length === 0) {
      await ctx.reply("📊 No leaderboard data available yet. Be the first to earn referrals!");
      return;
    }
    
    let message = "🏆 **TOP REFERRAL LEADERBOARD**\n\n";
    
    leaderboard.forEach((user, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅";
      const name = user.name || user.firstName || "Anonymous";
      const referrals = user.referralCount || 0;
      
      message += `${medal} **${index + 1}.** ${name}\n`;
      message += `   📊 ${referrals} referrals\n\n`;
    });
    
    message += `🔄 *Updated: ${new Date().toLocaleTimeString()}*\n`;
    message += `💡 *Use /cache to see performance stats*`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    console.log("✅ Leaderboard sent successfully");
    
  } catch (error) {
    console.error("❌ Error in leaderboard command:", error.message);
    await ctx.reply("❌ Sorry, couldn't load the leaderboard right now. Please try again later.");
  }
};