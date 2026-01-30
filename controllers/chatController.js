const asyncHandler = require('express-async-handler');
const Chat = require('../models/Chat');

// @desc    Get all chats for admin
// @route   GET /api/chats
// @access  Private/Admin
const getAllChats = asyncHandler(async (req, res) => {
    const chats = await Chat.find()
        .populate('user', 'name email avatar')
        .sort({ updatedAt: -1 });
    res.json(chats);
});

// @desc    Get user's chat (create if doesn't exist)
// @route   GET /api/chats/my
// @access  Private
const getMyChat = asyncHandler(async (req, res) => {
    let chat = await Chat.findOne({ user: req.user._id })
        .populate('user', 'name email avatar');

    if (!chat) {
        chat = await Chat.create({
            user: req.user._id,
            messages: [],
            status: 'active'
        });
        chat = await Chat.findById(chat._id).populate('user', 'name email avatar');
    }

    res.json(chat);
});

// @desc    Get specific chat by ID
// @route   GET /api/chats/:id
// @access  Private
const getChatById = asyncHandler(async (req, res) => {
    const chat = await Chat.findById(req.params.id)
        .populate('user', 'name email avatar');

    if (chat) {
        // Check if user is authorized (either the chat owner or admin)
        if (chat.user._id.toString() === req.user._id.toString() || req.user.isAdmin) {
            res.json(chat);
        } else {
            res.status(403);
            throw new Error('Not authorized to access this chat');
        }
    } else {
        res.status(404);
        throw new Error('Chat not found');
    }
});

// @desc    Send message in chat
// @route   POST /api/chats/:id/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
    const { message } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (chat) {
        // Check authorization
        if (chat.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            res.status(403);
            throw new Error('Not authorized to send messages in this chat');
        }

        const newMessage = {
            sender: req.user._id,
            senderModel: 'User',
            message,
            isRead: false,
            timestamp: new Date()
        };

        chat.messages.push(newMessage);
        chat.lastMessage = message;

        // Increment unread count if message is from user (not admin)
        if (!req.user.isAdmin) {
            chat.unreadCount += 1;
        }

        await chat.save();

        const updatedChat = await Chat.findById(chat._id)
            .populate('user', 'name email avatar');

        res.json(updatedChat);
    } else {
        res.status(404);
        throw new Error('Chat not found');
    }
});

// @desc    Mark messages as read
// @route   PUT /api/chats/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
    const chat = await Chat.findById(req.params.id);

    if (chat) {
        // Only admin can mark messages as read
        if (!req.user.isAdmin) {
            res.status(403);
            throw new Error('Not authorized');
        }

        // Mark all messages as read
        chat.messages.forEach(msg => {
            msg.isRead = true;
        });
        chat.unreadCount = 0;

        await chat.save();
        res.json({ message: 'Messages marked as read' });
    } else {
        res.status(404);
        throw new Error('Chat not found');
    }
});

// @desc    Close chat
// @route   PUT /api/chats/:id/close
// @access  Private/Admin
const closeChat = asyncHandler(async (req, res) => {
    const chat = await Chat.findById(req.params.id);

    if (chat) {
        chat.status = 'closed';
        await chat.save();
        res.json({ message: 'Chat closed' });
    } else {
        res.status(404);
        throw new Error('Chat not found');
    }
});

module.exports = {
    getAllChats,
    getMyChat,
    getChatById,
    sendMessage,
    markAsRead,
    closeChat
};
