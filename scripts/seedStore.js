require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../model/Store');

const seedStore = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pos-db';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');

    // Check if any store exists
    const existingStore = await Store.findOne();
    
    if (existingStore) {
      console.log('✅ Store already exists:', existingStore.name);
      console.log('Store ID:', existingStore._id);
      return existingStore;
    }

    // Create default store
    const defaultStore = new Store({
      name: 'Main Store',
      code: 'MAIN-001',
      type: 'supershop',
      address: {
        street: '123 Main Street',
        city: 'City',
        state: 'State',
        zipCode: '12345',
        country: 'Country'
      },
      phone: '+1234567890',
      email: 'store@example.com',
      timezone: 'UTC',
      settings: {
        currency: 'USD',
        locale: 'en-US',
        receiptHeader: 'Thank you for shopping with us!',
        receiptFooter: 'Visit us again!'
      },
      isActive: true
    });

    await defaultStore.save();
    console.log('✅ Default store created successfully!');
    console.log('Store ID:', defaultStore._id);
    console.log('Store Name:', defaultStore.name);
    console.log('\n🎯 Use this Store ID in your frontend configuration');
    
    return defaultStore;
  } catch (error) {
    console.error('❌ Error seeding store:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('📴 MongoDB Disconnected');
  }
};

// Run if called directly
if (require.main === module) {
  seedStore()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = seedStore;

