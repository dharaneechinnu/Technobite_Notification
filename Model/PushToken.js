// ParentPushToken.js
const mongoose = require('mongoose');

const PushTokenSchema = new mongoose.Schema({
    parentId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    pushToken: {
        type: String,
        required: true
    },
    students: [{
        studentId: {
            type: String,
            required: true
        },
        studentName: {
            type: String,
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PushToken', PushTokenSchema);
