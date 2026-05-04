const express = require('express');
const router = express.Router();
const Friendship = require('../models/Friendship');
const NotificationService = require('../services/NotificationService');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const auth = require('../middleware/auth');

// Send friend request
router.post('/request', auth, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user._id;

    if (requesterId === recipientId) {
      return res.status(400).json({ error: 'Cannot send request to self' });
    }

    const existing = await Friendship.findOne({
      $or: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requesterId }
      ]
    });

    if (existing) {
      if (existing.status === 'blocked') {
        return res.status(403).json({ error: 'Action not allowed' });
      }
      return res.status(400).json({ error: 'Friendship or request already exists' });
    }

    const friendship = await Friendship.create({ requesterId, recipientId, status: 'pending' });
    
    await NotificationService.sendNotification(
      recipientId,
      'friend_request',
      'You have a new friend request',
      { requesterId, friendshipId: friendship._id }
    );

    res.status(201).json(friendship);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept request
router.post('/accept/:id', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship || friendship.status !== 'pending') {
      return res.status(404).json({ error: 'Pending request not found' });
    }
    
    if (friendship.recipientId.toString() !== req.user._id) {
      return res.status(403).json({ error: 'Only recipient can accept' });
    }

    friendship.status = 'accepted';
    await friendship.save();

    await NotificationService.sendNotification(
      friendship.requesterId,
      'friend_accepted',
      'Your friend request was accepted',
      { recipientId: friendship.recipientId }
    );

    res.json(friendship);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block user
router.post('/block', auth, async (req, res) => {
  try {
    const { blockedUserId } = req.body;
    const userId = req.user._id;
    
    let friendship = await Friendship.findOne({
      $or: [
        { requesterId: userId, recipientId: blockedUserId },
        { requesterId: blockedUserId, recipientId: userId }
      ]
    });

    if (friendship) {
      friendship.status = 'blocked';
      friendship.blockedBy = userId;
      await friendship.save();
    } else {
      friendship = await Friendship.create({
        requesterId: userId,
        recipientId: blockedUserId,
        status: 'blocked',
        blockedBy: userId
      });
    }

    res.json({ success: true, friendship });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Friends
router.get('/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const friendships = await Friendship.find({
      $or: [{ requesterId: req.params.userId }, { recipientId: req.params.userId }],
      status: 'accepted'
    }).populate('requesterId recipientId');
    
    res.json(friendships);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recommendations Feed
router.get('/:userId/feed', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.user._id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const friendships = await Friendship.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted'
    });

    const friendIds = friendships.map(f => 
      f.requesterId.toString() === userId ? f.recipientId : f.requesterId
    );

    const friendWishlists = await Wishlist.find({ userId: { $in: friendIds } })
      .populate('productId')
      .populate('userId');

    const recommendations = {};
    for (const item of friendWishlists) {
      if (!item.productId) continue;
      const pid = item.productId._id.toString();
      if (!recommendations[pid]) {
        recommendations[pid] = {
          product: item.productId,
          friends: []
        };
      }
      recommendations[pid].friends.push(item.userId.name);
    }

    const feed = Object.values(recommendations).map(rec => ({
      message: `Your friends ${rec.friends.join(', ')} added ${rec.product.name} to their wishlist`,
      product: rec.product
    }));

    res.json(feed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
