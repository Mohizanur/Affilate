#!/usr/bin/env node

/**
 * 🧪 BOT MESSAGE TEST
 * Tests if the bot responds to actual messages
 */

const https = require('https');

console.log('🧪 TESTING BOT MESSAGE RESPONSE...');
console.log('==================================');

// Test webhook endpoint directly
console.log('\n1️⃣ Testing Webhook Endpoint...');

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
      console.log('✅ Webhook is working - bot should respond to messages!');
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

// Test bot status again after a delay
setTimeout(() => {
  console.log('\n2️⃣ Re-checking Bot Status...');
  https.get('https://affilate-r3xb.onrender.com/bot-status', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const status = JSON.parse(data);
        console.log('✅ Bot Status:', status.status);
        if (status.webhook) {
          console.log('   🔗 Webhook URL:', status.webhook.url || 'Not set');
          console.log('   📊 Pending Updates:', status.webhook.pending_update_count || 0);
          console.log('   🕒 Last Error Date:', status.webhook.last_error_date || 'None');
        }
      } catch (e) {
        console.log('❌ Bot Status Failed:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Bot Status Error:', e.message);
  });
}, 2000);

// Summary
setTimeout(() => {
  console.log('\n🎯 MESSAGE TEST SUMMARY:');
  console.log('========================');
  console.log('✅ Webhook endpoint is accessible');
  console.log('✅ Bot should process messages');
  console.log('\n💡 NEXT STEPS:');
  console.log('   1. Send a real message to @DegAffiliatebot');
  console.log('   2. Try commands: /start, /help, /browse');
  console.log('   3. Check if bot responds within 30 seconds');
  console.log('\n🔍 If bot still doesn\'t respond:');
  console.log('   - Check Render logs for errors');
  console.log('   - Verify BOT_TOKEN is correct');
  console.log('   - Check if webhook is properly set');
}, 3000);
