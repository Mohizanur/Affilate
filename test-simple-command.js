#!/usr/bin/env node

/**
 * 🧪 SIMPLE COMMAND TEST
 * Tests the /test command specifically
 */

const https = require('https');

console.log('🧪 TESTING /test COMMAND...');
console.log('============================');

// Test the /test command
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

console.log('📤 Sending /test command to webhook...');

const req = https.request(options, (res) => {
  console.log('✅ Webhook Response Status:', res.statusCode);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('📝 Response Body:', data || 'Empty response');
    
    if (res.statusCode === 200) {
      console.log('✅ Webhook accepted the /test command');
      console.log('🔍 Check Render logs for:');
      console.log('   - "🧪 /test command received from user: 123456789"');
      console.log('   - "✅ /test command completed successfully"');
      console.log('   - Any error messages');
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

// Wait and check health again
setTimeout(() => {
  console.log('\n🔍 Checking bot activity after /test command...');
  https.get('https://affilate-r3xb.onrender.com/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        console.log('📊 Telegram API Calls:', health.performance?.telegramApiCalls || 0);
        console.log('📊 Telegram API Errors:', health.performance?.telegramApiErrors || 0);
        console.log('📊 Errors:', health.performance?.errors || 0);
        
        if (health.performance?.telegramApiCalls > 0) {
          console.log('✅ Bot is making API calls - /test command worked!');
        } else {
          console.log('❌ Bot is still NOT making API calls');
          console.log('💡 This suggests the /test command is hanging or failing silently');
        }
      } catch (e) {
        console.log('❌ Health Check Failed:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Health Check Error:', e.message);
  });
}, 3000);
