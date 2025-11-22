const mongoose = require('mongoose');

const taxRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rate: { type: Number, required: true },
  type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  applicableCategories: [String],
  isActive: { type: Boolean, default: true }
});

const paymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['cash', 'card', 'upi', 'wallet', 'bank_transfer'], required: true },
  isActive: { type: Boolean, default: true },
  apiKey: String,
  apiSecret: String,
  merchantId: String
});

const notificationSchema = new mongoose.Schema({
  email: {
    enabled: { type: Boolean, default: false },
    smtp: {
      host: String,
      port: Number,
      username: String,
      password: String,
      fromEmail: String,
      fromName: String
    }
  },
  sms: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['twilio', 'nexmo', 'aws'], default: 'twilio' },
    apiKey: String,
    apiSecret: String,
    fromNumber: String
  },
  push: {
    enabled: { type: Boolean, default: false },
    fcmServerKey: String
  }
});

const receiptSchema = new mongoose.Schema({
  template: { type: String, enum: ['standard', 'compact', 'detailed'], default: 'standard' },
  showLogo: { type: Boolean, default: true },
  logoUrl: String,
  showQRCode: { type: Boolean, default: true },
  showBarcode: { type: Boolean, default: false },
  footer: {
    text: String,
    showSocialMedia: { type: Boolean, default: false },
    facebookUrl: String,
    instagramUrl: String,
    websiteUrl: String
  }
});

const settingsSchema = new mongoose.Schema({
  // General Settings
  businessName: { type: String, required: true, default: 'My Business' },
  businessType: { type: String, enum: ['retail', 'restaurant', 'pharmacy', 'service'], default: 'retail' },
  logo: String,
  tagline: String,
  
  // Regional Settings
  currency: { type: String, default: 'USD' },
  currencySymbol: { type: String, default: '$' },
  currencyPosition: { type: String, enum: ['before', 'after'], default: 'before' },
  timezone: { type: String, default: 'UTC' },
  dateFormat: { type: String, default: 'YYYY-MM-DD' },
  timeFormat: { type: String, enum: ['12h', '24h'], default: '12h' },
  language: { type: String, default: 'en' },
  
  // Tax Settings
  taxEnabled: { type: Boolean, default: true },
  taxInclusive: { type: Boolean, default: false },
  taxRules: [taxRuleSchema],
  
  // Payment Settings
  paymentMethods: [paymentMethodSchema],
  allowPartialPayments: { type: Boolean, default: true },
  allowCreditSales: { type: Boolean, default: false },
  
  // Receipt/Invoice Settings
  receipt: receiptSchema,
  invoicePrefix: { type: String, default: 'INV' },
  invoiceNumbering: { type: String, enum: ['sequential', 'date-based'], default: 'sequential' },
  invoiceStartNumber: { type: Number, default: 1000 },
  
  // Inventory Settings
  lowStockAlert: { type: Boolean, default: true },
  lowStockThreshold: { type: Number, default: 10 },
  allowNegativeStock: { type: Boolean, default: false },
  autoReorderEnabled: { type: Boolean, default: false },
  
  // Customer Settings
  loyaltyProgramEnabled: { type: Boolean, default: true },
  pointsPerDollar: { type: Number, default: 1 },
  requireCustomerPhone: { type: Boolean, default: false },
  allowCustomerCredit: { type: Boolean, default: false },
  
  // Notifications
  notifications: notificationSchema,
  
  // Email Settings for Receipts
  emailReceipts: { type: Boolean, default: false },
  smsReceipts: { type: Boolean, default: false },
  
  // Backup Settings
  autoBackup: { type: Boolean, default: true },
  backupFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
  
  // Security Settings
  sessionTimeout: { type: Number, default: 30 }, // minutes
  requireStrongPassword: { type: Boolean, default: true },
  twoFactorAuth: { type: Boolean, default: false },
  
  // POS Settings
  soundEnabled: { type: Boolean, default: true },
  printerEnabled: { type: Boolean, default: true },
  barcodeScanner: { type: Boolean, default: true },
  touchMode: { type: Boolean, default: false },
  
  // Advanced Settings
  maintenanceMode: { type: Boolean, default: false },
  allowApiAccess: { type: Boolean, default: false },
  webhookUrl: String,
  
  // Metadata
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('Settings', settingsSchema);

