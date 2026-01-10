require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../model/User');
const Role = require('../model/Role');

const defaultRoles = [
  {
    name: 'super_admin',
    description: 'Super Administrator with full system access',
    permissions: [
      { resource: 'dashboard', actions: ['read'] },
      { resource: 'products', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'inventory', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'sales', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'orders', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'customers', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'suppliers', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'barcodes', actions: ['create', 'read', 'delete', 'manage'] },
      { resource: 'reports', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'stores', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'settings', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'analytics', actions: ['create', 'read', 'update', 'delete', 'manage'] }
    ],
    isSystemRole: true
  },
  {
    name: 'admin',
    description: 'Administrator with management access',
    permissions: [
      { resource: 'dashboard', actions: ['read'] },
      { resource: 'products', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'inventory', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'sales', actions: ['create', 'read', 'update'] },
      { resource: 'orders', actions: ['create', 'read', 'update'] },
      { resource: 'customers', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'suppliers', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'barcodes', actions: ['create', 'read', 'delete'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'users', actions: ['read', 'create', 'update'] },
      { resource: 'stores', actions: ['read', 'update'] },
      { resource: 'analytics', actions: ['read'] }
    ],
    isSystemRole: true
  },
  {
    name: 'manager',
    description: 'Store Manager with operational access',
    permissions: [
      { resource: 'dashboard', actions: ['read'] },
      { resource: 'products', actions: ['read', 'update'] },
      { resource: 'inventory', actions: ['read', 'update'] },
      { resource: 'sales', actions: ['read', 'create'] },
      { resource: 'orders', actions: ['read', 'update'] },
      { resource: 'customers', actions: ['read', 'create', 'update'] },
      { resource: 'suppliers', actions: ['read', 'update'] },
      { resource: 'barcodes', actions: ['read', 'create'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'analytics', actions: ['read'] }
    ],
    isSystemRole: true
  },
  {
    name: 'cashier',
    description: 'Cashier for processing sales - Limited access to dashboard and sales only',
    permissions: [
      { resource: 'dashboard', actions: ['read'] },
      { resource: 'sales', actions: ['create', 'read'] }
    ],
    isSystemRole: true
  }
];

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pos_software');
    console.log('✅ Connected to MongoDB');

    // Create roles
    for (const roleData of defaultRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (!existingRole) {
        const role = await Role.create(roleData);
        console.log(`✅ Created role: ${role.name}`);
      } else {
        console.log(`⚠️  Role already exists: ${existingRole.name}`);
      }
    }

    // Create super admin user
    const superAdminRole = await Role.findOne({ name: 'super_admin' });
    if (superAdminRole) {
      const existingSuperAdmin = await User.findOne({ email: 'admin@pos.com' });
      if (!existingSuperAdmin) {
        const superAdmin = await User.create({
          name: 'Super Admin',
          email: 'admin@pos.com',
          password: 'admin123', // Will be hashed automatically
          role: 'super_admin',
          roleId: superAdminRole._id,
          isActive: true
        });
        console.log('✅ Created super admin user: admin@pos.com / admin123');
      } else {
        console.log('⚠️  Super admin already exists');
      }
    }

    console.log('✅ Seeding completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedRoles();
