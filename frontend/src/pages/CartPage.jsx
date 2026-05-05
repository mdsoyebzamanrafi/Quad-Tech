import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, X, ArrowRight, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/CartPage.css';
import { getProductOptionSummary } from '../utils/productUtils';

const CartPage = () => {
    const {
        cartItems,
        addToCart,
        removeFromCart,
        couponCode,
        couponDiscount,
        applyCouponPreview,
        removeCoupon,
    } = useCart();
    const { userInfo } = useAuth();
    const navigate = useNavigate();

    const [couponInput, setCouponInput] = useState(couponCode || '');
    const [couponError, setCouponError] = useState('');
    const [couponNotice, setCouponNotice] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);
    const previousCouponRef = useRef(couponCode);
    const manualRemoveRef = useRef(false);

    const addDecimals = (num) => (Math.round(Number(num || 0) * 100) / 100).toFixed(2);
    const itemsCount = cartItems.reduce((acc, item) => acc + item.qty, 0);
    const itemsPriceNumber = useMemo(
        () => Math.round(cartItems.reduce((acc, item) => acc + item.price * item.qty, 0) * 100) / 100,
        [cartItems]
    );
    const safeCouponDiscount = Math.min(Math.max(Number(couponDiscount || 0), 0), itemsPriceNumber);
    const displayedTotal = Math.max(itemsPriceNumber - safeCouponDiscount, 0);

    useEffect(() => {
        if (couponCode) {
            previousCouponRef.current = couponCode;
            setCouponInput(couponCode);
            return;
        }

        if (previousCouponRef.current && !manualRemoveRef.current) {
            setCouponNotice('Cart changed. Please apply coupon again.');
        }

        previousCouponRef.current = '';
        manualRemoveRef.current = false;
    }, [couponCode]);

    const checkoutHandler = () => {
        if (!userInfo) {
            navigate('/login?redirect=cart');
            return;
        }
        navigate('/shipping');
    };

    const applyCouponHandler = async () => {
        const nextCode = couponInput.trim().toUpperCase();

        if (!userInfo) {
            setCouponError('Please sign in before applying a coupon.');
            return;
        }

        if (!nextCode) {
            setCouponError('Enter a coupon code.');
            return;
        }

        setCouponLoading(true);
        setCouponError('');
        setCouponNotice('');

        try {
            const { data } = await api.post('/api/coupons/validate', {
                code: nextCode,
                itemsPrice: itemsPriceNumber,
            });

            applyCouponPreview({
                couponCode: data.code,
                couponDiscount: data.discountAmount,
            });
            setCouponInput(data.code);
            setCouponNotice(data.message || 'Coupon applied successfully.');
        } catch (error) {
            removeCoupon();
            setCouponError(error.response?.data?.message || 'Invalid coupon.');
        } finally {
            setCouponLoading(false);
        }
    };

    const removeCouponHandler = () => {
        manualRemoveRef.current = true;
        removeCoupon();
        setCouponInput('');
        setCouponError('');
        setCouponNotice('Coupon removed.');
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
                                <div key={item.cartItemKey || item.product} className="cart-item glass">
                                    <div className="cart-item-image">
                                        <img src={item.image} alt={item.name} />
                                    </div>

                                    <div className="cart-item-details">
                                        <Link to={`/product/${item.product}`} className="cart-item-name">
                                            {item.name}
                                        </Link>
                                        {getProductOptionSummary(item) && (
                                            <div className="cart-item-price">{getProductOptionSummary(item)}</div>
                                        )}
                                        <div className="cart-item-price">${item.price.toFixed(2)}</div>
                                    </div>

                                    <div className="cart-item-actions">
                                        <div className="custom-select-wrapper slim-select">
                                            <select
                                                value={item.qty}
                                                onChange={(e) =>
                                                    addToCart(item.product, Number(e.target.value), {
                                                        selectedColor: item.selectedColor,
                                                        selectedSize: item.selectedSize,
                                                    })
                                                }
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
                                            onClick={() => removeFromCartHandler(item.cartItemKey || item.product)}
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
                                    <span>Items ({itemsCount})</span>
                                    <span>${addDecimals(itemsPriceNumber)}</span>
                                </div>

                                <div className="summary-row">
                                    <span>Shipping</span>
                                    <span className="text-success">Free</span>
                                </div>

                                <div className="coupon-section">
                                    <div className="coupon-section-title">
                                        <Tag size={18} />
                                        <span>Coupon</span>
                                    </div>

                                    <div className="coupon-form">
                                        <input
                                            type="text"
                                            value={couponInput}
                                            onChange={(event) => {
                                                setCouponInput(event.target.value.toUpperCase());
                                                setCouponError('');
                                                setCouponNotice('');
                                            }}
                                            placeholder="Enter coupon code"
                                            className="coupon-input"
                                            disabled={couponLoading}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary coupon-apply-btn"
                                            onClick={applyCouponHandler}
                                            disabled={couponLoading || !couponInput.trim()}
                                        >
                                            {couponLoading ? 'Applying...' : 'Apply Coupon'}
                                        </button>
                                    </div>

                                    {couponError && <p className="coupon-message error">{couponError}</p>}
                                    {couponNotice && !couponError && <p className="coupon-message success">{couponNotice}</p>}

                                    {couponCode && (
                                        <div className="applied-coupon-box">
                                            <div className="applied-coupon-top">
                                                <span>Applied: <strong>{couponCode}</strong></span>
                                                <button type="button" className="coupon-remove-btn" onClick={removeCouponHandler}>
                                                    Remove
                                                </button>
                                            </div>
                                            <div className="summary-row coupon-discount-row">
                                                <span>Coupon Discount</span>
                                                <span>- ${addDecimals(safeCouponDiscount)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="summary-divider"></div>

                                <div className="summary-row total-row">
                                    <span>Total</span>
                                    <span className="text-gradient">
                                        ${addDecimals(displayedTotal)}
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
                </>
            )}
        </div>
    );
};

export default CartPage;
