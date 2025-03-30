require("dotenv").config();
const User = require('../Model/Student');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios'); 
const PushToken = require('../Model/PushToken');



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


const generateParentId = async () => {
    let uniqueId;
    let exists;

    do {
        uniqueId = `P${Math.floor(1000 + Math.random() * 9000)}`; // Generates a 4-digit number prefixed with 'P'
        exists = await PushToken.findOne({ parentId: uniqueId }); // Check if ID already exists
    } while (exists); // Repeat if ID is not unique

    return uniqueId;
};

const registerParent = async (req, res) => {
    try {
        const { name, phoneNumber, password, pushToken } = req.body;

        if (!name || !phoneNumber || !password || !pushToken) {
            return res.status(400).json({ message: "Name, phone number, password, and push token are required." });
        }

        let parent = await PushToken.findOne({ phoneNumber });

        if (parent) {
            parent.name = name;
            parent.pushToken = pushToken; // Update push token
            await parent.save();
        } else {
            const parentId = await generateParentId(); // Generate unique parentId

            const hashedPassword = await bcrypt.hash(password, 10); // Hash the password before saving

            parent = new PushToken({
                parentId, // Set unique 4-digit parentId
                name,
                phoneNumber,
                password: hashedPassword, // Store hashed password
                pushToken,
                students: []
            });
            await parent.save();
        }

        res.status(200).json({ message: "Parent registered successfully.", parent });
    } catch (error) {
        console.error("Error registering parent:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};





const loginParent = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ message: "Phone number is required." });
        }

        const parent = await PushToken.findOne({ phoneNumber });
        if (!parent) {
            return res.status(404).json({ message: "Parent not found. Please register first." });
        }

        res.status(200).json({ message: "Login successful.", parent });
    } catch (error) {
        console.error("Error logging in parent:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

const addStudent = async (req, res) => {
    try {
        const { phoneNumber, studentId, studentName } = req.body;

        if (!phoneNumber || !studentId || !studentName) {
            return res.status(400).json({ message: "Phone number, student ID, and student name are required." });
        }

        let parent = await PushToken.findOne({ phoneNumber });
        if (!parent) {
            return res.status(404).json({ message: "Parent not found. Please register first." });
        }

        // Check if the student already exists
        const studentExists = parent.students.some(s => s.studentId === studentId);
        if (!studentExists) {
            parent.students.push({ studentId, studentName });
            await parent.save();
        }

        res.status(200).json({ message: "Student added successfully.", parent });
    } catch (error) {
        console.error("Error adding student:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

const deleteStudent = async (req, res) => {
    try {
        const { phoneNumber, studentId } = req.body;

        if (!phoneNumber || !studentId) {
            return res.status(400).json({ message: "Phone number and student ID are required." });
        }

        let parent = await ParentPushToken.findOne({ phoneNumber });
        if (!parent) {
            return res.status(404).json({ message: "Parent not found." });
        }

        parent.students = parent.students.filter(student => student.studentId !== studentId);
        await parent.save();

        res.status(200).json({ message: "Student deleted successfully.", parent });
    } catch (error) {
        console.error("Error deleting student:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};



module.exports={registerParent, loginParent, addStudent,deleteStudent }