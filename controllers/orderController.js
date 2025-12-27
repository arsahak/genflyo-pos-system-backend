const Order = require("../model/Order");

/**
 * Create new order
 */
const createOrder = async (req, res) => {
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
      customerId,
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Get all orders
 */
const getAllOrders = async (req, res) => {
  try {
    const { storeId, status } = req.query;
    const query = {};
    if (storeId) query.storeId = storeId;
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate("waiterId", "name")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update order
 */
const updateOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  updateOrder,
};

