const mongoose = require('mongoose');

const chatSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    messages: [{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'messages.senderModel'
        },
        senderModel: {
            type: String,
            required: true,
            enum: ['User']
        },
        message: {
            type: String,
            required: true
        },
        isRead: {
            type: Boolean,
            default: false
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    },
    lastMessage: {
        type: String,
        default: ''
    },
    unreadCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
