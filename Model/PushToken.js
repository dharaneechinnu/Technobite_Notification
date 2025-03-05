const mongoose = require('mongoose');

const PushTokenSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    pushToken: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PushToken', PushTokenSchema);
