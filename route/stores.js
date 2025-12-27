const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const storeController = require("../controllers/storeController");

// GET /api/stores - Get all active stores
router.get("/", auth, storeController.getAllStores);

// GET /api/stores/:id - Get store by ID
router.get("/:id", auth, storeController.getStoreById);

// POST /api/stores - Create new store
router.post("/", auth, storeController.createStore);

// PUT /api/stores/:id - Update store
router.put("/:id", auth, storeController.updateStore);

// DELETE /api/stores/:id - Soft delete store
router.delete("/:id", auth, storeController.deleteStore);

module.exports = router;
