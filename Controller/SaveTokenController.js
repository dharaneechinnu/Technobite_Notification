const PushToken = require('../Model/PushToken');
const User = require('../Model/Student');



const saveToken= async(req,res)=>{
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
}




module.exports={saveToken}