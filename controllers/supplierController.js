const Supplier = require("../model/Supplier");

/**
 * Get all suppliers with search and filter
 */
const getAllSuppliers = async (req, res) => {
  try {
    const { q, email, phone, page = 1, limit = 50, isActive } = req.query;

    // Build query
    const query = {};

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search by name or company
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { company: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } }
      ];
    }

    // Search by email
    if (email) {
      query.email = { $regex: email, $options: "i" };
    }

    // Search by phone
    if (phone) {
      query.phone = { $regex: phone, $options: "i" };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const suppliers = await Supplier.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Supplier.countDocuments(query);

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get supplier by ID
 */
const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error("Error fetching supplier:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create new supplier
 */
const createSupplier = async (req, res) => {
  try {
    const {
      name,
      company,
      email,
      phone,
      mobile,
      address,
      city,
      country,
      taxNumber,
      paymentTerms,
      notes
    } = req.body;

    // Validate required fields
    if (!name || !company) {
      return res.status(400).json({
        success: false,
        message: "Name and company are required fields"
      });
    }

    // Check if supplier with same email exists
    if (email) {
      const existingSupplier = await Supplier.findOne({
        email: email.toLowerCase(),
        isActive: true
      });

      if (existingSupplier) {
        return res.status(400).json({
          success: false,
          message: "Supplier with this email already exists",
          data: existingSupplier
        });
      }
    }

    // Create new supplier
    const supplier = new Supplier({
      name,
      company,
      email,
      phone,
      mobile,
      address,
      city,
      country,
      taxNumber,
      paymentTerms: paymentTerms || '30',
      notes
    });

    await supplier.save();

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier
    });
  } catch (error) {
    console.error("Error creating supplier:", error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update supplier
 */
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if supplier exists
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    // If email is being updated, check for duplicates
    if (updateData.email && updateData.email !== supplier.email) {
      const existingSupplier = await Supplier.findOne({
        email: updateData.email.toLowerCase(),
        _id: { $ne: id },
        isActive: true
      });

      if (existingSupplier) {
        return res.status(400).json({
          success: false,
          message: "Another supplier with this email already exists"
        });
      }
    }

    // Update supplier
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Supplier updated successfully",
      data: updatedSupplier
    });
  } catch (error) {
    console.error("Error updating supplier:", error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete supplier (soft delete)
 */
const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    // Soft delete by setting isActive to false
    supplier.isActive = false;
    await supplier.save();

    res.json({
      success: true,
      message: "Supplier deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Permanently delete supplier
 */
const permanentDeleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findByIdAndDelete(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    res.json({
      success: true,
      message: "Supplier permanently deleted"
    });
  } catch (error) {
    console.error("Error permanently deleting supplier:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Restore deleted supplier
 */
const restoreSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    supplier.isActive = true;
    await supplier.save();

    res.json({
      success: true,
      message: "Supplier restored successfully",
      data: supplier
    });
  } catch (error) {
    console.error("Error restoring supplier:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get supplier statistics
 */
const getSupplierStats = async (req, res) => {
  try {
    const totalSuppliers = await Supplier.countDocuments({ isActive: true });
    const inactiveSuppliers = await Supplier.countDocuments({ isActive: false });

    const stats = await Supplier.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalPurchaseAmount: { $sum: "$totalPurchases" },
          avgPaymentTerms: { $avg: { $toInt: "$paymentTerms" } }
        }
      }
    ]);

    const recentSuppliers = await Supplier.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name company createdAt');

    res.json({
      success: true,
      data: {
        totalSuppliers,
        activeSuppliers: totalSuppliers,
        inactiveSuppliers,
        totalPurchaseAmount: stats[0]?.totalPurchaseAmount || 0,
        avgPaymentTerms: Math.round(stats[0]?.avgPaymentTerms || 30),
        recentSuppliers
      }
    });
  } catch (error) {
    console.error("Error fetching supplier stats:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  permanentDeleteSupplier,
  restoreSupplier,
  getSupplierStats
};
