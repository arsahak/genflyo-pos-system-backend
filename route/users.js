const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const upload = require("../midleware/upload");
const userController = require("../controllers/userController");

// GET /api/users - Get all users with pagination and search
router.get("/", auth, userController.getAllUsers);

// GET /api/users/me - Get current user
router.get("/me", auth, userController.getCurrentUser);

// GET /api/users/:id - Get user by ID
router.get("/:id", auth, userController.getUserById);

// POST /api/users - Create user
router.post("/", auth, upload.single("profileImage"), userController.createUser);

// PUT /api/users/:id - Update user
router.put("/:id", auth, upload.single("profileImage"), userController.updateUser);

// DELETE /api/users/:id - Delete user (soft delete)
router.delete("/:id", auth, userController.deleteUser);

module.exports = router;
