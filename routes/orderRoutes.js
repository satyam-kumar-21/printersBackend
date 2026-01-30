const express = require('express');
const router = express.Router();
const {
    addOrderItems,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getOrderById,
    updateOrderToPaid,
    updateOrderStatus,
    getMyOrders,
    getOrders
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, addOrderItems)
    .get(protect, admin, getOrders);

router.route('/create-razorpay-order').post(protect, createRazorpayOrder);
router.route('/verify-payment').post(protect, verifyRazorpayPayment);
router.route('/myorders').get(protect, getMyOrders);
router.route('/:id').get(getOrderById);
router.route('/:id/pay').put(protect, updateOrderToPaid);
router.route('/:id/status').put(protect, admin, updateOrderStatus);

module.exports = router;
