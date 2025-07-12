const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const Report = require('./models/report');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    'https://my-frontenf-server.onrender.com',
    'http://localhost:3001',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
    maxAge: 86400
}));

app.use(bodyParser.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected Successfully');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
}

connectDB();

mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: true
    }
});

transporter.verify(function(error, success) {
    if (error) {
        console.log('Email configuration error:', error);
    } else {
        console.log("Email server is ready");
    }
});

/**
 * Handles the '/health' GET request to check the server's health.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @returns {void}
 */
app.get('/health', async (req, res) => {
    try {
        const dbState = mongoose.connection.readyState;
        const dbStatus = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            mongodb: dbStatus[dbState] || 'unknown',
            environment: process.env.NODE_ENV
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.send('Incident Reporting API is running');
});

app.post('/reports', async (req, res) => {
    try {
         const { collegeCode, incidentCategory, incidentType, description, date, userEmail } = req.body;

        if (!collegeCode || !incidentCategory || !incidentType || !description) {
            return res.status(400).json({
                error: 'Missing required fields',
                requiredFields: ['collegeCode', 'incidentCategory', 'incidentType', 'description']
            });
        }

         const indianTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

        const report = new Report({
            collegeCode,
            incidentCategory,
            incidentType,
            description,
            date: new Date(date),
            localDate: indianTime,
             userEmail: userEmail || null,  // Store email only if provided
            status: 'Pending'  // Default status        });
        });
        await report.save();

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: 'New Incident Report',
                html: `
                     <h2>New Incident Report</h2>
    <p><strong>College Code:</strong> ${collegeCode}</p>
    <p><strong>Category:</strong> ${incidentCategory}</p>
    <p><strong>Type:</strong> ${incidentType}</p>
    <p><strong>Description:</strong> ${description}</p>
    <p><strong>Date:</strong> ${new Date(date).toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',  // Use Indian timezone
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    })}</p>
    `
 });           
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Report submitted successfully',
            reportId: report._id
        });
    } catch (error) {
        console.error('Report submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting report',
            error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
        });
    }
});

// Basic route protection (add before dashboard routes)
app.get('/admin*', (req, res, next) => {
    const SECRET_KEY = process.env.ADMIN_KEY || "temp123";
    if (req.query.key !== SECRET_KEY) {
        return res.status(403).send("Access denied");
    }
    next();
});
// Get all reports (with filtering)
app.get('/admin/reports', async (req, res) => {
    try {
        const { status, category, sortBy } = req.query;
        let query = {};

        if (status) query.status = status;
        if (category) query.incidentCategory = category;

        let reports = await Report.find(query);

        // Sorting (default: newest first)
        if (sortBy === 'oldest') {
            reports.sort((a, b) => a.date - b.date);
        } else {
            reports.sort((a, b) => b.date - a.date);
        }

        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch reports" });
    }
});

app.put('/admin/reports/:id', async (req, res) => {
    try {
        const { status } = req.body;
        
        // 1. FIRST find the report WITH email included
        const report = await Report.findById(req.params.id).select('+userEmail');
        
        if (!report) {
            return res.status(404).json({ success: false, error: "Report not found" });
        }

        // 2. THEN update it
        report.status = status;
        await report.save();

        // 3. Send email if user provided one
        if (report.userEmail) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: report.userEmail,
                    subject: 'Your Report Status Update',
                    html: `
                        <p>Hi,</p>
                        <p>The report you submitted has been marked as <strong>${status}</strong>.</p>
                        <p>Thank you for helping improve our campus!</p>
                        <p><em>This is an automated message. Please do not reply.</em></p>
                    `
                });
                console.log(`Status update email sent to: ${report.userEmail}`); // Log success
            } catch (emailError) {
                console.error('Failed to send status email:', emailError); // Log failure
            }
        }

        // 4. Return the report WITHOUT email
        const responseReport = report.toObject();
        delete responseReport.userEmail;
        res.json({ success: true, report: responseReport });

    } catch (error) {
        console.error('Status update failed:', error);
        res.status(500).json({ success: false, error: "Failed to update report" });
    }
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Environment:', process.env.NODE_ENV);
});
