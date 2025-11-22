const express = require('express');
const router = express.Router();
const Sale = require('../model/Sale');
const Customer = require('../model/Customer');
const Product = require('../model/Product');
const Inventory = require('../model/Inventory');
const { auth } = require('../midleware/auth');

// ==================== SALES REPORTS ====================

// Sales Overview Report
router.get('/sales', auth, async (req, res) => {
  try {
    const { storeId, from, to, groupBy = 'day' } = req.query;
    
    // Build query
    const query = {};
    if (storeId) query.storeId = storeId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(query)
      .populate('customerId', 'name phone email')
      .populate('cashierId', 'name')
      .populate('storeId', 'name')
      .sort({ createdAt: -1 });

    // Calculate metrics
    const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
    const totalDiscount = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
    const totalTax = sales.reduce((sum, s) => sum + (s.tax || 0), 0);
    const subtotal = sales.reduce((sum, s) => sum + s.subtotal, 0);
    const totalItems = sales.reduce((sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const averageOrderValue = sales.length > 0 ? totalSales / sales.length : 0;

    // Group by time period
    const groupedData = groupSalesByPeriod(sales, groupBy);

    // Payment method breakdown
    const paymentMethods = {};
    sales.forEach(sale => {
      sale.payments.forEach(payment => {
        if (!paymentMethods[payment.method]) {
          paymentMethods[payment.method] = { count: 0, total: 0 };
        }
        paymentMethods[payment.method].count++;
        paymentMethods[payment.method].total += payment.amount;
      });
    });

    // Top selling products
    const productSales = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const productKey = item.productId?.toString() || item.name;
        if (!productSales[productKey]) {
          productSales[productKey] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[productKey].quantity += item.quantity;
        productSales[productKey].revenue += item.totalPrice;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      summary: {
        totalSales,
        totalDiscount,
        totalTax,
        subtotal,
        totalOrders: sales.length,
        totalItems,
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2))
      },
      groupedData,
      paymentMethods,
      topProducts,
      sales: sales.slice(0, 100) // Limit to recent 100 for performance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Sales by Product Report
router.get('/sales/by-product', auth, async (req, res) => {
  try {
    const { storeId, from, to, limit = 20 } = req.query;
    
    const query = {};
    if (storeId) query.storeId = storeId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(query);
    
    const productStats = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.productId?.toString() || item.name;
        if (!productStats[key]) {
          productStats[key] = {
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            quantity: 0,
            revenue: 0,
            orders: 0
          };
        }
        productStats[key].quantity += item.quantity;
        productStats[key].revenue += item.totalPrice;
        productStats[key].orders++;
      });
    });

    const sortedProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, parseInt(limit));

    res.json(sortedProducts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== FINANCIAL REPORTS ====================

// Financial Overview Report
router.get('/financial', auth, async (req, res) => {
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

    // Revenue calculations
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const grossRevenue = sales.reduce((sum, s) => sum + s.subtotal, 0);
    const totalDiscount = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
    const totalTax = sales.reduce((sum, s) => sum + (s.tax || 0), 0);

    // Cost calculations (from product cost * quantity)
    let totalCost = 0;
    for (const sale of sales) {
      for (const item of sale.items) {
        const product = await Product.findById(item.productId);
        if (product && product.cost) {
          totalCost += product.cost * item.quantity;
        }
      }
    }

    const grossProfit = grossRevenue - totalCost;
    const netProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

    // Payment method breakdown
    const paymentBreakdown = {};
    sales.forEach(sale => {
      sale.payments.forEach(payment => {
        if (!paymentBreakdown[payment.method]) {
          paymentBreakdown[payment.method] = 0;
        }
        paymentBreakdown[payment.method] += payment.amount;
      });
    });

    // Daily revenue trend
    const dailyRevenue = {};
    sales.forEach(sale => {
      const date = new Date(sale.createdAt).toISOString().split('T')[0];
      if (!dailyRevenue[date]) {
        dailyRevenue[date] = { revenue: 0, orders: 0, profit: 0 };
      }
      dailyRevenue[date].revenue += sale.total;
      dailyRevenue[date].orders++;
    });

    const revenueTrend = Object.entries(dailyRevenue)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        grossRevenue: parseFloat(grossRevenue.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        profitMargin: parseFloat(profitMargin),
        totalDiscount: parseFloat(totalDiscount.toFixed(2)),
        totalTax: parseFloat(totalTax.toFixed(2)),
        totalOrders: sales.length
      },
      paymentBreakdown,
      revenueTrend
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Profit & Loss Report
router.get('/financial/profit-loss', auth, async (req, res) => {
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

    let revenue = 0;
    let cost = 0;
    let discount = 0;
    let tax = 0;

    for (const sale of sales) {
      revenue += sale.total;
      discount += sale.discount || 0;
      tax += sale.tax || 0;

      for (const item of sale.items) {
        const product = await Product.findById(item.productId);
        if (product && product.cost) {
          cost += product.cost * item.quantity;
        }
      }
    }

    const grossProfit = revenue - cost - discount;
    const netProfit = grossProfit;
    const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0;

    res.json({
      income: {
        totalRevenue: parseFloat(revenue.toFixed(2)),
        totalTax: parseFloat(tax.toFixed(2))
      },
      expenses: {
        costOfGoodsSold: parseFloat(cost.toFixed(2)),
        discounts: parseFloat(discount.toFixed(2))
      },
      profit: {
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        profitMargin: parseFloat(profitMargin)
      },
      period: { from, to }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== CUSTOMER REPORTS ====================

// Customer Overview Report
router.get('/customers', auth, async (req, res) => {
  try {
    const { from, to, membershipTier } = req.query;
    
    const customerQuery = {};
    if (membershipTier) customerQuery.membershipTier = membershipTier;

    const customers = await Customer.find(customerQuery);

    const salesQuery = {};
    if (from || to) {
      salesQuery.createdAt = {};
      if (from) salesQuery.createdAt.$gte = new Date(from);
      if (to) salesQuery.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(salesQuery).populate('customerId');

    // Customer metrics
    const totalCustomers = customers.length;
    const activeCustomers = new Set(sales.map(s => s.customerId?._id?.toString()).filter(Boolean)).size;
    
    // Membership breakdown
    const membershipBreakdown = {};
    customers.forEach(customer => {
      const tier = customer.membershipTier || 'regular';
      membershipBreakdown[tier] = (membershipBreakdown[tier] || 0) + 1;
    });

    // Customer purchase analysis
    const customerPurchases = {};
    sales.forEach(sale => {
      const customerId = sale.customerId?._id?.toString();
      if (customerId) {
        if (!customerPurchases[customerId]) {
          customerPurchases[customerId] = {
            name: sale.customerId.name,
            phone: sale.customerId.phone,
            membershipTier: sale.customerId.membershipTier,
            totalSpent: 0,
            orderCount: 0,
            lastPurchase: sale.createdAt
          };
        }
        customerPurchases[customerId].totalSpent += sale.total;
        customerPurchases[customerId].orderCount++;
        if (new Date(sale.createdAt) > new Date(customerPurchases[customerId].lastPurchase)) {
          customerPurchases[customerId].lastPurchase = sale.createdAt;
        }
      }
    });

    // Top customers
    const topCustomers = Object.values(customerPurchases)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Average customer value
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const averageCustomerValue = activeCustomers > 0 ? totalRevenue / activeCustomers : 0;

    res.json({
      summary: {
        totalCustomers,
        activeCustomers,
        newCustomers: customers.filter(c => 
          !from || new Date(c.createdAt) >= new Date(from)
        ).length,
        averageCustomerValue: parseFloat(averageCustomerValue.toFixed(2))
      },
      membershipBreakdown,
      topCustomers,
      customerActivity: Object.values(customerPurchases).slice(0, 50)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Customer Retention Report
router.get('/customers/retention', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    
    const salesQuery = {};
    if (from || to) {
      salesQuery.createdAt = {};
      if (from) salesQuery.createdAt.$gte = new Date(from);
      if (to) salesQuery.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(salesQuery).populate('customerId');

    // Calculate repeat customers
    const customerPurchaseCount = {};
    sales.forEach(sale => {
      const customerId = sale.customerId?._id?.toString();
      if (customerId) {
        customerPurchaseCount[customerId] = (customerPurchaseCount[customerId] || 0) + 1;
      }
    });

    const totalCustomers = Object.keys(customerPurchaseCount).length;
    const repeatCustomers = Object.values(customerPurchaseCount).filter(count => count > 1).length;
    const retentionRate = totalCustomers > 0 ? ((repeatCustomers / totalCustomers) * 100).toFixed(2) : 0;

    // Purchase frequency distribution
    const frequencyDistribution = {
      '1': 0,
      '2-3': 0,
      '4-5': 0,
      '6-10': 0,
      '10+': 0
    };

    Object.values(customerPurchaseCount).forEach(count => {
      if (count === 1) frequencyDistribution['1']++;
      else if (count <= 3) frequencyDistribution['2-3']++;
      else if (count <= 5) frequencyDistribution['4-5']++;
      else if (count <= 10) frequencyDistribution['6-10']++;
      else frequencyDistribution['10+']++;
    });

    res.json({
      summary: {
        totalCustomers,
        repeatCustomers,
        oneTimeBuyers: totalCustomers - repeatCustomers,
        retentionRate: parseFloat(retentionRate)
      },
      frequencyDistribution
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== INVENTORY REPORTS ====================

// Inventory Overview Report
router.get('/inventory', auth, async (req, res) => {
  try {
    const { storeId, lowStock } = req.query;
    
    const query = {};
    if (storeId) query.storeId = storeId;

    const inventory = await Inventory.find(query)
      .populate('productId', 'name sku category price cost')
      .populate('storeId', 'name');

    // Calculate metrics
    const totalItems = inventory.length;
    const totalQuantity = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    const totalValue = inventory.reduce((sum, inv) => {
      const price = inv.productId?.price || 0;
      return sum + (price * inv.quantity);
    }, 0);

    const lowStockItems = inventory.filter(inv => inv.quantity <= (inv.minStock || 0));
    const outOfStockItems = inventory.filter(inv => inv.quantity === 0);
    const overstockItems = inventory.filter(inv => inv.maxStock && inv.quantity >= inv.maxStock);

    // Category breakdown
    const categoryBreakdown = {};
    inventory.forEach(inv => {
      const category = inv.productId?.category || 'Uncategorized';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { items: 0, quantity: 0, value: 0 };
      }
      categoryBreakdown[category].items++;
      categoryBreakdown[category].quantity += inv.quantity;
      categoryBreakdown[category].value += (inv.productId?.price || 0) * inv.quantity;
    });

    // Stock status distribution
    const stockStatus = {
      inStock: inventory.filter(inv => inv.quantity > (inv.minStock || 0)).length,
      lowStock: lowStockItems.length,
      outOfStock: outOfStockItems.length,
      overstock: overstockItems.length
    };

    res.json({
      summary: {
        totalItems,
        totalQuantity,
        totalValue: parseFloat(totalValue.toFixed(2)),
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        overstockCount: overstockItems.length
      },
      stockStatus,
      categoryBreakdown,
      lowStockItems: lowStockItems.slice(0, 20),
      outOfStockItems: outOfStockItems.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stock Movement Report
router.get('/inventory/movement', auth, async (req, res) => {
  try {
    const { storeId, from, to } = req.query;
    
    const salesQuery = {};
    if (storeId) salesQuery.storeId = storeId;
    if (from || to) {
      salesQuery.createdAt = {};
      if (from) salesQuery.createdAt.$gte = new Date(from);
      if (to) salesQuery.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(salesQuery);

    // Calculate product movements
    const productMovement = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const productId = item.productId?.toString();
        if (productId) {
          if (!productMovement[productId]) {
            productMovement[productId] = {
              name: item.name,
              sku: item.sku,
              sold: 0,
              revenue: 0
            };
          }
          productMovement[productId].sold += item.quantity;
          productMovement[productId].revenue += item.totalPrice;
        }
      });
    });

    // Sort by most sold
    const topMovers = Object.values(productMovement)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 20);

    // Slow movers (products with low sales)
    const slowMovers = Object.values(productMovement)
      .sort((a, b) => a.sold - b.sold)
      .slice(0, 20);

    res.json({
      topMovers,
      slowMovers,
      totalProductsSold: Object.keys(productMovement).length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

function groupSalesByPeriod(sales, groupBy) {
  const grouped = {};

  sales.forEach(sale => {
    let key;
    const date = new Date(sale.createdAt);

    switch (groupBy) {
      case 'hour':
        key = `${date.toISOString().split('T')[0]} ${date.getHours()}:00`;
        break;
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = date.toISOString().split('T')[0];
    }

    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        sales: 0,
        orders: 0,
        items: 0
      };
    }

    grouped[key].sales += sale.total;
    grouped[key].orders++;
    grouped[key].items += sale.items.reduce((sum, item) => sum + item.quantity, 0);
  });

  return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
}

module.exports = router;
