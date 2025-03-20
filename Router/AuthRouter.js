const express= require("express");
const router = express.Router();

const {UserLogin,UserRegister}=require("../Controller/AuthController")

router.post("/register",UserRegister );
router.post("/login",UserLogin );


module.exports=router;