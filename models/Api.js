const mongoose = require("mongoose");

const apiSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  endpoint: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  owner: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["Active", "Inactive", "Deprecated"],
    required: true,
  },
  lastScanned: {
    type: Date,
    required: true,
  },
  lastUpdated: {
    type: Date,
  },
  version: {
    type: String,
    required: true,
  },
  creationDate: {
    type: Date,
    required: true,
  },
  securityStatus: {
    type: String,
    enum: ["Secure", "Vulnerable", "Unknown"],
    default: "Unknown",
  },
  documentationUrl: {
    type: String,
  },
  documentation: {
    type: String,
  },
  cvssscore: {
    type: String,
  },
  role: {
    type: String,
    required: true,
  },
  vulnerabilities: [
    {
      description: { type: String },
      severity: { type: String },
      remediation: { type: String },
      status: { type: String },
      discoveredDate: { type: Date },
    },
  ],
  auditLogs: [
    {
      changeDescription: { type: String },
      user: { type: String },
      date: { type: Date },
    },
  ],
});

const Api = mongoose.model("Api", apiSchema);

module.exports = Api;
