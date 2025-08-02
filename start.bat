@echo off
set LOG_LEVEL=warn
set PERFORMANCE_MODE=true
node --max-old-space-size=2048 server.js 