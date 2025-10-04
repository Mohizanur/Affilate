#!/usr/bin/env node

/**
 * 🧪 RENDER BOT TOKEN TEST
 * Tests if the bot token is working in the Render environment
 */

const https = require('https');

console.log('🧪 TESTING BOT TOKEN IN RENDER ENVIRONMENT...');
console.log('===============================================');

// Test if we can make a direct API call to Telegram from Render
const testMessage = {
  update_id: 123456789,
  message: {
    message_id: 1,
    from: {
      id: 123456789,
      is_bot: false,
      first_name: "Test",
      username: "testuser"
    },
    chat: {
      id: 123456789,
      first_name: "Test",
      username: "testuser",
      type: "private"
    },
    date: Math.floor(Date.now() / 1000),
    text: "/test"
  }
};

console.log('📤 Sending test message to webhook...');
console.log('📦 Message:', JSON.stringify(testMessage, null, 2));

const postData = JSON.stringify(testMessage);

const options = {
  hostname: 'affilate-r3xb.onrender.com',
  port: 443,
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log('📊 Webhook Response:');
  console.log('   Status:', res.statusCode);
  console.log('   Content-Length:', res.headers['content-length']);
  console.log('   Date:', res.headers['date']);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('   Body:', data || 'Empty response');
    
    if (res.statusCode === 200) {
      console.log('✅ Webhook accepted the message');
      console.log('🔍 The bot should process this message');
      console.log('💡 Check Render logs for processing details');
    } else {
      console.log('❌ Webhook rejected the message');
    }
  });
});

req.on('error', (e) => {
  console.log('❌ Webhook request failed:', e.message);
});

req.write(postData);
req.end();

// Also test the health endpoint to see current status
setTimeout(() => {
  console.log('\n🔍 Checking current bot status...');
  https.get('https://affilate-r3xb.onrender.com/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        console.log('📊 Current Bot Status:');
        console.log('   Telegram API Calls:', health.performance?.telegramApiCalls || 0);
        console.log('   Telegram API Errors:', health.performance?.telegramApiErrors || 0);
        console.log('   Errors:', health.performance?.errors || 0);
        console.log('   Uptime:', health.performance?.uptime || 'unknown');
        
        if (health.performance?.telegramApiCalls > 0) {
          console.log('✅ Bot is making API calls - working!');
        } else {
          console.log('❌ Bot is still not making API calls');
          console.log('\n💡 DIAGNOSIS:');
          console.log('   The webhook accepts requests but bot doesn\'t process them');
          console.log('   This suggests the bot handlers are not working');
          console.log('   Possible causes:');
          console.log('   1. Bot token invalid in Render environment');
          console.log('   2. Bot handlers hanging on database calls');
          console.log('   3. Bot initialization incomplete');
          console.log('   4. Webhook callback not properly connected');
        }
      } catch (e) {
        console.log('❌ Health check failed:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Health check failed:', e.message);
  });
}, 3000);
