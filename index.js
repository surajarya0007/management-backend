const { jwt } = require("jsonwebtoken");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const apiRoutes = require("./routes/api");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  "mongodb+srv://aryasuraj351:7BnvdHY5olKiB2YZ@cluster0.ldd7x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

app.use(cors());
app.use(express.json());
app.use("/api", apiRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
