const SourcedItem = require("../model/SourcedItem");
const mongoose = require("mongoose");

/**
 * Get all sourced items with pagination and filtering
 */
const getAllSourcedItems = async (req, res) => {
  console.log("getAllSourcedItems called", req.query);
  try {
    const { storeId, page = 1, limit = 50, startDate, endDate, search } = req.query;

    const query = {};
    if (storeId) query.storeId = storeId;

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search by product name
    if (search) {
      query.productName = { $regex: search, $options: "i" };
    }

    const sourcedItems = await SourcedItem.find(query)
      .populate("storeId", "name")
      .populate("sourcedBy", "name email")
      .populate("saleId", "saleNo")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SourcedItem.countDocuments(query);

    // Calculate summary stats for the filtered result
    const stats = {
      totalItems: total,
      totalCost: 0,
      totalProfit: 0,
    };
    
    const matchQuery = { ...query };
    if (matchQuery.storeId) {
        try {
            matchQuery.storeId = new mongoose.Types.ObjectId(matchQuery.storeId);
        } catch (e) {
            console.warn("Invalid storeId in sourced items query:", matchQuery.storeId);
            delete matchQuery.storeId;
        }
    }

    const aggregation = await SourcedItem.aggregate([
       { $match: matchQuery },
       { $group: { 
           _id: null, 
           totalCost: { $sum: { $multiply: ["$sourcingCost", "$quantity"] } },
           totalProfit: { $sum: "$profit" }
       }}
    ]);

    if (aggregation.length > 0) {
        stats.totalCost = aggregation[0].totalCost;
        stats.totalProfit = aggregation[0].totalProfit;
    }

    res.json({
      success: true,
      data: sourcedItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      stats
    });
  } catch (error) {
    console.error("Get sourced items error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a sourced item record (admin only usually)
 */
const deleteSourcedItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await SourcedItem.findByIdAndDelete(id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }
        res.json({ success: true, message: "Record deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
  getAllSourcedItems,
  deleteSourcedItem
};
