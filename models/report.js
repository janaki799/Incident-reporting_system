// models/report.js
const mongoose = require('mongoose');

// Report Schema
const reportSchema = new mongoose.Schema({
  collegeCode: { type: String, required: true },
  incidentCategory: { type: String, required: true },
  incidentType: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

// Report Model
const Report = mongoose.model('Report', reportSchema);

// Route to handle report submission
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { collegeCode, incidentCategory, incidentType, description } = req.body;
  
  const report = new Report({
    collegeCode,
    incidentCategory,
    incidentType,
    description
  });

  try {
    await report.save();
    res.status(201).json({ message: 'Report submitted successfully!' });
  } catch (error) {
    res.status(400).json({ message: 'Error submitting report', error });
  }
});

module.exports = router;