import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, size = 'md', showValue = false, className = '' }) => {
  const sizeClasses = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6' };
  const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`${sizeClasses[size]} ${star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
      {showValue && <span className={`${textSizes[size]} font-medium text-gray-700 ml-1`}>{rating.toFixed(1)}</span>}
    </div>
  );
};

export default StarRating;