import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    BadgeCheck,
    CalendarHeart,
    ChevronDown,
    ChevronUp,
    Gift,
    Loader2,
    Send,
    ShoppingBag,
    SlidersHorizontal,
    Sparkles,
    Users,
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getDepartmentLabel, normalizeDepartment } from '../utils/productUtils';
import { useCurrency } from '../context/CurrencyContext';
import '../styles/GiftAssistantPage.css';

const formatBudget = (giftContext, formatCurrencyFn) => {
    if (!giftContext) {
        return 'Not specified';
    }

    const { budgetMin, budgetMax } = giftContext;

    if (budgetMin && budgetMax) {
        return `${formatCurrencyFn(budgetMin)} - ${formatCurrencyFn(budgetMax)}`;
    }

    if (budgetMax) {
        return `Under ${formatCurrencyFn(budgetMax)}`;
    }

    if (budgetMin) {
        return `From ${formatCurrencyFn(budgetMin)}`;
    }

    return 'Not specified';
};

const formatList = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return 'Not specified';
    }

    return items.join(', ');
};

const getProductImage = (product) => {
    if (product?.image) {
        return product.image;
    }

    if (Array.isArray(product?.images) && product.images.length > 0) {
        return product.images[0];
    }

    return '';
};

const getStockLabel = (countInStock) => {
    const count = Number(countInStock || 0);

    if (count <= 0) {
        return 'Out of Stock';
    }

    if (count <= 5) {
        return 'Low Stock';
    }

    return 'In Stock';
};

const getMatchLabel = (score) => {
    const value = Number(score || 0);

    if (value >= 85) {
        return 'Excellent match';
    }

    if (value >= 70) {
        return 'Strong match';
    }

    if (value >= 50) {
        return 'Good match';
    }

    return 'Possible match';
};

const getSourceLabel = (source) => {
    if (source === 'user-mentioned') {
        return 'Chosen from your message';
    }

    if (source === 'upcoming') {
        return 'Upcoming Bangladesh occasion';
    }

    return 'General gift mode';
};

const getSourceBadge = (source) => {
    if (source === 'friend_wishlist') {
        return 'On their wishlist';
    }

    if (source === 'similar_to_wishlist') {
        return 'Similar to wishlist';
    }

    if (source === 'promoted_relevant_category') {
        return 'Promoted category match';
    }

    if (source === 'general_catalog') {
        return 'Catalog pick';
    }

    return 'Gift pick';
};

const getSourceToneClass = (source) => {
    if (source === 'friend_wishlist') {
        return 'gift-source-wishlist';
    }

    if (source === 'similar_to_wishlist') {
        return 'gift-source-similar';
    }

    if (source === 'promoted_relevant_category') {
        return 'gift-source-general';
    }

    if (source === 'general_catalog') {
        return 'gift-source-general';
    }

    return 'gift-source-default';
};

const getWishlistReasonLabel = (reason) => {
    if (reason === 'empty_wishlist') {
        return 'Your friend has no wishlist items available.';
    }

    if (reason === 'wishlist_items_out_of_stock') {
        return 'Wishlist items are currently out of stock.';
    }

    if (reason === 'no_wishlist_match_in_budget') {
        return 'Wishlist did not have a strong in-budget match.';
    }

    if (reason === 'not_requested') {
        return 'Wishlist mode was not requested.';
    }

    return 'No special note.';
};

const getStockToneClass = (countInStock) => {
    const count = Number(countInStock || 0);

    if (count <= 0) {
        return 'gift-stock-out';
    }

    if (count <= 5) {
        return 'gift-stock-low';
    }

    return 'gift-stock-in';
};

const getScoreToneClass = (score) => {
    const value = Number(score || 0);

    if (value >= 85) {
        return 'gift-score-excellent';
    }

    if (value >= 70) {
        return 'gift-score-strong';
    }

    if (value >= 50) {
        return 'gift-score-good';
    }

    return 'gift-score-possible';
};

const getFriendDisplay = (friend) => {
    if (!friend) {
        return 'Not specified';
    }

    return friend.name || friend.username || friend.email || 'Not specified';
};

const breakdownEntries = [
    { key: 'wishlistScore', label: 'Wishlist' },
    { key: 'relationshipScore', label: 'Relationship' },
    { key: 'occasionScore', label: 'Occasion' },
    { key: 'budgetScore', label: 'Budget' },
    { key: 'qualityScore', label: 'Quality' },
    { key: 'priorityScore', label: 'Priority' },
    { key: 'paidBoostScore', label: 'Paid boost' },
    { key: 'departmentScore', label: 'Department' },
    { key: 'penaltyScore', label: 'Penalty' },
    { key: 'totalBeforeClamp', label: 'Total before clamp' },
];

const GiftAssistantPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userInfo } = useAuth();
    const { formatCurrency } = useCurrency();
    const [message, setMessage] = useState('');
    const [useFriendWishlist, setUseFriendWishlist] = useState(false);
    const [friendIdentifier, setFriendIdentifier] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedBreakdowns, setExpandedBreakdowns] = useState({});

    const promptExamples = useMemo(
        () => [
            'I want to buy a gift for my girlfriend under 5000',
            'I need Eid gift for my father under 7000',
            'Suggest a gift for my colleague around 3000',
            'Pohela Boishakh gift for my friend under 4000',
            'Birthday gift for my sister below 4500',
            "Use my friend's wishlist for a birthday gift under 5000",
        ],
        []
    );

    const recommendations = useMemo(
        () => (Array.isArray(result?.recommendations) ? result.recommendations : []),
        [result]
    );

    const activeOccasion = useMemo(
        () => result?.occasionContext?.activeOccasion || null,
        [result]
    );

    const wishlistContext = useMemo(
        () => result?.wishlistContext || null,
        [result]
    );

    useEffect(() => {
        const prefillFriendIdentifier = location.state?.prefillFriendIdentifier;
        const enableFriendWishlist = location.state?.enableFriendWishlist;

        if (enableFriendWishlist && typeof prefillFriendIdentifier === 'string') {
            setUseFriendWishlist(true);
            setFriendIdentifier(prefillFriendIdentifier);
            setError('');
        }
    }, [location.state]);

    const submitHandler = async (event) => {
        event.preventDefault();

        const trimmedMessage = message.trim();
        const trimmedFriendIdentifier = friendIdentifier.trim();

        if (!trimmedMessage) {
            setError('Please describe who the gift is for and your budget.');
            return;
        }

        if (useFriendWishlist && !userInfo) {
            setError("Please log in to use a friend's wishlist for gift recommendations.");
            return;
        }

        if (useFriendWishlist && !trimmedFriendIdentifier) {
            setError("Please enter your friend's email or username.");
            return;
        }

        try {
            setLoading(true);
            setError('');
            setResult(null);
            setExpandedBreakdowns({});

            let data;

            if (useFriendWishlist) {
                ({ data } = await api.post('/api/ai/gift-assistant/friend', {
                    message: trimmedMessage,
                    friendIdentifier: trimmedFriendIdentifier,
                }));
            } else {
                ({ data } = await api.post('/api/ai/gift-assistant', {
                    message: trimmedMessage,
                }));
            }

            if (!data?.success) {
                setError(data?.message || 'Could not get gift recommendations right now.');
                return;
            }

            setResult(data);
        } catch (requestError) {
            const status = requestError.response?.status;
            const backendMessage = requestError.response?.data?.message;

            if (status && status < 500) {
                setError(
                    backendMessage ||
                        (useFriendWishlist
                            ? "Please enter your friend's email or username."
                            : 'Please describe who the gift is for and your budget.')
                );
            } else {
                setError('Could not get gift recommendations right now. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const applyExamplePrompt = (example) => {
        setMessage(example);
        setError('');
    };

    const toggleBreakdown = (breakdownKey) => {
        setExpandedBreakdowns((currentState) => ({
            ...currentState,
            [breakdownKey]: !currentState[breakdownKey],
        }));
    };

    return (
        <div className="gift-assistant-page animate-fade-in">
            <section className="gift-hero glass">
                <div className="gift-hero-content">
                    <p className="gift-kicker">
                        Feature 13 {'\u00B7'} AI Gift Assistant
                    </p>
                    <h1>
                        Find the right <span className="text-gradient">gift</span> for someone special
                    </h1>
                    <p>
                        Describe who you are buying for, your budget, and the occasion. Quad Tech
                        will select real in-stock products and explain why they fit.
                    </p>

                    <div className="gift-badge-row">
                        <span className="gift-badge">
                            <BadgeCheck size={16} />
                            Gifts for youyr loved ones
                        </span>
                        <span className="gift-badge">
                            <CalendarHeart size={16} />
                            For any Occasions
                        </span>
                        <span className="gift-badge">
                            <Sparkles size={16} />
                            Fashion + electronics
                        </span>
                    </div>
                </div>
            </section>

            <section className="gift-input-card glass">
                <form className="gift-form" onSubmit={submitHandler}>
                    <div className="gift-friend-mode-card glass">
                        <label className="gift-friend-toggle" htmlFor="gift-friend-mode">
                            <input
                                id="gift-friend-mode"
                                type="checkbox"
                                checked={useFriendWishlist}
                                onChange={(event) => {
                                    setUseFriendWishlist(event.target.checked);
                                    setError('');
                                }}
                            />
                            <div className="gift-friend-copy">
                                <strong>Use a friend's wishlist</strong>
                                <span>
                                    Only accepted friends can be used. We use wishlist items only,
                                    not past orders.
                                </span>
                            </div>
                        </label>

                        {useFriendWishlist ? (
                            <div className="gift-friend-input-wrap">
                                <label className="gift-form-label" htmlFor="gift-friend-identifier">
                                    Friend email or username
                                </label>
                                <input
                                    id="gift-friend-identifier"
                                    type="text"
                                    className="gift-friend-input"
                                    value={friendIdentifier}
                                    onChange={(event) => setFriendIdentifier(event.target.value)}
                                    placeholder="friend@example.com or friendUsername"
                                    aria-label="Friend email or username"
                                />
                                <p className="gift-friend-helper">
                                    We verify accepted friendship first, then use wishlist items as
                                    the starting point for gift picks.
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <label className="gift-form-label" htmlFor="gift-request">
                        Tell the assistant who the gift is for
                    </label>

                    <textarea
                        id="gift-request"
                        className="gift-textarea"
                        placeholder="Example: I want to buy a gift for my girlfriend under 5000"
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        aria-label="Describe who the gift is for and the budget"
                        rows={5}
                    />

                    <div className="gift-form-footer">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="spinner" />
                                    Finding gifts...
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    Find Gifts
                                </>
                            )}
                        </button>
                    </div>

                    <div className="gift-example-row">
                        {promptExamples.map((example) => (
                            <button
                                key={example}
                                type="button"
                                className="gift-example-chip"
                                onClick={() => applyExamplePrompt(example)}
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </form>
            </section>

            {error ? (
                <div className="gift-error glass" role="alert">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            ) : null}

            {result ? (
                <div className="gift-results-layout">
                    <section className="gift-reply-card glass">
                        <div className="gift-card-heading">
                            <Sparkles size={18} />
                            <h2>Assistant Reply</h2>
                        </div>
                        <p>{result.reply || 'Recommendations are ready.'}</p>
                    </section>

                    <div className="gift-meta-grid">
                        <article className="gift-context-card glass">
                            <div className="gift-card-heading">
                                <SlidersHorizontal size={18} />
                                <h2>Gift Context</h2>
                            </div>

                            <div className="gift-meta-list">
                                <div>
                                    <span>Recipient</span>
                                    <strong>{result.giftContext?.recipientType || 'Not specified'}</strong>
                                </div>
                                <div>
                                    <span>Relationship</span>
                                    <strong>{result.giftContext?.relationshipType || 'Not specified'}</strong>
                                </div>
                                <div>
                                    <span>Occasion</span>
                                    <strong>{result.giftContext?.occasion || 'Not specified'}</strong>
                                </div>
                                <div>
                                    <span>Budget</span>
                                    <strong>{formatBudget(result.giftContext, formatCurrency)}</strong>
                                </div>
                                <div>
                                    <span>Department preference</span>
                                    <strong>
                                        {result.giftContext?.departmentPreference || 'Not specified'}
                                    </strong>
                                </div>
                                <div>
                                    <span>Preferred categories</span>
                                    <strong>{formatList(result.giftContext?.preferredCategories)}</strong>
                                </div>
                                <div>
                                    <span>Preferred colors</span>
                                    <strong>{formatList(result.giftContext?.preferredColors)}</strong>
                                </div>
                                <div>
                                    <span>Preferred styles</span>
                                    <strong>{formatList(result.giftContext?.preferredStyleTags)}</strong>
                                </div>
                            </div>
                        </article>

                        <article className="gift-context-card glass">
                            <div className="gift-card-heading">
                                <CalendarHeart size={18} />
                                <h2>Occasion Context</h2>
                            </div>

                            <div className="gift-meta-list">
                                <div>
                                    <span>Active occasion</span>
                                    <strong>{activeOccasion?.name || 'Not specified'}</strong>
                                </div>
                                <div>
                                    <span>Source</span>
                                    <strong>{getSourceLabel(result.occasionContext?.source)}</strong>
                                </div>
                                <div>
                                    <span>Recommended colors</span>
                                    <strong>{formatList(activeOccasion?.recommendedColors)}</strong>
                                </div>
                                <div>
                                    <span>Recommended categories</span>
                                    <strong>{formatList(activeOccasion?.recommendedCategories)}</strong>
                                </div>
                                <div>
                                    <span>Recommended style tags</span>
                                    <strong>{formatList(activeOccasion?.recommendedStyleTags)}</strong>
                                </div>
                            </div>
                        </article>

                        {wishlistContext ? (
                            <article className="gift-context-card gift-wishlist-context-card glass">
                                <div className="gift-card-heading">
                                    <Users size={18} />
                                    <h2>Friend Wishlist Context</h2>
                                </div>

                                <div className="gift-meta-list">
                                    <div>
                                        <span>Friend</span>
                                        <strong>{getFriendDisplay(wishlistContext.friend)}</strong>
                                    </div>
                                    <div>
                                        <span>Wishlist used</span>
                                        <strong>{wishlistContext.usedWishlist ? 'Yes' : 'No'}</strong>
                                    </div>
                                    <div>
                                        <span>Wishlist items</span>
                                        <strong>{Number(wishlistContext.wishlistProductCount || 0)}</strong>
                                    </div>
                                    <div>
                                        <span>In-stock wishlist items</span>
                                        <strong>{Number(wishlistContext.inStockWishlistProductCount || 0)}</strong>
                                    </div>
                                    <div>
                                        <span>Selected wishlist picks</span>
                                        <strong>{Number(wishlistContext.selectedWishlistProductCount || 0)}</strong>
                                    </div>
                                    <div>
                                        <span>Similar picks</span>
                                        <strong>{Number(wishlistContext.selectedSimilarProductCount || 0)}</strong>
                                    </div>
                                    <div>
                                        <span>Catalog picks</span>
                                        <strong>{Number(wishlistContext.selectedGeneralProductCount || 0)}</strong>
                                    </div>
                                    {wishlistContext.reason ? (
                                        <div>
                                            <span>Note</span>
                                            <strong>{getWishlistReasonLabel(wishlistContext.reason)}</strong>
                                        </div>
                                    ) : null}
                                </div>
                            </article>
                        ) : null}
                    </div>

                    <section className="gift-recommendations-section">
                        <div className="gift-section-header">
                            <div className="gift-card-heading">
                                <ShoppingBag size={18} />
                                <h2>Recommended Gifts</h2>
                            </div>
                            <p>
                                Carefully selected from real Quad Tech inventory based on recipient
                                fit, occasion, budget, and wishlist relevance when available.
                            </p>
                        </div>

                        {recommendations.length === 0 ? (
                            <div className="gift-empty-state glass">
                                <Gift size={24} />
                                <h3>No matching in-stock products found yet.</h3>
                                <p>
                                    Try increasing the budget, removing category restrictions, or
                                    asking for a broader gift idea.
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => applyExamplePrompt('Gift for a friend around 3000')}
                                >
                                    Try example
                                </button>
                            </div>
                        ) : (
                            <div className="gift-recommendations-grid">
                                {recommendations.map((recommendation, index) => {
                                    const product = recommendation.product || {};
                                    const image = getProductImage(product);
                                    const stockLabel = getStockLabel(product.countInStock);
                                    const stockTone = getStockToneClass(product.countInStock);
                                    const score = Number(recommendation.giftScore || 0);
                                    const scoreTone = getScoreToneClass(score);
                                    const source = recommendation.recommendationSource;
                                    const productLink = product?._id ? `/product/${product._id}` : null;
                                    const reasonPreview = Array.isArray(recommendation.reasons)
                                        ? recommendation.reasons.slice(0, 4)
                                        : [];
                                    const hiddenReasonCount = Math.max(
                                        0,
                                        (recommendation.reasons || []).length - reasonPreview.length
                                    );
                                    const breakdownKey = product._id || `recommendation-${index}`;
                                    const showBreakdown =
                                        recommendation.scoreBreakdown &&
                                        Object.keys(recommendation.scoreBreakdown).length > 0;
                                    const isBreakdownOpen = Boolean(
                                        expandedBreakdowns[breakdownKey]
                                    );
                                    const department = normalizeDepartment(product.department);
                                    const isPromoted =
                                        Boolean(recommendation.isPromoted) ||
                                        Boolean(product.isPromoted) ||
                                        Number(recommendation.paidBoostScore) > 0 ||
                                        Number(product.paidBoostScore) > 0;
                                    const visibleBreakdownEntries = breakdownEntries.filter(
                                        (entry) => {
                                            const value = recommendation.scoreBreakdown?.[entry.key];

                                            if (value === undefined) {
                                                return false;
                                            }

                                            if (entry.key === 'paidBoostScore') {
                                                return Number(value) > 0;
                                            }

                                            return true;
                                        }
                                    );

                                    return (
                                        <article 
                                            key={breakdownKey} 
                                            className="gift-product-card glass"
                                            onClick={(e) => {
                                                if (!e.target.closest('button') && productLink) {
                                                    navigate(productLink);
                                                }
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="gift-product-image">
                                                {image ? (
                                                    <img src={image} alt={product.name || 'Gift product'} />
                                                ) : (
                                                    <div className="gift-image-placeholder">
                                                        <Gift size={40} />
                                                    </div>
                                                )}

                                                <span
                                                    className={`gift-source-badge ${getSourceToneClass(source)}`}
                                                >
                                                    {getSourceBadge(source)}
                                                </span>
                                                {isPromoted ? (
                                                    <span className="gift-promoted-badge">
                                                        Promoted
                                                    </span>
                                                ) : null}

                                                <div className={`gift-score-badge ${scoreTone}`}>
                                                    <strong>{score}/100</strong>
                                                    <span>{getMatchLabel(score)}</span>
                                                </div>
                                            </div>

                                            <div className="gift-product-body">
                                                <div className="gift-product-topline">
                                                    <span className="gift-brand">
                                                        {product.brand || 'Quad Tech'}
                                                    </span>
                                                    <span className="gift-department-tag">
                                                        {getDepartmentLabel(department)}
                                                    </span>
                                                </div>

                                                <h3 className="gift-product-title">
                                                    {product.name || 'Gift suggestion'}
                                                </h3>

                                                <p className="gift-product-meta">
                                                    {(product.category || 'General')} <span>/</span>{' '}
                                                    {getDepartmentLabel(department)}
                                                </p>

                                                <div className="gift-product-price-row">
                                                    <strong>{formatCurrency(product.price)}</strong>
                                                    <span className={`gift-stock-pill ${stockTone}`}>
                                                        {stockLabel}
                                                    </span>
                                                </div>

                                                <ul className="gift-reasons">
                                                    {reasonPreview.map((reason) => (
                                                        <li key={reason} className="gift-reason">
                                                            <BadgeCheck size={14} />
                                                            <span>{reason}</span>
                                                        </li>
                                                    ))}
                                                    {hiddenReasonCount > 0 ? (
                                                        <li className="gift-reason gift-reason-more">
                                                            +{hiddenReasonCount} more reasons
                                                        </li>
                                                    ) : null}
                                                </ul>

                                                <div className="gift-card-actions">

                                                    {showBreakdown ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline gift-breakdown-toggle"
                                                            onClick={() => toggleBreakdown(breakdownKey)}
                                                        >
                                                            {isBreakdownOpen ? (
                                                                <>
                                                                    <ChevronUp size={16} />
                                                                    Hide score details
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown size={16} />
                                                                    Show score details
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : null}
                                                </div>

                                                {showBreakdown && isBreakdownOpen ? (
                                                    <div className="gift-breakdown">
                                                        <div className="gift-breakdown-grid">
                                                            {visibleBreakdownEntries.map((entry) => (
                                                                <div
                                                                    key={entry.key}
                                                                    className="gift-breakdown-item"
                                                                >
                                                                    <span>{entry.label}</span>
                                                                    <strong>
                                                                        {Number(
                                                                            recommendation.scoreBreakdown?.[
                                                                                entry.key
                                                                            ] || 0
                                                                        )}
                                                                    </strong>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            ) : null}
        </div>
    );
};

export default GiftAssistantPage;
