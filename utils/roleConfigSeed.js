const RoleConfig = require("../models/RoleConfig");

const DEFAULT_ROLES = [
  {
    roleName: "Admin",
    permissions: ["All Permissions", "View Scans", "Manage APIs", "Add APIs", "View Reports", "User Management", "Settings"],
    isSystem: true,
  },
  {
    roleName: "Security Analyst",
    permissions: ["View Scans", "Manage APIs", "View Reports"],
    isSystem: true,
  },
  {
    roleName: "Developer",
    permissions: ["Add APIs", "View Reports", "View Scans"],
    isSystem: true,
  },
  {
    roleName: "Analyst",
    permissions: ["View Scans", "View Reports"],
    isSystem: true,
  },
  {
    roleName: "Tester",
    permissions: ["View Scans", "Add APIs"],
    isSystem: true,
  },
  {
    roleName: "Engineer",
    permissions: ["Manage APIs", "Add APIs", "View Reports"],
    isSystem: true,
  },
];

async function ensureRoleConfigs() {
  for (const def of DEFAULT_ROLES) {
    await RoleConfig.updateOne(
      { roleName: def.roleName },
      { $setOnInsert: { permissions: def.permissions, isSystem: def.isSystem } },
      { upsert: true },
    );
  }
}

module.exports = { ensureRoleConfigs, DEFAULT_ROLES };
