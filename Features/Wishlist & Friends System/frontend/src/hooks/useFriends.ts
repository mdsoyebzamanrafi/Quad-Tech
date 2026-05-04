import { useState, useCallback } from 'react';
import { Friendship, FeedItem } from '../types';
import * as api from '../api';

export const useFriends = (userId: string) => {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFriendsAndFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [friendsData, feedData] = await Promise.all([
        api.fetchFriends(userId),
        api.fetchFeed(userId)
      ]);
      setFriends(friendsData);
      setFeed(feedData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const requestFriend = async (recipientId: string) => {
    await api.sendFriendRequest(userId, recipientId);
    await loadFriendsAndFeed();
  };

  const acceptFriend = async (friendshipId: string) => {
    await api.acceptFriendRequest(userId, friendshipId);
    await loadFriendsAndFeed();
  };

  const block = async (blockedUserId: string) => {
    await api.blockUser(userId, blockedUserId);
    await loadFriendsAndFeed();
  };

  return { friends, feed, loading, loadFriendsAndFeed, requestFriend, acceptFriend, block };
};
