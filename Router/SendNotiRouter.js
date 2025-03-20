const express = require("express");
const router=express.Router();

const {sendNotification,SendNotificationToAll, } = require("../Controller/SendNotiController")

router.post("/send-notifications",sendNotification );
router.post("/notify-all-school-users",SendNotificationToAll );




module.exports=router;
