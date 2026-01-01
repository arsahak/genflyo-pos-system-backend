const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const dashboardController = require("../controllers/dashboardController");

// GET /api/dashboard/overview - Get dashboard overview data
router.get("/overview", auth, dashboardController.getDashboardOverview);

// GET /api/dashboard/stats - Get detailed statistics
router.get("/stats", auth, dashboardController.getDashboardStats);

module.exports = router;
