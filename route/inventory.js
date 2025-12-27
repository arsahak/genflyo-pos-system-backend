const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const inventoryController = require("../controllers/inventoryController");

// GET /api/inventory/stats/summary - Get inventory statistics
router.get("/stats/summary", auth, inventoryController.getInventoryStats);

// GET /api/inventory/alerts/low-stock - Get low stock items
router.get("/alerts/low-stock", auth, inventoryController.getLowStockItems);

// GET /api/inventory - Get all inventory
router.get("/", auth, inventoryController.getAllInventory);

// POST /api/inventory/adjust - Adjust inventory
router.post("/adjust", auth, inventoryController.adjustInventory);

// POST /api/inventory/adjust/batch - Batch adjust inventory
router.post("/adjust/batch", auth, inventoryController.batchAdjustInventory);

// POST /api/inventory/transfer - Transfer inventory between stores
router.post("/transfer", auth, inventoryController.transferInventory);

// GET /api/inventory/:storeId - Get inventory by store (legacy support)
router.get("/:storeId", auth, inventoryController.getInventoryByStore);

// PUT /api/inventory/:id - Update inventory
router.put("/:id", auth, inventoryController.updateInventory);

// DELETE /api/inventory/:id - Delete inventory entry
router.delete("/:id", auth, inventoryController.deleteInventory);

module.exports = router;
