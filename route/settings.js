const express = require("express");
const router = express.Router();
const { auth } = require("../midleware/auth");
const settingController = require("../controllers/settingController");

// GET /api/settings - Get application settings
router.get("/", auth, settingController.getSettings);

// PUT /api/settings - Update application settings
router.put("/", auth, settingController.updateSettings);

// PUT /api/settings/general - Update general settings
router.put("/general", auth, settingController.updateGeneralSettings);

// PUT /api/settings/tax - Update tax settings
router.put("/tax", auth, settingController.updateTaxSettings);

// PUT /api/settings/payment - Update payment settings
router.put("/payment", auth, settingController.updatePaymentSettings);

// PUT /api/settings/receipt - Update receipt settings
router.put("/receipt", auth, settingController.updateReceiptSettings);

// PUT /api/settings/notifications - Update notification settings
router.put("/notifications", auth, settingController.updateNotificationSettings);

// PUT /api/settings/inventory - Update inventory settings
router.put("/inventory", auth, settingController.updateInventorySettings);

// PUT /api/settings/customer - Update customer settings
router.put("/customer", auth, settingController.updateCustomerSettings);

// PUT /api/settings/security - Update security settings
router.put("/security", auth, settingController.updateSecuritySettings);

// PUT /api/settings/pos - Update POS settings
router.put("/pos", auth, settingController.updatePOSSettings);

// POST /api/settings/reset - Reset to default settings
router.post("/reset", auth, settingController.resetSettings);

module.exports = router;

