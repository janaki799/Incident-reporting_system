const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const flashRoutes = require('./flash-root'); // Ensure this is pointing to the correct file
const nodemailer = require('nodemailer');
const cors = require('cors');
const Report = require('./models/report'); // Assuming your report model is here
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: 'https://my-frontenf-server.onrender.com' }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to MongoDB');
})
.catch((error) =>
    console.error('Error connecting to MongoDB:', error)
);

// Nodemailer setup
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other email services
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Endpoint to test email functionality
app.get('/test-email', async (req, res) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Change to your email for testing
        subject: 'Test Email',
        text: 'This is a test email to check if Nodemailer is working.'
    };

    try {
        await transporter.sendMail(mailOptions);
        res.send('Test email sent!');
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).send('Failed to send test email');
    }
});

// Endpoint to submit reports
app.post('/reports', async (req, res) => { 
    const { collegeCode, incidentCategory, incidentType, description, date } = req.body;
    console.log('Received report:', req.body);

    if (!collegeCode || !incidentCategory || !incidentType || !description) {
        return res.status(400).send('All fields are required'); // Return error if any field is missing.
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
            Date: ${new Date().toLocaleString()}`
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully'); // Log email sent status
        res.status(201).json({ message: 'Report submitted successfully!' });
    } catch (error) {
        console.error('Error submitting report:', error); // Log report submission error
        res.status(500).json({ error: 'Error submitting report' });
    }
});

// Use the flash routes
app.use('/api/flash', flashRoutes);
console.log('Received POST request at /api/flash');

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});