const express = require('express');
const router = express.Router();
const User = require('../model/User');
const { auth, requireRole, hasPermission } = require('../midleware/auth');
const multer = require('multer');
const { uploadToImageBB } = require('../utils/imagebb');

// Configure multer for memory storage (we'll upload to ImageBB)
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

// Get all users with pagination and search
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      role = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build search query
    const query = { isActive: true };

    // Non-super-admin users cannot see super admin users
    if (req.user.role !== 'super_admin') {
      query.role = { $ne: 'super_admin' };
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by role
    if (role) {
      // If query.role is already an object (from super_admin filter), merge it
      if (typeof query.role === 'object') {
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
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const users = await User.find(query)
      .select('-password')
      .populate('roleId', 'name permissions')
      .populate('createdBy', 'name email')
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
        hasMore: pageNum * limitNum < total
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password')
      .populate('roleId', 'name permissions');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create user (requires appropriate permissions)
router.post('/', auth, upload.single('profileImage'), async (req, res) => {
  try {
    // Parse permissions if it's a string
    let permissions = req.body.permissions;
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid permissions format' });
      }
    }

    // Upload image to ImageBB if provided
    let profileImageUrl = null;
    if (req.file) {
      try {
        const uploadResult = await uploadToImageBB(req.file.buffer, req.file.originalname);
        profileImageUrl = uploadResult.url; // Store the full ImageBB URL
        console.log('✅ Image uploaded to ImageBB:', profileImageUrl);
      } catch (uploadError) {
        console.error('ImageBB upload error:', uploadError.message);
        return res.status(500).json({
          message: 'Failed to upload profile image',
          error: uploadError.message
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
      createdBy: req.userId
    };

    const user = new User(userData);
    await user.save();

    const newUser = await User.findById(user._id)
      .select('-password')
      .populate('roleId', 'name permissions')
      .populate('createdBy', 'name email');

    res.status(201).json(newUser);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Update user
router.put('/:id', auth, upload.single('profileImage'), async (req, res) => {
  try {
    // Parse permissions if it's a string
    let permissions = req.body.permissions;
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid permissions format' });
      }
    }

    const updateData = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      role: req.body.role,
      permissions: permissions
    };

    // Only update password if provided
    if (req.body.password && req.body.password.trim() !== '') {
      updateData.password = req.body.password;
    }

    // Upload new profile image to ImageBB if provided
    if (req.file) {
      try {
        const uploadResult = await uploadToImageBB(req.file.buffer, req.file.originalname);
        updateData.profileImage = uploadResult.url; // Store the ImageBB URL
        console.log('✅ Profile image updated on ImageBB:', uploadResult.url);
      } catch (uploadError) {
        console.error('ImageBB upload error:', uploadError.message);
        return res.status(500).json({
          message: 'Failed to upload profile image',
          error: uploadError.message
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password')
      .populate('roleId', 'name permissions')
      .populate('createdBy', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Delete user (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully', user: { id: user._id, name: user.name } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('roleId', 'name permissions')
      .populate('createdBy', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Non-super-admin users cannot view super admin users
    if (req.user.role !== 'super_admin' && user.role === 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
