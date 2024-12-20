const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const Report = require('./models/report');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
    'https://frontend-8ecmtkquq-janaki799s-projects.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
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
        const { collegeCode, incidentCategory, incidentType, description, date } = req.body;

        if (!collegeCode || !incidentCategory || !incidentType || !description) {
            return res.status(400).json({
                error: 'Missing required fields',
                requiredFields: ['collegeCode', 'incidentCategory', 'incidentType', 'description']
            });
        }

        const report = new Report({
            collegeCode,
            incidentCategory,
            incidentType,
            description,
            date: date || new Date()
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
                    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
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




