// Required Dependencies
require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Middleware Setup
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// CORS Setup
app.use(cors({
    origin: [
        'https://my-frontenf-server.onrender.com', // Production frontend
        'http://127.0.0.1:5500',                  // Local development
        'http://localhost:5500'                   // Alternate local development
    ],
    methods: ['GET', 'POST'], // Allowed HTTP methods
    credentials: true          // Include credentials in requests if necessary
}));

app.use('/uploads', express.static(uploadsDir)); // Serve uploaded files

// File Upload Setup (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => {
        console.error("MongoDB connection error:", err);
        process.exit(1); // Exit the process if DB connection fails
    });

// Define the Report Schema
const reportSchema = new mongoose.Schema({
    collegeCode: { type: String, required: true },
    incidentCategory: { type: String, required: true },
    incidentType: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: false },
    timestamp: { type: String, required: true }
});
const Report = mongoose.model('Report', reportSchema);

// Nodemailer Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// POST Route to Submit a Report
app.post('/reports', upload.single('image'), async (req, res) => {
    const { collegeCode, incidentCategory, incidentType, description, timestamp } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        // Save Report to MongoDB
        const newReport = new Report({
            collegeCode,
            incidentCategory,
            incidentType,
            description,
            image,
            timestamp
        });
        await newReport.save();

        // Construct Email Message
        let emailBody = `<p>New incident report submitted:</p>
            <ul>
                <li><strong>College Code:</strong> ${collegeCode}</li>
                <li><strong>Category:</strong> ${incidentCategory}</li>
                <li><strong>Type:</strong> ${incidentType}</li>
                <li><strong>Description:</strong> ${description}</li>
                <li><strong>Time:</strong> ${timestamp}</li>
            </ul>`;

        if (image) {
            const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${path.basename(req.file.path)}`;
            emailBody += `<p><strong>Image:</strong> <a href="${imageUrl}">${imageUrl}</a></p>`;
        }

        // Send Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Change if sending to another recipient
            subject: 'New Incident Report Submitted',
            html: emailBody
        };

        await transporter.sendMail(mailOptions);

        // Respond with success
        res.status(200).json({ message: 'Report submitted and email notification sent!' });
    } catch (error) {
        console.error('Error saving report or sending email:', error);
        res.status(500).json({ error: 'Failed to save report or send notification.' });
    }
});

// Test Endpoint (Optional for Debugging)
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


