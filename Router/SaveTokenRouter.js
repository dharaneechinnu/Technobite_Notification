const express = require("express");
const router= express.Router();

const {saveToken} =require("../Controller/SaveTokenController")

router.post("/save-push-token",saveToken );


module.exports=router;