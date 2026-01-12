# Brand Migration Guide

## Problem
Existing brands in the database (created before we added country/contact fields) don't have these new fields, so they show as `undefined` instead of empty strings.

## Solution
Run the migration script to add these fields to all existing brands.

---

## How to Run Migration

### Step 1: Stop your backend server (if running)
Press `Ctrl+C` in the terminal where your backend is running

### Step 2: Run the migration script

**Windows:**
```bash
cd backend
node scripts/migrateBrands.js
```

**Linux/Mac:**
```bash
cd backend
node scripts/migrateBrands.js
```

### Step 3: Wait for completion
You should see output like:
```
🔌 Connecting to MongoDB: mongodb://localhost:27017/***
✅ Connected to MongoDB

📦 Found 5 brands in database

✅ Updated brand: "Square" (ID: 69652f75d32b72c1d7ff3735)
   Added fields: country, contact, phone, email, website, address
✅ Updated brand: "Beximco" (ID: ...)
...

============================================================
✅ Migration complete!
   - Updated: 5 brands
   - Already up-to-date: 0 brands
   - Total: 5 brands
============================================================

📋 Current brands in database:

1. Square
   ID: 69652f75d32b72c1d7ff3735
   Country: (empty)
   Contact: (empty)
   Phone: (empty)
   Email: (empty)
   Status: Active

...

✅ Database connection closed
```

### Step 4: Restart your backend server
```bash
npm run dev
# or
npm start
```

---

## What the Script Does

1. ✅ Connects to your MongoDB database
2. ✅ Finds all existing brands
3. ✅ Checks which brands are missing the new fields
4. ✅ Adds empty string defaults to missing fields:
   - `country: ''`
   - `contact: ''`
   - `phone: ''`
   - `email: ''`
   - `website: ''`
   - `address: ''`
5. ✅ Displays a summary of all brands
6. ✅ Closes the database connection

---

## After Migration

Now when you:
1. **View brands list** → All brands will show "-" for empty country/contact
2. **Edit a brand** → All fields will be available (empty but editable)
3. **Create new brands** → New brands automatically get all fields

---

## Troubleshooting

### Error: "Cannot find module '../model/brands'"
**Solution:** Make sure you're in the `backend` directory:
```bash
cd backend
node scripts/migrateBrands.js
```

### Error: "Connection refused"
**Solution:** Make sure MongoDB is running:
```bash
# Check if MongoDB is running
mongosh

# Or start MongoDB service
# Windows: 
net start MongoDB

# Linux/Mac:
sudo systemctl start mongod
```

### Error: "Cannot read .env"
**Solution:** Make sure you have a `.env` file in the `backend` directory with `MONGO_URI`:
```env
MONGO_URI=mongodb://localhost:27017/pos-system
```

---

## Alternative: Automatic Fix (No Migration Needed)

If you don't want to run the migration, the backend now automatically ensures all fields are returned with empty string defaults. Just restart your backend server and it will work!

The migration script is **optional** but recommended to permanently update your database.
