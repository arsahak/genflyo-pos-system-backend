const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const saleController = require("../controllers/saleController");

// GET /api/sales/stats/summary - Get sales statistics
router.get("/stats/summary", auth, saleController.getSalesStats);

// POST /api/sales - Create sale
router.post("/", auth, saleController.createSale);

// GET /api/sales - Get all sales
router.get("/", auth, saleController.getAllSales);

// GET /api/sales/:id - Get sale by ID
router.get("/:id", auth, saleController.getSaleById);

// PUT /api/sales/:id - Update sale
router.put("/:id", auth, saleController.updateSale);

// DELETE /api/sales/:id - Delete sale (soft delete)
router.delete("/:id", auth, saleController.deleteSale);

module.exports = router;
