import asyncHandler from '../utils/asyncHandler.js';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';

/**
 * @desc    Search for users by name or email to add as friends
 * @route   GET /api/friends/search
 * @access  Private
 */
export const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json({ success: true, data: [] });
  }

  // Find users whose name or email matches the query, excluding the current user
  const users = await User.find({
    $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }],
    _id: { $ne: req.user._id }
  }).select('name email');

  res.json({ success: true, data: users });
});

/**
 * @desc    Get list of friends and pending friend requests
 * @route   GET /api/friends
 * @access  Private
 */
export const getFriends = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Find all friendships where the user is either the requester or recipient
  const friendships = await Friendship.find({
    $or: [{ requester: userId }, { recipient: userId }]
  }).populate('requester', 'name email').populate('recipient', 'name email');

  // Filter for accepted friendships and extract the friend's details
  const friends = friendships.filter(f => f.status === 'accepted').map(f => {
    return f.requester._id.toString() === userId.toString() ? f.recipient : f.requester;
  });

  // Filter for pending requests where the current user is the recipient
  const pendingRequests = friendships.filter(f => f.status === 'pending' && f.recipient._id.toString() === userId.toString()).map(f => ({
    friendshipId: f._id,
    user: f.requester
  }));

  // Filter for pending requests where the current user is the requester
  const sentRequests = friendships.filter(f => f.status === 'pending' && f.requester._id.toString() === userId.toString()).map(f => ({
    friendshipId: f._id,
    user: f.recipient
  }));

  res.json({ success: true, data: { friends, pendingRequests, sentRequests } });
});

/**
 * @desc    Send a friend request to another user
 * @route   POST /api/friends/request
 * @access  Private
 */
export const sendFriendRequest = asyncHandler(async (req, res) => {
  const { recipientId } = req.body;
  
  // Prevent adding self
  if (req.user._id.toString() === recipientId) {
    res.status(400);
    throw new Error('Cannot add yourself');
  }

  // Check if a friendship or request already exists between these two users
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

  // Create a new friendship record with 'pending' status
  await Friendship.create({ requester: req.user._id, recipient: recipientId });
  res.json({ success: true, message: 'Friend request sent' });
});

/**
 * @desc    Accept or reject a pending friend request
 * @route   PATCH /api/friends/request/:id
 * @access  Private
 */
export const handleFriendRequest = asyncHandler(async (req, res) => {
  const { action } = req.body; // 'accept' or 'reject'
  const friendshipId = req.params.id;

  const friendship = await Friendship.findById(friendshipId);
  
  // Verify request exists and current user is the intended recipient
  if (!friendship || friendship.recipient.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Request not found');
  }

  if (action === 'accept') {
    // Mark as accepted
    friendship.status = 'accepted';
    await friendship.save();
    res.json({ success: true, message: 'Friend request accepted' });
  } else if (action === 'reject') {
    // Delete the record on rejection
    await Friendship.findByIdAndDelete(friendshipId);
    res.json({ success: true, message: 'Friend request rejected' });
  } else {
    res.status(400);
    throw new Error('Invalid action');
  }
});

/**
 * @desc    Placeholder for future private wishlist access logic
 */
export const getFriendWishlist = asyncHandler(async (req, res) => {
  return res.status(403).json({
    message: 'Friend wishlists are private and only used for gift recommendations.'
  });
});

/**
 * @desc    Remove a friend or cancel a friend request
 * @route   DELETE /api/friends/:userId
 * @access  Private
 */
export const removeFriendOrRequest = asyncHandler(async (req, res) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user._id;

  const friendship = await Friendship.findOneAndDelete({
    $or: [
      { requester: currentUserId, recipient: targetUserId },
      { requester: targetUserId, recipient: currentUserId }
    ]
  });

  if (!friendship) {
    res.status(404);
    throw new Error('Friendship or request not found');
  }

  res.json({ success: true, message: 'Removed successfully' });
});

