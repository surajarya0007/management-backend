const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

/**
 * Cached connection for Vercel serverless: reuse across warm invocations,
 * and always await before any DB operation so Mongoose never buffers until timeout.
 */
function getCache() {
  if (!global._mongooseServerlessCache) {
    global._mongooseServerlessCache = { promise: null };
  }
  return global._mongooseServerlessCache;
}

async function connectDB() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI (or MONGODB_URI) is not set");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const cache = getCache();

  if (!cache.promise) {
    mongoose.set("bufferCommands", false);

    cache.promise = mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5,
      minPoolSize: 0,
    });
  }

  await cache.promise;
  return mongoose.connection;
}

module.exports = { connectDB, MONGO_URI };
