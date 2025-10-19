const logger = require("../../utils/logger");
const performanceMonitor = require("./performance");

class TelegramOptimizer {
  constructor() {
    this.callQueue = [];
    this.processing = false;
    this.lastCallTime = 0;
    this.callsThisSecond = 0;
    this.callsThisMinute = 0;

    // BEAST MODE: Telegram API limits (conservative to stay safe)
    this.MAX_CALLS_PER_SECOND = 25; // Stay under 30 to be safe
    this.MAX_CALLS_PER_MINUTE = 1400; // Stay under 1500 to be safe
    this.MIN_INTERVAL_BETWEEN_CALLS = 40; // 40ms between calls (25 calls/second)

    // EMERGENCY: Disable telegram optimizer counters to stop quota leak
    // setInterval(() => {
    //   this.callsThisSecond = 0;
    // }, 1000);

    // setInterval(() => {
    //   this.callsThisMinute = 0;
    }, 60000);
  }

  async executeWithRateLimit(apiCall, priority = "normal") {
    return new Promise((resolve, reject) => {
      const task = {
        apiCall,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Add to queue based on priority
      if (priority === "high") {
        this.callQueue.unshift(task);
      } else {
        this.callQueue.push(task);
      }

      // Process queue if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.processing || this.callQueue.length === 0) return;

    this.processing = true;

    while (this.callQueue.length > 0) {
      const now = Date.now();

      // Check rate limits
      if (this.callsThisSecond >= this.MAX_CALLS_PER_SECOND) {
        await this.delay(1000 - (now - this.lastCallTime));
        continue;
      }

      if (this.callsThisMinute >= this.MAX_CALLS_PER_MINUTE) {
        await this.delay(60000);
        continue;
      }

      // Ensure minimum interval between calls
      const timeSinceLastCall = now - this.lastCallTime;
      if (timeSinceLastCall < this.MIN_INTERVAL_BETWEEN_CALLS) {
        await this.delay(this.MIN_INTERVAL_BETWEEN_CALLS - timeSinceLastCall);
        continue;
      }

      // Execute API call
      const task = this.callQueue.shift();
      if (!task) continue;

      try {
        this.lastCallTime = Date.now();
        this.callsThisSecond++;
        this.callsThisMinute++;

        performanceMonitor.recordTelegramApiCall();

        const result = await task.apiCall();
        task.resolve(result);
      } catch (error) {
        performanceMonitor.recordTelegramApiError();
        logger.error("Telegram API call failed:", error);
        task.reject(error);
      }
    }

    this.processing = false;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getQueueStats() {
    return {
      queueLength: this.callQueue.length,
      callsThisSecond: this.callsThisSecond,
      callsThisMinute: this.callsThisMinute,
      maxCallsPerSecond: this.MAX_CALLS_PER_SECOND,
      maxCallsPerMinute: this.MAX_CALLS_PER_MINUTE,
    };
  }
}

const telegramOptimizer = new TelegramOptimizer();
module.exports = telegramOptimizer;
