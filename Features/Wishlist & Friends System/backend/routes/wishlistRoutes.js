const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// Add to wishlist
router.post('/', auth, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;
    
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const existing = await Wishlist.findOne({ userId, productId });
    if (existing) {
      return res.status(400).json({ error: 'Already in wishlist' });
    }

    const wishlistItem = await Wishlist.create({
      userId,
      productId,
      watchingForRestock: product.stock === 0
    });

    res.status(201).json(wishlistItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user wishlist
router.get('/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const wishlist = await Wishlist.find({ userId: req.params.userId }).populate('productId');
    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from wishlist
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Wishlist.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.userId.toString() !== req.user._id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await Wishlist.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
