import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { HelpCircle, ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import '../styles/FAQPage.css';

const FAQPage = () => {
    const [faqs, setFaqs] = useState({});
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [expandedFAQ, setExpandedFAQ] = useState(null);

    useEffect(() => {
        const fetchFAQs = async () => {
            try {
                const { data } = await api.get('/api/faqs');
                setFaqs(data.data);
                setCategories(data.meta.categories);
            } catch (error) {
                console.error("Failed to fetch FAQs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFAQs();
    }, []);

    const toggleFAQ = (id) => {
        setExpandedFAQ(expandedFAQ === id ? null : id);
    };

    const handleVote = async (faqId, isHelpful) => {
        try {
            await api.post(`/api/faqs/${faqId}/feedback`, { helpful: isHelpful });
            alert("Thank you for your feedback!");
        } catch (error) {
            alert(error.response?.data?.message || "Error submitting feedback");
        }
    };

    if (loading) {
        return <div className="container animate-fade-in faq-page" style={{ textAlign: 'center' }}>Loading FAQs...</div>;
    }

    const displayCategories = activeCategory === 'all' ? categories : [activeCategory];

    return (
        <div className="container animate-fade-in faq-page">
            <div className="glass faq-header">
                <div className="faq-header-content">
                    <HelpCircle size={56} className="text-accent-1" style={{ margin: '0 auto 1.5rem', opacity: 0.9 }} />
                    <h1>How can we help you?</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                        Browse our frequently asked questions below to find quick answers about orders, shipping, and returns.
                    </p>
                    
                    <div className="faq-category-filters">
                        <button 
                            className={`btn ${activeCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveCategory('all')}
                        >
                            All Categories
                        </button>
                        {categories.map(cat => (
                            <button 
                                key={cat}
                                className={`btn ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {displayCategories.map(category => (
                    faqs[category] && faqs[category].length > 0 && (
                        <div key={category} className="glass faq-section">
                            <h2 className="faq-section-title">{category}</h2>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {faqs[category].map(faq => {
                                    const isExpanded = expandedFAQ === faq._id;
                                    return (
                                        <div key={faq._id} className={`faq-item ${isExpanded ? 'expanded' : ''}`}>
                                            <div className="faq-question" onClick={() => toggleFAQ(faq._id)}>
                                                <span>{faq.question}</span>
                                                <div className="faq-icon-wrapper">
                                                    <ChevronDown size={20} />
                                                </div>
                                            </div>
                                            
                                            <div className="faq-answer-container">
                                                <div className="faq-answer">
                                                    <p>{faq.answer}</p>
                                                    
                                                    <div className="faq-feedback">
                                                        <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>Was this helpful?</span>
                                                        <button className="feedback-btn" onClick={() => handleVote(faq._id, true)}>
                                                            <ThumbsUp size={16} /> Yes
                                                        </button>
                                                        <button className="feedback-btn" onClick={() => handleVote(faq._id, false)}>
                                                            <ThumbsDown size={16} /> No
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
};

export default FAQPage;
