const mongoose = require("mongoose");
const Sale = require("../model/Sale");
const Order = require("../model/Order");
const Customer = require("../model/Customer");
const Product = require("../model/Product");
const Inventory = require("../model/Inventory");
const Supplier = require("../model/Supplier");
const SourcedItem = require("../model/SourcedItem");

/**
 * Get dashboard overview data
 * Returns comprehensive statistics for the dashboard
 */
const getDashboardOverview = async (req, res) => {
  try {
    const { storeId, from, to } = req.query;

    // Set default date range (last 30 days if not specified)
    const endDate = to ? new Date(to) : new Date();
    const startDate = from
      ? new Date(from)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Today's date range (start of day to now)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();

    // Previous period for comparison
    const periodDuration = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDuration);
    const prevEndDate = new Date(startDate);

    // Build base query (storeId stays as string — Mongoose auto-casts in find())
    const baseQuery = {};
    if (storeId) baseQuery.storeId = storeId;

    // Current period query
    const currentQuery = {
      ...baseQuery,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    // Previous period query
    const prevQuery = {
      ...baseQuery,
      createdAt: { $gte: prevStartDate, $lte: prevEndDate },
    };

    // Today's query
    const todayQuery = {
      ...baseQuery,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    };

    // Aggregation pipelines skip Mongoose schema casting, so storeId MUST be
    // an ObjectId explicitly — a raw string will never match stored ObjectIds.
    const storeObjectId =
      storeId && mongoose.Types.ObjectId.isValid(storeId)
        ? new mongoose.Types.ObjectId(storeId)
        : null;
    const aggBase = storeObjectId ? { storeId: storeObjectId } : {};
    const aggCurrentQuery = { ...aggBase, createdAt: { $gte: startDate, $lte: endDate } };
    const aggPrevQuery   = { ...aggBase, createdAt: { $gte: prevStartDate, $lte: prevEndDate } };

    // Sourced-item date queries (for purchase stats)
    const sourcedCurrentQuery = {
      ...(storeId && { storeId }),
      createdAt: { $gte: startDate, $lte: endDate },
    };
    const sourcedPrevQuery = {
      ...(storeId && { storeId }),
      createdAt: { $gte: prevStartDate, $lte: prevEndDate },
    };
    const sourcedTodayQuery = {
      ...(storeId && { storeId }),
      createdAt: { $gte: todayStart, $lte: todayEnd },
    };

    // Fetch all data in parallel
    const [
      currentSales,
      prevSales,
      todaySales,
      currentOrderCount,
      todayOrderCount,
      totalCustomers,
      totalSuppliers,
      lowStockProducts,
      recentSales,
      topProducts,
      // Sales returns
      salesReturns,
      prevSalesReturns,
      todaySalesReturns,
      // Due sales (Invoice Due) — all-time outstanding + period-specific
      allDueSales,
      prevDueSales,
      // Sourced items (Total Purchase)
      currentSourcedItems,
      prevSourcedItems,
      todaySourcedItems,
    ] = await Promise.all([
      // Completed sales — only fetch fields needed for revenue/discount/tax sums
      Sale.find({ ...currentQuery, status: { $nin: ["refunded", "due"] } }).select("total discount tax"),
      Sale.find({ ...prevQuery,    status: { $nin: ["refunded", "due"] } }).select("total discount tax"),
      Sale.find({ ...todayQuery,   status: { $nin: ["refunded", "due"] } }).select("total discount tax"),
      // Order counts — countDocuments is far cheaper than loading full documents
      Order.countDocuments(currentQuery),
      Order.countDocuments(todayQuery),
      // Customer / supplier totals
      Customer.countDocuments({ isActive: true }),
      Supplier.countDocuments({ isActive: true }),
      // Low stock
      Inventory.find({
        ...(storeId && { storeId }),
        $expr: { $lte: ["$quantity", "$minQuantity"] },
      })
        .populate("productId", "name")
        .limit(10),
      // Recent sales (completed + due)
      Sale.find({ ...currentQuery, status: { $ne: "refunded" } })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("customerId", "name")
        .populate("cashierId", "name"),
      // Top selling products — uses aggCurrentQuery so storeId is a proper ObjectId
      Sale.aggregate([
        { $match: { ...aggCurrentQuery, status: { $ne: "refunded" } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            totalQuantity: { $sum: { $abs: "$items.quantity" } },
            totalRevenue: { $sum: { $abs: "$items.total" } },
          },
        },
        // Exclude items that had no productId (null group key)
        { $match: { _id: { $ne: null }, productName: { $ne: null } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 100 },
      ]),
      // Sales returns — only total field needed
      Sale.find({ ...currentQuery, status: { $in: ["refunded", "partially_refunded"] } }).select("total"),
      Sale.find({ ...prevQuery,    status: { $in: ["refunded", "partially_refunded"] } }).select("total"),
      Sale.find({ ...todayQuery,   status: { $in: ["refunded", "partially_refunded"] } }).select("total"),
      // Invoice Due: all-time outstanding (not filtered by period)
      Sale.find({ ...(storeId ? { storeId } : {}), status: "due" }, "dueAmount createdAt"),
      Sale.find({ ...prevQuery, status: "due" }, "dueAmount"),
      // Sourced Items (purchase costs)
      SourcedItem.find(sourcedCurrentQuery, "sourcingCost quantity"),
      SourcedItem.find(sourcedPrevQuery, "sourcingCost quantity"),
      SourcedItem.find(sourcedTodayQuery, "sourcingCost quantity"),
    ]);

    // ── Sales stats ──────────────────────────────────────────────────────────
    const currentSalesStats = calculateSalesStats(currentSales);
    const prevSalesStats = calculateSalesStats(prevSales);
    const todaySalesStats = calculateSalesStats(todaySales);

    // ── Sales Returns ────────────────────────────────────────────────────────
    const totalSalesReturn = salesReturns.reduce((sum, s) => sum + (s.total || 0), 0);
    const prevTotalSalesReturn = prevSalesReturns.reduce((sum, s) => sum + (s.total || 0), 0);
    const todayTotalSalesReturn = todaySalesReturns.reduce((sum, s) => sum + (s.total || 0), 0);

    // ── Total Purchase (from SourcedItem sourcing costs) ─────────────────────
    const totalPurchase = currentSourcedItems.reduce(
      (sum, item) => sum + (item.sourcingCost || 0) * (item.quantity || 0), 0
    );
    const prevTotalPurchase = prevSourcedItems.reduce(
      (sum, item) => sum + (item.sourcingCost || 0) * (item.quantity || 0), 0
    );
    const todayTotalPurchase = todaySourcedItems.reduce(
      (sum, item) => sum + (item.sourcingCost || 0) * (item.quantity || 0), 0
    );

    // ── Total Purchase Return ─────────────────────────────────────────────────
    // No purchase-return model yet; kept as 0 until a Purchase model is added
    const totalPurchaseReturn = 0;
    const prevTotalPurchaseReturn = 0;
    const todayTotalPurchaseReturn = 0;

    // ── Total Expenses (COGS) ─────────────────────────────────────────────────
    // For SOURCED items  → use items.sourcingCost (the actual cost paid per unit
    //   for that specific deal, stored on the sale item at the time of purchase).
    // For REGULAR items  → use product.cost (standard cost from the Product doc).
    // This prevents profit inflation where product.cost << actual sourcing cost.
    const buildCogsPipeline = (matchQuery) => [
      { $match: { ...matchQuery, status: { $nin: ["refunded", "due"] } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $group: {
          _id: null,
          totalCOGS: {
            $sum: {
              $multiply: [
                { $abs: "$items.quantity" },
                {
                  $cond: {
                    if: { $eq: ["$items.isSourced", true] },
                    // Sourced item: use the actual cost paid at sourcing time
                    then: { $ifNull: ["$items.sourcingCost", 0] },
                    // Regular item: use the standard product cost
                    else: {
                      $ifNull: [
                        {
                          $let: {
                            vars: { p: { $arrayElemAt: ["$product", 0] } },
                            in: "$$p.cost",
                          },
                        },
                        0,
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    ];

    const [cogsResult, prevCogsResult] = await Promise.all([
      Sale.aggregate(buildCogsPipeline(aggCurrentQuery)),
      Sale.aggregate(buildCogsPipeline(aggPrevQuery)),
    ]);

    // Guard against any unexpected negative result
    const totalExpenses = Math.max(0, cogsResult[0]?.totalCOGS || 0);
    const prevTotalExpenses = Math.max(0, prevCogsResult[0]?.totalCOGS || 0);

    // ── Invoice Due (total outstanding due amount — all unpaid due sales) ─────
    const invoiceDue = allDueSales.reduce((sum, s) => sum + (s.dueAmount || 0), 0);
    const prevInvoiceDue = prevDueSales.reduce((sum, s) => sum + (s.dueAmount || 0), 0);

    // ── Profit (Net Profit = Revenue − COGS) ─────────────────────────────────
    const profit = currentSalesStats.totalRevenue - totalExpenses;
    const prevProfit = prevSalesStats.totalRevenue - prevTotalExpenses;

    // ── Payment Returns ───────────────────────────────────────────────────────
    const totalPaymentReturns = totalSalesReturn;
    const prevTotalPaymentReturns = prevTotalSalesReturn;

    // Customer analytics
    const customerAnalytics = await getCustomerAnalytics(currentQuery, prevQuery);

    // Format response
    const overview = {
      // Today's KPIs (NEW)
      todaysSales: todaySalesStats.totalRevenue,
      todaysSalesReturn: todayTotalSalesReturn,
      todaysPurchase: todayTotalPurchase,
      todaysPurchaseReturn: todayTotalPurchaseReturn,
      todaysOrderCount: todayOrderCount,

      // Main KPIs with comparison
      totalSales: {
        current: currentSalesStats.totalRevenue,
        previous: prevSalesStats.totalRevenue,
        change: calculatePercentageChange(
          currentSalesStats.totalRevenue,
          prevSalesStats.totalRevenue
        ),
        trend: getTrend(
          currentSalesStats.totalRevenue,
          prevSalesStats.totalRevenue
        ),
      },
      totalSalesReturn: {
        current: totalSalesReturn,
        previous: prevTotalSalesReturn,
        change: calculatePercentageChange(totalSalesReturn, prevTotalSalesReturn),
        trend: getTrend(totalSalesReturn, prevTotalSalesReturn, true), // inverse trend
      },
      totalPurchase: {
        current: totalPurchase,
        previous: prevTotalPurchase,
        change: calculatePercentageChange(totalPurchase, prevTotalPurchase),
        trend: getTrend(totalPurchase, prevTotalPurchase),
      },
      totalPurchaseReturn: {
        current: totalPurchaseReturn,
        previous: prevTotalPurchaseReturn,
        change: calculatePercentageChange(
          totalPurchaseReturn,
          prevTotalPurchaseReturn
        ),
        trend: getTrend(totalPurchaseReturn, prevTotalPurchaseReturn),
      },

      // Secondary KPIs
      profit: {
        current: profit,
        previous: prevProfit,
        change: calculatePercentageChange(profit, prevProfit),
        trend: getTrend(profit, prevProfit),
      },
      invoiceDue: {
        current: invoiceDue,
        previous: prevInvoiceDue,
        change: calculatePercentageChange(invoiceDue, prevInvoiceDue),
        trend: getTrend(invoiceDue, prevInvoiceDue),
      },
      totalExpenses: {
        current: totalExpenses,
        previous: prevTotalExpenses,
        change: calculatePercentageChange(totalExpenses, prevTotalExpenses),
        trend: getTrend(totalExpenses, prevTotalExpenses, true), // inverse trend
      },
      totalPaymentReturns: {
        current: totalPaymentReturns,
        previous: prevTotalPaymentReturns,
        change: calculatePercentageChange(
          totalPaymentReturns,
          prevTotalPaymentReturns
        ),
        trend: getTrend(totalPaymentReturns, prevTotalPaymentReturns, true), // inverse trend
      },

      // Overall information
      overallInformation: {
        suppliers: totalSuppliers,
        customers: totalCustomers,
        orders: currentOrderCount,
        lowStockItems: lowStockProducts.length,
      },

      // Customer analytics
      customerOverview: customerAnalytics,

      // Additional data
      recentSales: recentSales.map((sale) => ({
        id: sale._id,
        saleNo: sale.saleNo,
        total: sale.total,
        customer: sale.customerId?.name || "Walk-in",
        cashier: sale.cashierId?.name || "Unknown",
        createdAt: sale.createdAt,
      })),

      topProducts: topProducts.map((product) => ({
        id: product._id,
        name: product.productName,
        quantity: product.totalQuantity,
        revenue: product.totalRevenue,
      })),

      lowStockProducts: lowStockProducts.map((inv) => ({
        id: inv._id,
        productName: inv.productId?.name || "Unknown",
        currentStock: inv.quantity,
        minStock: inv.minQuantity,
      })),

      // Date range info
      dateRange: {
        from: startDate,
        to: endDate,
      },
    };

    res.json(overview);
  } catch (error) {
    console.error("Dashboard overview error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get detailed dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const { storeId, from, to } = req.query;

    const endDate = to ? new Date(to) : new Date();
    const startDate = from
      ? new Date(from)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const baseQuery = {};
    if (storeId) baseQuery.storeId = storeId;

    // Cast storeId to ObjectId for aggregation pipelines
    const storeObjectId =
      storeId && mongoose.Types.ObjectId.isValid(storeId)
        ? new mongoose.Types.ObjectId(storeId)
        : null;
    const aggBase = storeObjectId ? { storeId: storeObjectId } : {};
    const aggQuery = { ...aggBase, createdAt: { $gte: startDate, $lte: endDate } };

    // Sales by day
    const salesByDay = await Sale.aggregate([
      { $match: aggQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          sales: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Real purchase data from SourcedItem model (grouped by day)
    const purchaseByDay = await SourcedItem.aggregate([
      {
        $match: {
          ...aggBase,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          purchases: {
            $sum: { $multiply: ["$sourcingCost", "$quantity"] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Combine sales and purchases by day (fill gaps where one has data but not the other)
    const allDates = [
      ...new Set([
        ...salesByDay.map((d) => d._id),
        ...purchaseByDay.map((d) => d._id),
      ]),
    ].sort();

    const salesAndPurchaseByDay = allDates.map((date) => {
      const sale = salesByDay.find((d) => d._id === date);
      const purchase = purchaseByDay.find((d) => d._id === date);
      return {
        date,
        sales: sale?.sales || 0,
        purchases: purchase?.purchases || 0,
        salesCount: sale?.count || 0,
        purchaseCount: purchase?.count || 0,
      };
    });

    // Sales by payment method
    const salesByPaymentMethod = await Sale.aggregate([
      { $match: aggQuery },
      { $unwind: "$payments" },
      {
        $group: {
          _id: "$payments.method",
          total: { $sum: "$payments.amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Customer analytics by day for customer overview chart
    const customersByDay = await Sale.aggregate([
      {
        $match: {
          ...aggQuery,
          customerId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            customerId: "$customerId"
          },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          uniqueCustomers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
    ]);

    // Total customers by day (including repeats)
    const totalCustomersByDay = await Sale.aggregate([
      {
        $match: {
          ...aggQuery,
          customerId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalCustomers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
    ]);

    // Combine customer data
    const customerOverviewByDay = customersByDay.map((day) => {
      const total = totalCustomersByDay.find((t) => t._id === day._id);
      return {
        date: day._id,
        newCustomers: day.uniqueCustomers,
        returningCustomers: (total?.totalCustomers || 0) - day.uniqueCustomers,
      };
    });

    res.json({
      salesAndPurchaseByDay,
      salesByPaymentMethod,
      customerOverviewByDay,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Helper functions
function calculateSalesStats(sales) {
  return {
    totalRevenue: sales.reduce((sum, sale) => sum + sale.total, 0),
    totalDiscount: sales.reduce((sum, sale) => sum + (sale.discount || 0), 0),
    totalTax: sales.reduce((sum, sale) => sum + (sale.tax || 0), 0),
    count: sales.length,
  };
}

function calculatePercentageChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function getTrend(current, previous, inverse = false) {
  const change = current - previous;
  if (inverse) {
    return change > 0 ? "down" : change < 0 ? "up" : "neutral";
  }
  return change > 0 ? "up" : change < 0 ? "down" : "neutral";
}

async function getCustomerAnalytics(currentQuery, prevQuery) {
  try {
    // Get customers who made purchases in current period
    const currentCustomerIds = await Sale.distinct("customerId", {
      ...currentQuery,
      customerId: { $exists: true, $ne: null },
    });

    const prevCustomerIds = await Sale.distinct("customerId", {
      ...prevQuery,
      customerId: { $exists: true, $ne: null },
    });

    // Find new customers (in current but not in previous)
    const newCustomerIds = currentCustomerIds.filter(
      (id) => !prevCustomerIds.some((prevId) => prevId.equals(id))
    );

    // Find returning customers (in both periods)
    const returningCustomerIds = currentCustomerIds.filter((id) =>
      prevCustomerIds.some((prevId) => prevId.equals(id))
    );

    // Previous-period "new" customers = those in prev but not seen before prev period.
    // We don't have data two periods back, so use total prev customers as the baseline.
    const prevNewCount = prevCustomerIds.length - returningCustomerIds.length;
    // Previous-period "returning" customers = those in prev who also bought in current.
    // Best available proxy: customers who appear in both periods (returningCustomerIds).
    // We compare current returning count vs prev total unique customers as baseline.
    const prevReturningCount = prevCustomerIds.length > 0
      ? prevCustomerIds.filter((id) =>
          // count as "previously returning" those in prev who are still buying now
          currentCustomerIds.some((currId) => currId.equals(id))
        ).length
      : 0;

    return {
      firstTime: newCustomerIds.length,
      firstTimeChange: calculatePercentageChange(
        newCustomerIds.length,
        Math.max(0, prevNewCount)
      ),
      return: returningCustomerIds.length,
      returnChange: calculatePercentageChange(
        returningCustomerIds.length,
        prevReturningCount
      ),
    };
  } catch (error) {
    console.error("Customer analytics error:", error);
    return {
      firstTime: 0,
      firstTimeChange: 0,
      return: 0,
      returnChange: 0,
    };
  }
}

module.exports = {
  getDashboardOverview,
  getDashboardStats,
};
