const validator = require('validator');

class Validators {
  static isValidEmail(email) {
    return validator.isEmail(email);
  }

  static isValidPhone(phone) {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, "");

    // Check if it's a valid length (7-15 digits)
    return cleanPhone.length >= 7 && cleanPhone.length <= 15;
  }

  static isValidUrl(url) {
    return validator.isURL(url, {
      protocols: ["http", "https"],
      require_protocol: true,
    });
  }

  static isValidPrice(price) {
    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice > 0 && numPrice <= 999999;
  }

  static isValidCommissionRate(rate) {
    const numRate = parseFloat(rate);
    return !isNaN(numRate) && numRate >= 0 && numRate <= 100;
  }

  static isValidName(name) {
    return (
      typeof name === "string" &&
      name.trim().length >= 2 &&
      name.trim().length <= 50 &&
      /^[a-zA-Z\s\-']+$/.test(name.trim())
    );
  }

  static isValidCompanyName(name) {
    return (
      typeof name === "string" &&
      name.trim().length >= 2 &&
      name.trim().length <= 100
    );
  }

  static isValidProductTitle(title) {
    return (
      typeof title === "string" &&
      title.trim().length >= 3 &&
      title.trim().length <= 200
    );
  }

  static isValidDescription(description) {
    return (
      typeof description === "string" &&
      description.trim().length >= 10 &&
      description.trim().length <= 2000
    );
  }

  static isValidReferralCode(code) {
    return typeof code === "string" && /^[A-Z0-9]{6,20}$/.test(code);
  }

  static isValidAmount(amount, min = 0.01, max = 999999) {
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= min && numAmount <= max;
  }

  static isValidTelegramId(id) {
    const numId = parseInt(id);
    return !isNaN(numId) && numId > 0;
  }

  static isValidUUID(uuid) {
    return validator.isUUID(uuid, 4);
  }

  static sanitizeInput(input) {
    if (typeof input !== "string") return input;

    return input
      .trim()
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  }

  static sanitizeHtml(input) {
    if (typeof input !== "string") return input;

    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  static validateProductData(data) {
    const errors = [];

    if (!this.isValidProductTitle(data.title)) {
      errors.push("Product title must be between 3 and 200 characters");
    }

    if (!this.isValidDescription(data.description)) {
      errors.push("Description must be between 10 and 2000 characters");
    }

    if (!this.isValidPrice(data.price)) {
      errors.push("Price must be a valid positive number");
    }

    if (data.image_url && !this.isValidUrl(data.image_url)) {
      errors.push("Image URL must be a valid URL");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateCompanyData(data) {
    const errors = [];

    if (!this.isValidCompanyName(data.name)) {
      errors.push("Company name must be between 2 and 100 characters");
    }

    if (!this.isValidDescription(data.description)) {
      errors.push("Description must be between 10 and 2000 characters");
    }

    if (!this.isValidCommissionRate(data.commission_rate)) {
      errors.push("Commission rate must be between 0 and 100");
    }

    if (data.website && !this.isValidUrl(data.website)) {
      errors.push("Website must be a valid URL");
    }

    if (data.logo_url && !this.isValidUrl(data.logo_url)) {
      errors.push("Logo URL must be a valid URL");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateUserData(data) {
    const errors = [];

    if (data.first_name && !this.isValidName(data.first_name)) {
      errors.push(
        "First name must be between 2 and 50 characters and contain only letters"
      );
    }

    if (data.last_name && !this.isValidName(data.last_name)) {
      errors.push(
        "Last name must be between 2 and 50 characters and contain only letters"
      );
    }

    if (data.email && !this.isValidEmail(data.email)) {
      errors.push("Email must be a valid email address");
    }

    if (data.phone_number && !this.isValidPhone(data.phone_number)) {
      errors.push("Phone number must be between 7 and 15 digits");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateOrderData(data) {
    const errors = [];

    if (!this.isValidAmount(data.amount)) {
      errors.push("Order amount must be a valid positive number");
    }

    if (!this.isValidTelegramId(data.user_id)) {
      errors.push("User ID must be a valid Telegram ID");
    }

    if (!this.isValidUUID(data.product_id)) {
      errors.push("Product ID must be a valid UUID");
    }

    if (data.customer_name && !this.isValidName(data.customer_name)) {
      errors.push("Customer name must be valid");
    }

    if (data.customer_phone && !this.isValidPhone(data.customer_phone)) {
      errors.push("Customer phone must be valid");
    }

    if (data.customer_email && !this.isValidEmail(data.customer_email)) {
      errors.push("Customer email must be valid");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validatePayoutData(data) {
    const errors = [];

    if (!this.isValidAmount(data.amount, 1)) {
      errors.push("Payout amount must be at least $1");
    }

    if (!this.isValidTelegramId(data.user_id)) {
      errors.push("User ID must be a valid Telegram ID");
    }

    if (!data.payment_method || typeof data.payment_method !== "string") {
      errors.push("Payment method is required");
    }

    if (!data.payment_details || typeof data.payment_details !== "object") {
      errors.push("Payment details are required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateReferralCodeData(data) {
    const errors = [];

    if (data.code && !this.isValidReferralCode(data.code)) {
      errors.push(
        "Referral code must be 6-20 characters long and contain only uppercase letters and numbers"
      );
    }

    if (!this.isValidTelegramId(data.user_id)) {
      errors.push("User ID must be a valid Telegram ID");
    }

    if (!this.isValidUUID(data.product_id)) {
      errors.push("Product ID must be a valid UUID");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateSearchQuery(query) {
    if (typeof query !== "string") return false;

    const cleanQuery = query.trim();
    return cleanQuery.length >= 2 && cleanQuery.length <= 100;
  }

  static validatePaginationParams(page, limit) {
    const numPage = parseInt(page);
    const numLimit = parseInt(limit);

    return {
      page: !isNaN(numPage) && numPage > 0 ? numPage : 1,
      limit:
        !isNaN(numLimit) && numLimit > 0 && numLimit <= 100 ? numLimit : 10,
    };
  }

  static validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { isValid: false, error: "Invalid date format" };
    }

    if (start > end) {
      return { isValid: false, error: "Start date must be before end date" };
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (end - start > maxRange) {
      return { isValid: false, error: "Date range cannot exceed 1 year" };
    }

    return { isValid: true, startDate: start, endDate: end };
  }

  static validateFileUpload(file) {
    const errors = [];

    if (!file) {
      errors.push("File is required");
      return { isValid: false, errors };
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push("File size must be less than 5MB");
    }

    // Check file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push("File must be an image (JPEG, PNG, GIF, or WebP)");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateBankDetails(details) {
    const errors = [];

    if (!details.account_number || details.account_number.length < 8) {
      errors.push("Account number must be at least 8 characters");
    }

    if (!details.bank_name || details.bank_name.length < 2) {
      errors.push("Bank name is required");
    }

    if (
      !details.account_holder_name ||
      !this.isValidName(details.account_holder_name)
    ) {
      errors.push("Account holder name must be valid");
    }

    if (details.routing_number && !/^\d{9}$/.test(details.routing_number)) {
      errors.push("Routing number must be 9 digits");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validatePayPalDetails(details) {
    const errors = [];

    if (!details.email || !this.isValidEmail(details.email)) {
      errors.push("Valid PayPal email is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateCryptoDetails(details) {
    const errors = [];

    if (!details.wallet_address || details.wallet_address.length < 20) {
      errors.push("Valid wallet address is required");
    }

    if (
      !details.currency ||
      !["BTC", "ETH", "USDT", "USDC"].includes(details.currency)
    ) {
      errors.push("Supported currencies: BTC, ETH, USDT, USDC");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateMobileMoneyDetails(details) {
    const errors = [];

    if (!details.phone_number || !this.isValidPhone(details.phone_number)) {
      errors.push("Valid phone number is required");
    }

    if (!details.provider || details.provider.length < 2) {
      errors.push("Mobile money provider is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validatePaymentDetails(method, details) {
    switch (method) {
      case "bank":
        return this.validateBankDetails(details);
      case "paypal":
        return this.validatePayPalDetails(details);
      case "crypto":
        return this.validateCryptoDetails(details);
      case "mobile":
        return this.validateMobileMoneyDetails(details);
      default:
        return { isValid: false, errors: ["Invalid payment method"] };
    }
  }

  static validateNotificationPreferences(preferences) {
    const validKeys = [
      "orders",
      "payouts",
      "referrals",
      "company",
      "promotions",
      "reports",
      "system",
    ];
    const errors = [];

    if (typeof preferences !== "object" || preferences === null) {
      errors.push("Preferences must be an object");
      return { isValid: false, errors };
    }

    for (const key in preferences) {
      if (!validKeys.includes(key)) {
        errors.push(`Invalid preference key: ${key}`);
      } else if (typeof preferences[key] !== "boolean") {
        errors.push(`Preference ${key} must be a boolean`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateBroadcastMessage(message, targetType) {
    const errors = [];

    if (!message || typeof message !== "string") {
      errors.push("Message is required");
    }
    // Remove all other restrictions: allow any message length, any content, any targetType

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateAnalyticsParams(params) {
    const errors = [];
    const validTypes = [
      "users",
      "companies",
      "orders",
      "revenue",
      "growth",
      "top",
    ];
    const validPeriods = ["today", "week", "month", "year", "custom"];

    if (params.type && !validTypes.includes(params.type)) {
      errors.push("Invalid analytics type");
    }

    if (params.period && !validPeriods.includes(params.period)) {
      errors.push("Invalid time period");
    }

    if (params.period === "custom") {
      const dateValidation = this.validateDateRange(
        params.startDate,
        params.endDate
      );
      if (!dateValidation.isValid) {
        errors.push(dateValidation.error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  static normalizePhoneNumber(phone) {
    return phone.replace(/\D/g, "");
  }

  static formatCurrency(amount, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  }

  static truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }
}

module.exports = Validators;
