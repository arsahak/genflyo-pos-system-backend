const express = require('express');
const router = express.Router();
const Customer = require('../model/Customer');
const { auth } = require('../midleware/auth');

/**
 * GET /api/customers
 * Get all customers with search and filter
 * Query params: q (name search), phone (exact phone lookup)
 */
router.get('/', auth, async (req, res) => {
  try {
    const { q, phone, page = 1, limit = 50 } = req.query;
    
    // Build query
    const query = { isActive: true };
    
    // Search by name
    if (q) {
      query.name = { $regex: q, $options: 'i' };
    }
    
    // Search by phone (exact or partial match)
    if (phone) {
      query.phone = { $regex: phone.replace(/\D/g, ''), $options: 'i' }; // Remove non-digits for flexible matching
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const customers = await Customer.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Customer.countDocuments(query);
    
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/customers/phone/:phone
 * Find customer by exact phone number
 */
router.get('/phone/:phone', auth, async (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, ''); // Remove non-digits
    
    const customer = await Customer.findOne({ 
      phone: { $regex: phone, $options: 'i' },
      isActive: true 
    });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error finding customer by phone:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/customers/:id
 * Get customer by ID
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/customers
 * Create new customer
 */
router.post('/', auth, async (req, res) => {
  try {
    // Check if customer with phone already exists
    if (req.body.phone) {
      const existingCustomer = await Customer.findOne({ 
        phone: req.body.phone,
        isActive: true 
      });
      
      if (existingCustomer) {
        return res.status(400).json({ 
          message: 'Customer with this phone number already exists',
          customer: existingCustomer
        });
      }
    }
    
    // Set default membership type if not provided
    if (!req.body.membershipType) {
      req.body.membershipType = 'regular';
    }
    
    const customer = new Customer(req.body);
    await customer.save();
    
    console.log(`✅ Customer created: ${customer.name} (${customer.phone})`);
    
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * PUT /api/customers/:id
 * Update customer
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    console.log(`✅ Customer updated: ${customer.name}`);
    
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * DELETE /api/customers/:id
 * Soft delete customer
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    console.log(`🗑️ Customer deleted: ${customer.name}`);
    
    res.json({ message: 'Customer deleted successfully', customer });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
