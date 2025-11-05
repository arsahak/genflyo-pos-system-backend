const express = require('express');
const router = express.Router();
const Order = require('../model/Order');
const { auth } = require('../midleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { storeId, tableId, tableName, items, waiterId, customerId } = req.body;
    
    const orderCount = await Order.countDocuments();
    const orderNo = `ORD-${Date.now()}-${orderCount}`;

    const order = new Order({
      orderNo,
      storeId,
      tableId,
      tableName,
      items,
      waiterId,
      customerId
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const { storeId, status } = req.query;
    const query = {};
    if (storeId) query.storeId = storeId;
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('waiterId', 'name')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
