const express = require("express");
const router = express.Router();
const { auth, requireRole } = require("../midleware/auth");
const roleController = require("../controllers/roleController");

// GET /api/roles - Get all roles
router.get("/", auth, roleController.getAllRoles);

// GET /api/roles/:id - Get role by ID
router.get("/:id", auth, roleController.getRoleById);

// POST /api/roles - Create role (only super admin and admin)
router.post("/", auth, requireRole("super_admin", "admin"), roleController.createRole);

// PUT /api/roles/:id - Update role
router.put("/:id", auth, requireRole("super_admin", "admin"), roleController.updateRole);

// DELETE /api/roles/:id - Delete role
router.delete("/:id", auth, requireRole("super_admin"), roleController.deleteRole);

module.exports = router;
