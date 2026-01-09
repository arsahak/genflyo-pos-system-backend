const Sale = require("../model/Sale");
const Order = require("../model/Order");
const Customer = require("../model/Customer");
const Product = require("../model/Product");
const Inventory = require("../model/Inventory");

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

    // Build base query
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

    // Fetch all data in parallel
    const [
      currentSales,
      prevSales,
      todaySales,
      currentOrders,
      prevOrders,
      todayOrders,
      totalCustomers,
      totalSuppliers,
      lowStockProducts,
      recentSales,
      topProducts,
    ] = await Promise.all([
      // Current sales
      Sale.find({ ...currentQuery, status: { $ne: "refunded" } }),
      // Previous sales
      Sale.find({ ...prevQuery, status: { $ne: "refunded" } }),
      // Today's sales
      Sale.find({ ...todayQuery, status: { $ne: "refunded" } }),
      // Current orders
      Order.find(currentQuery),
      // Previous orders
      Order.find(prevQuery),
      // Today's orders
      Order.find(todayQuery),
      // Total customers
      Customer.countDocuments({ isActive: true }),
      // Total suppliers (if you have a Supplier model, otherwise return 0)
      Promise.resolve(0), // Placeholder for suppliers
      // Low stock products
      Inventory.find({
        ...(storeId && { storeId }),
        $expr: { $lte: ["$quantity", "$minQuantity"] },
      })
        .populate("productId", "name")
        .limit(10),
      // Recent sales
      Sale.find({ ...currentQuery, status: { $ne: "refunded" } })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("customerId", "name")
        .populate("cashierId", "name"),
      // Top selling products
      Sale.aggregate([
        { $match: currentQuery },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            totalQuantity: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.total" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Calculate sales statistics
    const currentSalesStats = calculateSalesStats(currentSales);
    const prevSalesStats = calculateSalesStats(prevSales);
    const todaySalesStats = calculateSalesStats(todaySales);

    // Calculate sales returns
    const salesReturns = await Sale.find({
      ...currentQuery,
      status: { $in: ["refunded", "partially_refunded"] },
    });
    const prevSalesReturns = await Sale.find({
      ...prevQuery,
      status: { $in: ["refunded", "partially_refunded"] },
    });
    const todaySalesReturns = await Sale.find({
      ...todayQuery,
      status: { $in: ["refunded", "partially_refunded"] },
    });

    const totalSalesReturn = salesReturns.reduce(
      (sum, sale) => sum + sale.total,
      0
    );
    const prevTotalSalesReturn = prevSalesReturns.reduce(
      (sum, sale) => sum + sale.total,
      0
    );
    const todayTotalSalesReturn = todaySalesReturns.reduce(
      (sum, sale) => sum + sale.total,
      0
    );

    // Calculate purchase statistics (placeholder - implement based on your Purchase model)
    const totalPurchase = 0;
    const prevTotalPurchase = 0;
    const todayTotalPurchase = 0;
    const totalPurchaseReturn = 0;
    const prevTotalPurchaseReturn = 0;
    const todayTotalPurchaseReturn = 0;

    // Calculate expenses (placeholder - implement based on your Expense model)
    const totalExpenses = 0;
    const prevTotalExpenses = 0;

    // Calculate profit (simplified - sales - purchases - expenses)
    const profit =
      currentSalesStats.totalRevenue - totalPurchase - totalExpenses;
    const prevProfit = prevSalesStats.totalRevenue - prevTotalPurchase - prevTotalExpenses;

    // Calculate invoice due (placeholder - implement based on your Invoice model)
    const invoiceDue = 0;
    const prevInvoiceDue = 0;

    // Calculate payment returns (placeholder)
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
      todaysOrderCount: todayOrders.length,

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
        orders: currentOrders.length,
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

    const query = {
      ...baseQuery,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    // Sales by day
    const salesByDay = await Sale.aggregate([
      { $match: query },
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

    // For now, generate mock purchase data (replace with real Purchase model later)
    const purchaseByDay = salesByDay.map((day) => ({
      _id: day._id,
      purchases: day.sales * 0.6, // Mock: 60% of sales
      count: Math.floor(day.count * 0.4), // Mock: 40% of sales count
    }));

    // Combine sales and purchases by day
    const salesAndPurchaseByDay = salesByDay.map((sale) => {
      const purchase = purchaseByDay.find((p) => p._id === sale._id);
      return {
        date: sale._id,
        sales: sale.sales,
        purchases: purchase?.purchases || 0,
        salesCount: sale.count,
        purchaseCount: purchase?.count || 0,
      };
    });

    // Sales by payment method
    const salesByPaymentMethod = await Sale.aggregate([
      { $match: query },
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
          ...query,
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
          ...query,
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

    return {
      firstTime: newCustomerIds.length,
      firstTimeChange: calculatePercentageChange(
        newCustomerIds.length,
        prevCustomerIds.length - returningCustomerIds.length
      ),
      return: returningCustomerIds.length,
      returnChange: calculatePercentageChange(
        returningCustomerIds.length,
        prevCustomerIds.filter((id) =>
          currentCustomerIds.some((currId) => currId.equals(id))
        ).length
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
