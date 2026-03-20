const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const apiRoutes = require("./routes/api");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(
    "MONGO_URI (or MONGODB_URI) is not set. Use .env locally; on Vercel set it under Project → Environment Variables and redeploy.",
  );
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
    console.warn("Server continuing — will retry DB connection in background.");
  });

app.use(cors());

app.use(express.json());
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API Security Shield backend is running." });
});

// Vercel serverless: export the app (no listen). Local: listen on PORT.
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
