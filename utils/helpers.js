const crypto = require('crypto');
const QRCode = require('qrcode');
const logger = require('../../utils/logger');

class Helpers {
  static generateId(length = 8) {
    return crypto.randomBytes(length).toString("hex").toUpperCase();
  }

  static generateReferralCode(length = 8) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }

  static hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  static formatCurrency(amount, currency = "USD", locale = "en-US") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  static formatDate(date, locale = "en-US", options = {}) {
    const defaultOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };

    return new Intl.DateTimeFormat(locale, {
      ...defaultOptions,
      ...options,
    }).format(new Date(date));
  }

  static formatRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return "Just now";
  }

  static truncateText(text, maxLength = 100, suffix = "...") {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  static capitalizeFirst(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static capitalizeWords(str) {
    if (!str) return str;
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  static slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }

  static parsePhoneNumber(phone) {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, "");

    // Format as international number if it doesn't start with +
    if (cleaned.length === 10) {
      return `+1${cleaned}`; // Assume US number
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+${cleaned}`;
    }

    return `+${cleaned}`;
  }

  static maskSensitiveData(data, fields = ["password", "token", "secret"]) {
    if (typeof data !== "object" || data === null) return data;

    const masked = { ...data };

    fields.forEach((field) => {
      if (masked[field]) {
        masked[field] = "***MASKED***";
      }
    });

    return masked;
  }

  static generateQRCode(text, options = {}) {
    const defaultOptions = {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    };

    return QRCode.toDataURL(text, { ...defaultOptions, ...options });
  }

  static async generateQRCodeBuffer(text, options = {}) {
    try {
      return await QRCode.toBuffer(text, options);
    } catch (error) {
      logger.error("Error generating QR code:", error);
      throw error;
    }
  }

  static calculateCommission(amount, rate) {
    return Math.round(((amount * rate) / 100) * 100) / 100;
  }

  static calculatePercentageChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 100) / 100;
  }

  static generateReferralLink(baseUrl, code) {
    return `${baseUrl}/ref/${code}`;
  }

  static extractReferralCode(url) {
    const match = url.match(/\/ref\/([A-Z0-9]+)/);
    return match ? match[1] : null;
  }

  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  static escapeMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
  }

  static formatTelegramMessage(text, options = {}) {
    let formatted = text;

    if (options.bold) {
      formatted = `<b>${formatted}</b>`;
    }

    if (options.italic) {
      formatted = `<i>${formatted}</i>`;
    }

    if (options.code) {
      formatted = `<code>${formatted}</code>`;
    }

    if (options.link) {
      formatted = `<a href="${options.link}">${formatted}</a>`;
    }

    return formatted;
  }

  static chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function () {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  static deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map((item) => this.deepClone(item));
    if (typeof obj === "object") {
      const cloned = {};
      Object.keys(obj).forEach((key) => {
        cloned[key] = this.deepClone(obj[key]);
      });
      return cloned;
    }
  }

  static isEmptyObject(obj) {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
  }

  static removeEmptyFields(obj) {
    const cleaned = {};

    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (value !== null && value !== undefined && value !== "") {
        if (typeof value === "object" && !Array.isArray(value)) {
          const cleanedNested = this.removeEmptyFields(value);
          if (!this.isEmptyObject(cleanedNested)) {
            cleaned[key] = cleanedNested;
          }
        } else {
          cleaned[key] = value;
        }
      }
    });

    return cleaned;
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  static generatePagination(currentPage, totalPages, maxButtons = 5) {
    const buttons = [];
    const half = Math.floor(maxButtons / 2);

    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) {
      buttons.push({
        page: i,
        current: i === currentPage,
      });
    }

    return {
      buttons,
      hasFirst: start > 1,
      hasLast: end < totalPages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
    };
  }

  static calculateStats(data, field) {
    if (!Array.isArray(data) || data.length === 0) {
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
    }

    const values = data.map((item) => parseFloat(item[field]) || 0);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      sum: sum,
      count: values.length,
    };
  }

  static groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  static sortBy(array, key, direction = "asc") {
    return array.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (direction === "desc") {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      }

      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });
  }

  static filterBy(array, filters) {
    return array.filter((item) => {
      return Object.keys(filters).every((key) => {
        const filterValue = filters[key];
        const itemValue = item[key];

        if (typeof filterValue === "string") {
          return itemValue
            .toString()
            .toLowerCase()
            .includes(filterValue.toLowerCase());
        }

        return itemValue === filterValue;
      });
    });
  }

  static createDateRange(startDate, endDate, interval = "day") {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(new Date(current));

      switch (interval) {
        case "day":
          current.setDate(current.getDate() + 1);
          break;
        case "week":
          current.setDate(current.getDate() + 7);
          break;
        case "month":
          current.setMonth(current.getMonth() + 1);
          break;
        case "year":
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }

    return dates;
  }

  static getTimeZoneOffset(timeZone = "UTC") {
    try {
      const date = new Date();
      const utcDate = new Date(
        date.toLocaleString("en-US", { timeZone: "UTC" })
      );
      const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
      return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
    } catch {
      return 0;
    }
  }

  static convertToTimeZone(date, timeZone) {
    return new Date(date.toLocaleString("en-US", { timeZone }));
  }

  static isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  static safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch {
      return defaultValue;
    }
  }

  static generateCSV(data, headers) {
    if (!Array.isArray(data) || data.length === 0) return "";

    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = data.map((row) =>
      csvHeaders
        .map((header) => {
          const value = row[header];
          return typeof value === "string" && value.includes(",")
            ? `"${value}"`
            : value;
        })
        .join(",")
    );

    return [csvHeaders.join(","), ...csvRows].join("\n");
  }

  static parseCSV(csvText) {
    const lines = csvText.split("\n");
    const headers = lines[0].split(",");

    return lines.slice(1).map((line) => {
      const values = line.split(",");
      const obj = {};

      headers.forEach((header, index) => {
        obj[header.trim()] = values[index]?.trim() || "";
      });

      return obj;
    });
  }

  static retry(fn, maxAttempts = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const attempt = async () => {
        try {
          attempts++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          if (attempts >= maxAttempts) {
            reject(error);
          } else {
            setTimeout(attempt, delay * attempts);
          }
        }
      };

      attempt();
    });
  }

  static memoize(fn, maxSize = 100) {
    const cache = new Map();

    return function (...args) {
      const key = JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = fn.apply(this, args);

      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(key, result);
      return result;
    };
  }
}

module.exports = Helpers;
