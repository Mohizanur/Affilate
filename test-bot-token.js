#!/usr/bin/env node

/**
 * 🧪 BOT TOKEN TEST
 * Tests if the bot token is working and can make API calls
 */

const https = require('https');

console.log('🧪 TESTING BOT TOKEN...');
console.log('========================');

// Test bot token by calling getMe API
const botToken = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN';
const apiUrl = `https://api.telegram.org/bot${botToken}/getMe`;

console.log('📤 Testing bot token with getMe API...');

https.get(apiUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📊 API Response:', response);
      
      if (response.ok) {
        console.log('✅ Bot token is valid!');
        console.log('   Bot name:', response.result.first_name);
        console.log('   Bot username:', response.result.username);
        console.log('   Bot ID:', response.result.id);
      } else {
        console.log('❌ Bot token is invalid:', response.description);
      }
    } catch (e) {
      console.log('❌ Failed to parse API response:', e.message);
      console.log('📝 Raw response:', data);
    }
  });
}).on('error', (e) => {
  console.log('❌ API call failed:', e.message);
});

// Also test if we can send a message (this will fail but show if token works)
setTimeout(() => {
  console.log('\n📤 Testing sendMessage API...');
  const sendUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const postData = JSON.stringify({
    chat_id: 123456789, // This will fail but show if token is valid
    text: 'Test message'
  });
  
  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('📊 SendMessage Response:', response);
        
        if (response.ok) {
          console.log('✅ SendMessage API works!');
        } else {
          console.log('❌ SendMessage failed:', response.description);
          if (response.error_code === 400) {
            console.log('✅ Token is valid (400 error is expected for invalid chat_id)');
          }
        }
      } catch (e) {
        console.log('❌ Failed to parse sendMessage response:', e.message);
      }
    });
  });
  
  req.on('error', (e) => {
    console.log('❌ SendMessage API call failed:', e.message);
  });
  
  req.write(postData);
  req.end();
}, 2000);
