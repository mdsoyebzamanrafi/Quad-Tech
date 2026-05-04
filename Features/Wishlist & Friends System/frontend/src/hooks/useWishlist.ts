import { useState, useCallback } from 'react';
import { WishlistItem } from '../types';
import * as api from '../api';

export const useWishlist = (userId: string) => {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchWishlist(userId);
      setWishlist(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const add = async (productId: string) => {
    try {
      await api.addToWishlist(userId, productId);
      await loadWishlist();
    } catch (error) {
      console.error(error);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.removeFromWishlist(userId, id);
      await loadWishlist();
    } catch (error) {
      console.error(error);
    }
  };

  return { wishlist, loading, loadWishlist, add, remove };
};
