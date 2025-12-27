const Category = require("../model/Category");
const Product = require("../model/Product");
const { uploadToImageBB } = require("../utils/imagebb");

/**
 * Check if user has permission
 */
const checkPermission = (user, permission, action = "perform this action") => {
  if (user.role === "super_admin") return null;
  if (!user.permissions || !user.permissions[permission]) {
    return { status: 403, message: `You do not have permission to ${action}` };
  }
  return null;
};

/**
 * Parse meta keywords from string or array
 */
const parseMetaKeywords = (keywords) => {
  if (!keywords) return [];
  if (Array.isArray(keywords)) return keywords;
  try {
    return JSON.parse(keywords);
  } catch {
    return keywords.split(",").map((k) => k.trim());
  }
};

/**
 * Upload category image to ImageBB
 */
const uploadCategoryImage = async (file) => {
  if (!file) return null;

  console.log("📸 Uploading category image to ImageBB...");
  try {
    const uploadResult = await uploadToImageBB(file.buffer, file.originalname);
    const imageData = {
      url: uploadResult.url,
      thumbUrl: uploadResult.thumbUrl,
      displayUrl: uploadResult.displayUrl,
      deleteUrl: uploadResult.deleteUrl,
    };
    console.log(`✅ Category image uploaded: ${uploadResult.url}`);
    return imageData;
  } catch (uploadError) {
    console.error("ImageBB upload error:", uploadError.message);
    throw { status: 500, message: "Failed to upload category image", error: uploadError.message };
  }
};

/**
 * Get all categories with pagination and search
 */
const getAllCategories = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canViewProducts", "view categories");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    const {
      page = 1,
      limit = 50,
      search = "",
      parentCategory,
      featured,
      sortBy = "order",
      sortOrder = "asc",
    } = req.query;

    // Build query
    const query = { isActive: true };

    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    // Parent category filter
    if (parentCategory === "null" || parentCategory === "root") {
      query.parentCategory = null; // Root categories only
    } else if (parentCategory) {
      query.parentCategory = parentCategory;
    }

    // Featured filter
    if (featured === "true") {
      query.isFeatured = true;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query
    const categories = await Category.find(query)
      .populate("parentCategory", "name slug")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category.name,
          isActive: true,
        });

        return {
          ...category.toObject(),
          productCount,
        };
      })
    );

    // Get total count
    const total = await Category.countDocuments(query);

    res.json({
      categories: categoriesWithCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get categories in hierarchical tree structure
 */
const getCategoryTree = async (req, res) => {
  try {
    // Get all active categories
    const categories = await Category.find({ isActive: true })
      .populate("parentCategory", "name slug")
      .sort({ order: 1, name: 1 });

    // Build tree structure
    const buildTree = (parentId = null) => {
      return categories
        .filter((cat) => {
          if (parentId === null) return cat.parentCategory === null;
          return cat.parentCategory && cat.parentCategory._id.toString() === parentId.toString();
        })
        .map((cat) => ({
          ...cat.toObject(),
          children: buildTree(cat._id),
        }));
    };

    const tree = buildTree();

    res.json({ categories: tree });
  } catch (error) {
    console.error("Error fetching category tree:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get category by ID
 */
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate("parentCategory", "name slug")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("deletedBy", "name email");

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Get product count
    const productCount = await Product.countDocuments({
      category: category.name,
      isActive: true,
    });

    // Get sub-categories with product counts
    const subCategories = await Category.find({
      parentCategory: category._id,
      isActive: true,
    }).select("name slug image");

    // Add product count to each subcategory
    const subCategoriesWithCount = await Promise.all(
      subCategories.map(async (subCat) => {
        const subProductCount = await Product.countDocuments({
          category: subCat.name,
          isActive: true,
        });
        return {
          ...subCat.toObject(),
          productCount: subProductCount,
        };
      })
    );

    res.json({
      ...category.toObject(),
      productCount,
      subCategories: subCategoriesWithCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all products in a category
 */
const getCategoryProducts = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Find products by category name
    const products = await Product.find({
      category: category.name,
      isActive: true,
    })
      .populate("createdBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments({
      category: category.name,
      isActive: true,
    });

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
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new category
 */
const createCategory = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canAddProducts", "create categories");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    let imageData = null;

    // Upload image to ImageBB if provided
    if (req.file) {
      try {
        imageData = await uploadCategoryImage(req.file);
      } catch (imageError) {
        return res.status(imageError.status || 500).json({
          message: imageError.message,
          error: imageError.error,
        });
      }
    }

    const categoryData = {
      ...req.body,
      image: imageData,
      metaKeywords: parseMetaKeywords(req.body.metaKeywords),
      createdBy: req.userId,
    };

    const category = new Category(categoryData);
    await category.save();

    const newCategory = await Category.findById(category._id)
      .populate("parentCategory", "name slug")
      .populate("createdBy", "name email");

    console.log(`✅ Category created: ${category.name} by ${req.user.name}`);

    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Error creating category:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Category slug already exists" });
    }
    res.status(400).json({ message: error.message });
  }
};

/**
 * Update category
 */
const updateCategory = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canEditProducts", "edit categories");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    const existingCategory = await Category.findById(req.params.id);
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    let imageData = existingCategory.image;

    // Upload new image if provided
    if (req.file) {
      try {
        imageData = await uploadCategoryImage(req.file);
      } catch (imageError) {
        return res.status(imageError.status || 500).json({
          message: imageError.message,
          error: imageError.error,
        });
      }
    }

    const updateData = {
      ...req.body,
      image: imageData,
      updatedBy: req.userId,
    };

    if (req.body.metaKeywords) {
      updateData.metaKeywords = parseMetaKeywords(req.body.metaKeywords);
    }

    const category = await Category.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("parentCategory", "name slug")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    console.log(`✅ Category updated: ${category.name} by ${req.user.name}`);

    res.json(category);
  } catch (error) {
    console.error("Error updating category:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Category slug already exists" });
    }
    res.status(400).json({ message: error.message });
  }
};

/**
 * Soft delete category
 */
const deleteCategory = async (req, res) => {
  try {
    const permissionError = checkPermission(req.user, "canDeleteProducts", "delete categories");
    if (permissionError) {
      return res.status(permissionError.status).json({ message: permissionError.message });
    }

    // Check if category has products
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const productCount = await Product.countDocuments({
      category: category.name,
      isActive: true,
    });

    if (productCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category with ${productCount} active products`,
        productCount,
      });
    }

    // Check if category has sub-categories
    const subCategoryCount = await Category.countDocuments({
      parentCategory: category._id,
      isActive: true,
    });

    if (subCategoryCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category with ${subCategoryCount} sub-categories`,
        subCategoryCount,
      });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      {
        isActive: false,
        deletedBy: req.userId,
        deletedAt: new Date(),
      },
      { new: true }
    );

    console.log(`🗑️ Category deleted: ${updatedCategory.name} by ${req.user.name}`);

    res.json({
      message: "Category deleted successfully",
      category: {
        id: updatedCategory._id,
        name: updatedCategory.name,
        deletedBy: req.user.name,
        deletedAt: updatedCategory.deletedAt,
      },
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllCategories,
  getCategoryTree,
  getCategoryById,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory,
};

