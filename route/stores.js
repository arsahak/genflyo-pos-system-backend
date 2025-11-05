const express = require('express');
const router = express.Router();
const Store = require('../model/Store');
const { auth } = require('../midleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true });
    res.json(stores);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const store = new Store(req.body);
    await store.save();
    res.status(201).json(store);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
