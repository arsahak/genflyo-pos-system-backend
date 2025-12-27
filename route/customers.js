const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const customerController = require("../controllers/customerController");

// GET /api/customers - Get all customers with search and filter
router.get("/", auth, customerController.getAllCustomers);

// GET /api/customers/phone/:phone - Find customer by phone number
router.get("/phone/:phone", auth, customerController.getCustomerByPhone);

// GET /api/customers/:id - Get customer by ID
router.get("/:id", auth, customerController.getCustomerById);

// POST /api/customers - Create new customer
router.post("/", auth, customerController.createCustomer);

// PUT /api/customers/:id - Update customer
router.put("/:id", auth, customerController.updateCustomer);

// DELETE /api/customers/:id - Soft delete customer
router.delete("/:id", auth, customerController.deleteCustomer);

module.exports = router;
