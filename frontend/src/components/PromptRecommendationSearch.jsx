import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Filter, Search, Sparkles, Star } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
    buildFashionMetaLine,
    getDepartmentLabel,
    normalizeDepartment,
    normalizeStringList,
} from '../utils/productUtils';

const suggestionChips = [
    'Dress under 1000',
    'Black shoes for men',
    'Cotton outfit for summer',
    'Products like my Cloud Closet',
    'Gift under 1500',
];

const formatPrice = (value) => `$${Number(value || 0).toLocaleString()}`;

const joinValues = (values) => normalizeStringList(values).join(', ');

const buildIntentChips = (intent) => {
    if (!intent) {
        return [];
    }

    const chips = [];

    if (intent.category) chips.push(`Category: ${intent.category}`);
    if (intent.productType) chips.push(`Type: ${intent.productType}`);
    if (intent.department) chips.push(`Department: ${getDepartmentLabel(intent.department)}`);
    if (intent.brand) chips.push(`Brand: ${intent.brand}`);
    if (intent.gender) chips.push(`For: ${intent.gender}`);
    if (Number(intent.minPrice) > 0 && Number(intent.maxPrice) > 0) {
        chips.push(`Price: ${formatPrice(intent.minPrice)}-${formatPrice(intent.maxPrice)}`);
    } else if (Number(intent.maxPrice) > 0) {
        chips.push(`Under ${formatPrice(intent.maxPrice)}`);
    } else if (Number(intent.minPrice) > 0) {
        chips.push(`Over ${formatPrice(intent.minPrice)}`);
    }
    if (intent.requestedColors?.length) chips.push(`Color: ${joinValues(intent.requestedColors)}`);
    if (intent.requestedMaterials?.length) chips.push(`Material: ${joinValues(intent.requestedMaterials)}`);
    if (intent.requestedSizes?.length) chips.push(`Size: ${joinValues(intent.requestedSizes)}`);
    if (intent.fit) chips.push(`Fit: ${intent.fit}`);
    if (intent.occasion) chips.push(`Occasion: ${intent.occasion}`);
    if (intent.season) chips.push(`Season: ${intent.season}`);
    if (intent.styleTags?.length) chips.push(`Style: ${joinValues(intent.styleTags)}`);

    return chips;
};

const PromptRecommendationSearch = () => {
    const { userInfo } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [submittedPrompt, setSubmittedPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const intentChips = useMemo(() => buildIntentChips(result?.intent), [result]);

    const submitPrompt = async (nextPrompt) => {
        const trimmedPrompt = String(nextPrompt ?? prompt).trim();

        if (!trimmedPrompt || loading) {
            return;
        }

        try {
            setLoading(true);
            setError('');
            setSubmittedPrompt(trimmedPrompt);

            const { data } = await api.post('/api/recommendations/prompt', {
                prompt: trimmedPrompt,
            });

            setResult(data);
        } catch (requestError) {
            setResult(null);
            setError(
                requestError.response?.data?.message ||
                    'Could not find prompt recommendations right now.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        submitPrompt();
    };

    const handleChipClick = (chip) => {
        setPrompt(chip);
        submitPrompt(chip);
    };

    if (!userInfo) {
        return (
            <section className="prompt-recommendation-panel glass">
                <div className="prompt-recommendation-header">
                    <p className="recommendations-page-kicker">AI Product Finder</p>
                    <h2>Ask in natural language after login</h2>
                    <p>Sign in to use your cart, wishlist, Cloud Closet, and order history while searching.</p>
                </div>
                <Link to="/login" className="btn btn-primary prompt-login-link">
                    Sign In
                </Link>
            </section>
        );
    }

    return (
        <section className="prompt-recommendation-panel glass">
            <div className="prompt-recommendation-header">
                <p className="recommendations-page-kicker">
                    <Sparkles size={16} /> AI Product Finder
                </p>
                <h2>Ask for products your way</h2>
                <p>Try prompts like black dress under 1000 or products like my Cloud Closet.</p>
            </div>

            <form className="prompt-recommendation-form" onSubmit={handleSubmit}>
                <div className="prompt-input-wrap">
                    <Search size={20} />
                    <input
                        type="text"
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        maxLength={300}
                        placeholder="Ask for products in natural language..."
                    />
                </div>
                <button
                    type="submit"
                    className="btn btn-primary prompt-submit-btn"
                    disabled={loading || !prompt.trim()}
                >
                    {loading ? 'Finding...' : 'Find Products'}
                </button>
            </form>

            <div className="prompt-suggestion-row">
                {suggestionChips.map((chip) => (
                    <button
                        key={chip}
                        type="button"
                        className="prompt-suggestion-chip"
                        onClick={() => handleChipClick(chip)}
                        disabled={loading}
                    >
                        {chip}
                    </button>
                ))}
            </div>

            {!submittedPrompt && !loading && !error && !result && (
                <p className="prompt-empty-state">
                    Ask for products in natural language, like "black dress under 1000".
                </p>
            )}

            {loading && (
                <div className="prompt-status-row">
                    <Sparkles size={18} />
                    <span>Finding matching products...</span>
                </div>
            )}

            {error && <p className="prompt-error-message">{error}</p>}

            {result && !loading && (
                <div className="prompt-results-shell">
                    <div className="prompt-result-summary">
                        <div>
                            <p className="prompt-result-eyebrow">Search result</p>
                            <h3>{submittedPrompt}</h3>
                        </div>
                        {result.fallbackUsed && (
                            <div className="prompt-fallback-message">
                                {result.message}
                            </div>
                        )}
                    </div>

                    {intentChips.length > 0 && (
                        <div className="prompt-intent-chips">
                            <span className="prompt-intent-label">
                                <Filter size={15} /> Showing
                            </span>
                            {intentChips.map((chip) => (
                                <span key={chip} className="recommended-chip">
                                    {chip}
                                </span>
                            ))}
                        </div>
                    )}

                    {Array.isArray(result.products) && result.products.length > 0 ? (
                        <div className="prompt-products-grid">
                            {result.products.map((product) => {
                                const department = normalizeDepartment(product.department);
                                const fashionMeta = buildFashionMetaLine(product);
                                const reasons = Array.isArray(product.matchReasons)
                                    ? product.matchReasons.slice(0, 3)
                                    : [];

                                return (
                                    <article key={product._id} className="prompt-product-card">
                                        <Link to={`/product/${product._id}`} className="prompt-product-image">
                                            <span className={`recommended-department-badge badge-${department}`}>
                                                {getDepartmentLabel(department)}
                                            </span>
                                            <img src={product.image} alt={product.name} />
                                        </Link>

                                        <div className="prompt-product-body">
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
                                                {product.category || 'General'}
                                                {product.productType ? ` | ${product.productType}` : ''}
                                            </p>
                                            {fashionMeta && <p className="recommended-meta">{fashionMeta}</p>}

                                            {reasons.length > 0 && (
                                                <ul className="recommended-reasons">
                                                    {reasons.map((reason) => (
                                                        <li key={reason}>{reason}</li>
                                                    ))}
                                                </ul>
                                            )}

                                            <div className="prompt-product-footer">
                                                <p className="recommended-price">
                                                    {formatPrice(product.price)}
                                                </p>
                                                <Link
                                                    to={`/product/${product._id}`}
                                                    className="prompt-details-link"
                                                >
                                                    View <ArrowRight size={15} />
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="prompt-empty-state">
                            No products matched that prompt. Try a broader product type or budget.
                        </p>
                    )}
                </div>
            )}
        </section>
    );
};

export default PromptRecommendationSearch;
