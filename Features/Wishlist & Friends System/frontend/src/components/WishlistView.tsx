import React, { useEffect } from 'react';
import { useWishlist } from '../hooks/useWishlist';

export const WishlistView: React.FC<{ userId: string }> = ({ userId }) => {
  const { wishlist, loading, loadWishlist, remove } = useWishlist(userId);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  if (loading) return <div>Loading wishlist...</div>;

  return (
    <div>
      <h2>Your Wishlist</h2>
      {wishlist.length === 0 ? <p>Your wishlist is empty.</p> : null}
      <ul>
        {wishlist.map(item => (
          <li key={item._id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc' }}>
            <strong>{item.productId?.name}</strong> - ${item.productId?.price}
            {item.watchingForRestock && <span style={{ marginLeft: '10px', color: 'orange' }}>[Watching for Restock]</span>}
            <button onClick={() => remove(item._id)} style={{ marginLeft: '10px' }}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
