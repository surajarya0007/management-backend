const mongoose = require("mongoose");

const roleConfigSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true, unique: true, trim: true },
    permissions: [{ type: String }],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RoleConfig", roleConfigSchema);
