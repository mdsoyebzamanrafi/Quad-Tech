export interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category: string;
  helpfulVotes: number;
  notHelpfulVotes: number;
  viewCount: number;
  helpfulnessScore: number;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface FAQGrouped {
  [category: string]: FAQ[];
}

export interface FAQApiResponse {
  success: boolean;
  message: string;
  data: FAQGrouped;
  meta?: {
    total: number;
    categories: string[];
  };
}

export interface CustomerFeedback {
  _id: string;
  name: string;
  email: string;
  rating: number;
  message: string;
  orderId?: string;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export interface FeedbackStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  recentFeedback: CustomerFeedback[];
}

export interface FeedbackApiResponse {
  success: boolean;
  message: string;
  data: CustomerFeedback[];
  meta?: {
    pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
    stats: FeedbackStats;
  };
}

export interface FeedbackFormData {
  name: string;
  email: string;
  rating: number;
  message: string;
  orderId?: string;
}

export type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
export type FAQSortOption = 'order' | 'popular' | 'newest';