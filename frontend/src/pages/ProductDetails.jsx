import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Star, ShieldCheck, Truck, Ruler, Palette, Heart } from 'lucide-react';
import '../styles/ProductDetails.css';
import api from '../utils/api';
import { useCart } from '../context/CartContext';
import {
    buildFashionMetaLine,
    getDepartmentLabel,
    normalizeDepartment,
    normalizeStringList,
} from '../utils/productUtils';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [qty, setQty] = useState(1);
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { addToCart } = useCart();

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const { data } = await api.get(`/api/products/${id}`);
                setProduct(data);
                setLoading(false);
            } catch (fetchError) {
                setError(fetchError.response?.data?.message || fetchError.message || 'Product not found');
                setLoading(false);
            }
        };

        fetchProduct();
    }, [id]);

    const addToCartHandler = () => {
        addToCart(product._id, qty);
        navigate('/cart');
    };

    const handleAddToWishlist = async () => {
        try {
            await api.post('/api/wishlist', { productId: product._id });
            alert('Added to wishlist!');
        } catch (error) {
            alert('Please login to add to wishlist');
        }
    };

    const normalizedProduct = useMemo(() => {
        if (!product) {
            return null;
        }

        return {
            ...product,
            department: normalizeDepartment(product.department),
            colors: normalizeStringList(product.colors),
            sizes: normalizeStringList(product.sizes),
            styleTags: normalizeStringList(product.styleTags),
        };
    }, [product]);

    const productHighlights = useMemo(() => {
        if (!normalizedProduct) {
            return [];
        }

        if (normalizedProduct.department === 'fashion') {
            return [
                { icon: <Ruler size={20} />, text: 'Easy size exchange available' },
                { icon: <Truck size={20} />, text: 'Fast nationwide fashion delivery' },
            ];
        }

        return [
            { icon: <ShieldCheck size={20} />, text: '1 Year Premium Warranty' },
            { icon: <Truck size={20} />, text: 'Free Next-Day Shipping' },
        ];
    }, [normalizedProduct]);

    const fashionDetailRows = useMemo(() => {
        if (!normalizedProduct || normalizedProduct.department !== 'fashion') {
            return [];
        }

        return [
            { label: 'Gender', value: normalizedProduct.gender },
            { label: 'Available Colors', value: normalizedProduct.colors.join(', ') },
            { label: 'Available Sizes', value: normalizedProduct.sizes.join(', ') },
            { label: 'Material', value: normalizedProduct.material },
            { label: 'Fit', value: normalizedProduct.fit },
            { label: 'Occasion', value: normalizedProduct.occasion },
            { label: 'Season', value: normalizedProduct.season },
            { label: 'Style Tags', value: normalizedProduct.styleTags.join(', ') },
            { label: 'Product Type', value: normalizedProduct.productType },
        ].filter((row) => typeof row.value === 'string' && row.value.trim());
    }, [normalizedProduct]);

    if (loading) {
        return (
            <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}>
                <h2>Loading Product...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="container"
                style={{ paddingTop: '6rem', textAlign: 'center', color: 'var(--accent-1)' }}
            >
                <h2>Error: {error}</h2>
            </div>
        );
    }

    if (!normalizedProduct) {
        return null;
    }

    const departmentLabel = getDepartmentLabel(normalizedProduct.department);
    const fashionMeta = buildFashionMetaLine(normalizedProduct);

    return (
        <div className="product-details-container container animate-fade-in">
            <Link to="/" className="btn btn-outline back-btn glass">
                <ArrowLeft size={16} /> Back to Collection
            </Link>

            <div className="product-details-grid">
                <div className="product-image-box">
                    <div className="image-blob-bg"></div>
                    <img src={normalizedProduct.image} alt={normalizedProduct.name} />
                </div>

                <div className="product-info-box">
                    <div className="brand-badge">{normalizedProduct.brand}</div>
                    <div className="product-detail-badges">
                        <span className={`detail-pill detail-${normalizedProduct.department}`}>{departmentLabel}</span>
                        <span className="detail-pill detail-category">{normalizedProduct.category}</span>
                        {normalizedProduct.isNewArrival && <span className="detail-pill detail-new">New Arrival</span>}
                        {normalizedProduct.isSponsored && <span className="detail-pill detail-sponsored">Sponsored</span>}
                    </div>

                    <h1 className="product-title">{normalizedProduct.name}</h1>

                    <div className="rating-container">
                        <div className="stars">
                            {[0, 1, 2, 3, 4].map((starIndex) => (
                                <Star
                                    key={starIndex}
                                    className={`star-icon ${
                                        normalizedProduct.rating >= starIndex + 1
                                            ? 'filled'
                                            : normalizedProduct.rating >= starIndex + 0.5
                                                ? 'half'
                                                : 'empty'
                                    }`}
                                    size={18}
                                    fill="currentColor"
                                />
                            ))}
                        </div>
                        <span className="reviews-count">
                            ({normalizedProduct.numReviews || 0} Reviews)
                        </span>
                    </div>

                    <div className="price-tag text-gradient">${Number(normalizedProduct.price || 0).toFixed(2)}</div>

                    <p className="product-description">{normalizedProduct.description}</p>

                    {fashionMeta && (
                        <div className="fashion-highlight">
                            <Palette size={18} />
                            <span>{fashionMeta}</span>
                        </div>
                    )}

                    {fashionDetailRows.length > 0 && (
                        <div className="fashion-details-card glass">
                            <h3>Fashion Details</h3>
                            <div className="fashion-details-grid">
                                {fashionDetailRows.map((row) => (
                                    <div key={row.label} className="fashion-detail-row">
                                        <span>{row.label}</span>
                                        <strong>{row.value}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="product-features">
                        {productHighlights.map((highlight) => (
                            <div key={highlight.text} className="feature">
                                <div className="feature-icon">{highlight.icon}</div>
                                <span>{highlight.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="product-action-box glass">
                    <div className="action-row">
                        <span className="action-label">Price</span>
                        <strong className="action-value">${Number(normalizedProduct.price || 0).toFixed(2)}</strong>
                    </div>

                    <div className="action-row">
                        <span className="action-label">Status</span>
                        <strong
                            className={`action-value ${
                                normalizedProduct.countInStock > 0 ? 'text-success' : 'text-error'
                            }`}
                        >
                            {normalizedProduct.countInStock > 0 ? 'In Stock' : 'Out of Stock'}
                        </strong>
                    </div>

                    {normalizedProduct.countInStock > 0 && (
                        <div className="action-row">
                            <span className="action-label">Quantity</span>
                            <div className="custom-select-wrapper">
                                <select
                                    value={qty}
                                    onChange={(event) => setQty(Number(event.target.value))}
                                    className="qty-select"
                                >
                                    {[...Array(normalizedProduct.countInStock).keys()].map((value) => (
                                        <option key={value + 1} value={value + 1}>
                                            {value + 1}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="action-button-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            className="btn btn-primary btn-full"
                            disabled={normalizedProduct.countInStock === 0}
                            onClick={addToCartHandler}
                        >
                            <ShoppingCart size={20} /> Add To Cart
                        </button>
                        <button
                            className="btn btn-secondary btn-full"
                            style={{ display: 'flex', justifyContent: 'center' }}
                            onClick={handleAddToWishlist}
                            title="Add to Wishlist"
                        >
                            <Heart size={20} /> Save to Wishlist
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetails;
