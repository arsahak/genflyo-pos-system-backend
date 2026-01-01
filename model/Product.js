const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name: String, // e.g., "Size: Large", "Color: Red"
  price: {
    type: Number,
    required: true
  },
  cost: Number,
  sku: String,
  barcode: String,
  stock: {
    type: Number,
    default: 0
  },
  attributes: {} // Flexible attributes object
});

const productSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    trim: true
  },
  barcode: {
    type: String,
    index: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },

  // Categorization
  category: {
    type: String,
    index: true,
    required: true
  },
  subCategory: {
    type: String,
    index: true
  },
  brand: {
    type: String,
    trim: true
  },
  manufacturer: {
    type: String,
    trim: true
  },
  suppliers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  }],

  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  cost: {
    type: Number,
    min: 0
  },
  wholesalePrice: {
    type: Number,
    min: 0
  },
  discountPrice: {
    type: Number,
    min: 0
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100
  },

  // Stock Management
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  minStock: {
    type: Number,
    default: 10,
    min: 0
  },
  maxStock: {
    type: Number,
    min: 0
  },
  reorderLevel: {
    type: Number,
    default: 5,
    min: 0
  },
  unit: {
    type: String,
    default: 'pcs',
    enum: ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'bottle', 'strip', 'tablet', 'capsule', 'injection', 'syrup', 'dozen', 'meter', 'yard']
  },

  // Images (ImageBB URLs)
  mainImage: {
    url: String,
    thumbUrl: String,
    displayUrl: String,
    deleteUrl: String
  },
  featureImages: [{
    url: String,
    thumbUrl: String,
    displayUrl: String,
    deleteUrl: String
  }],

  // Expiration Management (Critical for Pharmacy & Food)
  hasExpiry: {
    type: Boolean,
    default: false
  },
  expiryDate: {
    type: Date,
    index: true
  },
  manufacturingDate: {
    type: Date
  },
  batchNumber: {
    type: String,
    trim: true
  },
  expiryAlertDays: {
    type: Number,
    default: 30, // Alert 30 days before expiry
    min: 0
  },

  // Pharmacy Specific
  isPrescription: {
    type: Boolean,
    default: false
  },
  isControlled: {
    type: Boolean,
    default: false
  },
  genericName: {
    type: String,
    trim: true
  },
  dosage: {
    type: String,
    trim: true
  },
  strength: {
    type: String,
    trim: true
  },

  // Restaurant Specific
  isFood: {
    type: Boolean,
    default: false
  },
  cuisine: {
    type: String,
    trim: true
  },
  preparationTime: {
    type: Number, // in minutes
    min: 0
  },
  ingredients: [{
    type: String,
    trim: true
  }],
  allergens: [{
    type: String,
    trim: true
  }],
  isVegetarian: {
    type: Boolean,
    default: false
  },
  isVegan: {
    type: Boolean,
    default: false
  },
  spiceLevel: {
    type: String,
    enum: ['mild', 'medium', 'hot', 'extra_hot']
  },

  // Electronics & Warranty
  hasWarranty: {
    type: Boolean,
    default: false
  },
  warrantyPeriod: {
    type: Number, // in months
    min: 0
  },
  warrantyType: {
    type: String,
    enum: ['manufacturer', 'seller', 'both']
  },

  // Tax & Legal
  taxCode: {
    type: String,
    trim: true
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  hsnCode: {
    type: String,
    trim: true
  },

  // Variants
  hasVariants: {
    type: Boolean,
    default: false
  },
  variants: [variantSchema],

  // Additional Details
  weight: {
    type: Number,
    min: 0
  },
  weightUnit: {
    type: String,
    enum: ['kg', 'g', 'lb', 'oz']
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'inch', 'm']
    }
  },

  // Tags & Search
  tags: [{
    type: String,
    trim: true
  }],
  searchKeywords: [{
    type: String,
    trim: true
  }],

  // Status & Visibility
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isDiscontinued: {
    type: Boolean,
    default: false
  },

  // Supplier Information
  supplier: {
    name: String,
    phone: String,
    email: String,
    address: String
  },

  // Store/Location
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  },
  location: {
    aisle: String,
    shelf: String,
    bin: String
  },

  // Tracking & Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedAt: {
    type: Date
  },

  // Notes
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ expiryDate: 1, hasExpiry: 1 });
productSchema.index({ stock: 1, minStock: 1 });
productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });

// Virtual for checking if product is expiring soon
productSchema.virtual('isExpiringSoon').get(function() {
  if (!this.hasExpiry || !this.expiryDate) return false;

  const today = new Date();
  const alertDate = new Date(this.expiryDate);
  alertDate.setDate(alertDate.getDate() - this.expiryAlertDays);

  return today >= alertDate && today < this.expiryDate;
});

// Virtual for checking if product is expired
productSchema.virtual('isExpired').get(function() {
  if (!this.hasExpiry || !this.expiryDate) return false;
  return new Date() > this.expiryDate;
});

// Virtual for checking if stock is low
productSchema.virtual('isLowStock').get(function() {
  return this.stock <= this.reorderLevel;
});

// Virtual for profit margin
productSchema.virtual('profitMargin').get(function() {
  if (!this.cost || this.cost === 0) return 0;
  return ((this.price - this.cost) / this.cost) * 100;
});

// Method to check if user has permission to manage this product
productSchema.methods.canBeManaged = function(user) {
  if (user.role === 'super_admin') return true;
  if (user.permissions.canManageProducts) return true;
  return false;
};

// Ensure virtuals are included when converting to JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
