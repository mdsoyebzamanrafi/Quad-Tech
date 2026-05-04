import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { MessageSquare, Star } from 'lucide-react';
import '../styles/LoginPage.css';

const FeedbackPage = () => {
    const [feedbacks, setFeedbacks] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [rating, setRating] = useState(5);
    const [message, setMessage] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                const [feedbackRes, statsRes] = await Promise.all([
                    api.get('/api/feedback'),
                    api.get('/api/feedback/stats')
                ]);
                setFeedbacks(feedbackRes.data.data);
                setStats(statsRes.data.data);
            } catch (error) {
                console.error("Failed to fetch feedback:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFeedback();
    }, []);

    const submitHandler = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            await api.post('/api/feedback', { name, email, rating, message });
            alert("Thank you! Your feedback has been submitted for review.");
            setName('');
            setEmail('');
            setRating(5);
            setMessage('');
        } catch (error) {
            alert(error.response?.data?.message || "Error submitting feedback");
        } finally {
            setSubmitLoading(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        background: 'rgba(0, 0, 0, 0.2)',
        color: 'var(--text-main)',
        fontFamily: 'inherit',
        fontSize: '1rem',
        outline: 'none',
        transition: 'border-color 0.3s ease'
    };

    return (
        <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
            <div className="cart-grid" style={{ alignItems: 'flex-start' }}>
                <div className="cart-items-column" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                            <MessageSquare className="text-accent-1" />
                            <h1 style={{ fontSize: '1.8rem' }}>Customer Feedback</h1>
                        </div>
                        
                        {loading ? <p>Loading reviews...</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {feedbacks.length === 0 ? <p>No feedback yet. Be the first!</p> : feedbacks.map(fb => (
                                    <div key={fb._id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <strong style={{ color: 'var(--text-main)' }}>{fb.name}</strong>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{new Date(fb.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '0.5rem', color: '#ffb400' }}>
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} size={16} fill={i < fb.rating ? '#ffb400' : 'none'} />
                                            ))}
                                        </div>
                                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>{fb.message}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="cart-summary-column">
                    {stats && (
                        <div className="summary-box glass" style={{ marginBottom: '2rem' }}>
                            <h2 className="summary-title">Store Rating</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.averageRating}</span>
                                <div>
                                    <div style={{ display: 'flex', color: '#ffb400' }}>
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} size={20} fill={i < Math.round(stats.averageRating) ? '#ffb400' : 'none'} />
                                        ))}
                                    </div>
                                    <span style={{ color: 'var(--text-muted)' }}>Based on {stats.totalReviews} reviews</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="login-card glass" style={{ width: '100%', maxWidth: 'none', margin: 0 }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Leave Feedback</h2>
                        <form onSubmit={submitHandler} className="login-form">
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>Name</label>
                                <input type="text" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>Email</label>
                                <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>Rating (1-5)</label>
                                <input type="number" min="1" max="5" style={inputStyle} value={rating} onChange={(e) => setRating(Number(e.target.value))} required />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>Message</label>
                                <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows="4" style={{ ...inputStyle, resize: 'vertical' }} placeholder="Tell us about your experience..."></textarea>
                            </div>
                            <button type="submit" className="btn btn-primary btn-full" disabled={submitLoading} style={{ marginTop: '1rem' }}>
                                {submitLoading ? 'Submitting...' : 'Submit Feedback'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeedbackPage;
