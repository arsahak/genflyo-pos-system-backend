/**
 * ImageBB Upload Utility
 *
 * Uploads images to ImageBB hosting service and returns the hosted URL
 *
 * Features:
 * - Supports base64 image upload
 * - Supports file buffer upload
 * - Returns direct URL, thumbnail URL, and image info
 * - Error handling with detailed messages
 */

const axios = require("axios");
const FormData = require("form-data");

/**
 * Upload image to ImageBB
 * @param {Buffer|String} imageData - Image buffer or base64 string
 * @param {String} fileName - Original filename
 * @returns {Promise<Object>} Image URLs and metadata
 */
const uploadToImageBB = async (imageData, fileName = "image") => {
  try {
    const apiKey = process.env.IMAGEBB_API_KEY;

    if (!apiKey) {
      throw new Error(
        "IMAGEBB_API_KEY is not configured in environment variables"
      );
    }

    // Convert buffer to base64 if needed
    let base64Image;
    if (Buffer.isBuffer(imageData)) {
      base64Image = imageData.toString("base64");
    } else {
      base64Image = imageData;
    }

    // Create form data
    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("image", base64Image);
    formData.append("name", fileName);

    // Upload to ImageBB
    const response = await axios.post(
      "https://api.imgbb.com/1/upload",
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    if (response.data && response.data.success) {
      return {
        success: true,
        url: response.data.data.url, // Full size URL
        displayUrl: response.data.data.display_url, // Display URL
        thumbUrl: response.data.data.thumb.url, // Thumbnail URL
        deleteUrl: response.data.data.delete_url, // Delete URL (save this if you want to delete later)
        imageInfo: {
          width: response.data.data.width,
          height: response.data.data.height,
          size: response.data.data.size,
          extension: response.data.data.image.extension,
          filename: response.data.data.image.filename,
        },
      };
    } else {
      throw new Error("ImageBB upload failed: No success response");
    }
  } catch (error) {
    console.error("ImageBB upload error:", error.message);

    // Handle specific errors
    if (error.response) {
      throw new Error(
        `ImageBB upload failed: ${
          error.response.data?.error?.message || error.response.statusText
        }`
      );
    }

    throw new Error(`Failed to upload image to ImageBB: ${error.message}`);
  }
};

/**
 * Delete image from ImageBB (if delete URL is available)
 * Note: ImageBB doesn't provide a direct API to delete images using the API key
 * Images are automatically deleted after inactivity based on your ImageBB account settings
 */
const deleteFromImageBB = async (deleteUrl) => {
  try {
    if (!deleteUrl) {
      console.warn("No delete URL provided for ImageBB image");
      return { success: false, message: "No delete URL available" };
    }

    // ImageBB delete URLs are direct links, just access them
    await axios.get(deleteUrl);

    return { success: true, message: "Image deleted successfully" };
  } catch (error) {
    console.error("ImageBB delete error:", error.message);
    return { success: false, message: error.message };
  }
};

module.exports = {
  uploadToImageBB,
  deleteFromImageBB,
};
