const Barcode = require("../model/Barcode");
const Product = require("../model/Product");

/**
 * Calculate EAN13 check digit
 */
function calculateCheckDigit(barcode) {
  const digits = barcode.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Generate unique EAN13 barcode
 */
async function generateUniqueEAN13() {
  let barcode;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    // Prefix 200-299 for internal use
    const prefix = "200";
    // Generate 9 random digits
    const random = Math.floor(Math.random() * 1000000000)
      .toString()
      .padStart(9, "0");

    const base = prefix + random;
    const checkDigit = calculateCheckDigit(base);
    barcode = base + checkDigit;

    // Check if barcode already exists
    const existing = await Barcode.findOne({ barcode });
    if (!existing) {
      isUnique = true;
    }

    attempts++;
  }

  if (!isUnique) {
    throw new Error("Failed to generate unique barcode after maximum attempts");
  }

  return barcode;
}

/**
 * Generate new barcode
 * POST /api/barcodes/generate
 */
exports.generateBarcode = async (req, res) => {
  try {
    const { productId } = req.body;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Generate unique barcode
    const barcode = await generateUniqueEAN13();

    res.json({
      barcode,
      type: "EAN13",
      productId,
      productName: product.name,
    });
  } catch (error) {
    console.error("Generate barcode error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create new barcode
 * POST /api/barcodes
 */
exports.createBarcode = async (req, res) => {
  try {
    const { barcode, productId, type, notes } = req.body;

    // Validate required fields
    if (!barcode || !productId) {
      return res.status(400).json({ message: "Barcode and product ID are required" });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if barcode already exists
    const existingBarcode = await Barcode.findOne({ barcode });
    if (existingBarcode) {
      return res.status(400).json({
        message: "Barcode already exists",
        existingProduct: existingBarcode.productId,
      });
    }

    // Create barcode
    const newBarcode = new Barcode({
      barcode,
      productId,
      type: type || "EAN13",
      notes,
      createdBy: req.user?._id,
    });

    await newBarcode.save();

    // Populate product details
    await newBarcode.populate("productId", "name sku price");

    res.status(201).json(newBarcode);
  } catch (error) {
    console.error("Create barcode error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all barcodes
 * GET /api/barcodes
 */
exports.getAllBarcodes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      productId,
      type,
      isActive,
    } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.barcode = { $regex: search, $options: "i" };
    }

    if (productId) {
      query.productId = productId;
    }

    if (type) {
      query.type = type;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Execute query with pagination
    const barcodes = await Barcode.find(query)
      .populate("productId", "name sku price image")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count
    const count = await Barcode.countDocuments(query);

    res.json({
      barcodes,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    console.error("Get barcodes error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get barcode by ID
 * GET /api/barcodes/:id
 */
exports.getBarcodeById = async (req, res) => {
  try {
    const { id } = req.params;

    const barcode = await Barcode.findById(id)
      .populate("productId", "name sku price image")
      .populate("createdBy", "name email");

    if (!barcode) {
      return res.status(404).json({ message: "Barcode not found" });
    }

    res.json(barcode);
  } catch (error) {
    console.error("Get barcode error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete barcode
 * DELETE /api/barcodes/:id
 */
exports.deleteBarcode = async (req, res) => {
  try {
    const { id } = req.params;

    const barcode = await Barcode.findById(id);
    if (!barcode) {
      return res.status(404).json({ message: "Barcode not found" });
    }

    await Barcode.findByIdAndDelete(id);

    res.json({ message: "Barcode deleted successfully" });
  } catch (error) {
    console.error("Delete barcode error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Check if barcode is duplicate
 * POST /api/barcodes/check
 */
exports.checkDuplicate = async (req, res) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ message: "Barcode is required" });
    }

    const existing = await Barcode.findOne({ barcode }).populate(
      "productId",
      "name sku"
    );

    if (existing) {
      return res.json({
        isDuplicate: true,
        existingBarcode: existing,
      });
    }

    res.json({ isDuplicate: false });
  } catch (error) {
    console.error("Check duplicate error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update barcode (soft delete / deactivate)
 * PATCH /api/barcodes/:id
 */
exports.updateBarcode = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, notes } = req.body;

    const barcode = await Barcode.findById(id);
    if (!barcode) {
      return res.status(404).json({ message: "Barcode not found" });
    }

    if (isActive !== undefined) {
      barcode.isActive = isActive;
    }

    if (notes !== undefined) {
      barcode.notes = notes;
    }

    await barcode.save();
    await barcode.populate("productId", "name sku price");

    res.json(barcode);
  } catch (error) {
    console.error("Update barcode error:", error);
    res.status(500).json({ message: error.message });
  }
};
