const Sale = require("../model/Sale");
const Inventory = require("../model/Inventory");
const Product = require("../model/Product");
const SourcedItem = require("../model/SourcedItem");

/**
 * Create sale
 */
const createSale = async (req, res) => {
  const session = await Sale.startSession();
  session.startTransaction();

  try {
    const { storeId, items, payments, customerId } = req.body;

    // Validate required fields
    if (!storeId) {
      throw new Error("Store ID is required");
    }

    if (!items || items.length === 0) {
      throw new Error("At least one item is required");
    }

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let tax = 0;

    const saleItems = [];
    const sourcedItemsToCreate = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      if (!product.isActive) {
        throw new Error(`Product ${product.name} is not active`);
      }

      // Check if item is externally sourced
      const isSourced = item.isSourced || false;
      const sourcingCost = item.sourcingCost || 0;

      // Get unit price description
      let unitPrice = 0;
      // If sourced, use the custom price from cart if provided (though frontend sends it as unitPrice in payload logic usually, let's stick to standard flow or override)
      // Actually standard flow uses product price. If sourced, we sent 'price' in item.price? 
      // Req.body.items usually has productId, quantity... let's assume item has price override if allowed
      
      // But typically we fetch price from DB for security. 
      // For sourced items, we MUST use the price sent from frontend because it's a dynamic deal.
      if (isSourced && item.price) {
          unitPrice = item.price; 
      } else if (item.variantId !== undefined && product.variants && product.variants.length > 0) {
        const variant = product.variants[item.variantId];
        unitPrice = variant?.price || 0;
      } else {
        unitPrice = product.price || 0;
      }

      if (unitPrice === 0) {
        throw new Error(`Price not found for product ${product.name}`);
      }

      // Calculate tax (default to 0% if not specified)
      const taxRate = product.taxRate || 0;
      const itemSubtotal = unitPrice * item.quantity;
      const itemDiscount = item.discount || 0;
      const itemTax = ((itemSubtotal - itemDiscount) * taxRate) / 100;
      const itemTotal = itemSubtotal - itemDiscount + itemTax;

      saleItems.push({
        productId: item.productId,
        variantId: item.variantId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        tax: itemTax,
        total: itemTotal,
        isSourced,
        sourcingCost
      });

      if (isSourced) {
         sourcedItemsToCreate.push({
            storeId,
            productId: item.productId,
            productName: product.name,
            quantity: item.quantity,
            sourcingCost: sourcingCost,
            salePrice: unitPrice,
            profit: (unitPrice - sourcingCost) * item.quantity,
            sourcedBy: req.userId
         });
      }

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      tax += itemTax;

      // Update product stock (for NON-SOURCED items only)
      if (!isSourced && product.stock !== undefined) {
        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${product.stock}, Required: ${item.quantity}`
          );
        }
        product.stock -= item.quantity;
        await product.save({ session });
      }

      // Update inventory (for NON-SOURCED items only)
      if (!isSourced) {
        const inventory = await Inventory.findOne({ productId: item.productId, storeId }).session(session);
        if (inventory) {
          if (inventory.quantity < item.quantity) {
             throw new Error(`Insufficient inventory for ${product.name}`);
          }
          inventory.quantity -= item.quantity;
          await inventory.save({ session });
        }
      }
    }

    // Generate sale number
    const saleCount = await Sale.countDocuments();
    const saleNo = `SALE-${Date.now()}-${saleCount}`;

    // Calculate final total
    const finalTotal = subtotal - totalDiscount + tax;

    const sale = new Sale({
      storeId,
      saleNo,
      items: saleItems,
      subtotal,
      discount: totalDiscount,
      tax,
      total: finalTotal,
      payments: payments || [],
      customerId: customerId || undefined,
      cashierId: req.userId,
      status: "completed",
    });

    await sale.save({ session });
    
    // Save sourced items history
    if (sourcedItemsToCreate.length > 0) {
      // Add saleId to each
      const sourcedDocs = sourcedItemsToCreate.map(si => ({...si, saleId: sale._id}));
      await SourcedItem.insertMany(sourcedDocs, { session });
    }

    await session.commitTransaction();

    // Populate before sending response
    const populatedSale = await Sale.findById(sale._id)
      .populate("customerId", "name phone email membershipType")
      .populate("cashierId", "name email")
      .populate("storeId", "name address");

    res.status(201).json(populatedSale || sale);
  } catch (error) {
    await session.abortTransaction();
    console.error("Sale creation error:", error);
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

/**
 * Get sales
 */
const getAllSales = async (req, res) => {
  try {
    const { storeId, from, to, page = 1, limit = 50, status, search } = req.query;

    const query = {};
    if (storeId) query.storeId = storeId;
    if (status) query.status = status;

    // Date range filter
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    // Search by sale number
    if (search) {
      query.saleNo = { $regex: search, $options: "i" };
    }

    const sales = await Sale.find(query)
      .populate("cashierId", "name email")
      .populate("customerId", "name phone membershipType")
      .populate("storeId", "name")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Sale.countDocuments(query);

    res.json({
      sales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get sale by ID
 */
const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("cashierId", "name email")
      .populate("customerId", "name phone email membershipType")
      .populate("storeId", "name address phone")
      .populate("items.productId", "name sku category");

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update sale (limited to notes and status only)
 */
const updateSale = async (req, res) => {
  try {
    const { notes, status } = req.body;

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    // Only allow updating notes and status (not items or amounts)
    if (notes !== undefined) sale.notes = notes;
    if (status && ["completed", "refunded", "partially_refunded"].includes(status)) {
      sale.status = status;
    }

    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate("cashierId", "name email")
      .populate("customerId", "name phone")
      .populate("storeId", "name");

    res.json(updatedSale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete sale (soft delete by changing status)
 */
const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    // Instead of deleting, mark as cancelled/refunded
    sale.status = "refunded";
    sale.notes = (sale.notes || "") + " [CANCELLED]";
    await sale.save();

    res.json({ message: "Sale cancelled successfully", sale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get sales statistics
 */
const getSalesStats = async (req, res) => {
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

    const stats = {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, sale) => sum + sale.total, 0),
      totalDiscount: sales.reduce((sum, sale) => sum + (sale.discount || 0), 0),
      totalTax: sales.reduce((sum, sale) => sum + (sale.tax || 0), 0),
      completedSales: sales.filter((s) => s.status === "completed").length,
      refundedSales: sales.filter((s) => s.status === "refunded").length,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getSalesStats,
};

