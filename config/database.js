const mongoose = require("mongoose");

// Mongoose connection caching for serverless
let isConnected = false;

const connectDB = async () => {
  // If already connected, reuse connection
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log("✅ Using existing MongoDB connection");
    return;
  }

  try {
    // Check if MONGO_URI is set
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is not set");
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Optimized for serverless/Vercel deployment
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1, // Maintain at least 1 connection
      maxIdleTimeMS: 10000, // Close connections after 10s of inactivity
    });

    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    isConnected = false;

    // Don't exit in production (Vercel) - let it retry
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    } else {
      // In production, throw the error so the serverless function can report it
      throw error;
    }
  }
};

mongoose.connection.on("connected", () => {
  isConnected = true;
  console.log("MongoDB connection established");
});

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.warn("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  isConnected = false;
  console.error(`MongoDB error: ${err}`);
});

// Handle process termination
process.on("SIGINT", async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log("MongoDB connection closed through app termination");
    process.exit(0);
  }
});

module.exports = connectDB;
