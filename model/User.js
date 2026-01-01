const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'manager', 'cashier'],
    default: 'cashier'
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  },
  // Comprehensive permissions object
  permissions: {
    // POS & Sales Permissions
    canViewSales: { type: Boolean, default: false },
    canCreateSales: { type: Boolean, default: false },
    canEditSales: { type: Boolean, default: false },
    canDeleteSales: { type: Boolean, default: false },
    canProcessRefunds: { type: Boolean, default: false },
    canViewSalesReports: { type: Boolean, default: false },

    // Product Management Permissions
    canViewProducts: { type: Boolean, default: false },
    canAddProducts: { type: Boolean, default: false },
    canEditProducts: { type: Boolean, default: false },
    canDeleteProducts: { type: Boolean, default: false },
    canManageCategories: { type: Boolean, default: false },
    canViewInventory: { type: Boolean, default: false },
    canManageInventory: { type: Boolean, default: false },
    canAdjustStock: { type: Boolean, default: false },

    // Customer Management Permissions
    canViewCustomers: { type: Boolean, default: false },
    canAddCustomers: { type: Boolean, default: false },
    canEditCustomers: { type: Boolean, default: false },
    canDeleteCustomers: { type: Boolean, default: false },
    canViewCustomerHistory: { type: Boolean, default: false },

    // User Management Permissions
    canViewUsers: { type: Boolean, default: false },
    canAddUsers: { type: Boolean, default: false },
    canEditUsers: { type: Boolean, default: false },
    canDeleteUsers: { type: Boolean, default: false },
    canManageRoles: { type: Boolean, default: false },

    // Store Management Permissions
    canViewStores: { type: Boolean, default: false },
    canAddStores: { type: Boolean, default: false },
    canEditStores: { type: Boolean, default: false },
    canDeleteStores: { type: Boolean, default: false },
    canManageStoreSettings: { type: Boolean, default: false },

    // Reports & Analytics Permissions
    canViewReports: { type: Boolean, default: false },
    canExportReports: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false },
    canViewDashboard: { type: Boolean, default: true },

    // System Settings Permissions
    canManageSettings: { type: Boolean, default: false },
    canManagePaymentMethods: { type: Boolean, default: false },
    canManageTaxSettings: { type: Boolean, default: false },
    canManageReceiptSettings: { type: Boolean, default: false },
    canViewSystemLogs: { type: Boolean, default: false }
  },
  storeIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual for checking if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  // Lock the account if we've reached max attempts
  const attemptsReached = this.loginAttempts + 1 >= maxAttempts;
  if (attemptsReached && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

module.exports = mongoose.model('User', userSchema);
