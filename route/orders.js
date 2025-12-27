const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const orderController = require("../controllers/orderController");

// POST /api/orders - Create new order
router.post("/", auth, orderController.createOrder);

// GET /api/orders - Get all orders
router.get("/", auth, orderController.getAllOrders);

// PUT /api/orders/:id - Update order
router.put("/:id", auth, orderController.updateOrder);

module.exports = router;
