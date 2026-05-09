import asyncHandler from '../utils/asyncHandler.js';
import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';

/**
 * @desc    Get current user's wishlist
 * @route   GET /api/wishlist
 * @access  Private
 */
export const getWishlist = asyncHandler(async (req, res) => {
  // Find wishlist for the logged-in user and populate product details
  let wishlist = await Wishlist.findOne({ user: req.user._id }).populate('items.product', 'name image price countInStock');
  
  // If no wishlist exists, create an empty one for the user
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, items: [] });
  }
  
  res.json({ success: true, data: wishlist });
});

/**
 * @desc    Add a product to the user's wishlist
 * @route   POST /api/wishlist
 * @access  Private
 */
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  
  // Verify the product exists before adding to wishlist
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  
  let wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (!wishlist) {
    // Create new wishlist if it doesn't exist
    wishlist = await Wishlist.create({ user: req.user._id, items: [{ product: productId }] });
  } else {
    // Check if item is already in the wishlist to avoid duplicates
    const itemExists = wishlist.items.find(item => item.product.toString() === productId);
    if (!itemExists) {
      wishlist.items.push({ product: productId });
      await wishlist.save();
    }
  }
  
  // Return updated wishlist with populated product details
  const updatedWishlist = await Wishlist.findOne({ user: req.user._id }).populate('items.product', 'name image price countInStock');
  res.json({ success: true, message: 'Added to wishlist', data: updatedWishlist });
});

/**
 * @desc    Remove a product from the user's wishlist
 * @route   DELETE /api/wishlist/:id
 * @access  Private
 */
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (wishlist) {
    // Filter out the item to be removed
    wishlist.items = wishlist.items.filter(item => item.product.toString() !== productId);
    await wishlist.save();
  }
  
  // Return updated wishlist
  const updatedWishlist = await Wishlist.findOne({ user: req.user._id }).populate('items.product', 'name image price countInStock');
  res.json({ success: true, message: 'Removed from wishlist', data: updatedWishlist });
});

