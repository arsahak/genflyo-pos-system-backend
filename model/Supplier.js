const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Contact name is required'],
    trim: true
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  phone: {
    type: String,
    trim: true
  },
  mobile: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  taxNumber: {
    type: String,
    trim: true
  },
  paymentTerms: {
    type: String,
    default: '30',
    enum: ['0', '7', '15', '30', '45', '60', '90']
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  lastPurchaseDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster searches
supplierSchema.index({ name: 1, company: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ isActive: 1 });

// Virtual for full display name
supplierSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.company})`;
});

// Method to update purchase statistics
supplierSchema.methods.updatePurchaseStats = function(amount) {
  this.totalPurchases += amount;
  this.lastPurchaseDate = new Date();
  return this.save();
};

module.exports = mongoose.model('Supplier', supplierSchema);
