const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');
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
 * Function to Send Push Notifications via Expo
 */
async function sendPushNotificationBatch(userIds, title, body, data) {
    try {
        let messages = [];

        for (const userId of userIds) {
            const pushTokenEntry = await PushToken.findOne({ userId });
            if (!pushTokenEntry) {
                console.warn(`⚠️ No Expo push token found for user: ${userId}`);
                continue;
            }
            if (!Expo.isExpoPushToken(pushTokenEntry.pushToken)) {
                console.warn(`⚠️ Invalid Expo push token: ${pushTokenEntry.pushToken}`);
                continue;
            }

            messages.push({
                to: pushTokenEntry.pushToken,
                sound: 'default',
                title,
                body,
                data,
            });
        }

        if (messages.length === 0) {
            console.warn("⚠️ No valid push tokens found for Expo notifications.");
            return;
        }

        let chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
        }

        console.log(`✅ Expo notifications sent to ${messages.length} users`);
    } catch (error) {
        console.error("❌ Error sending Expo push notifications:", error);
    }
}

async function sendFCMNotificationBatch(userIds, title, body, data = {}) {
    try {
        for (const userId of userIds) {
            const pushTokenEntry = await PushToken.findOne({ userId });
            if (!pushTokenEntry) {
                console.warn(`⚠️ No FCM push token found for user: ${userId}`);
                continue;
            }

            const message = {
                data: {
                    title,
                    body,
                    customData: JSON.stringify(data)
                },
                token: pushTokenEntry.pushToken,
            };

            await admin.messaging().send(message);
        }

        console.log(`✅ FCM notifications sent to ${userIds.length} users`);
    } catch (error) {
        console.error("❌ Error sending FCM push notifications:", error);
    }
}
/**
 * Register User
 */
app.post('/register', async (req, res) => {
    try {
        const { studentId, password } = req.body;
        if (!studentId || !password) {
            return res.status(400).json({ error: "Student ID and password are required" });
        }

        const existingUser = await User.findOne({ studentId });
        if (existingUser) {
            return res.status(400).json({ error: "Student already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ studentId, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: "Student registered successfully" });
    } catch (error) {
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

        res.status(200).json({ message: "Login successful", token });
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
        if (!userId || !pushToken) return res.status(400).json({ error: "UserId and pushToken are required" });

        await PushToken.findOneAndUpdate(
            { userId },
            { pushToken },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: "Push token saved successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save push token", details: error.message });
    }
});

/**
 * Send Bulk Notifications
 */
app.post('/send-notifications', async (req, res) => {
    try {
        const { userIds, title, body, data = {} } = req.body;
        if (!userIds || !title || !body) return res.status(400).json({ error: "Missing required fields" });

        // Save notifications to the database
        const notifications = userIds.map(userId => ({ userId, title, body, data, sent: true }));
        await Notification.insertMany(notifications);

        // Send notifications using FCM
        await sendFCMNotificationBatch(userIds, title, body, data);

        res.status(200).json({ message: "Notifications sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to send notifications", details: error.message });
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
