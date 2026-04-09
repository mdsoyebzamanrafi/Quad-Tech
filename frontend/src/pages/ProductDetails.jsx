import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Star, ShieldCheck, Truck } from 'lucide-react';
import '../styles/ProductDetails.css';
import api from '../utils/api';
import { useCart } from '../context/CartContext';

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
            } catch (err) {
                setError(err.response?.data?.message || err.message || 'Product not found');
                setLoading(false);
            }
        };
        fetchProduct();
    }, [id]);

    const addToCartHandler = () => {
        addToCart(product._id, qty);
        navigate('/cart');
    };

    if (loading) return <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}><h2>Loading Product...</h2></div>;
    if (error) return <div className="container" style={{ paddingTop: '6rem', textAlign: 'center', color: 'var(--accent-1)' }}><h2>Error: {error}</h2></div>;
    if (!product) return null;

    return (
        <div className="product-details-container container animate-fade-in">
            <Link to="/" className="btn btn-outline back-btn glass">
                <ArrowLeft size={16} /> Back to Collection
            </Link>

            <div className="product-details-grid">
                <div className="product-image-box">
                    <div className="image-blob-bg"></div>
                    <img src={product.image} alt={product.name} />
                </div>

                <div className="product-info-box">
                    <div className="brand-badge">{product.brand}</div>
                    <h1 className="product-title">{product.name}</h1>

                    <div className="rating-container">
                        <div className="stars">
                            <Star className="star-icon filled" size={18} fill="currentColor" />
                            <Star className="star-icon filled" size={18} fill="currentColor" />
                            <Star className="star-icon filled" size={18} fill="currentColor" />
                            <Star className="star-icon filled" size={18} fill="currentColor" />
                            <Star className="star-icon half" size={18} fill="currentColor" />
                        </div>
                        <span className="reviews-count">({product.numReviews} Reviews)</span>
                    </div>

                    <div className="price-tag text-gradient">${product.price.toFixed(2)}</div>

                    <p className="product-description">{product.description}</p>

                    <div className="product-features">
                        <div className="feature">
                            <div className="feature-icon"><ShieldCheck size={20} /></div>
                            <span>1 Year Premium Warranty</span>
                        </div>
                        <div className="feature">
                            <div className="feature-icon"><Truck size={20} /></div>
                            <span>Free Next-Day Shipping</span>
                        </div>
                    </div>
                </div>

                <div className="product-action-box glass">
                    <div className="action-row">
                        <span className="action-label">Price</span>
                        <strong className="action-value">${product.price.toFixed(2)}</strong>
                    </div>

                    <div className="action-row">
                        <span className="action-label">Status</span>
                        <strong className={`action-value ${product.countInStock > 0 ? 'text-success' : 'text-error'}`}>
                            {product.countInStock > 0 ? 'In Stock' : 'Out of Stock'}
                        </strong>
                    </div>

                    {product.countInStock > 0 && (
                        <div className="action-row">
                            <span className="action-label">Quantity</span>
                            <div className="custom-select-wrapper">
                                <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="qty-select">
                                    {[...Array(product.countInStock).keys()].map((x) => (
                                        <option key={x + 1} value={x + 1}>
                                            {x + 1}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="action-button-wrapper">
                        <button
                            className="btn btn-primary btn-full"
                            disabled={product.countInStock === 0}
                            onClick={addToCartHandler}
                        >
                            <ShoppingCart size={20} /> Add To Cart
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetails;
