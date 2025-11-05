const express = require('express');
const router = express.Router();
const Sale = require('../model/Sale');
const Inventory = require('../model/Inventory');
const Product = require('../model/Product');
const { auth } = require('../midleware/auth');

// Create sale
router.post('/', auth, async (req, res) => {
  const session = await Sale.startSession();
  session.startTransaction();
  
  try {
    const { storeId, items, payments, customerId } = req.body;
    
    // Calculate totals
    let subtotal = 0;
    let tax = 0;
    
    const saleItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      const variant = item.variantId !== undefined ? product.variants[item.variantId] : null;
      const unitPrice = variant?.price || product.variants[0]?.price || 0;
      const itemTax = (unitPrice * item.quantity * product.taxRate) / 100;
      
      const itemTotal = (unitPrice * item.quantity) - (item.discount || 0) + itemTax;
      
      saleItems.push({
        productId: item.productId,
        variantId: item.variantId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        discount: item.discount || 0,
        tax: itemTax,
        total: itemTotal
      });

      subtotal += unitPrice * item.quantity;
      tax += itemTax;

      // Update inventory
      const inventory = await Inventory.findOne({ productId: item.productId, storeId }).session(session);
      if (inventory) {
        if (inventory.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
        inventory.quantity -= item.quantity;
        await inventory.save({ session });
      }
    }

    // Generate sale number
    const saleCount = await Sale.countDocuments();
    const saleNo = `SALE-${Date.now()}-${saleCount}`;

    const sale = new Sale({
      storeId,
      saleNo,
      items: saleItems,
      subtotal,
      tax,
      discount: 0,
      total: subtotal + tax,
      payments,
      customerId,
      cashierId: req.userId
    });

    await sale.save({ session });
    await session.commitTransaction();

    res.status(201).json(sale);
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Get sales
router.get('/', auth, async (req, res) => {
  try {
    const { storeId, from, to, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (storeId) query.storeId = storeId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(query)
      .populate('cashierId', 'name')
      .populate('customerId', 'name phone')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
