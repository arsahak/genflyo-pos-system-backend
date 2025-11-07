const express = require("express");
const router = express.Router();
const User = require("../model/User");
const RefreshToken = require("../model/RefreshToken");
const Role = require("../model/Role");
const { generateTokens, auth, hasPermission } = require("../midleware/auth");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

// Constants for security
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_DEVICES_PER_USER = 5;

// Rate limiting for authentication endpoints
// More lenient for production to avoid blocking legitimate users
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 5, // More attempts in production
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: (req) => process.env.NODE_ENV !== 'production',
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 3, // More attempts in production
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: (req) => process.env.NODE_ENV !== 'production',
});

// Helper function to hash tokens
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Helper function to get device info
const getDeviceInfo = (req) => {
  return {
    userAgent: req.get("user-agent") || "Unknown",
    ipAddress: req.ip || req.connection.remoteAddress || "Unknown",
    platform: req.get("sec-ch-ua-platform") || "Unknown",
  };
};

// Helper function to clean up old refresh tokens
const cleanupOldTokens = async (userId) => {
  try {
    // Remove expired tokens
    await RefreshToken.deleteMany({
      userId,
      expiresAt: { $lt: new Date() },
    });

    // Remove revoked tokens older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await RefreshToken.deleteMany({
      userId,
      isRevoked: true,
      updatedAt: { $lt: thirtyDaysAgo },
    });

    // If user has more than MAX_DEVICES_PER_USER active tokens, remove oldest
    const activeTokens = await RefreshToken.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: 1 });

    if (activeTokens.length > MAX_DEVICES_PER_USER) {
      const tokensToRemove = activeTokens.slice(
        0,
        activeTokens.length - MAX_DEVICES_PER_USER
      );
      await RefreshToken.deleteMany({
        _id: { $in: tokensToRemove.map((t) => t._id) },
      });
    }
  } catch (error) {
    console.error("Error cleaning up old tokens:", error);
  }
};

// Validation helper
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 6 characters
  if (password.length < 6) {
    return {
      valid: false,
      message: "Password must be at least 6 characters long",
    };
  }
  return { valid: true };
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 */
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || "cashier",
    });
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store refresh token
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await RefreshToken.create({
      userId: user._id,
      token: tokenHash,
      expiresAt,
      deviceInfo: getDeviceInfo(req),
    });

    // Log registration (you can expand this to a separate audit log)
    console.log(`New user registered: ${user.email} from IP: ${req.ip}`);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Registration failed. Please try again later.",
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password, deviceName } = req.body;

    // Log login attempt (without sensitive data)
    console.log(`Login attempt for email: ${email} from IP: ${req.ip}`);

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Find user
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).populate("roleId");

    if (!user) {
      // Don't reveal whether user exists
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockTimeRemaining = Math.ceil(
        (user.lockUntil - Date.now()) / 1000 / 60
      );
      return res.status(423).json({
        message: `Account is locked due to multiple failed login attempts. Please try again in ${lockTimeRemaining} minutes.`,
        lockUntil: user.lockUntil,
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        message: "Account has been deactivated. Please contact administrator.",
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();

      // Check if account should be locked
      const updatedUser = await User.findById(user._id);
      if (updatedUser.isLocked) {
        return res.status(423).json({
          message:
            "Account has been locked due to multiple failed login attempts. Please try again later.",
        });
      }

      const attemptsLeft = MAX_LOGIN_ATTEMPTS - updatedUser.loginAttempts;
      return res.status(401).json({
        message: "Invalid credentials",
        attemptsLeft: attemptsLeft > 0 ? attemptsLeft : 0,
      });
    }

    // Successful login - reset login attempts
    if (user.loginAttempts > 0 || user.lockUntil) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Clean up old tokens before creating new one
    await cleanupOldTokens(user._id);

    // Store refresh token with device info
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const deviceInfo = getDeviceInfo(req);
    if (deviceName) {
      deviceInfo.deviceName = deviceName;
    }

    await RefreshToken.create({
      userId: user._id,
      token: tokenHash,
      expiresAt,
      deviceInfo,
    });

    // Log successful login
    console.log(`User logged in: ${user.email} from IP: ${req.ip}`);

    // Prepare user response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId?._id,
      permissions: user.permissions || user.roleId?.permissions || {},
      lastLogin: user.lastLogin,
      profileImage: user.profileImage,
    };

    res.json({
      message: "Login successful",
      user: userResponse,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    console.error("Error stack:", error.stack);
    
    // Provide more specific error messages in development
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? "Login failed. Please try again later." 
      : `Login failed: ${error.message}`;
    
    res.status(500).json({
      message: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post("/refresh", strictAuthLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    // Verify token signature and expiration
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ message: "Refresh token has expired. Please login again." });
      }
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Check if token exists in database and is not revoked
    const tokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({
      token: tokenHash,
      userId: decoded.userId,
      isRevoked: false,
    });

    if (!storedToken) {
      // Token reuse detected - possible security breach
      console.warn(
        `⚠️ Token reuse detected for user: ${decoded.userId} from IP: ${req.ip}`
      );

      // Revoke all tokens for this user as a security measure
      await RefreshToken.updateMany(
        { userId: decoded.userId },
        { isRevoked: true }
      );

      return res.status(401).json({
        message:
          "Token reuse detected. All sessions have been terminated. Please login again.",
        requireLogin: true,
      });
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      await storedToken.deleteOne();
      return res.status(401).json({
        message: "Refresh token has expired. Please login again.",
        requireLogin: true,
      });
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "User not found or inactive. Please login again.",
        requireLogin: true,
      });
    }

    // Check if user is locked
    if (user.isLocked) {
      return res.status(423).json({
        message: "Account is locked. Please contact administrator.",
        requireLogin: true,
      });
    }

    // Token Rotation: Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      decoded.userId
    );

    // Revoke old token (important for security)
    storedToken.isRevoked = true;
    storedToken.revokedAt = new Date();
    await storedToken.save();

    // Store new refresh token with updated device info
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const deviceInfo = getDeviceInfo(req);
    // Preserve device name if it existed
    if (storedToken.deviceInfo?.deviceName) {
      deviceInfo.deviceName = storedToken.deviceInfo.deviceName;
    }

    await RefreshToken.create({
      userId: decoded.userId,
      token: newTokenHash,
      expiresAt,
      deviceInfo,
    });

    // Log token refresh
    console.log(`Token refreshed for user: ${user.email}`);

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      message: "Tokens refreshed successfully",
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({
      message: "Failed to refresh token. Please login again.",
      requireLogin: true,
    });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (revoke refresh token)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", auth, async (req, res) => {
  try {
    const { refreshToken, logoutAll = false } = req.body;

    if (logoutAll) {
      // Logout from all devices
      await RefreshToken.updateMany(
        { userId: req.userId, isRevoked: false },
        {
          isRevoked: true,
          revokedAt: new Date(),
        }
      );

      console.log(`User logged out from all devices: ${req.user.email}`);
      return res.json({ message: "Logged out from all devices successfully" });
    }

    // Logout from current device only
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const result = await RefreshToken.updateOne(
        { token: tokenHash, userId: req.userId, isRevoked: false },
        {
          isRevoked: true,
          revokedAt: new Date(),
        }
      );

      if (result.modifiedCount === 0) {
        return res
          .status(404)
          .json({ message: "Token not found or already revoked" });
      }
    }

    console.log(`User logged out: ${req.user.email} from IP: ${req.ip}`);
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed. Please try again." });
  }
});

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Get all active sessions/devices for current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 */
router.get("/sessions", auth, async (req, res) => {
  try {
    const sessions = await RefreshToken.find({
      userId: req.userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .select("deviceInfo createdAt expiresAt _id")
      .sort({ createdAt: -1 })
      .lean();

    const formattedSessions = sessions.map((session) => ({
      id: session._id,
      deviceName: session.deviceInfo?.deviceName || "Unknown Device",
      userAgent: session.deviceInfo?.userAgent || "Unknown",
      ipAddress: session.deviceInfo?.ipAddress || "Unknown",
      platform: session.deviceInfo?.platform || "Unknown",
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: false, // You can enhance this by comparing tokens
    }));

    res.json({
      sessions: formattedSessions,
      count: formattedSessions.length,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ message: "Failed to retrieve sessions" });
  }
});

/**
 * @swagger
 * /api/auth/sessions/:id:
 *   delete:
 *     summary: Revoke a specific session/device
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked successfully
 */
router.delete("/sessions/:id", auth, async (req, res) => {
  try {
    const result = await RefreshToken.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId,
        isRevoked: false,
      },
      {
        isRevoked: true,
        revokedAt: new Date(),
      }
    );

    if (!result) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json({ message: "Session revoked successfully" });
  } catch (error) {
    console.error("Revoke session error:", error);
    res.status(500).json({ message: "Failed to revoke session" });
  }
});

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify if access token is valid
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 */
router.get("/verify", auth, async (req, res) => {
  try {
    res.json({
      valid: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions,
      },
    });
  } catch (error) {
    res.status(401).json({ valid: false, message: "Invalid token" });
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               logoutOtherDevices:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post("/change-password", auth, strictAuthLimiter, async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
      logoutOtherDevices = false,
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Get user with password
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Update password
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // Optionally logout from other devices
    if (logoutOtherDevices) {
      await RefreshToken.updateMany(
        { userId: user._id, isRevoked: false },
        {
          isRevoked: true,
          revokedAt: new Date(),
        }
      );
    }

    console.log(`Password changed for user: ${user.email}`);

    res.json({
      message: "Password changed successfully",
      loggedOutOtherDevices: logoutOtherDevices,
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
});

module.exports = router;
