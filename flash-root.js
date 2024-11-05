// flash-root.js
const express = require('express');
const router = express.Router();

// Define a POST endpoint for /api/flash
router.post('/reports', (req, res) => {
    const { collegeCode, incidentCategory, incidentType, description, date } = req.body;

    // Log the received data for debugging
    console.log('Received data:', req.body);

    // Validate the incoming data
    if (!collegeCode || !incidentCategory || !incidentType || !description) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Process the report here (e.g., save it to the database)+

    // Respond with a success message
    res.status(201).json({
        message: 'Report received successfully!',
        report: {
            collegeCode,
            incidentCategory,
            incidentType,
            description,
            date: date ? new Date(date) : new Date()
        }
    });
});

// Export the router
module.exports = router;