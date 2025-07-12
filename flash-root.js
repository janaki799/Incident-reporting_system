const express = require('express');
const router = express.Router();
const Report = require('../models/report'); // Import the Report model

// Define a POST endpoint for /api/flash
router.post('/reports', (req, res) => {
    const { collegeCode, incidentCategory, incidentType, description, date } = req.body;

    // Log the received data for debugging
    console.log('Received data:', req.body);

    // Validate the incoming data
    if (!collegeCode || !incidentCategory || !incidentType || !description) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Create a new report using the Report model
    const newReport = new Report({
        collegeCode,
        incidentCategory,
        incidentType,
        description,
        date: date ? new Date(date) : new Date()  // Optional date field
    });

    // Save the report to the database
    newReport.save()
        .then((savedReport) => {
            // Send success response with saved report
            res.status(201).json({
                message: 'Report received and saved successfully!',
                report: savedReport
            });
        })
        .catch((err) => {
            // Handle any errors
            console.error('Error saving report:', err);
            res.status(500).json({ error: 'Failed to save the report.' });
        });
});

// Export the router
module.exports = router;
