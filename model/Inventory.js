const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchNo: String,
  expiryDate: Date,
  quantity: Number,
  cost: Number
});

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantId: String, // variant index or ID
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  reserved: {
    type: Number,
    default: 0 // Reserved for pending orders
  },
  minStock: Number,
  maxStock: Number,
  location: String, // e.g., "Shelf A1", "Warehouse"
  batches: [batchSchema], // For pharmacy
  serialNumbers: [String], // For electronics
  lastRestocked: Date
}, {
  timestamps: true
});

inventorySchema.index({ productId: 1, storeId: 1 });
inventorySchema.index({ storeId: 1, quantity: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
