const express = require('express');
const router = express.Router();
const Product = require('../model/Product');
const { auth } = require('../midleware/auth');
const multer = require('multer');
const { uploadToImageBB } = require('../utils/imagebb');

// Configure multer for memory storage (ImageBB upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.split('.').pop().toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
  }
});

/**
 * GET /api/products
 * Get all products with pagination, search, and filters
 */
router.get('/', auth, async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions?.canViewProducts && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You do not have permission to view products' });
    }

    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      subCategory = '',
      brand = '',
      minPrice,
      maxPrice,
      inStock,
      expiring,
      lowStock,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { isActive: true };

    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    if (brand) query.brand = brand;

    // Price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Stock filter
    if (inStock === 'true') {
      query.stock = { $gt: 0 };
    } else if (inStock === 'false') {
      query.stock = 0;
    }

    // Low stock filter
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stock', '$reorderLevel'] };
    }

    // Featured filter
    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Expiring soon filter
    if (expiring === 'true') {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // Next 30 days

      query.hasExpiry = true;
      query.expiryDate = { $gte: today, $lte: futureDate };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const products = await Product.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('storeId', 'name address')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Product.countDocuments(query);

    res.json({
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/products/expiring
 * Get products expiring soon (alert endpoint)
 */
router.get('/alerts/expiring', auth, async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions?.canViewProducts && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You do not have permission to view products' });
    }

    const { days = 30 } = req.query;

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const expiringProducts = await Product.find({
      isActive: true,
      hasExpiry: true,
      expiryDate: { $gte: today, $lte: futureDate }
    })
      .populate('createdBy', 'name email')
      .sort({ expiryDate: 1 });

    res.json({
      products: expiringProducts,
      count: expiringProducts.length,
      alertDays: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching expiring products:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/products/low-stock
 * Get products with low stock
 */
router.get('/alerts/low-stock', auth, async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions?.canViewProducts && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You do not have permission to view products' });
    }

    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$reorderLevel'] }
    })
      .populate('createdBy', 'name email')
      .sort({ stock: 1 });

    res.json({
      products: lowStockProducts,
      count: lowStockProducts.length
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/products/categories
 * Get all unique categories
 */
router.get('/meta/categories', auth, async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/products/brands
 * Get all unique brands
 */
router.get('/meta/brands', auth, async (req, res) => {
  try {
    const brands = await Product.distinct('brand', { isActive: true });
    res.json({ brands: brands.filter(b => b) }); // Filter out null/empty
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/products/:id
 * Get product by ID
 */
router.get('/:id', auth, async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions?.canViewProducts && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You do not have permission to view products' });
    }

    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('deletedBy', 'name email')
      .populate('storeId', 'name address');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/products
 * Create a new product with main image + feature images upload
 */
router.post('/', auth, upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'featureImages', maxCount: 5 }
]), async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions?.canAddProducts && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You do not have permission to add products' });
    }

    let mainImageData = null;
    const featureImagesData = [];

    // Upload main image to ImageBB if provided
    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      console.log('📸 Uploading main image to ImageBB...');
      try {
        const uploadResult = await uploadToImageBB(req.files.mainImage[0].buffer, req.files.mainImage[0].originalname);
        mainImageData = {
          url: uploadResult.url,
          thumbUrl: uploadResult.thumbUrl,
          displayUrl: uploadResult.displayUrl,
          deleteUrl: uploadResult.deleteUrl
        };
        console.log(`✅ Main image uploaded: ${uploadResult.url}`);
      } catch (uploadError) {
        console.error('Main image upload error:', uploadError.message);
        return res.status(500).json({
          message: 'Failed to upload main image',
          error: uploadError.message
        });
      }
    }

    // Upload feature images to ImageBB if provided
    if (req.files && req.files.featureImages && req.files.featureImages.length > 0) {
      console.log(`📸 Uploading ${req.files.featureImages.length} feature images to ImageBB...`);

      for (const file of req.files.featureImages) {
        try {
          const uploadResult = await uploadToImageBB(file.buffer, file.originalname);
          featureImagesData.push({
            url: uploadResult.url,
            thumbUrl: uploadResult.thumbUrl,
            displayUrl: uploadResult.displayUrl,
            deleteUrl: uploadResult.deleteUrl
          });
          console.log(`✅ Feature image uploaded: ${uploadResult.url}`);
        } catch (uploadError) {
          console.error('Feature image upload error:', uploadError.message);
          // Continue with other images even if one fails
        }
      }
    }

    // Parse arrays from string if needed
    const parseArray = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      try {
        return JSON.parse(field);
      } catch {
        return field.split(',').map(item => item.trim());
      }
    };

    // Parse supplier object
    const parseSupplier = (supplierData) => {
      if (!supplierData) return undefined;
      if (typeof supplierData === 'object') return supplierData;
      try {
        return JSON.parse(supplierData);
      } catch {
        return undefined;
      }
    };

    // Create product data
    const productData = {
      ...req.body,
      mainImage: mainImageData,
      featureImages: featureImagesData,
      tags: parseArray(req.body.tags),
      searchKeywords: parseArray(req.body.searchKeywords),
      ingredients: parseArray(req.body.ingredients),
      allergens: parseArray(req.body.allergens),
      supplier: parseSupplier(req.body.supplier),
      createdBy: req.userId
    };

    const product = new Product(productData);
    await product.save();

    const newProduct = await Product.findById(product._id)
      .populate('createdBy', 'name email')
      .populate('storeId', 'name address');

    console.log(`✅ Product created: ${product.name} by ${req.user.name}`);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'SKU already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/products/:id
 * Update product with optional main image + feature images upload
 */
router.put('/:id', auth, upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'featureImages', maxCount: 5 }
]), async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions?.canEditProducts && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You do not have permission to edit products' });
    }

    // Find existing product
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let mainImageData = existingProduct.mainImage;
    let featureImagesData = existingProduct.featureImages || [];

    // Upload new main image to ImageBB if provided
    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      console.log('📸 Uploading new main image to ImageBB...');
      try {
        const uploadResult = await uploadToImageBB(req.files.mainImage[0].buffer, req.files.mainImage[0].originalname);
        mainImageData = {
          url: uploadResult.url,
          thumbUrl: uploadResult.thumbUrl,
          displayUrl: uploadResult.displayUrl,
          deleteUrl: uploadResult.deleteUrl
        };
        console.log(`✅ Main image updated: ${uploadResult.url}`);
      } catch (uploadError) {
        console.error('Main image upload error:', uploadError.message);
        return res.status(500).json({
          message: 'Failed to upload main image',
          error: uploadError.message
        });
      }
    }

    // Upload new feature images to ImageBB if provided
    if (req.files && req.files.featureImages && req.files.featureImages.length > 0) {
      console.log(`📸 Uploading ${req.files.featureImages.length} new feature images to ImageBB...`);

      // If keepExistingFeatureImages is true, keep existing ones, otherwise replace
      if (req.body.keepExistingFeatureImages === 'true') {
        // Add to existing
        for (const file of req.files.featureImages) {
          if (featureImagesData.length >= 5) break; // Max 5 feature images

          try {
            const uploadResult = await uploadToImageBB(file.buffer, file.originalname);
            featureImagesData.push({
              url: uploadResult.url,
              thumbUrl: uploadResult.thumbUrl,
              displayUrl: uploadResult.displayUrl,
              deleteUrl: uploadResult.deleteUrl
            });
            console.log(`✅ Feature image uploaded: ${uploadResult.url}`);
          } catch (uploadError) {
            console.error('Feature image upload error:', uploadError.message);
          }
        }
      } else {
        // Replace all feature images
        featureImagesData = [];
        for (const file of req.files.featureImages) {
          try {
            const uploadResult = await uploadToImageBB(file.buffer, file.originalname);
            featureImagesData.push({
              url: uploadResult.url,
              thumbUrl: uploadResult.thumbUrl,
              displayUrl: uploadResult.displayUrl,
              deleteUrl: uploadResult.deleteUrl
            });
            console.log(`✅ Feature image uploaded: ${uploadResult.url}`);
          } catch (uploadError) {
            console.error('Feature image upload error:', uploadError.message);
          }
        }
      }
    }

    // Parse arrays from string if needed
    const parseArray = (field) => {
      if (!field) return undefined;
      if (Array.isArray(field)) return field;
      try {
        return JSON.parse(field);
      } catch {
        return field.split(',').map(item => item.trim());
      }
    };

    // Parse supplier object
    const parseSupplier = (supplierData) => {
      if (!supplierData) return undefined;
      if (typeof supplierData === 'object') return supplierData;
      try {
        return JSON.parse(supplierData);
      } catch {
        return undefined;
      }
    };

    // Update product data
    const updateData = {
      ...req.body,
      mainImage: mainImageData,
      featureImages: featureImagesData,
      updatedBy: req.userId
    };

    // Parse arrays
    if (req.body.tags) updateData.tags = parseArray(req.body.tags);
    if (req.body.searchKeywords) updateData.searchKeywords = parseArray(req.body.searchKeywords);
    if (req.body.ingredients) updateData.ingredients = parseArray(req.body.ingredients);
    if (req.body.allergens) updateData.allergens = parseArray(req.body.allergens);
    if (req.body.supplier) updateData.supplier = parseSupplier(req.body.supplier);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('storeId', 'name address');

    console.log(`✅ Product updated: ${product.name} by ${req.user.name}`);

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'SKU already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

/**
 * DELETE /api/products/:id
 * Soft delete product (track who deleted and when)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions?.canDeleteProducts && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You do not have permission to delete products' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        isActive: false,
        deletedBy: req.userId,
        deletedAt: new Date()
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log(`🗑️ Product deleted: ${product.name} by ${req.user.name}`);

    res.json({
      message: 'Product deleted successfully',
      product: {
        id: product._id,
        name: product.name,
        deletedBy: req.user.name,
        deletedAt: product.deletedAt
      }
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
