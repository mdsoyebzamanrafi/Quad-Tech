import { FAQApiResponse, FeedbackApiResponse, FeedbackFormData, FAQSortOption, SortOption } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const handleResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.message || 'Something went wrong');
  return data;
};

export const fetchFAQs = async (search?: string, category?: string, sortBy: FAQSortOption = 'order'): Promise<FAQApiResponse> => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (category && category !== 'all') params.append('category', category);
  params.append('sortBy', sortBy);
  const response = await fetch(`${API_BASE_URL}/faqs?${params}`);
  return handleResponse(response);
};

export const submitFAQFeedback = async (faqId: string, helpful: boolean) => {
  const response = await fetch(`${API_BASE_URL}/faqs/${faqId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ helpful }),
  });
  return handleResponse(response);
};

export const recordFAQView = async (faqId: string) => {
  const response = await fetch(`${API_BASE_URL}/faqs/${faqId}`);
  return handleResponse(response);
};

export const fetchFeedback = async (page = 1, limit = 10, sortBy: SortOption = 'newest', rating?: number, minRating?: number): Promise<FeedbackApiResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  params.append('sortBy', sortBy);
  if (rating) params.append('rating', rating.toString());
  if (minRating) params.append('minRating', minRating.toString());
  const response = await fetch(`${API_BASE_URL}/feedback?${params}`);
  return handleResponse(response);
};

export const fetchFeedbackStats = async () => {
  const response = await fetch(`${API_BASE_URL}/feedback/stats`);
  return handleResponse(response);
};

export const submitFeedback = async (data: FeedbackFormData) => {
  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};