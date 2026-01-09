const mongoose = require("mongoose");

const barcodeSchema = new mongoose.Schema(
  {
    barcode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: {
      type: String,
      enum: ["EAN13", "EAN8", "CODE128", "CODE39", "CUSTOM"],
      default: "EAN13",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
barcodeSchema.index({ productId: 1, isActive: 1 });
barcodeSchema.index({ barcode: 1 });

// Virtual for product details
barcodeSchema.virtual("product", {
  ref: "Product",
  localField: "productId",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included in JSON
barcodeSchema.set("toJSON", { virtuals: true });
barcodeSchema.set("toObject", { virtuals: true });

const Barcode = mongoose.model("Barcode", barcodeSchema);

module.exports = Barcode;
