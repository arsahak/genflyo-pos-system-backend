const express = require('express');
const router = express.Router();
const Inventory = require('../model/Inventory');
const { auth } = require('../midleware/auth');

router.get('/:storeId', auth, async (req, res) => {
  try {
    const inventories = await Inventory.find({ storeId: req.params.storeId })
      .populate('productId', 'name sku barcode category')
      .sort({ 'productId.name': 1 });
    
    res.json(inventories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
