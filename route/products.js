const express = require("express");
const router = express.Router();
const multer = require("multer");
const { auth } = require("../midleware/auth");
const upload = require("../midleware/upload");
const productController = require("../controllers/productController");

// GET /api/products - Get all products with pagination, search, and filters
router.get("/", auth, productController.getAllProducts);

// GET /api/products/alerts/expiring - Get products expiring soon (not yet expired)
router.get("/alerts/expiring", auth, productController.getExpiringProducts);

// GET /api/products/alerts/expired - Get products that have already expired
router.get("/alerts/expired", auth, productController.getExpiredProducts);

// GET /api/products/alerts/low-stock - Get products with low stock
router.get("/alerts/low-stock", auth, productController.getLowStockProducts);

// GET /api/products/meta/categories - Get all unique categories
router.get("/meta/categories", auth, productController.getCategories);

// GET /api/products/meta/brands - Get all unique brands
router.get("/meta/brands", auth, productController.getBrands);

// POST /api/products/bulk-import - Bulk import products
router.post("/bulk-import", auth, productController.bulkImportProducts);

// GET /api/products/:id - Get product by ID
router.get("/:id", auth, productController.getProductById);

// POST /api/products - Create a new product
router.post(
  "/",
  auth,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "featureImages", maxCount: 5 },
  ]),
  (err, req, res, next) => {
    // Handle multer errors (file size, file type, etc.)
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ 
            message: "Image file is too large. Maximum size is 5MB." 
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({ 
            message: "Too many files uploaded." 
          });
        }
      }
      return res.status(400).json({ 
        message: err.message || "File upload error" 
      });
    }
    next();
  },
  productController.createProduct
);

// PUT /api/products/:id - Update product
router.put(
  "/:id",
  auth,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "featureImages", maxCount: 5 },
  ]),
  productController.updateProduct
);

// DELETE /api/products/:id - Delete product (soft delete)
router.delete("/:id", auth, productController.deleteProduct);

module.exports = router;
