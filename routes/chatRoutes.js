const express = require('express');
const router = express.Router();
const {
    getAllChats,
    getMyChat,
    getChatById,
    sendMessage,
    markAsRead,
    closeChat
} = require('../controllers/chatController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').get(protect, admin, getAllChats);
router.route('/my').get(protect, getMyChat);
router.route('/:id').get(protect, getChatById);
router.route('/:id/messages').post(protect, sendMessage);
router.route('/:id/read').put(protect, admin, markAsRead);
router.route('/:id/close').put(protect, admin, closeChat);

module.exports = router;
