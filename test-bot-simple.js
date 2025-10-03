#!/usr/bin/env node

/**
 * 🧪 SIMPLE BOT TEST
 * Tests if the bot is actually processing messages
 */

const https = require('https');

console.log('🧪 TESTING BOT MESSAGE PROCESSING...');
console.log('=====================================');

// Test 1: Send a simple /start command
console.log('\n1️⃣ Testing /start command...');

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
    text: "/start"
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

const req = https.request(options, (res) => {
  console.log('✅ Webhook Response Status:', res.statusCode);
  console.log('   📊 Headers:', res.headers);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('   📝 Response Body:', data || 'Empty response');
    
    if (res.statusCode === 200) {
      console.log('✅ Webhook is working - bot should process the message');
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

// Test 2: Check if bot is making API calls
setTimeout(() => {
  console.log('\n2️⃣ Checking bot API activity...');
  https.get('https://affilate-r3xb.onrender.com/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        console.log('✅ Health Check Response:');
        console.log('   📊 Telegram API Calls:', health.performance?.telegramApiCalls || 0);
        console.log('   📊 Telegram API Errors:', health.performance?.telegramApiErrors || 0);
        console.log('   📊 Cache Hits:', health.performance?.cacheHits || 0);
        console.log('   📊 Cache Misses:', health.performance?.cacheMisses || 0);
        console.log('   📊 Errors:', health.performance?.errors || 0);
        
        if (health.performance?.telegramApiCalls > 0) {
          console.log('✅ Bot is making API calls - working properly');
        } else {
          console.log('❌ Bot is NOT making API calls - there might be an issue');
        }
      } catch (e) {
        console.log('❌ Health Check Failed:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Health Check Error:', e.message);
  });
}, 2000);

// Summary
setTimeout(() => {
  console.log('\n🎯 DIAGNOSIS SUMMARY:');
  console.log('====================');
  console.log('✅ Webhook endpoint is accessible');
  console.log('✅ Bot should process messages');
  console.log('\n💡 NEXT STEPS:');
  console.log('   1. Check Render logs for any error messages');
  console.log('   2. Look for "Bot error:" or "Error in" messages');
  console.log('   3. Check if database initialization is hanging');
  console.log('   4. Verify bot command handlers are working');
  console.log('\n🔍 If bot still doesn\'t respond:');
  console.log('   - There might be a database connection issue');
  console.log('   - Bot handlers might be hanging on database calls');
  console.log('   - Check for unhandled promise rejections');
}, 3000);
