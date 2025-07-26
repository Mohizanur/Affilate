# Render Deployment Guide

## Overview
This bot is configured to work on Render's free web service tier using webhooks instead of long polling.

## Environment Variables
Set these in your Render dashboard:

### Required:
- `BOT_TOKEN` - Your Telegram bot token from @BotFather
- `NODE_ENV` - Set to `production`

### Optional:
- `WEBHOOK_URL` - Custom webhook URL (if not using Render's default)
- `PORT` - Port number (Render sets this automatically)

## Render Configuration

### Service Type: Web Service
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Environment:** Node

### Auto-Deploy Settings
- **Branch:** `main` (or your default branch)
- **Auto-Deploy:** Enabled

## How It Works

### Development (Local)
- Uses long polling (`bot.launch()`)
- Continuously polls Telegram for updates
- Good for development and testing

### Production (Render)
- Uses webhooks (`bot.webhookCallback()`)
- Telegram sends updates directly to your server
- More efficient, works on free tier
- Automatically detects Render environment

## Webhook Setup
The bot automatically:
1. Detects if running on Render (`process.env.RENDER`)
2. Sets up webhook endpoint at `/webhook/{BOT_TOKEN}`
3. Configures webhook URL using Render's external hostname
4. Registers webhook with Telegram after server starts

## Health Checks
- **Root endpoint:** `GET /` - Returns "✅ Bot API Running"
- **Health check:** `GET /health` - Returns JSON with status and timestamp

## Troubleshooting

### Bot not responding
1. Check Render logs for webhook setup messages
2. Verify `BOT_TOKEN` is correct
3. Ensure `NODE_ENV=production` is set

### Webhook errors
1. Check if webhook URL is accessible
2. Verify HTTPS is working (Render provides this)
3. Check bot token in webhook path

### Performance
- Webhooks are faster than long polling
- Lower resource usage
- More reliable for production

## Features Impact
✅ **No impact on bot features**
- All commands work identically
- Admin panel, user interactions unchanged
- Database operations remain the same
- Callback queries work normally

## Migration from Long Polling
The bot automatically switches between modes:
- **Local development:** Long polling
- **Render production:** Webhooks

No manual configuration needed! 