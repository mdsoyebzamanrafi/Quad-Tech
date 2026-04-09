import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, X, ArrowRight, CreditCard } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/CartPage.css';

const CartPage = () => {
    const { cartItems, addToCart, removeFromCart, clearCart, shippingAddress, paymentMethod } = useCart();
    const { userInfo } = useAuth();
    const navigate = useNavigate();

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Calculate Prices exactly like PlaceOrderPage
    const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2);
    const itemsPrice = addDecimals(cartItems.reduce((acc, item) => acc + item.price * item.qty, 0));
    const shippingPrice = addDecimals(itemsPrice > 100 ? 0 : 10);
    const taxPrice = addDecimals(Number((0.15 * itemsPrice).toFixed(2)));
    const totalPrice = (Number(itemsPrice) + Number(shippingPrice) + Number(taxPrice)).toFixed(2);

    const checkoutHandler = () => {
        if (!userInfo) {
            navigate('/login?redirect=cart');
            return;
        }
        // Instead of typical flow, just show the custom modal
        setShowPaymentModal(true);
    };

    const confirmPaymentHandler = async () => {
        setIsProcessing(true);
        try {
            // Need a valid dummy address if they haven't set one yet to bypass mongoose validation
            const validShipping = shippingAddress?.address ? shippingAddress : {
                address: '123 Default St',
                city: 'Default City',
                postalCode: '00000',
                country: 'Default Country'
            };

            const validPayment = paymentMethod || 'Placeholder';

            await api.post('/api/orders', {
                orderItems: cartItems,
                shippingAddress: validShipping,
                paymentMethod: validPayment,
                itemsPrice,
                shippingPrice,
                taxPrice,
                totalPrice,
            });
            clearCart();
            setShowPaymentModal(false);
            navigate('/orders');
        } catch (error) {
            alert(error.response?.data?.message || 'Error placing order');
            setShowPaymentModal(false);
        } finally {
            setIsProcessing(false);
        }
    };

    const removeFromCartHandler = (id) => {
        removeFromCart(id);
    };

    return (
        <div className="cart-page-container container animate-fade-in">
            <div className="cart-header">
                <h1 className="cart-title">Your Quad Tech Cart</h1>
                <p className="cart-subtitle">Review your items before proceeding to checkout.</p>
            </div>

            {cartItems.length === 0 ? (
                <div className="empty-cart-message glass">
                    <ShoppingBag size={48} className="text-muted" />
                    <h2>Your cart is entirely empty.</h2>
                    <p>Discover something you'll love.</p>
                    <Link to="/" className="btn btn-primary">Go Back to Shop</Link>
                </div>
            ) : (
                <>
                    <div className="cart-grid">
                        <div className="cart-items-column">
                            {cartItems.map((item) => (
                                <div key={item.product} className="cart-item glass">
                                    <div className="cart-item-image">
                                        <img src={item.image} alt={item.name} />
                                    </div>

                                    <div className="cart-item-details">
                                        <Link to={`/product/${item.product}`} className="cart-item-name">
                                            {item.name}
                                        </Link>
                                        <div className="cart-item-price">${item.price.toFixed(2)}</div>
                                    </div>

                                    <div className="cart-item-actions">
                                        <div className="custom-select-wrapper slim-select">
                                            <select
                                                value={item.qty}
                                                onChange={(e) => addToCart(item.product, Number(e.target.value))}
                                                className="qty-select"
                                            >
                                                {[...Array(item.countInStock).keys()].map((x) => (
                                                    <option key={x + 1} value={x + 1}>
                                                        {x + 1}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            className="remove-btn"
                                            onClick={() => removeFromCartHandler(item.product)}
                                            aria-label="Remove item"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="cart-summary-column">
                            <div className="summary-box glass">
                                <h2 className="summary-title">Summary</h2>

                                <div className="summary-row">
                                    <span>Items ({cartItems.reduce((acc, item) => acc + item.qty, 0)})</span>
                                    <span>
                                        ${cartItems.reduce((acc, item) => acc + item.qty * item.price, 0).toFixed(2)}
                                    </span>
                                </div>

                                <div className="summary-row">
                                    <span>Shipping</span>
                                    <span className="text-success">Free</span>
                                </div>

                                <div className="summary-divider"></div>

                                <div className="summary-row total-row">
                                    <span>Total</span>
                                    <span className="text-gradient">
                                        ${cartItems.reduce((acc, item) => acc + item.qty * item.price, 0).toFixed(2)}
                                    </span>
                                </div>

                                <button
                                    className="btn btn-primary btn-full checkout-btn"
                                    disabled={cartItems.length === 0}
                                    onClick={checkoutHandler}
                                >
                                    Proceed to Checkout <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Custom Payment Modal Overlay */}
                    {showPaymentModal && (
                        <div className="payment-modal-overlay animate-fade-in" style={{
                            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                            backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
                        }}>
                            <div className="glass" style={{
                                padding: '2.5rem', borderRadius: 'var(--radius-lg)', maxWidth: '400px', width: '90%',
                                textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', position: 'relative'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--accent-1)' }}>
                                    <CreditCard size={48} />
                                </div>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Confirm Payment</h2>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
                                    Are you sure you want to securely pay the total amount of <strong style={{ color: 'var(--text-main)' }}>${totalPrice}</strong>?
                                </p>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.8rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                                        onClick={() => setShowPaymentModal(false)}
                                        disabled={isProcessing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        style={{ flex: 1 }}
                                        onClick={confirmPaymentHandler}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? 'Processing...' : 'Yes, Pay'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CartPage;
