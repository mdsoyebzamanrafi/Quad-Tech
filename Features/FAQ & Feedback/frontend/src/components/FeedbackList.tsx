import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Calendar, Filter, ChevronLeft, ChevronRight, Loader2, AlertCircle, MessageSquare } from 'lucide-react';
import StarRating from './StarRating';
import { CustomerFeedback, SortOption } from '../types';

interface FeedbackListProps {
  feedbacks: CustomerFeedback[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  sortBy: SortOption;
  filterRating?: number;
  onPageChange: (page: number) => void;
  onSortChange: (sort: SortOption) => void;
  onFilterChange: (rating?: number) => void;
}

const FeedbackList: React.FC<FeedbackListProps> = ({ feedbacks, loading, error, page, totalPages, sortBy, filterRating, onPageChange, onSortChange, onFilterChange }) => {
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'highest', label: 'Highest Rated' },
    { value: 'lowest', label: 'Lowest Rated' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex gap-1.5">
            {[5, 4, 3, 2, 1].map((rating) => (
              <button key={rating} onClick={() => onFilterChange(filterRating === rating ? undefined : rating)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterRating === rating ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <Star className="w-3.5 h-3.5 fill-current" />{rating}
              </button>
            ))}
          </div>
        </div>
        <select value={sortBy} onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white">
          {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {loading && <div className="flex flex-col items-center justify-center py-12"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" /><p className="text-gray-500">Loading reviews...</p></div>}
      {error && !loading && <div className="flex flex-col items-center justify-center py-12 text-center"><AlertCircle className="w-12 h-12 text-red-400 mb-3" /><p className="text-gray-500">{error}</p></div>}
      {!loading && !error && feedbacks.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-center"><MessageSquare className="w-16 h-16 text-gray-300 mb-4" /><h3 className="text-lg font-semibold text-gray-800 mb-1">No reviews yet</h3><p className="text-gray-500">Be the first to share your experience!</p></div>}

      <AnimatePresence mode="wait">
        {!loading && !error && feedbacks.map((feedback, index) => (
          <motion.div key={feedback._id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ delay: index * 0.05 }}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">{feedback.name?.charAt(0)?.toUpperCase() || 'A'}</div>
                <div>
                  <h4 className="font-medium text-gray-900">{feedback.name || 'Anonymous'}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500"><Calendar className="w-3.5 h-3.5" />{new Date(feedback.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                </div>
              </div>
              <StarRating rating={feedback.rating} size="sm" />
            </div>
            <p className="text-gray-600 leading-relaxed">{feedback.message}</p>
            {feedback.orderId && <div className="mt-3 text-xs text-gray-400">Order: {feedback.orderId}</div>}
          </motion.div>
        ))}
      </AnimatePresence>

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => onPageChange(p)} className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-indigo-600 text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}>{p}</button>
          ))}
          <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
};

export default FeedbackList;