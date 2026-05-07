import asyncHandler from '../utils/asyncHandler.js';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';

export const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json({ success: true, data: [] });
  }

  const users = await User.find({
    $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }],
    _id: { $ne: req.user._id }
  }).select('name email');

  res.json({ success: true, data: users });
});

export const getFriends = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const friendships = await Friendship.find({
    $or: [{ requester: userId }, { recipient: userId }]
  }).populate('requester', 'name email').populate('recipient', 'name email');

  const friends = friendships.filter(f => f.status === 'accepted').map(f => {
    return f.requester._id.toString() === userId.toString() ? f.recipient : f.requester;
  });

  const pendingRequests = friendships.filter(f => f.status === 'pending' && f.recipient._id.toString() === userId.toString()).map(f => ({
    friendshipId: f._id,
    user: f.requester
  }));

  res.json({ success: true, data: { friends, pendingRequests } });
});

export const sendFriendRequest = asyncHandler(async (req, res) => {
  const { recipientId } = req.body;
  if (req.user._id.toString() === recipientId) {
    res.status(400);
    throw new Error('Cannot add yourself');
  }

  const existing = await Friendship.findOne({
    $or: [
      { requester: req.user._id, recipient: recipientId },
      { requester: recipientId, recipient: req.user._id }
    ]
  });

  if (existing) {
    res.status(400);
    throw new Error('Friendship or request already exists');
  }

  await Friendship.create({ requester: req.user._id, recipient: recipientId });
  res.json({ success: true, message: 'Friend request sent' });
});

export const handleFriendRequest = asyncHandler(async (req, res) => {
  const { action } = req.body; // 'accept' or 'reject'
  const friendshipId = req.params.id;

  const friendship = await Friendship.findById(friendshipId);
  if (!friendship || friendship.recipient.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Request not found');
  }

  if (action === 'accept') {
    friendship.status = 'accepted';
    await friendship.save();
    res.json({ success: true, message: 'Friend request accepted' });
  } else if (action === 'reject') {
    await Friendship.findByIdAndDelete(friendshipId);
    res.json({ success: true, message: 'Friend request rejected' });
  } else {
    res.status(400);
    throw new Error('Invalid action');
  }
});

export const getFriendWishlist = asyncHandler(async (req, res) => {
  return res.status(403).json({
    message: 'Friend wishlists are private and only used for gift recommendations.'
  });
});
