const mongoose = require("mongoose");
const { Schema } = mongoose;

const ROLES = ["Admin", "Security Analyst", "Developer", "Analyst", "Tester", "Engineer"];

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ROLES,
    required: true,
  },
  phoneNumber: {
    type: String,
    default: "",
  },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

module.exports = User;
