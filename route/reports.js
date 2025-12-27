const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const reportController = require("../controllers/reportController");

// ==================== SALES REPORTS ====================

// GET /api/reports/sales - Sales Overview Report
router.get("/sales", auth, reportController.getSalesReport);

// GET /api/reports/sales/by-product - Sales by Product Report
router.get("/sales/by-product", auth, reportController.getSalesByProduct);

// ==================== FINANCIAL REPORTS ====================

// GET /api/reports/financial - Financial Overview Report
router.get("/financial", auth, reportController.getFinancialReport);

// GET /api/reports/financial/profit-loss - Profit & Loss Report
router.get("/financial/profit-loss", auth, reportController.getProfitLossReport);

// ==================== CUSTOMER REPORTS ====================

// GET /api/reports/customers - Customer Overview Report
router.get("/customers", auth, reportController.getCustomerReport);

// GET /api/reports/customers/retention - Customer Retention Report
router.get("/customers/retention", auth, reportController.getCustomerRetentionReport);

// ==================== INVENTORY REPORTS ====================

// GET /api/reports/inventory - Inventory Overview Report
router.get("/inventory", auth, reportController.getInventoryReport);

// GET /api/reports/inventory/movement - Stock Movement Report
router.get("/inventory/movement", auth, reportController.getStockMovementReport);

module.exports = router;
