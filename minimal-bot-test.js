#!/usr/bin/env node

/**
 * 🧪 MINIMAL BOT TEST
 * Tests if the bot can respond to a simple message without database calls
 */

const https = require('https');

console.log('🧪 MINIMAL BOT TEST - No Database Calls');
console.log('========================================');

// Test with a simple message that shouldn't require database
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
    text: "hello"
  }
};

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

console.log('📤 Sending simple "hello" message to webhook...');

const req = https.request(options, (res) => {
  console.log('✅ Webhook Response Status:', res.statusCode);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('📝 Response Body:', data || 'Empty response');
    
    if (res.statusCode === 200) {
      console.log('✅ Webhook accepted the message');
      console.log('🔍 This should trigger message handlers');
    } else {
      console.log('❌ Webhook issue - status code:', res.statusCode);
    }
  });
});

req.on('error', (e) => {
  console.log('❌ Webhook Test Error:', e.message);
});

req.write(postData);
req.end();

// Check if any activity happened
setTimeout(() => {
  console.log('\n🔍 Checking for any bot activity...');
  https.get('https://affilate-r3xb.onrender.com/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        console.log('📊 Current Status:');
        console.log('   Telegram API Calls:', health.performance?.telegramApiCalls || 0);
        console.log('   Telegram API Errors:', health.performance?.telegramApiErrors || 0);
        console.log('   Errors:', health.performance?.errors || 0);
        console.log('   Cache Misses:', health.performance?.cacheMisses || 0);
        
        if (health.performance?.telegramApiCalls > 0) {
          console.log('✅ Bot is responding to messages!');
        } else {
          console.log('❌ Bot is completely unresponsive');
          console.log('💡 Possible issues:');
          console.log('   - Bot initialization failed');
          console.log('   - Database connection hanging');
          console.log('   - Command handlers not registered');
          console.log('   - Webhook callback not working');
        }
      } catch (e) {
        console.log('❌ Health Check Failed:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Health Check Error:', e.message);
  });
}, 2000);
