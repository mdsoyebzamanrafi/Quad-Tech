import { useState, useEffect, useCallback } from 'react';
import { fetchFeedback, fetchFeedbackStats, submitFeedback } from '../services/api';
import { CustomerFeedback, FeedbackStats, FeedbackFormData, SortOption } from '../types';

export const useFeedback = () => {
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterRating, setFilterRating] = useState<number | undefined>();

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFeedback(page, 10, sortBy, filterRating);
      setFeedbacks(response.data);
      setTotalPages(response.meta?.pagination.totalPages || 1);
      setStats(response.meta?.stats || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, filterRating]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetchFeedbackStats();
      setStats(response.data);
    } catch (err) { console.error('Failed to load stats:', err); }
  }, []);

  useEffect(() => { loadFeedbacks(); }, [loadFeedbacks]);

  const submitCustomerFeedback = async (data: FeedbackFormData) => {
    try {
      await submitFeedback(data);
      await loadFeedbacks();
      await loadStats();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return { feedbacks, stats, loading, error, page, setPage, totalPages, sortBy, setSortBy, filterRating, setFilterRating, submitCustomerFeedback, refresh: loadFeedbacks };
};