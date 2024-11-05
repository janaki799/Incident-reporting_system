const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const flashRoutes = require('./flash-root');
const nodemailer = require('nodemailer');
const cors = require('cors');
const Report = require('./models/report');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging function
const logInfo = (location, message, data = {}) => {
    console.log(`[${new Date().toISOString()}] ${location}:`, message, data);
};

const logError = (location, error) => {
    console.error(`[${new Date().toISOString()}] Error in ${location}:`, {
        message: error.message,
        stack: error.stack
    });
};

// Updated CORS configuration
const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = [
            'https://my-frontenf-server.onrender.com',  // Production frontend
            'http://127.0.0.1:5500',                    // Local development
            'http://localhost:5500'                     // Alternative local
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logInfo('CORS', `Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
    maxAge: 86400
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB connection with retry logic
const connectToMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            retryWrites: true
        });
        logInfo('MongoDB', 'Connected successfully');
    } catch (error) {
        logError('MongoDB Connection', error);
        setTimeout(connectToMongoDB, 5000);
    }
};

connectToMongoDB();

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify email configuration
transporter.verify((error, success) => {
    if (error) {
        logError('Email Configuration', error);
    } else {
        logInfo('Email', 'Server is ready to send emails');
    }
});

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the Reporting API!');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'up',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Reports endpoint
app.post('/reports', async (req, res) => {
    logInfo('Reports', 'Received new report request', { body: req.body });

    const { collegeCode, incidentCategory, incidentType, description, date } = req.body;

    // Validation
    if (!collegeCode || !incidentCategory || !incidentType || !description) {
        return res.status(400).json({
            error: 'Missing required fields',
            requiredFields: ['collegeCode', 'incidentCategory', 'incidentType', 'description']
        });
    }

    try {
        // Create and save report
        const report = new Report({
            collegeCode,
            incidentCategory,
            incidentType,
            description,
            date: date ? new Date(date) : new Date()
        });

        await report.save();
        logInfo('Reports', 'Report saved successfully', { id: report._id });

        // Send email notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'New Incident Report Submitted',
            html: `
                <h2>New Report Details:</h2>
                <p><strong>ID:</strong> ${report._id}</p>
                <p><strong>College Code:</strong> ${collegeCode}</p>
                <p><strong>Category:</strong> ${incidentCategory}</p>
                <p><strong>Type:</strong> ${incidentType}</p>
                <p><strong>Description:</strong> ${description}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                <hr>
                <p><small>Environment: ${process.env.NODE_ENV || 'development'}</small></p>
            `
        };

        await transporter.sendMail(mailOptions);
        logInfo('Email', 'Notification sent successfully');

        res.status(201).json({
            message: 'Report submitted successfully!',
            reportId: report._id,
            emailSent: true
        });
    } catch (error) {
        logError('Report Submission', error);
        res.status(500).json({
            error: 'Error submitting report',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Use flash routes
app.use('/api/flash', flashRoutes);

// Global error handler
app.use((err, req, res, next) => {
    logError('Global', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

app.listen(PORT, () => {
    logInfo('Server', `Running on port ${PORT}`);
    logInfo('Environment', process.env.NODE_ENV || 'development');
});





