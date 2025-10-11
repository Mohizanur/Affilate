// 🔧 RENDER MEMORY FIX - Disable heavy monitoring on free tier
// Run this to reduce memory usage from 94% to ~60%

const fs = require('fs');
const path = require('path');

console.log('🔧 Optimizing for Render free tier (512MB RAM)...');

// Disable heavy monitoring in production
const envPath = path.join(__dirname, '.env');
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

// Add or update settings
const settings = {
  'DISABLE_HEAVY_MONITORING': 'true',
  'MEMORY_THRESHOLD': '85',  // Less aggressive
  'CACHE_CHECK_INTERVAL': '300000',  // 5 min instead of 1 min
  'DISABLE_REAL_TIME_MONITOR': 'true',
  'DISABLE_PERFORMANCE_LOGGER': 'true'
};

Object.entries(settings).forEach(([key, value]) => {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
});

fs.writeFileSync(envPath, envContent);

console.log('✅ Memory optimization settings added to .env');
console.log('📊 Expected memory reduction: 94% → 60%');
console.log('🚀 Push changes and redeploy to apply');

