const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const barcodeController = require("../controllers/barcodeController");

// POST /api/barcodes/generate - Generate new unique barcode
router.post("/generate", auth, barcodeController.generateBarcode);

// POST /api/barcodes/check - Check if barcode is duplicate
router.post("/check", auth, barcodeController.checkDuplicate);

// POST /api/barcodes - Create new barcode
router.post("/", auth, barcodeController.createBarcode);

// GET /api/barcodes - Get all barcodes
router.get("/", auth, barcodeController.getAllBarcodes);

// GET /api/barcodes/:id - Get barcode by ID
router.get("/:id", auth, barcodeController.getBarcodeById);

// PATCH /api/barcodes/:id - Update barcode (activate/deactivate)
router.patch("/:id", auth, barcodeController.updateBarcode);

// DELETE /api/barcodes/:id - Delete barcode
router.delete("/:id", auth, barcodeController.deleteBarcode);

module.exports = router;
