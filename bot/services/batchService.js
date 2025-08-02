const databaseService = require("../config/database");
const cacheService = require("../config/cache");
const logger = require("../../utils/logger");

class BatchService {
  constructor() {
    this.batchSize = 500; // Firestore batch limit
  }

  // Batch get users by telegram IDs
  async getUsersBatch(telegramIds) {
    const results = {};
    const missing = [];

    // Check cache first
    for (const id of telegramIds) {
      const cached = cacheService.getUser(id);
      if (cached) {
        results[id] = cached;
      } else {
        missing.push(id);
      }
    }

    // Get missing users from database in batches
    if (missing.length > 0) {
      for (let i = 0; i < missing.length; i += this.batchSize) {
        const batch = missing.slice(i, i + this.batchSize);
        const batchResults = await this._getUsersFromDb(batch);

        // Cache and add to results
        for (const [id, userData] of Object.entries(batchResults)) {
          cacheService.setUser(id, userData);
          results[id] = userData;
        }
      }
    }

    return results;
  }

  // Batch get companies by IDs
  async getCompaniesBatch(companyIds) {
    const results = {};
    const missing = [];

    // Check cache first
    for (const id of companyIds) {
      const cached = cacheService.getCompany(id);
      if (cached) {
        results[id] = cached;
      } else {
        missing.push(id);
      }
    }

    // Get missing companies from database
    if (missing.length > 0) {
      const batchResults = await this._getCompaniesFromDb(missing);

      // Cache and add to results
      for (const [id, companyData] of Object.entries(batchResults)) {
        cacheService.setCompany(id, companyData);
        results[id] = companyData;
      }
    }

    return results;
  }

  // Batch update users
  async updateUsersBatch(updates) {
    const batch = databaseService.batch();
    const cacheUpdates = {};

    for (const [telegramId, updateData] of Object.entries(updates)) {
      const userRef = databaseService.users().doc(telegramId.toString());
      batch.update(userRef, {
        ...updateData,
        updatedAt: databaseService.serverTimestamp(),
      });

      // Prepare cache update
      cacheUpdates[telegramId] = updateData;
    }

    await batch.commit();

    // Update cache
    for (const [telegramId, updateData] of Object.entries(cacheUpdates)) {
      const existing = cacheService.getUser(telegramId);
      if (existing) {
        cacheService.setUser(telegramId, { ...existing, ...updateData });
      }
    }

    logger.info(`Batch updated ${Object.keys(updates).length} users`);
  }

  // Batch update companies
  async updateCompaniesBatch(updates) {
    const batch = databaseService.batch();
    const cacheUpdates = {};

    for (const [companyId, updateData] of Object.entries(updates)) {
      const companyRef = databaseService.companies().doc(companyId);
      batch.update(companyRef, {
        ...updateData,
        updatedAt: databaseService.serverTimestamp(),
      });

      // Prepare cache update
      cacheUpdates[companyId] = updateData;
    }

    await batch.commit();

    // Update cache
    for (const [companyId, updateData] of Object.entries(cacheUpdates)) {
      const existing = cacheService.getCompany(companyId);
      if (existing) {
        cacheService.setCompany(companyId, { ...existing, ...updateData });
      }
    }

    logger.info(`Batch updated ${Object.keys(updates).length} companies`);
  }

  // Private method to get users from database
  async _getUsersFromDb(telegramIds) {
    const results = {};

    try {
      // Use Promise.all for parallel execution
      const promises = telegramIds.map(async (id) => {
        try {
          const doc = await databaseService.users().doc(id.toString()).get();
          if (doc.exists) {
            return { id, data: { id: doc.id, ...doc.data() } };
          }
          return { id, data: null };
        } catch (error) {
          logger.error(`Error getting user ${id}:`, error);
          return { id, data: null };
        }
      });

      const userDocs = await Promise.all(promises);

      for (const { id, data } of userDocs) {
        if (data) {
          results[id] = data;
        }
      }
    } catch (error) {
      logger.error("Error in batch user retrieval:", error);
    }

    return results;
  }

  // Private method to get companies from database
  async _getCompaniesFromDb(companyIds) {
    const results = {};

    try {
      // Use Promise.all for parallel execution
      const promises = companyIds.map(async (id) => {
        try {
          const doc = await databaseService.companies().doc(id).get();
          if (doc.exists) {
            return { id, data: { id: doc.id, ...doc.data() } };
          }
          return { id, data: null };
        } catch (error) {
          logger.error(`Error getting company ${id}:`, error);
          return { id, data: null };
        }
      });

      const companyDocs = await Promise.all(promises);

      for (const { id, data } of companyDocs) {
        if (data) {
          results[id] = data;
        }
      }
    } catch (error) {
      logger.error("Error in batch company retrieval:", error);
    }

    return results;
  }
}

// Export singleton instance
const batchService = new BatchService();
module.exports = batchService;
