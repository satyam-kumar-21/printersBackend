const express = require('express');
const router = express.Router();
const { getDashboardStats, getAnalytics } = require('../controllers/dashboardController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/stats').get(protect, admin, getDashboardStats);
router.route('/analytics').get(protect, admin, getAnalytics);

module.exports = router;
