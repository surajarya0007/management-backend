const mongoose = require("mongoose");
const { Schema } = mongoose;

const activityLogSchema = new Schema({
  action: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

module.exports = ActivityLog;
