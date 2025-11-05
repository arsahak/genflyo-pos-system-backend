const express = require('express');
const router = express.Router();
const Customer = require('../model/Customer');
const { auth } = require('../midleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { q } = req.query;
    const query = q ? { name: { $regex: q, $options: 'i' } } : {};
    const customers = await Customer.find(query).limit(50);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
