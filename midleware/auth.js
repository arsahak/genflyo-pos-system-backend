const jwt = require('jsonwebtoken');
const User = require('../model/User');
const Role = require('../model/Role');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.accessToken;
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId)
      .select('-password')
      .populate('roleId', 'permissions');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

// Permission checker middleware
const hasPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check role permissions
    const role = req.user.roleId;
    if (role && role.permissions) {
      const permission = role.permissions.find(p => p.resource === resource);
      if (permission && permission.actions.includes(action)) {
        return next();
      }
    }

    // Check user's custom permissions
    if (req.user.permissions) {
      const userPermission = req.user.permissions.find(p => p.resource === resource);
      if (userPermission && userPermission.actions.includes(action)) {
        return next();
      }
    }

    return res.status(403).json({ 
      message: `You don't have permission to ${action} ${resource}` 
    });
  };
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  return { accessToken, refreshToken };
};

module.exports = { auth, requireRole, hasPermission, generateTokens };
