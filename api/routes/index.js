const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Profit simulation endpoint
router.post('/admin/simulate', adminController.simulateProfit);

module.exports = router;
