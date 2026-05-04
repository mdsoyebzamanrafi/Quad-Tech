import React, { useEffect } from 'react';
import { useFriends } from '../hooks/useFriends';

export const SocialFeed: React.FC<{ userId: string }> = ({ userId }) => {
  const { feed, loading, loadFriendsAndFeed } = useFriends(userId);

  useEffect(() => {
    loadFriendsAndFeed();
  }, [loadFriendsAndFeed]);

  if (loading) return <div>Loading feed...</div>;

  return (
    <div>
      <h2>Social Feed</h2>
      {feed.length === 0 ? <p>No recent activity from friends.</p> : null}
      <ul>
        {feed.map((item, i) => (
          <li key={i} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee' }}>
            <p>{item.message}</p>
            <small>Product: {item.product.name}</small>
          </li>
        ))}
      </ul>
    </div>
  );
};
