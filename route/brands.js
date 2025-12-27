const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const brandController = require("../controllers/brandController");

// GET /api/brands/stats - Get brand statistics
router.get("/stats", auth, brandController.getBrandStats);

// GET /api/brands - Get all brands with pagination, search, and filters
router.get("/", auth, brandController.getAllBrands);

// GET /api/brands/:id - Get brand by ID
router.get("/:id", auth, brandController.getBrandById);

// POST /api/brands - Create a new brand
router.post("/", auth, brandController.createBrand);

// PUT /api/brands/:id - Update brand
router.put("/:id", auth, brandController.updateBrand);

// DELETE /api/brands/:id - Delete brand
router.delete("/:id", auth, brandController.deleteBrand);

module.exports = router;
