import React, { useEffect, useState } from 'react';
import { useFriends } from '../hooks/useFriends';

export const FriendManagement: React.FC<{ userId: string }> = ({ userId }) => {
  const { friends, loading, loadFriendsAndFeed, requestFriend, acceptFriend, block } = useFriends(userId);
  const [searchId, setSearchId] = useState('');

  useEffect(() => {
    loadFriendsAndFeed();
  }, [loadFriendsAndFeed]);

  if (loading) return <div>Loading friends...</div>;

  return (
    <div>
      <h2>Friends</h2>
      <div>
        <input 
          placeholder="User ID to add/block" 
          value={searchId} 
          onChange={e => setSearchId(e.target.value)} 
        />
        <button onClick={() => requestFriend(searchId)}>Send Request</button>
        <button onClick={() => block(searchId)}>Block User</button>
      </div>
      
      <ul>
        {friends.map(f => {
          const isRequester = typeof f.requesterId === 'object' 
            ? f.requesterId._id === userId 
            : f.requesterId === userId;
            
          const friend = isRequester ? f.recipientId : f.requesterId;
          const friendName = typeof friend === 'object' ? friend.name : friend;
          
          return (
            <li key={f._id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc' }}>
              {friendName} - Status: {f.status}
              {f.status === 'pending' && !isRequester && (
                <button onClick={() => acceptFriend(f._id)}>Accept</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
