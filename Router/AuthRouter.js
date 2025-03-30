const express= require("express");
const router = express.Router();

const { registerParent, loginParent, addStudent,deleteStudent }=require("../Controller/AuthController")

router.post('/register', registerParent);
router.post('/login', loginParent);
router.post('/add-student', addStudent);
router.post('/delete-student', deleteStudent);


module.exports=router;