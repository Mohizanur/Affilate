#!/usr/bin/env node

/**
 * 🔍 BOT DIAGNOSTIC
 * Comprehensive diagnosis of bot issues
 */

const https = require('https');

console.log('🔍 COMPREHENSIVE BOT DIAGNOSIS');
console.log('===============================');

// Test 1: Check if service is running
console.log('\n1️⃣ Testing service health...');
https.get('https://affilate-r3xb.onrender.com/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const health = JSON.parse(data);
      console.log('✅ Service is running');
      console.log('   Status:', health.status);
      console.log('   Uptime:', health.performance?.uptime || 'unknown');
      console.log('   Memory:', health.performance?.currentMemory?.heapUsed || 'unknown');
    } catch (e) {
      console.log('❌ Service health check failed:', e.message);
    }
  });
}).on('error', (e) => {
  console.log('❌ Service is not responding:', e.message);
});

// Test 2: Check bot status endpoint
setTimeout(() => {
  console.log('\n2️⃣ Testing bot status endpoint...');
  https.get('https://affilate-r3xb.onrender.com/bot-status', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const status = JSON.parse(data);
        console.log('📊 Bot Status:', status.status);
        if (status.webhook) {
          console.log('   Webhook URL:', status.webhook.url);
          console.log('   Webhook Pending:', status.webhook.pending_update_count);
        }
        if (status.error) {
          console.log('   Error:', status.error);
        }
      } catch (e) {
        console.log('❌ Bot status check failed:', e.message);
        console.log('   Raw response:', data);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Bot status endpoint failed:', e.message);
  });
}, 2000);

// Test 3: Test webhook with detailed logging
setTimeout(() => {
  console.log('\n3️⃣ Testing webhook with detailed logging...');
  
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
    console.log('   Headers:', res.headers);
    
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('   Body:', data || 'Empty');
      
      if (res.statusCode === 200) {
        console.log('✅ Webhook accepted the request');
      } else {
        console.log('❌ Webhook rejected the request');
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ Webhook request failed:', e.message);
  });

  req.write(postData);
  req.end();
}, 4000);

// Test 4: Final health check
setTimeout(() => {
  console.log('\n4️⃣ Final health check...');
  https.get('https://affilate-r3xb.onrender.com/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        console.log('📊 Final Status:');
        console.log('   Telegram API Calls:', health.performance?.telegramApiCalls || 0);
        console.log('   Telegram API Errors:', health.performance?.telegramApiErrors || 0);
        console.log('   Errors:', health.performance?.errors || 0);
        console.log('   Cache Misses:', health.performance?.cacheMisses || 0);
        
        if (health.performance?.telegramApiCalls > 0) {
          console.log('✅ Bot is making API calls - working!');
        } else {
          console.log('❌ Bot is still not making API calls');
          console.log('\n💡 POSSIBLE ISSUES:');
          console.log('   1. Bot initialization failed');
          console.log('   2. Database connection hanging');
          console.log('   3. Bot token invalid in Render');
          console.log('   4. Webhook callback not working');
          console.log('   5. Bot handlers not registered');
        }
      } catch (e) {
        console.log('❌ Final health check failed:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Final health check failed:', e.message);
  });
}, 6000);
