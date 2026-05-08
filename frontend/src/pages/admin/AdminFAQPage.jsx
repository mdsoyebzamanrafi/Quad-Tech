import React, { useEffect, useState } from 'react';
import { Trash2, Plus, HelpCircle } from 'lucide-react';
import api from '../../utils/api';
import '../../styles/Admin.css';

const AdminFAQPage = () => {
    const [faqs, setFaqs] = useState({});
    const [loading, setLoading] = useState(true);
    
    // Form state
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [category, setCategory] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const fetchFAQs = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/api/faqs');
            setFaqs(data.data || {});
        } catch {
            console.error('Failed to fetch FAQs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFAQs();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!question || !answer || !category) {
            alert('Please fill out all fields');
            return;
        }

        try {
            setIsCreating(true);
            await api.post('/api/faqs', { question, answer, category });
            setQuestion('');
            setAnswer('');
            setCategory('');
            fetchFAQs();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to create FAQ');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (faqId) => {
        if (!window.confirm('Are you sure you want to delete this FAQ?')) return;
        
        try {
            await api.delete(`/api/faqs/${faqId}`);
            fetchFAQs();
        } catch {
            alert('Failed to delete FAQ');
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
        <div className="admin-page animate-fade-in">
            <header className="admin-page-header">
                <h2>Manage FAQs</h2>
                <p>Create, view, and remove Frequently Asked Questions.</p>
            </header>

            <div className="admin-card glass" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                    <Plus size={20} className="text-accent-1" /> Add New FAQ
                </h3>
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>Category</label>
                        <select 
                            style={inputStyle}
                            value={category} 
                            onChange={e => setCategory(e.target.value)}
                            required
                        >
                            <option value="" disabled>Select a category...</option>
                            <option value="Orders">Orders</option>
                            <option value="Payments">Payments</option>
                            <option value="Shipping & Delivery">Shipping & Delivery</option>
                            <option value="Returns & Refunds">Returns & Refunds</option>
                            <option value="Products">Products</option>
                            <option value="Account & Security">Account & Security</option>
                            <option value="Support">Support</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>Question</label>
                        <input 
                            type="text" 
                            style={inputStyle}
                            value={question} 
                            onChange={e => setQuestion(e.target.value)} 
                            placeholder="e.g., What is your return policy?"
                            required
                        />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>Answer</label>
                        <textarea 
                            style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }}
                            value={answer} 
                            onChange={e => setAnswer(e.target.value)} 
                            placeholder="Provide the detailed answer here..."
                            rows="4"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={isCreating} style={{ alignSelf: 'flex-start', marginTop: '0.5rem', padding: '0.75rem 2rem' }}>
                        {isCreating ? 'Adding...' : 'Add FAQ'}
                    </button>
                </form>
            </div>

            <div className="admin-card glass">
                <h3 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                    <HelpCircle size={20} className="text-accent-1" /> Current FAQs
                </h3>
                
                {loading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading FAQs...</p>
                ) : Object.keys(faqs).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No FAQs exist yet. Create one above!</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        {Object.entries(faqs).map(([cat, questions]) => (
                            <div key={cat}>
                                <h4 style={{ color: 'var(--accent-1)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', fontSize: '1.2rem' }}>{cat}</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {questions.map(q => (
                                        <div key={q._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', transition: 'transform 0.2s ease' }}>
                                            <div style={{ flex: 1, paddingRight: '1.5rem' }}>
                                                <strong style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-main)', fontSize: '1.05rem' }}>Q: {q.question}</strong>
                                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: '1.6' }}>A: {q.answer}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleDelete(q._id)}
                                                style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.2)', color: 'var(--error)', cursor: 'pointer', padding: '0.75rem', height: 'fit-content', borderRadius: 'var(--radius-sm)', transition: 'all 0.2s ease' }}
                                                title="Delete FAQ"
                                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,0,0,0.2)'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,0,0,0.1)'; }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminFAQPage;
