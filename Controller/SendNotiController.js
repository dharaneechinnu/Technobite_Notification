require('dotenv').config();
const Notification = require('../Model/Notification');
const FB = require('../serviceAccountKey.json');
const admin = require('firebase-admin');
const PushToken = require('../Model/PushToken');

admin.initializeApp({
    credential: admin.credential.cert(FB),
});

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

const sendNotification = async(req,res)=>{
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
}

const SendNotificationToAll = async(req,res)=>{
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
}

const sendFCMNotificationToParent = async (req, res) => {
    try {
        const { studentId, studentName, title, body, data = {} } = req.body;

        // Find all parents who have this student in their students array
        const parentTokens = await PushToken.find({ 
            "students.studentId": studentId 
        });

        if (parentTokens.length === 0) {
            console.warn(`⚠️ No parent FCM push token found for student: ${studentId}`);
            return res.status(404).json({ message: "No parent found for the given student." });
        }

        // Extract push tokens
        const validTokens = parentTokens.map(parent => parent.pushToken);

        if (validTokens.length === 0) {
            return res.status(400).json({ message: "No valid FCM tokens found for parents." });
        }

        // Send notifications using FCM
        try {
            await sendFCMNotificationBatch(validTokens, title, `${studentName}: ${body}`, { studentId, studentName, ...data });
        } catch (fcmError) {
            return res.status(500).json({ 
                error: "Failed to send FCM notifications", 
                details: fcmError.message 
            });
        }

        return res.status(200).json({ message: "Notifications sent successfully." });
    } catch (error) {
        console.error("❌ Error sending FCM push notifications to parents:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};



module.exports={sendNotification,SendNotificationToAll,sendFCMNotificationToParent}
