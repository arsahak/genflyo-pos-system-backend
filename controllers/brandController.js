const Brand = require("../model/brands");

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
 * GET /api/brands - Get all brands with pagination, search, and filters
 */
exports.getAllBrands = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      isActive,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    // Build query
    const query = {};

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }


    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const [brands, total] = await Promise.all([
      Brand.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Brand.countDocuments(query),
    ]);

    res.status(200).json({
      brands,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({
      message: "Failed to fetch brands",
      error: error.message,
    });
  }
};

/**
 * GET /api/brands/:id - Get brand by ID
 */
exports.getBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    res.status(200).json(brand);
  } catch (error) {
    console.error("Error fetching brand:", error);
    res.status(500).json({
      message: "Failed to fetch brand",
      error: error.message,
    });
  }
};

/**
 * POST /api/brands - Create a new brand
 */
exports.createBrand = async (req, res) => {
  try {
    // Check permission
    const permissionError = checkPermission(
      req.user,
      "canManageProducts",
      "create brands"
    );
    if (permissionError) {
      return res.status(permissionError.status).json({
        message: permissionError.message,
      });
    }

    const { name, description, isActive } = req.body;

    // Check if brand already exists
    const existingBrand = await Brand.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingBrand) {
      return res.status(400).json({
        message: "Brand with this name already exists",
      });
    }

    // Prepare brand data
    const brandData = {
      name,
      description,
      isActive: isActive !== undefined ? isActive : true,
    };

    // Create brand
    const brand = await Brand.create(brandData);

    res.status(201).json({
      message: "Brand created successfully",
      brand,
    });
  } catch (error) {
    console.error("Error creating brand:", error);
    res.status(500).json({
      message: "Failed to create brand",
      error: error.message,
    });
  }
};

/**
 * PUT /api/brands/:id - Update brand
 */
exports.updateBrand = async (req, res) => {
  try {
    // Check permission
    const permissionError = checkPermission(
      req.user,
      "canManageProducts",
      "update brands"
    );
    if (permissionError) {
      return res.status(permissionError.status).json({
        message: permissionError.message,
      });
    }

    const { id } = req.params;
    const { name, description, isActive } = req.body;

    // Find brand
    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    // Check if new name conflicts with existing brand
    if (name && name !== brand.name) {
      const existingBrand = await Brand.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: id },
      });

      if (existingBrand) {
        return res.status(400).json({
          message: "Brand with this name already exists",
        });
      }
    }

    // Prepare update data
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update brand
    const updatedBrand = await Brand.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Brand updated successfully",
      brand: updatedBrand,
    });
  } catch (error) {
    console.error("Error updating brand:", error);
    res.status(500).json({
      message: "Failed to update brand",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/brands/:id - Delete brand
 */
exports.deleteBrand = async (req, res) => {
  try {
    // Check permission
    const permissionError = checkPermission(
      req.user,
      "canManageProducts",
      "delete brands"
    );
    if (permissionError) {
      return res.status(permissionError.status).json({
        message: permissionError.message,
      });
    }

    const { id } = req.params;

    // Find and delete brand
    const brand = await Brand.findByIdAndDelete(id);

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    res.status(200).json({
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting brand:", error);
    res.status(500).json({
      message: "Failed to delete brand",
      error: error.message,
    });
  }
};

/**
 * GET /api/brands/stats - Get brand statistics
 */
exports.getBrandStats = async (req, res) => {
  try {
    const [totalBrands, activeBrands, inactiveBrands] = await Promise.all([
      Brand.countDocuments({}),
      Brand.countDocuments({ isActive: true }),
      Brand.countDocuments({ isActive: false }),
    ]);

    res.status(200).json({
      total: totalBrands,
      active: activeBrands,
      inactive: inactiveBrands,
    });
  } catch (error) {
    console.error("Error fetching brand stats:", error);
    res.status(500).json({
      message: "Failed to fetch brand statistics",
      error: error.message,
    });
  }
};
