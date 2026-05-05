import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingCart, Sparkles, Star } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
    buildFashionMetaLine,
    getDepartmentLabel,
    normalizeDepartment,
} from '../utils/productUtils';
import '../styles/RecommendedForYou.css';

const buildMatchPercent = (finalScore) =>
    Math.min(99, Math.max(50, Math.round(Number(finalScore) || 0)));

const toSummaryEntries = (contextSummary) => {
    if (!contextSummary) {
        return [];
    }

    const entries = [
        ...(contextSummary.preferredDepartments || []).map((value) => ({
            label: 'Department',
            value,
        })),
        ...(contextSummary.preferredCategories || []).map((value) => ({
            label: 'Category',
            value,
        })),
        ...(contextSummary.preferredBrands || []).map((value) => ({
            label: 'Brand',
            value,
        })),
    ];

    if (contextSummary.averagePrice) {
        entries.push({
            label: 'Avg Price',
            value: `$${Number(contextSummary.averagePrice).toLocaleString()}`,
        });
    }

    return entries.slice(0, 8);
};

const RecommendedForYou = ({ variant = 'section' }) => {
    const { userInfo } = useAuth();
    const { addToCart } = useCart();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recommendations, setRecommendations] = useState([]);
    const [contextSummary, setContextSummary] = useState(null);

    useEffect(() => {
        let isMounted = true;

        if (!userInfo) {
            setRecommendations([]);
            setContextSummary(null);
            setError('');
            setLoading(false);
            return undefined;
        }

        const fetchRecommendations = async () => {
            try {
                setLoading(true);
                setError('');

                const { data } = await api.get('/api/recommendations/personal');

                if (!isMounted) {
                    return;
                }

                setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
                setContextSummary(data.contextSummary || null);
            } catch (fetchError) {
                if (!isMounted) {
                    return;
                }

                setError(
                    fetchError.response?.data?.message ||
                        'Could not load recommendations right now.'
                );
                setRecommendations([]);
                setContextSummary(null);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchRecommendations();

        return () => {
            isMounted = false;
        };
    }, [userInfo]);

    const summaryEntries = useMemo(() => toSummaryEntries(contextSummary), [contextSummary]);
    const isPageVariant = variant === 'page';

    if (!userInfo) {
        return (
            <section className={`recommended-shell ${isPageVariant ? 'recommended-page-shell' : ''}`}>
                <div className="recommended-panel glass">
                    <div className="recommended-header-row">
                        <div>
                            <p className="recommended-kicker">Recommended For You</p>
                            <h2>Personal picks unlock after login</h2>
                        </div>
                    </div>
                    <p className="recommended-state-text">
                        Log in to see personalized recommendations.
                    </p>
                    <Link to="/login" className="btn btn-primary recommended-login-btn">
                        Sign In
                    </Link>
                </div>
            </section>
        );
    }

    if (loading) {
        return (
            <section className={`recommended-shell ${isPageVariant ? 'recommended-page-shell' : ''}`}>
                <div className="recommended-panel glass">
                    <p className="recommended-kicker">Recommended For You</p>
                    <h2>Finding your best picks...</h2>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className={`recommended-shell ${isPageVariant ? 'recommended-page-shell' : ''}`}>
                <div className="recommended-panel glass">
                    <p className="recommended-kicker">Recommended For You</p>
                    <h2>Could not load recommendations right now.</h2>
                    <p className="recommended-state-text">{error}</p>
                </div>
            </section>
        );
    }

    if (recommendations.length === 0) {
        return (
            <section className={`recommended-shell ${isPageVariant ? 'recommended-page-shell' : ''}`}>
                <div className="recommended-panel glass">
                    <p className="recommended-kicker">Recommended For You</p>
                    <h2>Your feed needs more signals</h2>
                    <p className="recommended-state-text">
                        Add items to your wishlist or place an order to get better recommendations.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className={`recommended-shell ${isPageVariant ? 'recommended-page-shell' : ''}`}>
            <div className="recommended-panel glass">
                <div className="recommended-header-row">
                    <div>
                        <p className="recommended-kicker">Recommended For You</p>
                        <h2>
                            {isPageVariant
                                ? 'Based on your orders, wishlist, and preferences'
                                : 'Your next five likely picks'}
                        </h2>
                    </div>
                    {!isPageVariant && (
                        <Link to="/recommendations" className="recommended-more-link">
                            See full view <ArrowRight size={16} />
                        </Link>
                    )}
                </div>

                {summaryEntries.length > 0 && (
                    <div className="recommended-summary-chips">
                        {summaryEntries.map((entry, index) => (
                            <span
                                key={`${entry.label}-${entry.value}-${index}`}
                                className="recommended-chip"
                            >
                                <strong>{entry.label}:</strong> {entry.value}
                            </span>
                        ))}
                    </div>
                )}

                <div className="recommended-grid">
                    {recommendations.slice(0, 5).map((recommendation) => {
                        const product = recommendation.product || {};
                        const matchPercent = buildMatchPercent(recommendation.finalScore);
                        const department = normalizeDepartment(product.department);
                        const fashionMeta = buildFashionMetaLine(product);
                        const reasons = Array.isArray(recommendation.reasons)
                            ? recommendation.reasons.slice(0, 3)
                            : [];

                        return (
                            <article key={product._id} className="recommended-card">
                                <div className="recommended-image-wrap">
                                    <span className={`recommended-department-badge badge-${department}`}>
                                        {getDepartmentLabel(department)}
                                    </span>
                                    <span className="recommended-match-badge">
                                        <Sparkles size={14} />
                                        {matchPercent}% match
                                    </span>
                                    <img src={product.image} alt={product.name} />
                                </div>

                                <div className="recommended-card-body">
                                    <div className="recommended-topline">
                                        <span className="recommended-brand">
                                            {product.brand || 'Quad Tech'}
                                        </span>
                                        {Number(product.rating) > 0 && (
                                            <span className="recommended-rating">
                                                <Star size={14} fill="currentColor" />
                                                {Number(product.rating).toFixed(1)}
                                            </span>
                                        )}
                                    </div>

                                    <h3>{product.name}</h3>
                                    <p className="recommended-category">
                                        {product.category || 'General'} | {getDepartmentLabel(department)}
                                    </p>
                                    {fashionMeta && <p className="recommended-meta">{fashionMeta}</p>}

                                    <ul className="recommended-reasons">
                                        {reasons.map((reason) => (
                                            <li key={reason}>{reason}</li>
                                        ))}
                                    </ul>

                                    <div className="recommended-footer">
                                        <div>
                                            <p className="recommended-price">
                                                ${Number(product.price || 0).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="recommended-actions">
                                            <Link
                                                to={`/product/${product._id}`}
                                                className="btn btn-outline recommended-card-btn"
                                            >
                                                View Details
                                            </Link>
                                            <button
                                                type="button"
                                                className="btn btn-primary recommended-card-btn"
                                                onClick={() => addToCart(product._id, 1)}
                                                disabled={Number(product.countInStock) <= 0}
                                            >
                                                <ShoppingCart size={16} />
                                                Add to Cart
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default RecommendedForYou;
