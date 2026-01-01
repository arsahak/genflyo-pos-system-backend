const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const supplierController = require("../controllers/supplierController");

// GET /api/suppliers - Get all suppliers with search and filter
router.get("/", auth, supplierController.getAllSuppliers);

// GET /api/suppliers/stats - Get supplier statistics
router.get("/stats", auth, supplierController.getSupplierStats);

// GET /api/suppliers/:id - Get supplier by ID
router.get("/:id", auth, supplierController.getSupplierById);

// POST /api/suppliers - Create new supplier
router.post("/", auth, supplierController.createSupplier);

// PUT /api/suppliers/:id - Update supplier
router.put("/:id", auth, supplierController.updateSupplier);

// DELETE /api/suppliers/:id - Soft delete supplier
router.delete("/:id", auth, supplierController.deleteSupplier);

// DELETE /api/suppliers/:id/permanent - Permanently delete supplier
router.delete("/:id/permanent", auth, supplierController.permanentDeleteSupplier);

// PUT /api/suppliers/:id/restore - Restore deleted supplier
router.put("/:id/restore", auth, supplierController.restoreSupplier);

module.exports = router;
