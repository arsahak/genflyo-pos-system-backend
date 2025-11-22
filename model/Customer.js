const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  phone: {
    type: String,
    index: true
  },
  email: {
    type: String,
    lowercase: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  membershipType: {
    type: String,
    enum: ['none', 'regular', 'silver', 'gold', 'platinum'],
    default: 'regular'
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  visitCount: {
    type: Number,
    default: 0
  },
  lastVisit: Date,
  notes: String,
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Customer', customerSchema);
