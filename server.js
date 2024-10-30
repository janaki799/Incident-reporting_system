// server.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const Report = require('./models/report'); // Assuming your report model is here
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Nodemailer setup
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other email services
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Endpoint to submit reports
app.post('/reports', async (req, res) => {
    const { collegeCode, incidentCategory, incidentType, description } = req.body;

    const report = new Report({
        collegeCode,
        incidentCategory,
        incidentType,
        description,
        date: new Date()
    });

    try {
        await report.save();

        // Send email notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send notification to yourself
            subject: 'New Incident Report Submitted',
            text: `A new report has been submitted://+//+
            College Code: ${collegeCode}/
            Incident Category: ${incidentCategory}//+
            Incident Type: ${incidentType}//+
            Description: ${description}//+
            Date: ${new Date()}`//+// {"conversationId":"588549ad-8b4e-47f5-baac-18999574956f","source":"instruct"}
        };

        await transporter.sendMail(mailOptions);
        
        res.status(200).send('Report submitted successfully!');
    } catch (error) {
        console.error('Error submitting report:', error);
        res.status(500).send('Error submitting report');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});