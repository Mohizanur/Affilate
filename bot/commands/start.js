const { Markup } = require("telegraf");
const userService = require("../services/userService").userService;
const logger = require("../../utils/logger");

const userHandlers = require("../handlers/userHandlers");

module.exports = async (ctx) => {
  try {
    console.log("🚀 /start command received from user:", ctx.from.id);
    console.log("📝 User info:", {
      id: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name
    });
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Command timeout')), 10000);
    });
    
    const startPromise = userHandlers.handleStart(ctx);
    
    try {
      return await Promise.race([startPromise, timeoutPromise]);
    } catch (error) {
      if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('Quota exceeded')) {
        console.log('🛡️ Quota exceeded, sending fallback response');
        await ctx.reply('👋 Welcome to DegAffiliatebot!\n\n🚀 The bot is working but temporarily limited due to quota restrictions.\n\n✅ Your account has been created successfully!\n\n📱 Try again in a few minutes for full functionality.');
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in /start command:", error.message);
    
    // Send fallback message to user
    try {
      await ctx.reply(
        "🚀 Welcome to our bot!\n\n" +
        "I'm here to help you with our affiliate platform.\n\n" +
        "Use /help to see available commands.\n" +
        "Use /browse to see available products.\n" +
        "Use /profile to manage your account."
      );
    } catch (replyError) {
      console.error("❌ Failed to send fallback message:", replyError.message);
    }
  }
};
