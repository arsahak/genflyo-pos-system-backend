const express = require("express");
const router = express.Router();
const { auth, hasPermission } = require("../midleware/auth");
const dashboardController = require("../controllers/dashboardController");

// GET /api/dashboard/overview - Get dashboard overview data
// Requires authentication + dashboard read permission
router.get("/overview", auth, hasPermission("dashboard", "read"), dashboardController.getDashboardOverview);

// GET /api/dashboard/stats - Get detailed statistics
// Requires authentication + dashboard read permission
router.get("/stats", auth, hasPermission("dashboard", "read"), dashboardController.getDashboardStats);

module.exports = router;
