import { useState, useEffect, useCallback } from 'react';
import { fetchFAQs, submitFAQFeedback, recordFAQView } from '../services/api';
import { FAQGrouped, FAQSortOption } from '../types';

export const useFAQs = (initialSearch = '', initialCategory = 'all') => {
  const [faqs, setFaqs] = useState<FAQGrouped>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState<FAQSortOption>('order');

  const loadFAQs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFAQs(search, category, sortBy);
      setFaqs(response.data);
      setCategories(response.meta?.categories || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  }, [search, category, sortBy]);

  useEffect(() => { loadFAQs(); }, [loadFAQs]);

  const voteFAQ = async (faqId: string, helpful: boolean) => {
    try {
      await submitFAQFeedback(faqId, helpful);
      await loadFAQs();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const viewFAQ = async (faqId: string) => {
    try {
      await recordFAQView(faqId);
    } catch (err) {
      console.error('Failed to record FAQ view:', err);
    }
  };

  return { faqs, categories, loading, error, search, setSearch, category, setCategory, sortBy, setSortBy, voteFAQ, viewFAQ, refresh: loadFAQs };
};