const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: String,
  quantity: Number,
  unitPrice: Number,
  modifiers: [String], // e.g., "Extra cheese", "No onions"
  notes: String,
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'served'],
    default: 'pending'
  }
});

const orderSchema = new mongoose.Schema({
  orderNo: {
    type: String,
    unique: true,
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  tableId: String,
  tableName: String,
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled', 'paid'],
    default: 'pending'
  },
  waiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  notes: String,
  subtotal: Number,
  tax: Number,
  serviceCharge: Number,
  total: Number
}, {
  timestamps: true
});

orderSchema.index({ createdAt: -1 });
orderSchema.index({ storeId: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
