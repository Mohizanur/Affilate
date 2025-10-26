#!/usr/bin/env node

/**
 * Keep-alive script for Render free tier
 * This script can be run externally to prevent the service from spinning down
 */

const https = require("https");
const http = require("http");

// Configuration
const SERVICE_URL =
  process.env.SERVICE_URL || "https://affilate-r3xb.onrender.com";
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes
// EMERGENCY: Disabled health checks to eliminate any potential database reads
// const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

console.log(`🚀 Starting keep-alive for: ${SERVICE_URL}`);
console.log(
  `⏰ Keep-alive interval: ${KEEP_ALIVE_INTERVAL / 1000 / 60} minutes`
);
// console.log(
//   `🏥 Health check interval: ${HEALTH_CHECK_INTERVAL / 1000 / 60} minutes`
// );

function makeRequest(url, endpoint) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${url}${endpoint}`;
    const protocol = url.startsWith("https") ? https : http;

    const req = protocol.get(fullUrl, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          data: data,
          headers: res.headers,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

async function keepAlive() {
  try {
    console.log(`💓 Keep-alive ping at ${new Date().toISOString()}`);
    const response = await makeRequest(SERVICE_URL, "/keep-alive");
    console.log(`✅ Keep-alive successful: ${response.status}`);
  } catch (error) {
    console.log(`❌ Keep-alive failed: ${error.message}`);
  }
}

// EMERGENCY: Disabled health checks to eliminate any potential database reads
// async function healthCheck() {
//   try {
//     console.log(`🏥 Health check at ${new Date().toISOString()}`);
//     const response = await makeRequest(SERVICE_URL, "/health");
//     console.log(`✅ Health check successful: ${response.status}`);
//     if (response.data) {
//       const healthData = JSON.parse(response.data);
//       console.log(
//         `📊 Service uptime: ${Math.round(healthData.uptime / 60)} minutes`
//       );
//     }
//   } catch (error) {
//     console.log(`❌ Health check failed: ${error.message}`);
//   }
// }

// Start keep-alive
setInterval(keepAlive, KEEP_ALIVE_INTERVAL);

// EMERGENCY: Disabled health checks to eliminate any potential database reads
// Start health checks
// setInterval(healthCheck, HEALTH_CHECK_INTERVAL);

// Initial calls
keepAlive();
// EMERGENCY: Disabled health checks to eliminate any potential database reads
// healthCheck();

console.log("✅ Keep-alive script started successfully");
console.log("Press Ctrl+C to stop");

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping keep-alive script...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Stopping keep-alive script...");
  process.exit(0);
});
