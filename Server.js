const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');
const axios = require('axios'); // Added axios import at the top

require('dotenv').config();

// Import Models
const User = require('./Model/Student');
const PushToken = require('./Model/PushToken');
const Notification = require('./Model/Notification');
const FB = require('./serviceAccountKey.json');

// Initialize Expo Push Client
const expo = new Expo();

admin.initializeApp({
    credential: admin.credential.cert(FB),
});

// Express App
const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1); // Exit the process if DB connection fails
    });

/** 
 * Function to Send Push Notifications via FCM
 */
async function sendFCMNotificationBatch(userIds, title, body, data = {}) {
    
 try {
     for (const userId of userIds) {
      const pte = await PushToken.findOne({ userId : userId });
         
         if (!pte) {
             console.warn(`⚠️ No FCM push token found for user: ${userId}`);
             continue;
         }
         const message = {
          token: pte.pushToken,
          notification: {
            title: title,
            body: body,
          },
          data: {
            customData: "Crescent Notification",
          },
        };
        
        admin
          .messaging()
          .send(message)
          .then((response) => {
            console.log("Successfully sent message:", response);
          })
          .catch((error) => {
            console.error("Error sending message:", error);
          });
 }} catch (error) {
     console.error("❌ Error sending FCM push notifications:", error);
 }
}

/**
 * Function to Send Push Notifications via Expo
 */


/**
 * Fetch school users from API
 */
async function fetchSchoolUsers() {
    try {
        const formData = new FormData();
        formData.append('api_key', process.env.API_KEY); // Use environment variable for security

        // Make the POST request
        const response = await axios.post('https://app.edisha.org/index.php/resource/GetUsers', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data.status && Array.isArray(response.data.data)) {
            return response.data.data;
        }
        
        console.error("❌ Invalid response from school API:", response.data);
        return [];
    } catch (error) {
        console.error("❌ Error fetching school users:", error);
        return [];
    }
}

/**
 * Register User
 */
// Register endpoint
app.post('/register', async (req, res) => {
    try {
        const { studentId, password } = req.body;

        if (!studentId || !password) {
            return res.status(400).json({ error: "Student ID and password are required" });
        }

        // Fetch valid users from school database
        let schoolUsers;
        try {
            schoolUsers = await fetchSchoolUsers();
            if (!Array.isArray(schoolUsers) || schoolUsers.length === 0) {
                return res.status(500).json({ error: "Failed to retrieve student data" });
            }
        } catch (error) {
            console.error("Error fetching school students:", error);
            return res.status(500).json({ error: "Error verifying student with school database" });
        }

        // Validate studentId
        const isValidStudent = schoolUsers.some(user => user.user_id?.toString() === studentId.toString());
        if (!isValidStudent) {
            return res.status(403).json({ error: "Not a registered school student" });
        }

        // Check if student already registered
        const existingUser = await User.findOne({ studentId });
        if (existingUser) {
            return res.status(400).json({ error: "Student already registered" });
        }

        // Fix: Ensure password is a string before hashing
        const hashedPassword = await bcrypt.hash(String(password), 10);

        // Register the student
        const newUser = new User({ studentId, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: "Student registered successfully" });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Registration failed", details: error.message });
    }
});


/**
 * Login
 */
app.post('/login', async (req, res) => {
    try {
        const { studentId, password } = req.body;
        
        // Check if userId and password are provided
        if (!studentId || !password) {
            return res.status(400).json({ error: "UserId and password are required" });
        }

        // Find user in the database
        const user = await User.findOne({ studentId });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign({ studentId: user.studentId }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: "Login successful", token, userId: user.studentId });
    } catch (error) {
        console.error("❌ Login Error:", error);
        res.status(500).json({ error: "Login failed", details: error.message });
    }
});

/**
 * Save Push Token
 */
app.post('/save-push-token', async (req, res) => {
    try {
        const { userId, pushToken } = req.body;

        // Validate request body
        if (!userId || !pushToken) {
            return res.status(400).json({ error: "UserId and pushToken are required" });
        }

        // Check if userId exists in User collection
        const userExists = await User.findOne({studentId: userId});
  
        if (!userExists) {
            return res.status(400).json({ error: "Invalid userId, user does not exist" });
        }

        // Check if the pushToken is already assigned to another user
        const existingToken = await PushToken.findOne({ pushToken });

        if (existingToken && existingToken.userId.toString() !== userId) {
            return res.status(400).json({ 
                error: "This push token is already assigned to another user", 
                existingUserId: existingToken.userId 
            });
        }

        // Save or update push token for the user
        await PushToken.findOneAndUpdate(
            { userId },
            { pushToken },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: "Push token saved successfully" });

    } catch (error) {
        res.status(500).json({ 
            error: "Failed to save push token", 
            details: error.message 
        });
    }
});

/**
 * Send Bulk Notifications
 */
app.post('/send-notifications', async (req, res) => {
    try {
        const { userIds, title, body, data = {} } = req.body;

        // Validate request body
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: "Invalid or missing userIds" });
        }
        if (!title || !body) {
            return res.status(400).json({ error: "Title and body are required" });
        }

        // Validate userIds exist in the PushToken collection
        const existingTokens = await PushToken.find({ userId: { $in: userIds } }, 'userId');
        const validUserIds = existingTokens.map(token => token.userId.toString());
        const invalidUserIds = userIds.filter(id => !validUserIds.includes(id));

        if (invalidUserIds.length > 0) {
            return res.status(400).json({ 
                error: "Some userIds do not have registered push tokens", 
                invalidUserIds 
            });
        }

        // Save notifications to the database
        const notifications = validUserIds.map(userId => ({
            userId,
            title,
            body,
            data,
            sent: true
        }));
        await Notification.insertMany(notifications);

        // Send notifications using FCM
        try {
            await sendFCMNotificationBatch(validUserIds, title, body, data);
        } catch (fcmError) {
            return res.status(500).json({ 
                error: "Failed to send FCM notifications", 
                details: fcmError.message 
            });
        }

        res.status(200).json({ message: "Notifications sent successfully" });

    } catch (error) {
        res.status(500).json({ 
            error: "Internal server error", 
            details: error.message 
        });
    }
});

/**
 * Send notifications to all school users
 */
app.post('/notify-all-school-users', async (req, res) => {
    try {
        const { title, body, data = {} } = req.body;
        
        if (!title || !body) {
            return res.status(400).json({ error: "Title and body are required" });
        }
        
        // Get all users from school database
        const schoolUsers = await fetchSchoolUsers();
        if (!schoolUsers || !schoolUsers.length) {
            return res.status(404).json({ error: "No users found in school database" });
        }
        
        // Get all registered users from our database
        const registeredUsers = await User.find({}, 'studentId');
        const registeredUserIds = registeredUsers.map(user => user.studentId);
        
        if (!registeredUserIds.length) {
            return res.status(404).json({ error: "No registered users found" });
        }
        
        // Find users who are both in school database and registered in our app
        const schoolUserIds = schoolUsers.map(user => user.user_id.toString());
        const validUserIds = registeredUserIds.filter(id => 
            schoolUserIds.includes(id.toString())
        );
        
        if (!validUserIds.length) {
            return res.status(404).json({ error: "No valid users found to send notifications" });
        }
        
        // Send notifications to users
        await sendFCMNotificationBatch(validUserIds, title, body, data);
        
        // Save notifications to database
        const notifications = validUserIds.map(userId => ({
            userId,
            title,
            body,
            data,
            sent: true
        }));
        await Notification.insertMany(notifications);
        
        res.status(200).json({ 
            message: "Notifications sent successfully to school users", 
            sentTo: validUserIds.length,
            totalSchoolUsers: schoolUserIds.length,
            totalRegisteredUsers: registeredUserIds.length
        });
        
    } catch (error) {
        res.status(500).json({ 
            error: "Failed to send notifications to school users", 
            details: error.message 
        });
    }
});

/**
 * Retrieve Notifications for history 
 */
app.get('/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: "UserId is required" });

        const notifications = await Notification.find({ userId, sent: true }).sort({ createdAt: -1 });

        if (notifications.length === 0) {
            return res.status(404).json({ message: "No notifications found" });
        }

        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve notifications", details: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;