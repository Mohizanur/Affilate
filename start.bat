@echo off
set LOG_LEVEL=error
set PERFORMANCE_MODE=true
node --max-old-space-size=2048 server.js 