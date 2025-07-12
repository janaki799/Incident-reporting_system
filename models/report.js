// models/report.js
const mongoose = require('mongoose');

// Report Schema
const reportSchema = new mongoose.Schema({
  collegeCode: { type: String, required: true },
  incidentCategory: { type: String, required: true },
  incidentType: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now },
  localDate: { type: String },
  status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Resolved'],
        default: 'Pending'
    },
});

// Report Model
const Report = mongoose.model('Report', reportSchema);

// Route to handle report submission

module.exports = Report;