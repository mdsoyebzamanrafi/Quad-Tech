import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2, ShoppingCart } from 'lucide-react';
import api from '../utils/api';
import { useCart } from '../context/CartContext';
import '../styles/HomePage.css';

const WishlistPage = () => {
    const [wishlistItems, setWishlistItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const { addToCart } = useCart();

    useEffect(() => {
        fetchWishlist();
    }, []);

    const fetchWishlist = async () => {
        try {
            const { data } = await api.get('/api/wishlist');
            setWishlistItems(data.data?.items || []);
        } catch (error) {
            console.error('Failed to fetch wishlist', error);
        } finally {
            setLoading(false);
        }
    };

    const removeFromWishlist = async (productId) => {
        try {
            await api.delete(`/api/wishlist/${productId}`);
            setWishlistItems(wishlistItems.filter(item => item.product._id !== productId));
        } catch (error) {
            alert('Failed to remove item');
        }
    };

    const handleAddToCart = (product) => {
        addToCart(product._id, 1);
        alert('Added to cart!');
    };

    if (loading) {
        return <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}>Loading Wishlist...</div>;
    }

    return (
        <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
            <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                    <Heart className="text-accent-1" size={32} />
                    <h1 style={{ fontSize: '2rem' }}>My Wishlist</h1>
                </div>
                <p style={{ color: 'var(--text-muted)' }}>Items you've saved for later.</p>
            </div>

            {wishlistItems.length === 0 ? (
                <div className="glass" style={{ padding: '4rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
                    <Heart size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <h2>Your wishlist is empty</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Discover something you love and save it here.</p>
                    <Link to="/" className="btn btn-primary">Start Shopping</Link>
                </div>
            ) : (
                <div className="products-grid">
                    {wishlistItems.map((item) => {
                        const product = item.product;
                        if (!product) return null;
                        
                        return (
                            <div key={product._id} className="product-card glass" style={{ position: 'relative' }}>
                                <button 
                                    onClick={(e) => { e.preventDefault(); removeFromWishlist(product._id); }}
                                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, color: 'var(--error)' }}
                                    title="Remove from wishlist"
                                >
                                    <Trash2 size={16} />
                                </button>
                                
                                <Link to={`/product/${product._id}`} className="product-image">
                                    <img src={product.image} alt={product.name} />
                                </Link>
                                
                                <div className="product-info">
                                    <Link to={`/product/${product._id}`}>
                                        <h3 style={{ marginBottom: '0.5rem' }}>{product.name}</h3>
                                    </Link>
                                    <div className="product-card-footer" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
                                        <p className="price" style={{ margin: 0 }}>${Number(product.price || 0).toFixed(2)}</p>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                                            onClick={() => handleAddToCart(product)}
                                            disabled={product.countInStock === 0}
                                        >
                                            <ShoppingCart size={16} />
                                            {product.countInStock === 0 ? 'Out of Stock' : 'Add to Cart'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WishlistPage;
