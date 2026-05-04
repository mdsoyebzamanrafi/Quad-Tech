import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  searchUsers,
  getFriends,
  sendFriendRequest,
  handleFriendRequest,
  getFriendWishlist
} from '../controllers/friendController.js';

const router = express.Router();

router.get('/search', protect, searchUsers);
router.route('/')
  .get(protect, getFriends)
  .post(protect, sendFriendRequest);

router.put('/request/:id', protect, handleFriendRequest);
router.get('/:friendId/wishlist', protect, getFriendWishlist);

export default router;
