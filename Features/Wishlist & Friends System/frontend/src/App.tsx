import React from 'react';
import { WishlistButton } from './components/WishlistButton';
import { WishlistView } from './components/WishlistView';
import { FriendManagement } from './components/FriendManagement';
import { SocialFeed } from './components/SocialFeed';
import { useWishlist } from './hooks/useWishlist';

const MOCK_USER_ID = 'user123';
const MOCK_PRODUCT_ID = 'prod123';

function App() {
  const { wishlist, add, remove } = useWishlist(MOCK_USER_ID);
  
  const isInWishlist = wishlist.some(item => 
    typeof item.productId === 'object' 
      ? item.productId?._id === MOCK_PRODUCT_ID 
      : item.productId === MOCK_PRODUCT_ID
  );
  
  const wishlistItemId = wishlist.find(item => 
    typeof item.productId === 'object' 
      ? item.productId?._id === MOCK_PRODUCT_ID 
      : item.productId === MOCK_PRODUCT_ID
  )?._id;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Wishlist & Friends System Demo</h1>
      
      <div style={{ border: '1px solid #ddd', padding: '20px', marginBottom: '20px' }}>
        <h2>Product Mock: Wireless Headphones</h2>
        <WishlistButton 
          productId={MOCK_PRODUCT_ID}
          isOutofStock={true}
          isInWishlist={isInWishlist}
          wishlistId={wishlistItemId}
          onAdd={() => add(MOCK_PRODUCT_ID)}
          onRemove={(id) => remove(id)}
        />
      </div>

      <div style={{ border: '1px solid #ddd', padding: '20px', marginBottom: '20px' }}>
        <WishlistView userId={MOCK_USER_ID} />
      </div>

      <div style={{ border: '1px solid #ddd', padding: '20px', marginBottom: '20px' }}>
        <FriendManagement userId={MOCK_USER_ID} />
      </div>

      <div style={{ border: '1px solid #ddd', padding: '20px' }}>
        <SocialFeed userId={MOCK_USER_ID} />
      </div>
    </div>
  );
}

export default App;
