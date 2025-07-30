console.log("Entering utils/logger.js");
const winston = require("winston");
const path = require("path");

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which logs to print based on environment
const level = () => {
  const env = process.env.NODE_ENV || "development";
  const isDevelopment = env === "development";
  return isDevelopment ? "info" : "warn"; // Changed from "debug" to "info" to reduce noise
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),

  // File transport for errors
  new winston.transports.File({
    filename: path.join(__dirname, "../logs/error.log"),
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: path.join(__dirname, "../logs/combined.log"),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/exceptions.log"),
    }),
  ],
  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/rejections.log"),
    }),
  ],
});

// Create logs directory if it doesn't exist
const fs = require("fs");
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging method
logger.logRequest = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 400) {
      logger.error(message);
    } else {
      logger.http(message);
    }
  });

  if (next) next();
};

// Add bot logging methods
logger.logBotCommand = (ctx, command) => {
  const user = ctx.from;
  const message = `Bot Command: ${command} - User: ${user.id} (@${
    user.username || "no_username"
  })`;
  logger.info(message);
};

logger.logBotError = (ctx, error, command = "unknown") => {
  const user = ctx.from;
  const message = `Bot Error in ${command} - User: ${user.id} (@${
    user.username || "no_username"
  }) - Error: ${error.message}`;
  logger.error(message);
};

logger.logBotAction = (userId, action, details = "") => {
  const message = `Bot Action: ${action} - User: ${userId} - Details: ${details}`;
  logger.info(message);
};

// Add database logging methods
logger.logDbOperation = (operation, collection, docId = "", details = "") => {
  const message = `DB ${operation}: ${collection}${
    docId ? `/${docId}` : ""
  } - ${details}`;
  logger.debug(message);
};

logger.logDbError = (operation, collection, error, docId = "") => {
  const message = `DB Error in ${operation} on ${collection}${
    docId ? `/${docId}` : ""
  }: ${error.message}`;
  logger.error(message);
};

// Add service logging methods
logger.logServiceCall = (service, method, userId = "", details = "") => {
  const message = `Service Call: ${service}.${method}${
    userId ? ` - User: ${userId}` : ""
  } - ${details}`;
  logger.debug(message);
};

logger.logServiceError = (service, method, error, userId = "") => {
  const message = `Service Error: ${service}.${method}${
    userId ? ` - User: ${userId}` : ""
  } - ${error.message}`;
  logger.error(message);
};

console.log("Exiting utils/logger.js");
module.exports = logger;
