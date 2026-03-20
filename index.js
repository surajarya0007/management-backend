const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/api");
const { ensureRoleConfigs } = require("./utils/roleConfigSeed");
const { connectDB, MONGO_URI } = require("./utils/connectDB");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

if (!MONGO_URI && !process.env.VERCEL) {
  console.error(
    "MONGO_URI (or MONGODB_URI) is not set. Use .env locally; on Vercel set it under Project → Environment Variables and redeploy.",
  );
  process.exit(1);
}

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());

// Vercel serverless: MongoDB is not connected when the module loads — await before every /api request
let roleConfigsSeeded = false;
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    if (!roleConfigsSeeded) {
      roleConfigsSeeded = true;
      try {
        await ensureRoleConfigs();
      } catch (e) {
        console.error("Role config seed error:", e.message);
      }
    }
    next();
  } catch (err) {
    console.error("Database connection error:", err.message);
    return res.status(503).json({
      message:
        "Database unavailable. Set MONGO_URI on Vercel, and in MongoDB Atlas allow Network Access for 0.0.0.0/0 (or Vercel).",
    });
  }
});

app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API Security Shield backend is running." });
});

// Vercel serverless: export the app (no listen). Local: connect then listen
if (process.env.VERCEL) {
  module.exports = app;
} else {
  connectDB()
    .then(async () => {
      console.log("Connected to MongoDB");
      try {
        await ensureRoleConfigs();
        roleConfigsSeeded = true;
      } catch (e) {
        console.error("Role config seed error:", e.message);
      }
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
      process.exit(1);
    });
}
