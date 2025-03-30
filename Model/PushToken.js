const mongoose = require('mongoose');

const PushTokenSchema = new mongoose.Schema({
    pushToken: {
        type: String,
        required: true,
        unique: true  // Ensure only one entry per device token
    },
    userIds: [{
        type: String,
        required: true
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PushToken', PushTokenSchema);
