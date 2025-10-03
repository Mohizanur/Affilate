#!/usr/bin/env node

/**
 * 🚨 EMERGENCY BOT FIX
 * Creates a minimal working bot to test if the issue is with our complex setup
 */

const { Telegraf } = require('telegraf');
const express = require('express');

console.log('🚨 EMERGENCY BOT FIX - Creating minimal working bot');
console.log('==================================================');

// Create a minimal bot
const bot = new Telegraf(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN');

// Simple test command
bot.command('test', (ctx) => {
  console.log('🧪 Emergency /test command received from user:', ctx.from.id);
  ctx.reply('✅ Emergency bot is working!');
  console.log('✅ Emergency /test command completed');
});

// Simple text handler
bot.on('text', (ctx) => {
  console.log('📝 Emergency text message received:', ctx.message.text, 'from user:', ctx.from.id);
  ctx.reply('👋 Emergency bot received your message: ' + ctx.message.text);
  console.log('✅ Emergency text response sent');
});

// Error handling
bot.catch((err, ctx) => {
  console.error('❌ Emergency bot error:', err.message);
  ctx.reply('❌ Emergency bot error: ' + err.message);
});

// Create Express app
const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/emergency-webhook', (req, res) => {
  console.log('🔔 Emergency webhook request received');
  console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    bot.handleUpdate(req.body);
    console.log('✅ Emergency webhook processed successfully');
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Emergency webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health endpoint
app.get('/emergency-health', (req, res) => {
  res.json({
    status: 'emergency_bot_healthy',
    timestamp: new Date().toISOString(),
    message: 'Emergency bot is running'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚨 Emergency bot server running on port ${PORT}`);
  console.log(`🔗 Emergency webhook: http://localhost:${PORT}/emergency-webhook`);
  console.log(`🔗 Emergency health: http://localhost:${PORT}/emergency-health`);
  console.log('✅ Emergency bot is ready for testing');
});

console.log('🚨 Emergency bot setup complete');
console.log('💡 This minimal bot should work if the issue is with our complex setup');
