const Inventory = require("../model/Inventory");
const Product = require("../model/Product");

/**
 * Get all inventory for a store with filters
 */
const getAllInventory = async (req, res) => {
  try {
    const { storeId, lowStock, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (storeId) query.storeId = storeId;

    // Low stock filter
    if (lowStock === "true") {
      query.$expr = { $lte: ["$quantity", "$minStock"] };
    }

    const inventories = await Inventory.find(query)
      .populate("productId", "name sku barcode category price image")
      .populate("storeId", "name")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ updatedAt: -1 });

    // Filter by search after populating
    let filteredInventories = inventories;
    if (search) {
      filteredInventories = inventories.filter(
        (inv) =>
          inv.productId?.name?.toLowerCase().includes(search.toLowerCase()) ||
          inv.productId?.sku?.toLowerCase().includes(search.toLowerCase()) ||
          inv.productId?.barcode?.includes(search) ||
          inv.location?.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = await Inventory.countDocuments(query);

    res.json({
      inventories: filteredInventories,
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
 * Get inventory by store (legacy support)
 */
const getInventoryByStore = async (req, res) => {
  try {
    const inventories = await Inventory.find({ storeId: req.params.storeId })
      .populate("productId", "name sku barcode category price")
      .populate("storeId", "name")
      .sort({ "productId.name": 1 });

    res.json(inventories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get low stock items
 */
const getLowStockItems = async (req, res) => {
  try {
    const { storeId } = req.query;

    const query = {
      $expr: { $lte: ["$quantity", "$minStock"] },
    };
    if (storeId) query.storeId = storeId;

    const lowStockItems = await Inventory.find(query)
      .populate("productId", "name sku barcode category price")
      .populate("storeId", "name")
      .sort({ quantity: 1 });

    res.json(lowStockItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get inventory statistics (optimized with aggregation)
 */
const getInventoryStats = async (req, res) => {
  try {
    const { storeId } = req.query;

    const matchStage = {};
    if (storeId) matchStage.storeId = storeId;

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                totalItems: { $sum: 1 },
                totalQuantity: { $sum: "$quantity" },
                lowStockItems: {
                  $sum: {
                    $cond: [{ $lte: ["$quantity", "$minStock"] }, 1, 0],
                  },
                },
                outOfStockItems: {
                  $sum: {
                    $cond: [{ $eq: ["$quantity", 0] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
      { $unwind: { path: "$stats", preserveNullAndEmptyArrays: true } },
      { $replaceRoot: { newRoot: "$stats" } },
    ];

    const result = await Inventory.aggregate(pipeline);

    const stats = result[0] || {
      totalItems: 0,
      totalQuantity: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    };

    // Remove the _id field from aggregation
    delete stats._id;

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Adjust inventory (add/remove stock)
 */
const adjustInventory = async (req, res) => {
  try {
    const { productId, storeId, adjustment, reason, location, minStock, maxStock } = req.body;

    // Validation
    if (!productId || !storeId || adjustment === undefined) {
      return res.status(400).json({
        message: "Product ID, Store ID, and adjustment quantity are required",
      });
    }

    // Find or create inventory entry
    let inventory = await Inventory.findOne({ productId, storeId });

    if (!inventory) {
      // Create new inventory entry
      inventory = new Inventory({
        productId,
        storeId,
        quantity: Math.max(0, adjustment),
        minStock: minStock || 10,
        maxStock: maxStock || 1000,
        location: location || "Main Store",
        lastRestocked: new Date(),
      });
    } else {
      // Update existing inventory
      inventory.quantity = Math.max(0, inventory.quantity + adjustment);
      if (location) inventory.location = location;
      if (minStock !== undefined) inventory.minStock = minStock;
      if (maxStock !== undefined) inventory.maxStock = maxStock;
      if (adjustment > 0) inventory.lastRestocked = new Date();
    }

    await inventory.save();

    // Also update product stock if product has stock field
    const product = await Product.findById(productId);
    if (product && product.stock !== undefined) {
      product.stock = Math.max(0, product.stock + adjustment);
      await product.save();
    }

    const populatedInventory = await Inventory.findById(inventory._id)
      .populate("productId", "name sku barcode")
      .populate("storeId", "name");

    res.json({
      message: `Inventory adjusted successfully (${adjustment > 0 ? "+" : ""}${adjustment})`,
      inventory: populatedInventory,
      reason,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Batch adjust multiple items
 */
const batchAdjustInventory = async (req, res) => {
  try {
    const { adjustments, reason } = req.body;

    if (!adjustments || !Array.isArray(adjustments)) {
      return res.status(400).json({ message: "Adjustments array is required" });
    }

    const results = [];
    const errors = [];

    for (const adj of adjustments) {
      try {
        const { productId, storeId, adjustment } = adj;

        let inventory = await Inventory.findOne({ productId, storeId });

        if (inventory) {
          inventory.quantity = Math.max(0, inventory.quantity + adjustment);
          await inventory.save();
          results.push({ productId, success: true });
        } else {
          errors.push({ productId, error: "Inventory not found" });
        }
      } catch (error) {
        errors.push({ productId: adj.productId, error: error.message });
      }
    }

    res.json({
      message: `Batch adjustment completed: ${results.length} success, ${errors.length} errors`,
      results,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Transfer inventory between stores
 */
const transferInventory = async (req, res) => {
  try {
    const { productId, fromStoreId, toStoreId, quantity, reason } = req.body;

    // Validation
    if (!productId || !fromStoreId || !toStoreId || !quantity || quantity <= 0) {
      return res.status(400).json({
        message: "Product ID, from/to store IDs, and valid quantity are required",
      });
    }

    // Check from inventory
    const fromInventory = await Inventory.findOne({ productId, storeId: fromStoreId });
    if (!fromInventory) {
      return res.status(404).json({ message: "Source inventory not found" });
    }

    if (fromInventory.quantity < quantity) {
      return res.status(400).json({
        message: `Insufficient quantity. Available: ${fromInventory.quantity}, Required: ${quantity}`,
      });
    }

    // Deduct from source
    fromInventory.quantity -= quantity;
    await fromInventory.save();

    // Add to destination
    let toInventory = await Inventory.findOne({ productId, storeId: toStoreId });
    if (!toInventory) {
      toInventory = new Inventory({
        productId,
        storeId: toStoreId,
        quantity: quantity,
        minStock: fromInventory.minStock,
        maxStock: fromInventory.maxStock,
        lastRestocked: new Date(),
      });
    } else {
      toInventory.quantity += quantity;
      toInventory.lastRestocked = new Date();
    }
    await toInventory.save();

    res.json({
      message: `Successfully transferred ${quantity} units`,
      from: await Inventory.findById(fromInventory._id).populate("storeId", "name"),
      to: await Inventory.findById(toInventory._id).populate("storeId", "name"),
      reason,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update inventory settings (min/max stock, location)
 */
const updateInventory = async (req, res) => {
  try {
    const { minStock, maxStock, location } = req.body;

    const inventory = await Inventory.findById(req.params.id);
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (minStock !== undefined) inventory.minStock = minStock;
    if (maxStock !== undefined) inventory.maxStock = maxStock;
    if (location !== undefined) inventory.location = location;

    await inventory.save();

    const updated = await Inventory.findById(inventory._id)
      .populate("productId", "name sku")
      .populate("storeId", "name");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete inventory entry
 */
const deleteInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndDelete(req.params.id);
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    res.json({ message: "Inventory deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllInventory,
  getInventoryByStore,
  getLowStockItems,
  getInventoryStats,
  adjustInventory,
  batchAdjustInventory,
  transferInventory,
  updateInventory,
  deleteInventory,
};

