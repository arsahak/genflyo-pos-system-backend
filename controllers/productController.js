const Product = require("../model/Product");
const { uploadToImageBB } = require("../utils/imagebb");

/**
 * Check if user has permission to perform action
 */
const checkPermission = (user, permission, action = "perform this action") => {
  if (user.role === "super_admin") return null;
  if (!user.permissions || !user.permissions[permission]) {
    return { status: 403, message: `You do not have permission to ${action}` };
  }
  return null;
};

/**
 * Parse array from string or return array
 */
const parseArray = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    return JSON.parse(field);
  } catch {
    return field.split(",").map((item) => item.trim());
  }
};

/**
 * Parse supplier object from string or return object
 */
const parseSupplier = (supplierData) => {
  if (!supplierData) return undefined;
  if (typeof supplierData === "object") return supplierData;
  try {
    return JSON.parse(supplierData);
  } catch {
    return undefined;
  }
};

/**
 * Upload images to ImageBB
 */
const uploadImages = async (files) => {
  let mainImageData = null;
  const featureImagesData = [];

  // Upload main image
  if (files && files.mainImage && files.mainImage[0]) {
    const mainImageFile = files.mainImage[0];
    console.log("📸 Uploading main image to ImageBB...", {
      filename: mainImageFile.originalname,
      mimetype: mainImageFile.mimetype,
      size: mainImageFile.size,
      hasBuffer: !!mainImageFile.buffer,
      bufferLength: mainImageFile.buffer?.length || 0,
    });
    
    // Validate file buffer
    if (!mainImageFile.buffer || mainImageFile.buffer.length === 0) {
      throw { 
        status: 400, 
        message: "Main image file is empty or corrupted",
        error: "File buffer is empty"
      };
    }
    
    try {
      const uploadResult = await uploadToImageBB(
        mainImageFile.buffer,
        mainImageFile.originalname
      );
      mainImageData = {
        url: uploadResult.url,
        thumbUrl: uploadResult.thumbUrl,
        displayUrl: uploadResult.displayUrl,
        deleteUrl: uploadResult.deleteUrl,
      };
      console.log(`✅ Main image uploaded: ${uploadResult.url}`);
    } catch (uploadError) {
      console.error("❌ Main image upload error:", uploadError.message);
      throw { 
        status: 500, 
        message: uploadError.message || "Failed to upload main image", 
        error: uploadError.message 
      };
    }
  }

  // Upload feature images
  if (files && files.featureImages && files.featureImages.length > 0) {
    console.log(`📸 Uploading ${files.featureImages.length} feature images to ImageBB...`);
    for (const file of files.featureImages) {
      try {
        const uploadResult = await uploadToImageBB(file.buffer, file.originalname);
        featureImagesData.push({
          url: uploadResult.url,
          thumbUrl: uploadResult.thumbUrl,
          displayUrl: uploadResult.displayUrl,
          deleteUrl: uploadResult.deleteUrl,
        });
        console.log(`✅ Feature image uploaded: ${uploadResult.url}`);
      } catch (uploadError) {
        console.error("Feature image upload error:", uploadError.message);
        // Continue with other images even if one fails
      }
    }
  }

  return { mainImageData, featureImagesData };
};

/**
 * Get all products with pagination, search, and filters
 */
const getAllProducts = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canViewProducts", "view products");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    const {
      page = 1,
      limit = 20,
      search = "",
      category = "",
      subCategory = "",
      brand = "",
      minPrice,
      maxPrice,
      inStock,
      expiring,
      lowStock,
      featured,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { isActive: true };

    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
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
    if (inStock === "true") {
      query.stock = { $gt: 0 };
    } else if (inStock === "false") {
      query.stock = 0;
    }

    // Low stock filter
    if (lowStock === "true") {
      query.$expr = { $lte: ["$stock", "$reorderLevel"] };
    }

    // Featured filter
    if (featured === "true") {
      query.isFeatured = true;
    }

    // Expiring soon filter
    if (expiring === "true") {
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
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query
    const products = await Product.find(query)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("storeId", "name address")
      .populate("suppliers", "name company phone email")
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
        hasMore: pageNum * limitNum < total,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get products expiring soon
 */
const getExpiringProducts = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canViewProducts", "view products");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    const { days = 30 } = req.query;

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const expiringProducts = await Product.find({
      isActive: true,
      hasExpiry: true,
      expiryDate: { $gte: today, $lte: futureDate },
    })
      .populate("createdBy", "name email")
      .sort({ expiryDate: 1 });

    res.json({
      products: expiringProducts,
      count: expiringProducts.length,
      alertDays: parseInt(days),
    });
  } catch (error) {
    console.error("Error fetching expiring products:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get products with low stock
 */
const getLowStockProducts = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canViewProducts", "view products");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ["$stock", "$reorderLevel"] },
    })
      .populate("createdBy", "name email")
      .sort({ stock: 1 });

    res.json({
      products: lowStockProducts,
      count: lowStockProducts.length,
    });
  } catch (error) {
    console.error("Error fetching low stock products:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all unique categories
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct("category", { isActive: true });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all unique brands
 */
const getBrands = async (req, res) => {
  try {
    const brands = await Product.distinct("brand", { isActive: true });
    res.json({ brands: brands.filter((b) => b) }); // Filter out null/empty
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Bulk import products
 */
const bulkImportProducts = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canAddProducts", "add products");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "No products provided for import" });
    }

    const results = {
      success: [],
      failed: [],
      imported: 0,
      errors: [],
    };

    // Process each product
    for (let i = 0; i < products.length; i++) {
      const productData = products[i];

      try {
        // Set required fields
        const product = new Product({
          name: productData.name,
          sku: productData.sku || undefined,
          barcode: productData.barcode || undefined,
          description: productData.description || undefined,
          category: productData.category,
          subCategory: productData.subCategory || undefined,
          brand: productData.brand || undefined,
          price: parseFloat(productData.price) || 0,
          cost: productData.cost ? parseFloat(productData.cost) : undefined,
          stock: parseInt(productData.stock) || 0,
          minStock: productData.minStock ? parseInt(productData.minStock) : 0,
          reorderLevel: productData.reorderLevel ? parseInt(productData.reorderLevel) : 0,
          unit: productData.unit || "pcs",
          hasExpiry: productData.hasExpiry === true || productData.hasExpiry === "TRUE",
          expiryDate: productData.expiryDate ? new Date(productData.expiryDate) : undefined,
          expiryAlertDays: productData.expiryAlertDays ? parseInt(productData.expiryAlertDays) : 0,
          isFeatured: productData.isFeatured === true || productData.isFeatured === "TRUE",
          isActive: productData.isActive !== false && productData.isActive !== "FALSE",
          createdBy: req.userId,
        });

        await product.save();
        results.success.push({
          row: i + 1,
          name: productData.name,
          id: product._id,
        });
        results.imported++;
      } catch (error) {
        console.error(`Error importing product at row ${i + 1}:`, error.message);
        results.failed.push({
          row: i + 1,
          name: productData.name,
          error: error.message,
        });
        results.errors.push({
          row: i + 1,
          error: error.code === 11000 ? "Duplicate SKU or Barcode" : error.message,
        });
      }
    }

    console.log(
      `✅ Bulk import completed: ${results.imported} products imported, ${results.failed.length} failed`
    );

    res.status(200).json({
      message: `Import completed: ${results.imported} products imported successfully`,
      imported: results.imported,
      failed: results.failed.length,
      results,
    });
  } catch (error) {
    console.error("Error during bulk import:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get product by ID
 */
const getProductById = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canViewProducts", "view products");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    const product = await Product.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("deletedBy", "name email")
      .populate("storeId", "name address")
      .populate("suppliers", "name company phone email");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new product
 */
const createProduct = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canAddProducts", "add products");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    // Upload images
    let mainImageData = null;
    let featureImagesData = [];
    
    // Only attempt upload if files are provided
    if (req.files && (req.files.mainImage || req.files.featureImages)) {
      try {
        const imageResult = await uploadImages(req.files);
        mainImageData = imageResult.mainImageData;
        featureImagesData = imageResult.featureImagesData;
      } catch (imageError) {
        console.error("❌ Image upload failed:", imageError);
        return res.status(imageError.status || 500).json({ 
          message: imageError.message || "Failed to upload image",
          error: imageError.error || imageError.message,
          hint: !process.env.IMAGEBB_API_KEY 
            ? "IMAGEBB_API_KEY environment variable is not configured. Please set it in your .env file."
            : "Please check your image file and try again."
        });
      }
    }

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
      suppliers: parseArray(req.body.suppliers), // Parse suppliers array
      createdBy: req.userId,
    };

    const product = new Product(productData);
    await product.save();

    const newProduct = await Product.findById(product._id)
      .populate("createdBy", "name email")
      .populate("storeId", "name address")
      .populate("suppliers", "name company phone email");

    console.log(`✅ Product created: ${product.name} by ${req.user.name}`);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "SKU already exists" });
    }
    res.status(400).json({ message: error.message });
  }
};

/**
 * Update product
 */
const updateProduct = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canEditProducts", "edit products");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    // Find existing product
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    let mainImageData = existingProduct.mainImage;
    let featureImagesData = existingProduct.featureImages || [];

    // Upload new images if provided
    if (req.files) {
      try {
        // Upload new main image if provided
        if (req.files.mainImage && req.files.mainImage[0]) {
          console.log("📸 Uploading new main image to ImageBB...");
          const uploadResult = await uploadToImageBB(
            req.files.mainImage[0].buffer,
            req.files.mainImage[0].originalname
          );
          mainImageData = {
            url: uploadResult.url,
            thumbUrl: uploadResult.thumbUrl,
            displayUrl: uploadResult.displayUrl,
            deleteUrl: uploadResult.deleteUrl,
          };
          console.log(`✅ Main image updated: ${uploadResult.url}`);
        }

        // Upload new feature images if provided
        if (req.files.featureImages && req.files.featureImages.length > 0) {
          console.log(
            `📸 Uploading ${req.files.featureImages.length} new feature images to ImageBB...`
          );

          // If keepExistingFeatureImages is true, keep existing ones, otherwise replace
          if (req.body.keepExistingFeatureImages === "true") {
            // Add to existing
            for (const file of req.files.featureImages) {
              if (featureImagesData.length >= 5) break; // Max 5 feature images

              try {
                const uploadResult = await uploadToImageBB(file.buffer, file.originalname);
                featureImagesData.push({
                  url: uploadResult.url,
                  thumbUrl: uploadResult.thumbUrl,
                  displayUrl: uploadResult.displayUrl,
                  deleteUrl: uploadResult.deleteUrl,
                });
                console.log(`✅ Feature image uploaded: ${uploadResult.url}`);
              } catch (uploadError) {
                console.error("Feature image upload error:", uploadError.message);
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
                  deleteUrl: uploadResult.deleteUrl,
                });
                console.log(`✅ Feature image uploaded: ${uploadResult.url}`);
              } catch (uploadError) {
                console.error("Feature image upload error:", uploadError.message);
              }
            }
          }
        }
      } catch (imageError) {
        console.error("Image upload error:", imageError.message);
        return res.status(500).json({
          message: "Failed to upload image",
          error: imageError.message,
        });
      }
    }

    // Update product data
    const updateData = {
      ...req.body,
      mainImage: mainImageData,
      featureImages: featureImagesData,
      updatedBy: req.userId,
    };

    // Parse arrays
    if (req.body.tags) updateData.tags = parseArray(req.body.tags);
    if (req.body.searchKeywords) updateData.searchKeywords = parseArray(req.body.searchKeywords);
    if (req.body.ingredients) updateData.ingredients = parseArray(req.body.ingredients);
    if (req.body.allergens) updateData.allergens = parseArray(req.body.allergens);
    if (req.body.supplier) updateData.supplier = parseSupplier(req.body.supplier);
    if (req.body.suppliers) updateData.suppliers = parseArray(req.body.suppliers);

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("storeId", "name address");

    console.log(`✅ Product updated: ${product.name} by ${req.user.name}`);

    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "SKU already exists" });
    }
    res.status(400).json({ message: error.message });
  }
};

/**
 * Delete product (soft delete)
 */
const deleteProduct = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canDeleteProducts", "delete products");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        isActive: false,
        deletedBy: req.userId,
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    console.log(`🗑️ Product deleted: ${product.name} by ${req.user.name}`);

    res.json({
      message: "Product deleted successfully",
      product: {
        id: product._id,
        name: product.name,
        deletedBy: req.user.name,
        deletedAt: product.deletedAt,
      },
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllProducts,
  getExpiringProducts,
  getLowStockProducts,
  getCategories,
  getBrands,
  bulkImportProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};

