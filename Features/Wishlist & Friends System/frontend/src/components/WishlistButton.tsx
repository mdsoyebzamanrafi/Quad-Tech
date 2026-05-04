import React from 'react';

interface WishlistButtonProps {
  productId: string;
  isOutofStock: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  isInWishlist: boolean;
  wishlistId?: string;
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({ 
  productId, isOutofStock, onAdd, onRemove, isInWishlist, wishlistId 
}) => {
  const handleClick = () => {
    if (isInWishlist && wishlistId) {
      onRemove(wishlistId);
    } else {
      onAdd(productId);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <button disabled={isOutofStock} style={{ padding: '8px', cursor: isOutofStock ? 'not-allowed' : 'pointer' }}>
        {isOutofStock ? 'Out of Stock' : 'Add to Cart'}
      </button>
      <button 
        onClick={handleClick}
        style={{ padding: '8px', color: isInWishlist ? 'red' : 'black', cursor: 'pointer' }}
      >
        {isInWishlist ? '♥ Wishlisted' : '♡ Add to Wishlist'}
      </button>
      {isOutofStock && isInWishlist && (
        <span style={{ fontSize: '12px', color: 'orange' }}>Watching for Restock</span>
      )}
    </div>
  );
};
