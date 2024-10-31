// server.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');
const Report = require('./models/report'); // Assuming your report model is here
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static('public'));
// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('connected to MongoDB');
})
.catch((error)=>
console.error('error connecting to MongoDB:', error));


app.get('/reports',( req, res) => {
    res.sendFile(__dirname + '/index.html');
    })

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
    const { collegeCode, incidentCategory, incidentType, description, date } = req.body;
     console.log('Recieved report:', req.body);
    

    if(!collegeCode || !incidentCategory || !incidentType || !description) {
        return res.status(400).send('All fields are required');  // Return error if any field is missing.  // {"conversationId":"588549ad-8b4e-47f5-baac-18999574956f","source":"instruct"}
    }

    const report = new Report({
        collegeCode,
        incidentCategory,
        incidentType,
        description,
        date: date ? new Date(date) : new Date()
    });

    try {
        await report.save();

        // Send email notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send notification to yourself
            subject: 'New Incident Report Submitted',
            text: `A new report has been submitted:\n\n
            College Code: ${collegeCode}\n
            Incident Category: ${incidentCategory}\n
            Incident Type: ${incidentType}\n
            Description: ${description}\n
            Date: ${new Date().toLocaleString()}`//+// {"conversationId":"588549ad-8b4e-47f5-baac-18999574956f","source":"instruct"}
        };

        await transporter.sendMail(mailOptions);
        
        res.status(201).json({ message: 'Report submitted successfully!'});
    } catch (error) {
        console.error('Error submitting report:', error);
        res.status(500).json({ error:'Error submitting report'});
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});