require("dotenv").config();

// Validate required environment variables on startup
const requiredEnvVars = {
  MONGO_URI: "Database connection string",
  JWT_SECRET: "JWT authentication secret",
  // IMAGEBB_API_KEY is optional but recommended for image uploads
};

const optionalEnvVars = {
  IMAGEBB_API_KEY: "Image upload functionality (optional but recommended)",
};

// Check required variables
for (const [key, description] of Object.entries(requiredEnvVars)) {
  if (!process.env[key]) {
    console.warn(`⚠️  Warning: ${key} is not set - ${description}`);
  }
}

// Check optional but recommended variables
for (const [key, description] of Object.entries(optionalEnvVars)) {
  if (!process.env[key]) {
    console.warn(`⚠️  Warning: ${key} is not set - ${description}`);
    console.warn(
      `   Image uploads will fail without this. Add it to your .env file.`
    );
  } else {
    console.log(`✅ ${key} is configured`);
  }
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const connectDB = require("./config/database");

// Import routes
const authRoutes = require("./route/auth");
const roleRoutes = require("./route/roles");
const productRoutes = require("./route/products");
const categoryRoutes = require("./route/categories");
const brandRoutes = require("./route/brands");
const inventoryRoutes = require("./route/inventory");
const salesRoutes = require("./route/sales");
const orderRoutes = require("./route/orders");
const customerRoutes = require("./route/customers");
const reportRoutes = require("./route/reports");
const storeRoutes = require("./route/stores");
const userRoutes = require("./route/users");
const settingsRoutes = require("./route/settings");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
// Note: Socket.IO doesn't work well with Vercel serverless functions
// For production on Vercel, consider using a separate WebSocket service or polling
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Additional config for serverless
  transports:
    process.env.NODE_ENV === "production"
      ? ["polling"]
      : ["websocket", "polling"],
});

// Connect to MongoDB
connectDB();

// Middlewares
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));

// CORS Configuration - Allow multiple origins for production and development
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.includes("*")
      ) {
        callback(null, true);
      } else {
        // In production, be more lenient if CORS_ORIGIN is not properly set
        if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGIN) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Rate limiting - Increased for POS system that makes multiple API calls
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // limit each IP to 200 requests per minute (allows multiple simultaneous operations)
  message: "Too many requests, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for local development
  skip: (req) => {
    // Skip in development environment
    if (process.env.NODE_ENV !== "production") {
      return (
        req.ip === "::1" ||
        req.ip === "127.0.0.1" ||
        req.ip === "::ffff:127.0.0.1"
      );
    }
    return false;
  },
});
app.use("/api/", limiter);

// Welcome Route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to POS Software API",
    status: "Running",
    version: "1.0.0",
  });
});

// Health check with database status
app.get("/health", async (req, res) => {
  const mongoose = require("mongoose");
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const isHealthy = mongoose.connection.readyState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "OK" : "ERROR",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: dbStatus,
    environment: process.env.NODE_ENV || "development",
  });
});

// Swagger API Documentation
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "POS API Documentation",
  })
);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join-store", (storeId) => {
    socket.join(`store-${storeId}`);
    console.log(`Socket ${socket.id} joined store-${storeId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Attach io to app for use in routes
app.set("io", io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// For Vercel deployment, export the app
// For local development, start the server
if (process.env.NODE_ENV !== "production" && require.main === module) {
  const PORT = process.env.PORT || 8000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  });
}

// Export app for Vercel serverless
module.exports = app;
