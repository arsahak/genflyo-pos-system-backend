const express = require('express');
const router = express.Router();
const Sale = require('../model/Sale');
const { auth } = require('../midleware/auth');

router.get('/sales', auth, async (req, res) => {
  try {
    const { storeId, from, to } = req.query;
    const query = {};
    if (storeId) query.storeId = storeId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(query);
    const total = sales.reduce((sum, s) => sum + s.total, 0);
    
    res.json({ count: sales.length, total, sales });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
