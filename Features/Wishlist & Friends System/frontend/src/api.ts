import { WishlistItem, Friendship, FeedItem } from './types';

const API_BASE = 'http://localhost:5001/api';

export const addToWishlist = async (userId: string, productId: string) => {
  const res = await fetch(`${API_BASE}/wishlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ productId })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const removeFromWishlist = async (userId: string, id: string) => {
  const res = await fetch(`${API_BASE}/wishlist/${id}`, { 
    method: 'DELETE',
    headers: { 'x-user-id': userId }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const fetchWishlist = async (userId: string): Promise<WishlistItem[]> => {
  const res = await fetch(`${API_BASE}/wishlist/${userId}`, {
    headers: { 'x-user-id': userId }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const sendFriendRequest = async (requesterId: string, recipientId: string) => {
  const res = await fetch(`${API_BASE}/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
    body: JSON.stringify({ recipientId })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const acceptFriendRequest = async (userId: string, friendshipId: string) => {
  const res = await fetch(`${API_BASE}/friends/accept/${friendshipId}`, { 
    method: 'POST',
    headers: { 'x-user-id': userId }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const blockUser = async (userId: string, blockedUserId: string) => {
  const res = await fetch(`${API_BASE}/friends/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ blockedUserId })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const fetchFriends = async (userId: string): Promise<Friendship[]> => {
  const res = await fetch(`${API_BASE}/friends/${userId}`, {
    headers: { 'x-user-id': userId }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const fetchFeed = async (userId: string): Promise<FeedItem[]> => {
  const res = await fetch(`${API_BASE}/friends/${userId}/feed`, {
    headers: { 'x-user-id': userId }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
