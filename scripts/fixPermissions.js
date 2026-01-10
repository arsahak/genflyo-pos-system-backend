/**
 * Migration Script: Fix User Permissions Structure
 *
 * This script converts user permissions from array format to object format
 * to match the updated User model schema.
 *
 * Run this script when:
 * - Migrating from old schema (permissions as array) to new schema (permissions as object)
 * - After updating the User model to use granular permissions
 *
 * Usage: node scripts/fixPermissions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const fixPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pos_software');
    console.log('✅ Connected to MongoDB\n');

    console.log('🔧 Fixing permissions structure for all users...\n');

    // Get all users
    const users = await mongoose.connection.db.collection('users').find({}).toArray();

    console.log(`Found ${users.length} users\n`);

    for (const user of users) {
      console.log(`Processing: ${user.email}`);

      // Check if permissions is an array or missing
      if (Array.isArray(user.permissions) || !user.permissions) {
        console.log('  - Permissions is array or missing, converting to object...');

        // Set default permissions object based on role
        let defaultPermissions = {};

        if (user.role === 'super_admin') {
          // Super admin gets all permissions
          defaultPermissions = {
            canViewDashboard: true,
            canViewSales: true,
            canCreateSales: true,
            canEditSales: true,
            canDeleteSales: true,
            canProcessRefunds: true,
            canViewSalesReports: true,
            canViewOrders: true,
            canCreateOrders: true,
            canEditOrders: true,
            canDeleteOrders: true,
            canApproveOrders: true,
            canCancelOrders: true,
            canViewProducts: true,
            canAddProducts: true,
            canEditProducts: true,
            canDeleteProducts: true,
            canManageCategories: true,
            canViewInventory: true,
            canManageInventory: true,
            canAdjustStock: true,
            canViewSuppliers: true,
            canAddSuppliers: true,
            canEditSuppliers: true,
            canDeleteSuppliers: true,
            canManageSuppliers: true,
            canViewCustomers: true,
            canAddCustomers: true,
            canEditCustomers: true,
            canDeleteCustomers: true,
            canViewCustomerHistory: true,
            canViewUsers: true,
            canAddUsers: true,
            canEditUsers: true,
            canDeleteUsers: true,
            canManageRoles: true,
            canViewStores: true,
            canAddStores: true,
            canEditStores: true,
            canDeleteStores: true,
            canManageStoreSettings: true,
            canViewBarcodes: true,
            canGenerateBarcodes: true,
            canDeleteBarcodes: true,
            canManageBarcodes: true,
            canViewReports: true,
            canExportReports: true,
            canViewAnalytics: true,
            canManageSettings: true,
            canManagePaymentMethods: true,
            canManageTaxSettings: true,
            canManageReceiptSettings: true,
            canViewSystemLogs: true
          };
        } else if (user.role === 'admin') {
          // Admin gets most permissions
          defaultPermissions = {
            canViewDashboard: true,
            canViewSales: true,
            canCreateSales: true,
            canEditSales: true,
            canDeleteSales: false,
            canProcessRefunds: true,
            canViewSalesReports: true,
            canViewOrders: true,
            canCreateOrders: true,
            canEditOrders: true,
            canDeleteOrders: false,
            canApproveOrders: true,
            canCancelOrders: true,
            canViewProducts: true,
            canAddProducts: true,
            canEditProducts: true,
            canDeleteProducts: false,
            canManageCategories: true,
            canViewInventory: true,
            canManageInventory: true,
            canAdjustStock: true,
            canViewSuppliers: true,
            canAddSuppliers: true,
            canEditSuppliers: true,
            canDeleteSuppliers: false,
            canManageSuppliers: false,
            canViewCustomers: true,
            canAddCustomers: true,
            canEditCustomers: true,
            canDeleteCustomers: false,
            canViewCustomerHistory: true,
            canViewUsers: true,
            canAddUsers: true,
            canEditUsers: true,
            canDeleteUsers: false,
            canManageRoles: false,
            canViewStores: true,
            canAddStores: false,
            canEditStores: true,
            canDeleteStores: false,
            canManageStoreSettings: false,
            canViewBarcodes: true,
            canGenerateBarcodes: true,
            canDeleteBarcodes: true,
            canManageBarcodes: false,
            canViewReports: true,
            canExportReports: true,
            canViewAnalytics: true,
            canManageSettings: false,
            canManagePaymentMethods: false,
            canManageTaxSettings: false,
            canManageReceiptSettings: false,
            canViewSystemLogs: false
          };
        } else if (user.role === 'manager') {
          // Manager gets moderate permissions
          defaultPermissions = {
            canViewDashboard: true,
            canViewSales: true,
            canCreateSales: true,
            canEditSales: true,
            canDeleteSales: false,
            canProcessRefunds: false,
            canViewSalesReports: true,
            canViewOrders: true,
            canCreateOrders: true,
            canEditOrders: true,
            canDeleteOrders: false,
            canApproveOrders: false,
            canCancelOrders: false,
            canViewProducts: true,
            canAddProducts: false,
            canEditProducts: true,
            canDeleteProducts: false,
            canManageCategories: false,
            canViewInventory: true,
            canManageInventory: false,
            canAdjustStock: true,
            canViewSuppliers: true,
            canAddSuppliers: false,
            canEditSuppliers: true,
            canDeleteSuppliers: false,
            canManageSuppliers: false,
            canViewCustomers: true,
            canAddCustomers: true,
            canEditCustomers: true,
            canDeleteCustomers: false,
            canViewCustomerHistory: true,
            canViewUsers: false,
            canAddUsers: false,
            canEditUsers: false,
            canDeleteUsers: false,
            canManageRoles: false,
            canViewStores: true,
            canAddStores: false,
            canEditStores: false,
            canDeleteStores: false,
            canManageStoreSettings: false,
            canViewBarcodes: true,
            canGenerateBarcodes: true,
            canDeleteBarcodes: false,
            canManageBarcodes: false,
            canViewReports: true,
            canExportReports: false,
            canViewAnalytics: true,
            canManageSettings: false,
            canManagePaymentMethods: false,
            canManageTaxSettings: false,
            canManageReceiptSettings: false,
            canViewSystemLogs: false
          };
        } else {
          // Cashier gets minimal permissions - ONLY dashboard and sales
          defaultPermissions = {
            canViewDashboard: true,
            canViewSales: true,
            canCreateSales: true,
            canEditSales: false,
            canDeleteSales: false,
            canProcessRefunds: false,
            canViewSalesReports: false,
            canViewOrders: false,
            canCreateOrders: false,
            canEditOrders: false,
            canDeleteOrders: false,
            canApproveOrders: false,
            canCancelOrders: false,
            canViewProducts: false,
            canAddProducts: false,
            canEditProducts: false,
            canDeleteProducts: false,
            canManageCategories: false,
            canViewInventory: false,
            canManageInventory: false,
            canAdjustStock: false,
            canViewSuppliers: false,
            canAddSuppliers: false,
            canEditSuppliers: false,
            canDeleteSuppliers: false,
            canManageSuppliers: false,
            canViewCustomers: false,
            canAddCustomers: false,
            canEditCustomers: false,
            canDeleteCustomers: false,
            canViewCustomerHistory: false,
            canViewUsers: false,
            canAddUsers: false,
            canEditUsers: false,
            canDeleteUsers: false,
            canManageRoles: false,
            canViewStores: false,
            canAddStores: false,
            canEditStores: false,
            canDeleteStores: false,
            canManageStoreSettings: false,
            canViewBarcodes: false,
            canGenerateBarcodes: false,
            canDeleteBarcodes: false,
            canManageBarcodes: false,
            canViewReports: false,
            canExportReports: false,
            canViewAnalytics: false,
            canManageSettings: false,
            canManagePaymentMethods: false,
            canManageTaxSettings: false,
            canManageReceiptSettings: false,
            canViewSystemLogs: false
          };
        }

        // Update the user document
        await mongoose.connection.db.collection('users').updateOne(
          { _id: user._id },
          { $set: { permissions: defaultPermissions } }
        );

        console.log('  ✅ Permissions updated to object format');
      } else {
        console.log('  ✅ Permissions already in correct format');
      }
    }

    console.log('\n✅ All users processed successfully!');
    console.log('\n🎉 You can now login with: admin@pos.com / admin123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixPermissions();

