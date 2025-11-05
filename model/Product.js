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
  attributes: {} // Flexible attributes object
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  barcode: {
    type: String,
    index: true
  },
  description: String,
  category: {
    type: String,
    index: true
  },
  brand: String,
  variants: [variantSchema],
  // For pharmacy
  isPrescription: Boolean,
  isControlled: Boolean,
  requiresExpiry: Boolean,
  // For electronics
  hasWarranty: Boolean,
  warrantyPeriod: Number,
  // For general
  taxCode: String,
  taxRate: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
