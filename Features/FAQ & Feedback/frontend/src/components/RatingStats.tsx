import React from 'react';
import { motion } from 'framer-motion';
import { Star, Users, TrendingUp } from 'lucide-react';
import { FeedbackStats } from '../types';

interface RatingStatsProps {
  stats: FeedbackStats | null;
  loading: boolean;
}

const RatingStats: React.FC<RatingStatsProps> = ({ stats, loading }) => {
  if (loading) return <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div><div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-gray-200 rounded"></div>)}</div></div>;
  if (!stats || stats.totalReviews === 0) return <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center"><Star className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No ratings yet</p></div>;

  const maxCount = Math.max(...Object.values(stats.ratingDistribution));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-baseline gap-2"><span className="text-4xl font-bold text-gray-900">{stats.averageRating.toFixed(1)}</span><span className="text-gray-400">/ 5</span></div>
          <div className="flex items-center gap-1 mt-1">{[1,2,3,4,5].map(star => <Star key={star} className={`w-4 h-4 ${star <= Math.round(stats.averageRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />)}</div>
        </div>
        <div className="text-right"><div className="flex items-center gap-2 text-gray-600"><Users className="w-4 h-4" /><span className="font-medium">{stats.totalReviews}</span></div><p className="text-sm text-gray-400">Total reviews</p></div>
      </div>

      <div className="space-y-2.5">
        {[5,4,3,2,1].map((rating) => {
          const r = rating as keyof typeof stats.ratingDistribution;
          const count = stats.ratingDistribution[r] || 0;
          const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
          return (
            <div key={rating} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 w-3">{rating}</span>
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8, delay: (5 - rating) * 0.1 }}
                  className={`h-full rounded-full ${rating >= 4 ? 'bg-green-500' : rating === 3 ? 'bg-amber-400' : 'bg-red-400'}`} />
              </div>
              <span className="text-sm text-gray-500 w-10 text-right">{count}</span>
            </div>
          );
        })}
      </div>

      {stats.totalReviews > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-green-600">
          <TrendingUp className="w-4 h-4" />
          <span>{((stats.ratingDistribution[5] + stats.ratingDistribution[4]) / stats.totalReviews * 100).toFixed(0)}% of customers recommend Trail</span>
        </div>
      )}
    </motion.div>
  );
};

export default RatingStats;