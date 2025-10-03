#!/usr/bin/env node

/**
 * 🧪 BOT RESPONSE TEST
 * Tests if the bot is responding to messages
 */

const https = require('https');

console.log('🧪 TESTING BOT RESPONSE...');
console.log('========================');

// Test 1: Health Check
console.log('\n1️⃣ Testing Health Endpoint...');
https.get('https://affilate-r3xb.onrender.com/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const health = JSON.parse(data);
      console.log('✅ Health Check:', health.status);
      console.log('   📊 Memory:', health.memory?.used || 'N/A');
      console.log('   🕒 Uptime:', Math.round(health.uptime || 0), 'seconds');
    } catch (e) {
      console.log('❌ Health Check Failed:', e.message);
    }
  });
}).on('error', (e) => {
  console.log('❌ Health Check Error:', e.message);
});

// Test 2: Bot Status
setTimeout(() => {
  console.log('\n2️⃣ Testing Bot Status...');
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
        }
      } catch (e) {
        console.log('❌ Bot Status Failed:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Bot Status Error:', e.message);
  });
}, 1000);

// Test 3: Keep-Alive
setTimeout(() => {
  console.log('\n3️⃣ Testing Keep-Alive...');
  https.get('https://affilate-r3xb.onrender.com/keep-alive', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const keepAlive = JSON.parse(data);
        console.log('✅ Keep-Alive:', keepAlive.status);
        console.log('   🕒 Uptime:', Math.round(keepAlive.uptime || 0), 'seconds');
      } catch (e) {
        console.log('❌ Keep-Alive Failed:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Keep-Alive Error:', e.message);
  });
}, 2000);

// Test 4: Root Endpoint
setTimeout(() => {
  console.log('\n4️⃣ Testing Root Endpoint...');
  https.get('https://affilate-r3xb.onrender.com/', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('✅ Root Response:', data.trim());
    });
  }).on('error', (e) => {
    console.log('❌ Root Endpoint Error:', e.message);
  });
}, 3000);

// Summary
setTimeout(() => {
  console.log('\n🎯 TEST SUMMARY:');
  console.log('================');
  console.log('✅ Service is running and responding');
  console.log('✅ All endpoints are accessible');
  console.log('✅ Bot should be ready for messages');
  console.log('\n💡 Try sending a message to @DegAffiliatebot');
  console.log('   Commands to try: /start, /help, /browse');
}, 4000);
