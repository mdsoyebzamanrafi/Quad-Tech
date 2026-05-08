import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, UserPlus, Check, X, Gift } from 'lucide-react';
import api from '../utils/api';
import '../styles/LoginPage.css';

const FriendsPage = () => {
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'search'

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        try {
            const { data } = await api.get('/api/friends');
            setFriends(data.data.friends);
            setPendingRequests(data.data.pendingRequests);
        } catch (error) {
            console.error('Failed to fetch friends', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        
        setSearchLoading(true);
        try {
            const { data } = await api.get(`/api/friends/search?q=${searchQuery}`);
            setSearchResults(data.data);
            setActiveTab('search');
        } catch {
            alert('Search failed');
        } finally {
            setSearchLoading(false);
        }
    };

    const sendRequest = async (userId) => {
        try {
            await api.post('/api/friends', { recipientId: userId });
            alert('Friend request sent!');
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to send request');
        }
    };

    const handleRequest = async (friendshipId, action) => {
        try {
            await api.put(`/api/friends/request/${friendshipId}`, { action });
            fetchFriends();
            alert(`Request ${action}ed`);
        } catch {
            alert(`Failed to ${action} request`);
        }
    };

    if (loading) {
        return <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}>Loading Friends...</div>;
    }

    return (
        <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
            <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                    <Users className="text-accent-1" size={32} />
                    <h1 style={{ fontSize: '2rem' }}>Friends Hub</h1>
                </div>
                <p style={{ color: 'var(--text-muted)' }}>Connect with friends and use the Gift Assistant to find thoughtful picks without exposing private wishlists.</p>
                
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', maxWidth: '500px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input 
                            type="text" 
                            placeholder="Search users by name or email..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={searchLoading}>
                        {searchLoading ? 'Searching...' : 'Search'}
                    </button>
                </form>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <button 
                    className={`btn ${activeTab === 'friends' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('friends')}
                >
                    My Friends ({friends.length})
                </button>
                <button 
                    className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('requests')}
                >
                    Requests ({pendingRequests.length})
                </button>
                {activeTab === 'search' && (
                    <button className="btn btn-primary">Search Results</button>
                )}
            </div>

            <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                {activeTab === 'friends' && (
                    <div>
                        {friends.length === 0 ? <p>You haven't added any friends yet.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {friends.map(friend => (
                                    <div key={friend._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                        <div>
                                            <h3 style={{ color: 'var(--text-main)', margin: 0 }}>{friend.name}</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0' }}>{friend.email}</p>
                                        </div>
                                        <Link
                                            to="/gift-assistant"
                                            state={{
                                                enableFriendWishlist: true,
                                                prefillFriendIdentifier: friend.email || friend.name || '',
                                            }}
                                            className="btn btn-secondary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                            <Gift size={16} /> Find Gift
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div>
                        {pendingRequests.length === 0 ? <p>No pending friend requests.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {pendingRequests.map(req => (
                                    <div key={req.friendshipId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                        <div>
                                            <h3 style={{ color: 'var(--text-main)', margin: 0 }}>{req.user.name}</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0' }}>{req.user.email}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn btn-primary" onClick={() => handleRequest(req.friendshipId, 'accept')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Check size={16} /> Accept
                                            </button>
                                            <button className="btn btn-outline" onClick={() => handleRequest(req.friendshipId, 'reject')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--error)', color: 'var(--error)' }}>
                                                <X size={16} /> Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'search' && (
                    <div>
                        {searchResults.length === 0 ? <p>No users found matching "{searchQuery}"</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {searchResults.map(user => (
                                    <div key={user._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                        <div>
                                            <h3 style={{ color: 'var(--text-main)', margin: 0 }}>{user.name}</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0' }}>{user.email}</p>
                                        </div>
                                        <button className="btn btn-primary" onClick={() => sendRequest(user._id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <UserPlus size={16} /> Add Friend
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FriendsPage;
