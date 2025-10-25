/**
 * SMART FREE TIER OPTIMIZER
 * Keeps reads under 50K/day for 1000+ users
 */

const NodeCache = require('node-cache');

class SmartFreeTierOptimizer {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 300, maxKeys: 10000 });
    this.readsToday = 0;
    this.dailyQuota = 50000;
    this.userLimits = new Map();
  }

  canRead(userId) {
    if (this.readsToday >= this.dailyQuota * 0.9) return false;
    if (userId && (this.userLimits.get(userId) || 0) >= 50) return false;
    return true;
  }

  recordRead(userId) {
    this.readsToday++;
    if (userId) {
      this.userLimits.set(userId, (this.userLimits.get(userId) || 0) + 1);
    }
  }

  async smartQuery(key, fetchFn, userId, ttl = 300) {
    if (!this.canRead(userId)) {
      return this.cache.get(key);
    }

    const cached = this.cache.get(key);
    if (cached) return cached;

    this.recordRead(userId);
    const data = await fetchFn();
    this.cache.set(key, data, ttl);
    return data;
  }

  getStats() {
    return {
      reads: this.readsToday,
      remaining: this.dailyQuota - this.readsToday,
      percentUsed: ((this.readsToday / this.dailyQuota) * 100).toFixed(2) + '%'
    };
  }
}

module.exports = new SmartFreeTierOptimizer();
