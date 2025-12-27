const User = require("../model/User");
const { uploadToImageBB } = require("../utils/imagebb");

/**
 * Upload profile image to ImageBB
 */
const uploadProfileImage = async (file) => {
  if (!file) return null;

  try {
    const uploadResult = await uploadToImageBB(file.buffer, file.originalname);
    console.log("✅ Image uploaded to ImageBB:", uploadResult.url);
    return uploadResult.url;
  } catch (uploadError) {
    console.error("ImageBB upload error:", uploadError.message);
    throw { status: 500, message: "Failed to upload profile image", error: uploadError.message };
  }
};

/**
 * Parse permissions from string or return object
 */
const parsePermissions = (permissions) => {
  if (!permissions) return {};
  if (typeof permissions === "object") return permissions;
  try {
    return JSON.parse(permissions);
  } catch (e) {
    throw { status: 400, message: "Invalid permissions format" };
  }
};

/**
 * Get all users with pagination and search
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build search query
    const query = { isActive: true };

    // Non-super-admin users cannot see super admin users
    if (req.user.role !== "super_admin") {
      query.role = { $ne: "super_admin" };
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by role
    if (role) {
      // If query.role is already an object (from super_admin filter), merge it
      if (typeof query.role === "object") {
        query.role = { ...query.role, $eq: role };
      } else {
        query.role = role;
      }
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with pagination
    const users = await User.find(query)
      .select("-password")
      .populate("roleId", "name permissions")
      .populate("createdBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await User.countDocuments(query);

    res.json({
      users,
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
 * Get current user
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("-password")
      .populate("roleId", "name permissions");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("roleId", "name permissions")
      .populate("createdBy", "name email");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Non-super-admin users cannot view super admin users
    if (req.user.role !== "super_admin" && user.role === "super_admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create user
 */
const createUser = async (req, res) => {
  try {
    // Parse permissions
    let permissions;
    try {
      permissions = parsePermissions(req.body.permissions);
    } catch (permError) {
      return res.status(permError.status || 400).json({ message: permError.message });
    }

    // Upload image to ImageBB if provided
    let profileImageUrl = null;
    if (req.file) {
      try {
        profileImageUrl = await uploadProfileImage(req.file);
      } catch (imageError) {
        return res.status(imageError.status || 500).json({
          message: imageError.message,
          error: imageError.error,
        });
      }
    }

    const userData = {
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      phone: req.body.phone,
      address: req.body.address,
      role: req.body.role,
      permissions: permissions || {},
      profileImage: profileImageUrl,
      createdBy: req.userId,
    };

    const user = new User(userData);
    await user.save();

    const newUser = await User.findById(user._id)
      .select("-password")
      .populate("roleId", "name permissions")
      .populate("createdBy", "name email");

    res.status(201).json(newUser);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(400).json({ message: error.message });
  }
};

/**
 * Update user
 */
const updateUser = async (req, res) => {
  try {
    // Parse permissions
    let permissions;
    if (req.body.permissions) {
      try {
        permissions = parsePermissions(req.body.permissions);
      } catch (permError) {
        return res.status(permError.status || 400).json({ message: permError.message });
      }
    }

    const updateData = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      role: req.body.role,
    };

    if (permissions) {
      updateData.permissions = permissions;
    }

    // Only update password if provided
    if (req.body.password && req.body.password.trim() !== "") {
      updateData.password = req.body.password;
    }

    // Upload new profile image to ImageBB if provided
    if (req.file) {
      try {
        const profileImageUrl = await uploadProfileImage(req.file);
        updateData.profileImage = profileImageUrl;
      } catch (imageError) {
        return res.status(imageError.status || 500).json({
          message: imageError.message,
          error: imageError.error,
        });
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .select("-password")
      .populate("roleId", "name permissions")
      .populate("createdBy", "name email");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(400).json({ message: error.message });
  }
};

/**
 * Delete user (soft delete)
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully", user: { id: user._id, name: user.name } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  getCurrentUser,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};

