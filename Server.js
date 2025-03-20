require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const app = express();



app.use(cors());
app.use(express.json());

app.use("/Auth",require("./Router/AuthRouter"));
app.use("/token",require("./Router/SaveTokenRouter"));
app.use("/notification",require("./Router/SendNotiRouter"));

mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1); // Exit the process if DB connection fails
    });



const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;