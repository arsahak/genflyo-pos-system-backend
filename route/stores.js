const express = require('express');
const router = express.Router();
const Store = require('../model/Store');
const { auth } = require('../midleware/auth');

/**
 * GET /api/stores
 * Get all active stores
 */
router.get('/', auth, async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true });
    
    // If no stores exist, create a default one
    if (stores.length === 0) {
      const defaultStore = new Store({
        name: 'Main Store',
        code: 'MAIN-001',
        type: 'pharmacy',
        address: {
          street: '123 Main Street',
          city: 'City',
          state: 'State',
          zipCode: '12345',
          country: 'Country'
        },
        phone: '+1234567890',
        email: 'store@example.com',
        settings: {
          currency: 'USD',
          receiptHeader: 'Welcome to Our Store',
          receiptFooter: 'Thank you for your business!'
        }
      });
      await defaultStore.save();
      console.log('✅ Default store created');
      return res.json([defaultStore]);
    }
    
    res.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/stores/:id
 * Get store by ID
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    res.json(store);
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/stores
 * Create new store
 */
router.post('/', auth, async (req, res) => {
  try {
    const store = new Store(req.body);
    await store.save();
    console.log(`✅ Store created: ${store.name}`);
    res.status(201).json(store);
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/stores/:id
 * Update store
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    console.log(`✅ Store updated: ${store.name}`);
    res.json(store);
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * DELETE /api/stores/:id
 * Soft delete store
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    console.log(`🗑️ Store deleted: ${store.name}`);
    res.json({ message: 'Store deleted successfully', store });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
