/**
 * Migration script to add country and contact fields to existing brands
 * This ensures existing brands have the new fields with default empty string values
 * 
 * Usage: node backend/scripts/migrateBrands.js
 */

const mongoose = require('mongoose');
const Brand = require('../model/brands');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function migrateBrands() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pos-system';
    console.log('🔌 Connecting to MongoDB:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all brands
    const brands = await Brand.find({});
    console.log(`📦 Found ${brands.length} brands in database\n`);

    if (brands.length === 0) {
      console.log('⚠️  No brands found in database. Nothing to migrate.');
      await mongoose.connection.close();
      return;
    }

    let updated = 0;
    let alreadyUpdated = 0;

    for (const brand of brands) {
      const updates = {};
      let needsUpdate = false;

      // Check if new fields are missing or undefined
      if (brand.country === undefined) {
        updates.country = '';
        needsUpdate = true;
      }
      if (brand.contact === undefined) {
        updates.contact = '';
        needsUpdate = true;
      }
      if (brand.phone === undefined) {
        updates.phone = '';
        needsUpdate = true;
      }
      if (brand.email === undefined) {
        updates.email = '';
        needsUpdate = true;
      }
      if (brand.website === undefined) {
        updates.website = '';
        needsUpdate = true;
      }
      if (brand.address === undefined) {
        updates.address = '';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Brand.findByIdAndUpdate(brand._id, { $set: updates });
        console.log(`✅ Updated brand: "${brand.name}" (ID: ${brand._id})`);
        console.log(`   Added fields: ${Object.keys(updates).join(', ')}`);
        updated++;
      } else {
        console.log(`⏭️  Skipped brand: "${brand.name}" (already has all fields)`);
        alreadyUpdated++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Migration complete!`);
    console.log(`   - Updated: ${updated} brands`);
    console.log(`   - Already up-to-date: ${alreadyUpdated} brands`);
    console.log(`   - Total: ${brands.length} brands`);
    console.log(`${'='.repeat(60)}\n`);

    // Display all brands with their fields
    console.log('📋 Current brands in database:\n');
    const allBrands = await Brand.find({}).lean();
    
    allBrands.forEach((brand, index) => {
      console.log(`${index + 1}. ${brand.name}`);
      console.log(`   ID: ${brand._id}`);
      console.log(`   Country: ${brand.country || '(empty)'}`);
      console.log(`   Contact: ${brand.contact || '(empty)'}`);
      console.log(`   Phone: ${brand.phone || '(empty)'}`);
      console.log(`   Email: ${brand.email || '(empty)'}`);
      console.log(`   Status: ${brand.isActive ? 'Active' : 'Inactive'}`);
      console.log('');
    });

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
migrateBrands();
