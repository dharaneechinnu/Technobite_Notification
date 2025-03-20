require("dotenv").config();
const User = require('../Model/Student');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios'); 





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



const UserLogin = async(req,res)=>{
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
}

const UserRegister = async(req,res)=>{
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
}



module.exports={UserLogin,UserRegister}