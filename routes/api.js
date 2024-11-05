const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET_KEY = "ABC";

const Admin = require("../models/Admin");
const API = require("../models/Api");
const User = require("../models/User"); // New model
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = jwt.verify(token, SECRET_KEY);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

router.post("/user/signup", async (req, res) => {
  console.log(req.body);
  try {
    const { email, password, role, username, fullname } = req.body;
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new User({
      username,
      fullname,
      email,
      password: hashedPassword,
      role,
  
    });
    await newAdmin.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("User Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("email,password",email,password);

    let user;

    user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(402).json({ message: "Invalid Pasword" });
    }

    const token = jwt.sign({ email: user.email, role: user.role }, SECRET_KEY, {
      expiresIn: "24h",
    });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Existing API routes
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
      creationDate: new Date(),
      version,
      description,
      role,
    });

    await newAPI.save();

    broadcast(newAPI);

    res.status(201).json({
      message: "API added successfully",
      api: newAPI, // Include the newly created API in the response
    });
  } catch (error) {
    console.error("Error adding API:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/:role/api", verifyToken, async (req, res) => {
  try {
    const { role } = req.params;

    console.log("Requested role :", role);

    if (!role) {
      return res.status(400).json({ message: "Role parameter is required" });
    }

    let apis;
    if (role === "Admin") {
      apis = await API.find();
    } else if (role) {
      apis = await API.find({ role });
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }
    return res.status(200).json(apis);
  } catch (error) {
    console.error("Error fetching API:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/api/:apiId", verifyToken, async (req, res) => {
  try {
    const { apiId } = req.params;
    const userRole = req.user.role;
    console.log("user role :" , userRole)
    let apis;
    if(userRole === "Admin"){
      apis = await API.findOne({  _id: apiId });
    }
    else if(userRole){
      apis = await API.findOne({ role: userRole, _id: apiId });
    }
    else {
      return res.status(400).json({ message: "Not authorized" });
    }
    return res.status(200).json(apis);
  } catch (error) {
    console.error("Error fetching API:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// New API routes for users
router.get("/users", verifyToken, async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/users", verifyToken, async (req, res) => {
  try {
    const { email, password, fullName, username, role } = req.body;
    console.log(req.body);
    if (!email || !password || !fullName || !username || !role) {
      return res.status(444).json({ message: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password,
      fullName,
      role,
    });
    await newUser.save();

    broadcast({ type: "userAdded", data: newUser });

    res.status(201).json({ message: "User added successfully", user: newUser });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.put("/users/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
    });

    broadcast({ type: "userUpdated", data: updatedUser });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.delete("/users/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const deletedUser = await User.findByIdAndDelete(userId);

    broadcast({ type: "userDeleted", data: userId });

    res.status(204).end();
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// Broadcast function to send messages to all connected clients
const broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

module.exports = router;
