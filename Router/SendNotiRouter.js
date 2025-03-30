const express = require("express");
const router=express.Router();

const {sendNotification,SendNotificationToAll,sendFCMNotificationToParent } = require("../Controller/SendNotiController")

router.post("/send-notifications",sendNotification );
router.post("/notify-all-school-users",SendNotificationToAll );
router.post("/notify",sendFCMNotificationToParent );



module.exports=router;
