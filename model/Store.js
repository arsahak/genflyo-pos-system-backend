const mongoose = require('mongoose');

const taxRuleSchema = new mongoose.Schema({
  name: String,
  rate: Number,
  applicableCategories: [String]
});

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    unique: true,
    sparse: true
  },
  type: {
    type: String,
    enum: ['restaurant', 'pharmacy', 'electronics', 'supershop'],
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  phone: String,
  email: String,
  timezone: {
    type: String,
    default: 'UTC'
  },
  taxRules: [taxRuleSchema],
  settings: {
    currency: {
      type: String,
      default: 'USD'
    },
    locale: String,
    receiptHeader: String,
    receiptFooter: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Store', storeSchema);
