const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const upload = require("../midleware/upload");
const categoryController = require("../controllers/categoryController");

// GET /api/categories - Get all categories with pagination and search
router.get("/", auth, categoryController.getAllCategories);

// GET /api/categories/tree - Get categories in hierarchical tree structure
router.get("/tree", auth, categoryController.getCategoryTree);

// GET /api/categories/:id/products - Get all products in a category
router.get("/:id/products", auth, categoryController.getCategoryProducts);

// GET /api/categories/:id - Get category by ID
router.get("/:id", auth, categoryController.getCategoryById);

// POST /api/categories - Create a new category
router.post("/", auth, upload.single("image"), categoryController.createCategory);

// PUT /api/categories/:id - Update category
router.put("/:id", auth, upload.single("image"), categoryController.updateCategory);

// DELETE /api/categories/:id - Soft delete category
router.delete("/:id", auth, categoryController.deleteCategory);

module.exports = router;

