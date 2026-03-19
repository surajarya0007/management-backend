const mongoose = require("mongoose");

const scanSchema = new mongoose.Schema({
  scanDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  apiName: {
    type: String,
    required: true,
  },
  results: {
    type: String,
    enum: ["Success", "Failed", "In Progress"],
    default: "In Progress",
  },
  vulnerabilitiesDetected: {
    type: Number,
    default: 0,
  },
  frequency: {
    type: String,
    enum: ["Daily", "Weekly", "Monthly", "Manual"],
    default: "Manual",
  },
  typesOfChecks: {
    type: [String],
    default: [],
  },
  createdBy: {
    type: String,
    required: true,
  },
}, { timestamps: true });

const Scan = mongoose.model("Scan", scanSchema);

module.exports = Scan;
