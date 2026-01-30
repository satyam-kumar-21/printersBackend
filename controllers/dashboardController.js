const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// @desc    Get dashboard analytics
// @route   GET /api/dashboard/analytics
// @access  Private/Admin
const getAnalytics = asyncHandler(async (req, res) => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Total Revenue (all paid orders)
    const revenueResult = await Order.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Current Month Revenue
    const currentMonthRevenue = await Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: currentMonthStart } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const currentRevenue = currentMonthRevenue.length > 0 ? currentMonthRevenue[0].total : 0;

    // Last Month Revenue
    const lastMonthRevenue = await Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const lastRevenue = lastMonthRevenue.length > 0 ? lastMonthRevenue[0].total : 0;

    // Revenue Growth Percentage
    const revenueGrowth = lastRevenue > 0
        ? (((currentRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1)
        : currentRevenue > 0 ? 100 : 0;

    // Total Orders
    const totalOrders = await Order.countDocuments();
    const currentMonthOrders = await Order.countDocuments({ createdAt: { $gte: currentMonthStart } });
    const lastMonthOrders = await Order.countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    // Orders Growth Percentage
    const ordersGrowth = lastMonthOrders > 0
        ? (((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100).toFixed(1)
        : currentMonthOrders > 0 ? 100 : 0;

    // Total Customers (non-admin users)
    const totalCustomers = await User.countDocuments({ isAdmin: false });
    const currentMonthCustomers = await User.countDocuments({
        isAdmin: false,
        createdAt: { $gte: currentMonthStart }
    });
    const lastMonthCustomers = await User.countDocuments({
        isAdmin: false,
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    // Customers Growth Percentage
    const customersGrowth = lastMonthCustomers > 0
        ? (((currentMonthCustomers - lastMonthCustomers) / lastMonthCustomers) * 100).toFixed(1)
        : currentMonthCustomers > 0 ? 100 : 0;

    // Recent Orders (last 10)
    const recentOrders = await Order.find()
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('_id user totalPrice status isPaid createdAt');

    // Orders by Status
    const ordersByStatus = await Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Revenue by Month (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const revenueByMonth = await Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: sixMonthsAgo } } },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                revenue: { $sum: '$totalPrice' },
                orders: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
        revenue: {
            total: totalRevenue,
            growth: parseFloat(revenueGrowth)
        },
        orders: {
            total: totalOrders,
            growth: parseFloat(ordersGrowth)
        },
        customers: {
            total: totalCustomers,
            growth: parseFloat(customersGrowth)
        },
        recentOrders,
        ordersByStatus,
        revenueByMonth
    });
});

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private/Admin
const getStats = asyncHandler(async (req, res) => {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const totalCustomers = await User.countDocuments({ isAdmin: false });
    const totalProducts = await Product.countDocuments();

    res.json({
        totalOrders,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        totalCustomers,
        totalProducts
    });
});

module.exports = { getDashboardStats: getStats, getAnalytics };
