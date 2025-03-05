const mongoose = require('mongoose');

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

// Create the model for admins
const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
