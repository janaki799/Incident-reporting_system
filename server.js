const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const flashRoutes = require('./flash-root');
const twilio = require('twilio');
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
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://my-frontenf-server.onrender.com',
            'http://127.0.0.1:5500',
            'http://localhost:5500'
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

// Initialize Twilio client using your credentials
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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

        // Prepare the message body
        const messageBody = `
            New Report Details:
            ID: ${report._id}
            College Code: ${collegeCode}
            Category: ${incidentCategory}
            Type: ${incidentType}
            Description: ${description}
            Date: ${new Date().toLocaleString()}
        `;

        // Send SMS notifications to all phone numbers
        const phoneNumbers = process.env.NOTIFY_PHONE_NUMBERS.split(','); // Comma-separated numbers
        const sentMessages = [];

        for (const number of phoneNumbers) {
            try {
                const messageSent = await client.messages.create({
                    body: messageBody,
                    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
                    to: number.trim()
                });
                sentMessages.push({ number: number.trim(), sid: messageSent.sid });
                logInfo('Twilio', `SMS sent successfully to ${number.trim()}`, { messageSid: messageSent.sid });
            } catch (smsError) {
                logError(`Twilio SMS to ${number.trim()}`, smsError);
            }
        }

        res.status(201).json({
            message: 'Report submitted successfully!',
            reportId: report._id,
            smsSent: sentMessages.length > 0
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




