const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const PushTokenSchema = new mongoose.Schema({
    parentId: {
        type: String,
      
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
     
        unique: true
    },
    password: {
        type: String,
    },
    pushToken: {
        type: String,
       
        unique: true  // Ensure only one entry per device token
    },
    students: [{
        studentId: {
            type: String,
           
        },
        studentName: {
            type: String,
           
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
PushTokenSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('PushToken', PushTokenSchema);
