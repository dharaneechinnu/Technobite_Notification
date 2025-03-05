const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  subscription: {
    type: Object,
    required: true
  }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);