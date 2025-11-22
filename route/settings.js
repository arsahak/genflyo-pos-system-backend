const express = require('express');
const router = express.Router();
const Settings = require('../model/Settings');
const { auth } = require('../midleware/auth');

/**
 * GET /api/settings
 * Get application settings
 */
router.get('/', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne({ isActive: true });
    
    // If no settings exist, create default
    if (!settings) {
      settings = new Settings({
        businessName: 'My Business',
        currency: 'USD',
        currencySymbol: '$',
        timezone: 'UTC'
      });
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/settings
 * Update application settings
 */
router.put('/', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      // Create new settings
      settings = new Settings(req.body);
      settings.lastModifiedBy = req.user._id;
      await settings.save();
    } else {
      // Update existing settings
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          settings[key] = req.body[key];
        }
      });
      settings.lastModifiedBy = req.user._id;
      await settings.save();
    }
    
    res.json({ message: 'Settings updated successfully', settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/general
 * Update general settings
 */
router.put('/general', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { businessName, businessType, logo, tagline, currency, currencySymbol, 
            currencyPosition, timezone, dateFormat, timeFormat, language } = req.body;
    
    if (businessName) settings.businessName = businessName;
    if (businessType) settings.businessType = businessType;
    if (logo !== undefined) settings.logo = logo;
    if (tagline !== undefined) settings.tagline = tagline;
    if (currency) settings.currency = currency;
    if (currencySymbol) settings.currencySymbol = currencySymbol;
    if (currencyPosition) settings.currencyPosition = currencyPosition;
    if (timezone) settings.timezone = timezone;
    if (dateFormat) settings.dateFormat = dateFormat;
    if (timeFormat) settings.timeFormat = timeFormat;
    if (language) settings.language = language;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'General settings updated', settings });
  } catch (error) {
    console.error('Error updating general settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/tax
 * Update tax settings
 */
router.put('/tax', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { taxEnabled, taxInclusive, taxRules } = req.body;
    
    if (taxEnabled !== undefined) settings.taxEnabled = taxEnabled;
    if (taxInclusive !== undefined) settings.taxInclusive = taxInclusive;
    if (taxRules) settings.taxRules = taxRules;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'Tax settings updated', settings });
  } catch (error) {
    console.error('Error updating tax settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/payment
 * Update payment settings
 */
router.put('/payment', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { paymentMethods, allowPartialPayments, allowCreditSales } = req.body;
    
    if (paymentMethods) settings.paymentMethods = paymentMethods;
    if (allowPartialPayments !== undefined) settings.allowPartialPayments = allowPartialPayments;
    if (allowCreditSales !== undefined) settings.allowCreditSales = allowCreditSales;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'Payment settings updated', settings });
  } catch (error) {
    console.error('Error updating payment settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/receipt
 * Update receipt settings
 */
router.put('/receipt', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { receipt, invoicePrefix, invoiceNumbering, invoiceStartNumber } = req.body;
    
    if (receipt) settings.receipt = { ...settings.receipt, ...receipt };
    if (invoicePrefix) settings.invoicePrefix = invoicePrefix;
    if (invoiceNumbering) settings.invoiceNumbering = invoiceNumbering;
    if (invoiceStartNumber) settings.invoiceStartNumber = invoiceStartNumber;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'Receipt settings updated', settings });
  } catch (error) {
    console.error('Error updating receipt settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/notifications
 * Update notification settings
 */
router.put('/notifications', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { notifications, emailReceipts, smsReceipts } = req.body;
    
    if (notifications) settings.notifications = { ...settings.notifications, ...notifications };
    if (emailReceipts !== undefined) settings.emailReceipts = emailReceipts;
    if (smsReceipts !== undefined) settings.smsReceipts = smsReceipts;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'Notification settings updated', settings });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/inventory
 * Update inventory settings
 */
router.put('/inventory', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { lowStockAlert, lowStockThreshold, allowNegativeStock, autoReorderEnabled } = req.body;
    
    if (lowStockAlert !== undefined) settings.lowStockAlert = lowStockAlert;
    if (lowStockThreshold) settings.lowStockThreshold = lowStockThreshold;
    if (allowNegativeStock !== undefined) settings.allowNegativeStock = allowNegativeStock;
    if (autoReorderEnabled !== undefined) settings.autoReorderEnabled = autoReorderEnabled;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'Inventory settings updated', settings });
  } catch (error) {
    console.error('Error updating inventory settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/customer
 * Update customer settings
 */
router.put('/customer', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { loyaltyProgramEnabled, pointsPerDollar, requireCustomerPhone, allowCustomerCredit } = req.body;
    
    if (loyaltyProgramEnabled !== undefined) settings.loyaltyProgramEnabled = loyaltyProgramEnabled;
    if (pointsPerDollar) settings.pointsPerDollar = pointsPerDollar;
    if (requireCustomerPhone !== undefined) settings.requireCustomerPhone = requireCustomerPhone;
    if (allowCustomerCredit !== undefined) settings.allowCustomerCredit = allowCustomerCredit;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'Customer settings updated', settings });
  } catch (error) {
    console.error('Error updating customer settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/security
 * Update security settings
 */
router.put('/security', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { sessionTimeout, requireStrongPassword, twoFactorAuth } = req.body;
    
    if (sessionTimeout) settings.sessionTimeout = sessionTimeout;
    if (requireStrongPassword !== undefined) settings.requireStrongPassword = requireStrongPassword;
    if (twoFactorAuth !== undefined) settings.twoFactorAuth = twoFactorAuth;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'Security settings updated', settings });
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/settings/pos
 * Update POS settings
 */
router.put('/pos', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const { soundEnabled, printerEnabled, barcodeScanner, touchMode } = req.body;
    
    if (soundEnabled !== undefined) settings.soundEnabled = soundEnabled;
    if (printerEnabled !== undefined) settings.printerEnabled = printerEnabled;
    if (barcodeScanner !== undefined) settings.barcodeScanner = barcodeScanner;
    if (touchMode !== undefined) settings.touchMode = touchMode;
    
    settings.lastModifiedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'POS settings updated', settings });
  } catch (error) {
    console.error('Error updating POS settings:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * POST /api/settings/reset
 * Reset to default settings
 */
router.post('/reset', auth, async (req, res) => {
  try {
    // Deactivate current settings
    await Settings.updateMany({ isActive: true }, { isActive: false });
    
    // Create new default settings
    const defaultSettings = new Settings({
      businessName: 'My Business',
      currency: 'USD',
      currencySymbol: '$',
      timezone: 'UTC',
      lastModifiedBy: req.user._id
    });
    
    await defaultSettings.save();
    
    res.json({ message: 'Settings reset to defaults', settings: defaultSettings });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

