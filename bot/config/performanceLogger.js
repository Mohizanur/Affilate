const logger = require("../../utils/logger");

class PerformanceLogger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === "production" || process.env.RENDER;
    this.logLevel = process.env.LOG_LEVEL || "warn"; // error, warn, info, debug
    this.performanceMode = process.env.PERFORMANCE_MODE === "true" || this.isProduction;
  }

  // Only log errors in production/performance mode
  error(message, ...args) {
    logger.error(message, ...args);
  }

  // Only log warnings and above
  warn(message, ...args) {
    if (this.logLevel !== "error") {
      logger.warn(message, ...args);
    }
  }

  // Only log info in development mode
  info(message, ...args) {
    if (!this.performanceMode && this.logLevel !== "error" && this.logLevel !== "warn") {
      logger.info(message, ...args);
    }
  }

  // Only log debug in development mode
  debug(message, ...args) {
    if (!this.performanceMode && this.logLevel === "debug") {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  // Performance-critical operations - minimal logging
  perf(message, ...args) {
    if (this.logLevel === "debug") {
      console.log(`[PERF] ${message}`, ...args);
    }
  }

  // Critical system events only
  system(message, ...args) {
    logger.info(message, ...args);
  }

  // User actions - minimal in production
  userAction(action, userId, ...args) {
    if (!this.performanceMode) {
      this.debug(`User ${userId}: ${action}`, ...args);
    }
  }

  // Admin actions - always log
  adminAction(action, adminId, ...args) {
    this.info(`Admin ${adminId}: ${action}`, ...args);
  }

  // Database operations - minimal logging
  db(operation, ...args) {
    if (this.logLevel === "debug") {
      this.debug(`DB ${operation}`, ...args);
    }
  }

  // Cache operations - minimal logging
  cache(operation, ...args) {
    if (this.logLevel === "debug") {
      this.debug(`CACHE ${operation}`, ...args);
    }
  }

  // Telegram API calls - minimal logging
  telegram(operation, ...args) {
    if (this.logLevel === "debug") {
      this.debug(`TELEGRAM ${operation}`, ...args);
    }
  }
}

const performanceLogger = new PerformanceLogger();
module.exports = performanceLogger; 