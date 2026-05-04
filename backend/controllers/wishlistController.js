import asyncHandler from '../utils/asyncHandler.js';
import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';

export const getWishlist = asyncHandler(async (req, res) => {
  let wishlist = await Wishlist.findOne({ user: req.user._id }).populate('items.product', 'name image price countInStock');
  
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, items: [] });
  }
  
  res.json({ success: true, data: wishlist });
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  
  let wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, items: [{ product: productId }] });
  } else {
    const itemExists = wishlist.items.find(item => item.product.toString() === productId);
    if (!itemExists) {
      wishlist.items.push({ product: productId });
      await wishlist.save();
    }
  }
  
  const updatedWishlist = await Wishlist.findOne({ user: req.user._id }).populate('items.product', 'name image price countInStock');
  res.json({ success: true, message: 'Added to wishlist', data: updatedWishlist });
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  if (wishlist) {
    wishlist.items = wishlist.items.filter(item => item.product.toString() !== productId);
    await wishlist.save();
  }
  
  const updatedWishlist = await Wishlist.findOne({ user: req.user._id }).populate('items.product', 'name image price countInStock');
  res.json({ success: true, message: 'Removed from wishlist', data: updatedWishlist });
});
