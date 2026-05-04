export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Product {
  _id: string;
  name: string;
  stock: number;
  price: number;
  image?: string;
}

export interface WishlistItem {
  _id: string;
  userId: string;
  productId: Product;
  watchingForRestock: boolean;
  createdAt: string;
}

export interface Friendship {
  _id: string;
  requesterId: User;
  recipientId: User;
  status: 'pending' | 'accepted' | 'blocked';
  blockedBy?: string;
}

export interface FeedItem {
  message: string;
  product: Product;
}
