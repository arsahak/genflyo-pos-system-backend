const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantId: String,
  productName: String,
  quantity: Number,
  unitPrice: Number,
  discount: {
    type: Number,
    default: 0
  },
  tax: Number,
  total: Number
});

const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['cash', 'card', 'mobile_wallet', 'gift_card', 'voucher'],
    required: true
  },
  amount: Number,
  reference: String
});

const saleSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  saleNo: {
    type: String,
    unique: true,
    required: true
  },
  items: [saleItemSchema],
  subtotal: Number,
  discount: Number,
  tax: Number,
  total: {
    type: Number,
    required: true
  },
  payments: [paymentSchema],
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'refunded', 'partially_refunded'],
    default: 'completed'
  },
  notes: String
}, {
  timestamps: true
});

saleSchema.index({ createdAt: -1 });
saleSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
