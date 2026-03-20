const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const https = require("https");

const SECRET_KEY = process.env.JWT_SECRET || "ABC";

const API = require("../models/Api");
const User = require("../models/User");
const Scan = require("../models/Scan");
const RoleConfig = require("../models/RoleConfig");
const { ensureRoleConfigs } = require("../utils/roleConfigSeed");

// ─── Endpoint Connectivity Check ──────────────────────────────────────────────

const checkEndpoint = (rawUrl, timeoutMs = 6000) => {
  return new Promise((resolve) => {
    try {
      let url = rawUrl.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      const lib = url.startsWith("https://") ? https : http;
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        const reachable = res.statusCode < 500;
        res.resume();
        resolve({ reachable, statusCode: res.statusCode });
      });
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve({ reachable: false, statusCode: 0, reason: "Timed out" });
      });
      req.on("error", (err) => {
        resolve({ reachable: false, statusCode: 0, reason: err.message });
      });
    } catch (err) {
      resolve({ reachable: false, statusCode: 0, reason: err.message });
    }
  });
};

// ─── Middleware ────────────────────────────────────────────────────────────────

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Forbidden: Admin only" });
  }
  next();
};

// ─── Auth ──────────────────────────────────────────────────────────────────────

router.post("/user/signup", async (req, res) => {
  try {
    const { email, password, role, username, fullname } = req.body;

    if (!email || !password || !role || !username || !fullname) {
      return res.status(400).json({ message: "All fields are required" });
    }

    await ensureRoleConfigs();
    const roleDoc = await RoleConfig.findOne({ roleName: role.trim() });
    if (!roleDoc) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, fullName: fullname, email, password: hashedPassword, role });
    await newUser.save();

    const token = jwt.sign(
      { email: newUser.email, role: newUser.role, username: newUser.username },
      SECRET_KEY,
      { expiresIn: "24h" }
    );

    res.status(201).json({ message: "User registered successfully", token });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role, username: user.username },
      SECRET_KEY,
      { expiresIn: "24h" }
    );

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Roles (public names for signup) & Role config (Admin) ─────────────────────

router.get("/roles", async (req, res) => {
  try {
    await ensureRoleConfigs();
    const list = await RoleConfig.find().sort({ roleName: 1 }).select("roleName").lean();
    res.status(200).json({ roles: list.map((r) => r.roleName) });
  } catch (error) {
    console.error("Error listing roles:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/role-configs", verifyToken, requireAdmin, async (req, res) => {
  try {
    await ensureRoleConfigs();
    const configs = await RoleConfig.find().sort({ roleName: 1 }).lean();
    res.status(200).json(configs);
  } catch (error) {
    console.error("Error fetching role configs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/role-configs", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { roleName, permissions } = req.body;
    const name = (roleName || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }
    const existing = await RoleConfig.findOne({ roleName: name });
    if (existing) {
      return res.status(400).json({ message: "A role with this name already exists" });
    }
    const doc = await RoleConfig.create({
      roleName: name,
      permissions: Array.isArray(permissions) ? permissions : [],
      isSystem: false,
    });
    res.status(201).json(doc);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.put("/role-configs", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { roleName, permissions } = req.body;
    const name = (roleName || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: "permissions must be an array" });
    }
    const updated = await RoleConfig.findOneAndUpdate(
      { roleName: name },
      { $set: { permissions } },
      { new: true, runValidators: true },
    );
    if (!updated) {
      return res.status(404).json({ message: "Role not found" });
    }
    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.delete("/role-configs", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { roleName } = req.body;
    const name = (roleName || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }
    const doc = await RoleConfig.findOne({ roleName: name });
    if (!doc) {
      return res.status(404).json({ message: "Role not found" });
    }
    if (doc.isSystem) {
      return res.status(403).json({ message: "System roles cannot be deleted" });
    }
    const usersWithRole = await User.countDocuments({ role: name });
    if (usersWithRole > 0) {
      return res.status(400).json({
        message: `Cannot delete role: ${usersWithRole} user(s) still have this role. Reassign them first.`,
      });
    }
    await RoleConfig.deleteOne({ _id: doc._id });
    res.status(204).end();
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── API Inventory ─────────────────────────────────────────────────────────────

router.post("/api/add", verifyToken, async (req, res) => {
  try {
    const { name, endpoint, owner, status, version, description, role } = req.body;

    if (!name || !endpoint || !owner || !status || !version || !description || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newAPI = new API({
      name,
      endpoint,
      owner,
      status,
      lastScanned: new Date(),
      lastUpdated: new Date(),
      creationDate: new Date(),
      version,
      description,
      role,
      securityStatus: "Unknown",
    });

    await newAPI.save();

    res.status(201).json({ message: "API added successfully", api: newAPI });
  } catch (error) {
    console.error("Error adding API:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/:role/api", verifyToken, async (req, res) => {
  try {
    // Use role from verified JWT, not URL param (prevents privilege escalation)
    const role = req.user.role;

    let apis;
    if (role === "Admin") {
      apis = await API.find();
    } else {
      apis = await API.find({ role });
    }
    return res.status(200).json(apis);
  } catch (error) {
    console.error("Error fetching APIs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/api/:apiId", verifyToken, async (req, res) => {
  try {
    const { apiId } = req.params;
    const userRole = req.user.role;

    let api;
    if (userRole === "Admin") {
      api = await API.findById(apiId);
    } else {
      api = await API.findOne({ _id: apiId, role: userRole });
    }

    if (!api) {
      return res.status(404).json({ message: "API not found" });
    }

    return res.status(200).json(api);
  } catch (error) {
    console.error("Error fetching API:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/api/:apiId", verifyToken, async (req, res) => {
  try {
    const { apiId } = req.params;
    const userRole = req.user.role;
    const { name, endpoint, description, owner, status, version, lastScanned } = req.body;

    const query = userRole === "Admin" ? { _id: apiId } : { _id: apiId, role: userRole };

    const updated = await API.findOneAndUpdate(
      query,
      { name, endpoint, description, owner, status, version, lastScanned, lastUpdated: new Date() },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "API not found" });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating API:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.delete("/api/:apiId", verifyToken, async (req, res) => {
  try {
    const { apiId } = req.params;
    const userRole = req.user.role;

    const query = userRole === "Admin" ? { _id: apiId } : { _id: apiId, role: userRole };
    const deleted = await API.findOneAndDelete(query);

    if (!deleted) {
      return res.status(404).json({ message: "API not found" });
    }

    res.status(204).end();
  } catch (error) {
    console.error("Error deleting API:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── Profile (current user) — MUST be before /users/:userId ──────────────────

router.get("/users/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/users/me/password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/users/me", verifyToken, async (req, res) => {
  try {
    const { fullName, email, phoneNumber, username } = req.body;

    const updated = await User.findOneAndUpdate(
      { email: req.user.email },
      { fullName, email, phoneNumber, username },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── User Management (Admin only) — after /users/me to avoid param conflict ───

router.get("/users", verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/users", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, fullName, username, role } = req.body;

    if (!email || !password || !fullName || !username || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    await ensureRoleConfigs();
    const roleDoc = await RoleConfig.findOne({ roleName: role.trim() });
    if (!roleDoc) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ message: "User with this email or username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword, fullName, role });
    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({ message: "User added successfully", user: userResponse });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.put("/users/:userId", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, fullName, email, role } = req.body;

    if (role) {
      await ensureRoleConfigs();
      const roleDoc = await RoleConfig.findOne({ roleName: role.trim() });
      if (!roleDoc) {
        return res.status(400).json({ message: "Invalid role" });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, fullName, email, role },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.delete("/users/:userId", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const deleted = await User.findByIdAndDelete(userId);

    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(204).end();
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─── OWASP Scans ───────────────────────────────────────────────────────────────

router.get("/scans", verifyToken, async (req, res) => {
  try {
    const role = req.user.role;
    const scans = role === "Admin"
      ? await Scan.find().sort({ createdAt: -1 })
      : await Scan.find({ createdBy: req.user.email }).sort({ createdAt: -1 });

    res.status(200).json(scans);
  } catch (error) {
    console.error("Error fetching scans:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/scans", verifyToken, async (req, res) => {
  try {
    const { frequency, typesOfChecks } = req.body;
    const userRole = req.user.role;

    // Fetch all APIs this user can access
    const apis = userRole === "Admin"
      ? await API.find()
      : await API.find({ role: userRole });

    if (apis.length === 0) {
      return res.status(200).json({ message: "No APIs registered to scan", scans: [] });
    }

    // Check all endpoints in parallel
    const checkResults = await Promise.all(
      apis.map(async (api) => {
        const result = await checkEndpoint(api.endpoint);
        return { api, ...result };
      })
    );

    const scanDocs = [];

    for (const { api, reachable, statusCode, reason } of checkResults) {
      const failed = !reachable;

      // Create one scan record per API
      const scan = new Scan({
        scanDate: new Date(),
        apiName: api.name,
        results: failed ? "Failed" : "Success",
        vulnerabilitiesDetected: failed ? 1 : 0,
        frequency: frequency || "Manual",
        typesOfChecks: typesOfChecks || [],
        createdBy: req.user.email,
      });
      await scan.save();
      scanDocs.push(scan);

      // Build the API update
      const apiUpdate = {
        $set: {
          securityStatus: failed ? "Vulnerable" : "Secure",
          lastScanned: new Date(),
        },
      };

      // Add an Open vulnerability entry only if the API isn't already marked Vulnerable
      // (avoids duplicate entries on repeated scans)
      if (failed && api.securityStatus !== "Vulnerable") {
        apiUpdate.$push = {
          vulnerabilities: {
            description: `Endpoint unreachable — ${reason || `HTTP ${statusCode}`}`,
            severity: "High",
            remediation: "Verify the API endpoint URL is correct and the service is running.",
            status: "Open",
            discoveredDate: new Date(),
          },
        };
      }

      await API.findByIdAndUpdate(api._id, apiUpdate);
    }

    res.status(201).json({ message: "Scan completed", scans: scanDocs });
  } catch (error) {
    console.error("Error running scan:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
