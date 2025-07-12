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
     userEmail: {
        type: String,
        default: null,
        select: false  // Never include in queries unless explicitly requested
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Resolved'],
        default: 'Pending'
    }
});

reportSchema.methods.toJSON = function() {
    const report = this.toObject();
    delete report.userEmail;
    return report;
};
// Report Model
const Report = mongoose.model('Report', reportSchema);

// Route to handle report submission

module.exports = Report;
