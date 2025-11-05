const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  // Category Image (ImageBB URL)
  image: {
    url: String,
    thumbUrl: String,
    displayUrl: String,
    deleteUrl: String
  },
  // Parent Category for hierarchical structure
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  // Category Level (0 = root, 1 = sub-category, etc.)
  level: {
    type: Number,
    default: 0,
    min: 0
  },
  // Order for sorting
  order: {
    type: Number,
    default: 0
  },
  // Meta Information
  metaTitle: {
    type: String,
    trim: true
  },
  metaDescription: {
    type: String,
    trim: true
  },
  metaKeywords: [{
    type: String,
    trim: true
  }],
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  // Tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for text search
categorySchema.index({ name: 'text', description: 'text' });

// Virtual for product count
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'categoryId',
  count: true
});

// Virtual for sub-categories
categorySchema.virtual('subCategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory'
});

// Generate slug from name before saving
categorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    // Generate slug from name
    let slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug exists
    let slugExists = await mongoose.model('Category').findOne({ slug, _id: { $ne: this._id } });
    let counter = 1;

    while (slugExists) {
      slug = `${this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${counter}`;
      slugExists = await mongoose.model('Category').findOne({ slug, _id: { $ne: this._id } });
      counter++;
    }

    this.slug = slug;
  }

  // Set level based on parent category
  if (this.parentCategory) {
    const parent = await mongoose.model('Category').findById(this.parentCategory);
    if (parent) {
      this.level = parent.level + 1;
    }
  } else {
    this.level = 0;
  }

  next();
});

// Ensure virtuals are included when converting to JSON
categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Category', categorySchema);

