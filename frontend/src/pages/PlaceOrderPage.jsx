import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Package, Truck, CreditCard } from 'lucide-react';
import api from '../utils/api';
import { getEligibleSmartDiscount } from '../services/discountService';
import '../styles/CartPage.css'; // Let's reuse some summary styles
import { getProductOptionSummary } from '../utils/productUtils';

const emptySmartDiscount = {
    eligible: false,
    ruleName: '',
    discountAmount: 0,
};

const PlaceOrderPage = () => {
    const navigate = useNavigate();
    const {
        cartItems,
        shippingAddress,
        paymentMethod,
        clearCart,
        couponCode: savedCouponCode,
        couponDiscount: savedCouponDiscount,
        useRewardTokens,
        requestedTokens: savedRequestedTokens,
        saveCouponPreview,
        removeCoupon,
        saveTokenUsage,
        clearDiscounts,
    } = useCart();
    const { userInfo } = useAuth();
    const [profile, setProfile] = useState(userInfo);
    const [couponInput, setCouponInput] = useState(savedCouponCode || '');
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponMessage, setCouponMessage] = useState('');
    const [smartDiscount, setSmartDiscount] = useState(emptySmartDiscount);
    const [tokenMessage, setTokenMessage] = useState('');
    const [requestedTokenInput, setRequestedTokenInput] = useState(savedRequestedTokens ? String(savedRequestedTokens) : '');

    const addDecimals = (num) => {
        return (Math.round(num * 100) / 100).toFixed(2);
    };

    const itemsPriceNumber = useMemo(
        () => Math.round(cartItems.reduce((acc, item) => acc + item.price * item.qty, 0) * 100) / 100,
        [cartItems]
    );
    const effectiveSmartDiscount = useMemo(() => {
        const rawSmartDiscount = Math.max(Number(smartDiscount.discountAmount || 0), 0);
        const remainingAfterCoupon = Math.max(itemsPriceNumber - Number(savedCouponDiscount || 0), 0);
        return Math.min(rawSmartDiscount, remainingAfterCoupon);
    }, [itemsPriceNumber, savedCouponDiscount, smartDiscount.discountAmount]);
    const availableTokens = Number(profile?.rewardTokens || 0);
    const tokenPreview = useMemo(() => {
        if (!useRewardTokens) {
            return { tokensUsed: 0, discountAmount: 0 };
        }

        const parsedRequestedTokens = Number(requestedTokenInput);
        if (!Number.isFinite(parsedRequestedTokens) || parsedRequestedTokens <= 0) {
            return { tokensUsed: 0, discountAmount: 0 };
        }

        const remainingAfterCouponAndSmart = Math.max(
            itemsPriceNumber - Number(savedCouponDiscount || 0) - effectiveSmartDiscount,
            0
        );
        const maxDiscount = Math.round((remainingAfterCouponAndSmart * 0.2) * 100) / 100;
        const maxTokensAllowed = Math.floor(maxDiscount * 10);
        const tokensUsed = Math.max(0, Math.min(Math.floor(parsedRequestedTokens), availableTokens, maxTokensAllowed));

        return {
            tokensUsed,
            discountAmount: Math.round((tokensUsed / 10) * 100) / 100,
        };
    }, [availableTokens, effectiveSmartDiscount, itemsPriceNumber, requestedTokenInput, savedCouponDiscount, useRewardTokens]);
    const netItemsPriceNumber = Math.max(
        itemsPriceNumber - Number(savedCouponDiscount || 0) - effectiveSmartDiscount - tokenPreview.discountAmount,
        0
    );
    const shippingPriceNumber = netItemsPriceNumber > 1000 ? 0 : 100;
    const taxPriceNumber = Math.round(netItemsPriceNumber * 0.1 * 100) / 100;
    const totalDiscountNumber = Math.round(
        (Number(savedCouponDiscount || 0) + effectiveSmartDiscount + tokenPreview.discountAmount) * 100
    ) / 100;
    const totalPriceNumber = Math.round((netItemsPriceNumber + shippingPriceNumber + taxPriceNumber) * 100) / 100;
    const itemsPrice = addDecimals(itemsPriceNumber);
    const shippingPrice = addDecimals(shippingPriceNumber);
    const taxPrice = addDecimals(taxPriceNumber);
    const totalPrice = addDecimals(totalPriceNumber);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data } = await api.get('/api/users/profile');
                setProfile((current) => ({ ...current, ...data }));
            } catch (error) {
                console.error('Failed to load profile for checkout', error);
            }
        };

        if (userInfo) {
            fetchProfile();
        }
    }, [userInfo]);

    useEffect(() => {
        let cancelled = false;

        const loadSmartDiscount = async () => {
            if (!userInfo || cartItems.length === 0) {
                if (!cancelled) {
                    setSmartDiscount(emptySmartDiscount);
                }
                return;
            }

            try {
                const data = await getEligibleSmartDiscount(cartItems);
                if (!cancelled) {
                    setSmartDiscount(data?.eligible ? data : emptySmartDiscount);
                }
            } catch (error) {
                if (!cancelled) {
                    setSmartDiscount(emptySmartDiscount);
                }
            }
        };

        loadSmartDiscount();

        return () => {
            cancelled = true;
        };
    }, [cartItems, userInfo]);

    useEffect(() => {
        saveTokenUsage({
            useRewardTokens,
            requestedTokens: tokenPreview.tokensUsed,
            tokenDiscount: tokenPreview.discountAmount,
        });
    }, [tokenPreview.discountAmount, tokenPreview.tokensUsed, useRewardTokens]);

    useEffect(() => {
        if (!shippingAddress.address) {
            navigate('/shipping');
        }
    }, [shippingAddress, navigate]);

    const applyCouponHandler = async () => {
        if (!couponInput.trim()) {
            window.alert('Enter a coupon code first.');
            return;
        }

        setCouponLoading(true);
        setCouponMessage('');

        try {
            const { data } = await api.post('/api/coupons/validate', {
                code: couponInput.trim(),
                itemsPrice: itemsPriceNumber,
            });

            saveCouponPreview({
                couponCode: data.code,
                couponDiscount: data.discountAmount,
            });
            setCouponInput(data.code);
            setCouponMessage(`Coupon applied. Discount: $${addDecimals(data.discountAmount)}`);
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to validate coupon';
            removeCoupon();
            setCouponMessage(message);
            window.alert(message);
        } finally {
            setCouponLoading(false);
        }
    };

    const removeCouponHandler = () => {
        removeCoupon();
        setCouponInput('');
        setCouponMessage('Coupon removed.');
    };

    const toggleRewardTokens = (event) => {
        const checked = event.target.checked;
        if (!checked) {
            setRequestedTokenInput('');
            setTokenMessage('');
        }
        saveTokenUsage({
            useRewardTokens: checked,
            requestedTokens: checked ? tokenPreview.tokensUsed : 0,
            tokenDiscount: checked ? tokenPreview.discountAmount : 0,
        });
    };

    const handleTokenInputChange = (event) => {
        const nextValue = event.target.value.replace(/[^\d]/g, '');
        setRequestedTokenInput(nextValue);

        if (!nextValue) {
            setTokenMessage('');
            return;
        }

        const parsed = Number(nextValue);
        if (parsed > availableTokens) {
            setTokenMessage(`Only ${availableTokens} tokens are available.`);
            return;
        }

        if (parsed > 0 && tokenPreview.tokensUsed < parsed) {
            setTokenMessage(`Only ${tokenPreview.tokensUsed} tokens can be used here because of the 20% cap.`);
            return;
        }

        setTokenMessage('');
    };

    const placeOrderHandler = async () => {
        if (!window.confirm(`Are you sure you want to pay an amount of $${totalPrice}?`)) {
            return;
        }
        try {
            const { data } = await api.post('/api/orders', {
                orderItems: cartItems,
                shippingAddress: shippingAddress,
                shippingPhone: shippingAddress.phone || userInfo?.phone,
                paymentMethod: paymentMethod,
                couponCode: savedCouponCode || undefined,
                requestedTokens: useRewardTokens ? tokenPreview.tokensUsed : 0,
            });
            clearDiscounts();
            clearCart();
            alert('Order placed successfully! Backend response ID: ' + data._id);
            navigate(`/order/${data._id}`);
        } catch (error) {
            alert(error.response?.data?.message || 'Error placing order');
        }
    };

    return (
        <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
            <h1 style={{ marginBottom: '2rem', fontSize: '2rem', fontWeight: '600' }}>Review Order</h1>

            <div className="cart-grid" style={{ alignItems: 'flex-start' }}>
                <div className="cart-items-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Shipping Info Block */}
                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                            <Truck className="text-accent-1" />
                            <h2 style={{ fontSize: '1.25rem' }}>Shipping Details</h2>
                        </div>
                        <p style={{ color: 'var(--text-main)', lineHeight: '1.6' }}>
                            <strong>Name: </strong> {userInfo?.name} <br />
                            <strong>Email: </strong> <a href={`mailto:${userInfo?.email}`} style={{ color: 'var(--accent-1)' }}>{userInfo?.email}</a> <br />
                            <strong>Phone: </strong> {shippingAddress.phone || userInfo?.phone} <br />
                            <strong>Address: </strong>
                            {shippingAddress.address}, {shippingAddress.city} {shippingAddress.postalCode},{' '}
                            {shippingAddress.country}
                        </p>
                    </div>

                    {/* Payment Info Block */}
                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                            <CreditCard className="text-accent-1" />
                            <h2 style={{ fontSize: '1.25rem' }}>Payment Method</h2>
                        </div>
                        <p style={{ color: 'var(--text-main)' }}>
                            <strong>Method: </strong> {paymentMethod}
                        </p>
                    </div>

                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Discounts</h2>

                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Coupon Code
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        value={couponInput}
                                        onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                                        placeholder="WELCOME10"
                                        style={{
                                            flex: '1 1 220px',
                                            minHeight: '46px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-main)',
                                            padding: '0.8rem 0.9rem',
                                        }}
                                    />
                                    <button className="btn btn-primary" type="button" onClick={applyCouponHandler} disabled={couponLoading}>
                                        {couponLoading ? 'Applying...' : 'Apply Coupon'}
                                    </button>
                                    <button className="btn btn-secondary" type="button" onClick={removeCouponHandler} disabled={!savedCouponCode}>
                                        Remove Coupon
                                    </button>
                                </div>
                                {couponMessage && (
                                    <p style={{ marginTop: '0.5rem', color: savedCouponCode ? 'var(--success)' : 'var(--text-muted)' }}>{couponMessage}</p>
                                )}
                            </div>

                            {smartDiscount.eligible && effectiveSmartDiscount > 0 && (
                                <div
                                    style={{
                                        padding: '0.9rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-main)',
                                    }}
                                >
                                    <strong>{smartDiscount.ruleName}</strong>
                                    <p style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                                        Applied automatically at checkout. Discount: ${addDecimals(effectiveSmartDiscount)}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                    <input type="checkbox" checked={useRewardTokens} onChange={toggleRewardTokens} />
                                    Use reward tokens
                                </label>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                    Available tokens: {availableTokens}
                                </p>
                                <input
                                    type="text"
                                    value={requestedTokenInput}
                                    onChange={handleTokenInputChange}
                                    disabled={!useRewardTokens}
                                    placeholder="Enter token amount"
                                    style={{
                                        width: '100%',
                                        minHeight: '46px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-main)',
                                        padding: '0.8rem 0.9rem',
                                    }}
                                />
                                {tokenMessage && <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>{tokenMessage}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Order Items Block */}
                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                            <Package className="text-accent-1" />
                            <h2 style={{ fontSize: '1.25rem' }}>Order Items</h2>
                        </div>
                        {cartItems.length === 0 ? (
                            <p>Your cart is empty</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {cartItems.map((item, index) => (
                                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                        <img src={item.image} alt={item.name} style={{ width: '60px', borderRadius: '8px' }} />
                                        <div style={{ flex: 1 }}>
                                            <Link to={`/product/${item.product}`} style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: '500' }}>
                                                {item.name}
                                            </Link>
                                            {getProductOptionSummary(item) && (
                                                <div style={{ color: 'var(--text-muted)', marginTop: '0.3rem', fontSize: '0.9rem' }}>
                                                    {getProductOptionSummary(item)}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ color: 'var(--text-main)', fontWeight: '600' }}>
                                            {item.qty} x ${item.price} = ${(item.qty * item.price).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="cart-summary-column">
                    <div className="summary-box glass">
                        <h2 className="summary-title">Order Summary</h2>

                        <div className="summary-row">
                            <span>Items</span>
                            <span>${itemsPrice}</span>
                        </div>

                        <div className="summary-row">
                            <span>Coupon Discount</span>
                            <span>- ${addDecimals(savedCouponDiscount || 0)}</span>
                        </div>

                        {smartDiscount.eligible && effectiveSmartDiscount > 0 && (
                            <>
                                <div className="summary-row">
                                    <span>Smart Discount</span>
                                    <span>- ${addDecimals(effectiveSmartDiscount)}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Rule</span>
                                    <span>{smartDiscount.ruleName}</span>
                                </div>
                            </>
                        )}

                        <div className="summary-row">
                            <span>Token Discount</span>
                            <span>- ${addDecimals(tokenPreview.discountAmount)}</span>
                        </div>

                        <div className="summary-row">
                            <span>Total Discount</span>
                            <span>- ${addDecimals(totalDiscountNumber)}</span>
                        </div>

                        <div className="summary-row">
                            <span>Net Items</span>
                            <span>${addDecimals(netItemsPriceNumber)}</span>
                        </div>

                        <div className="summary-row">
                            <span>Shipping</span>
                            <span>${shippingPrice}</span>
                        </div>

                        <div className="summary-row">
                            <span>Tax</span>
                            <span>${taxPrice}</span>
                        </div>

                        <div className="summary-divider"></div>

                        <div className="summary-row total-row">
                            <span>Final Total</span>
                            <span className="text-gradient">${totalPrice}</span>
                        </div>

                        <button
                            className="btn btn-primary btn-full checkout-btn"
                            disabled={cartItems.length === 0}
                            onClick={placeOrderHandler}
                            style={{ marginTop: '1.5rem' }}
                        >
                            Place Order
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlaceOrderPage;
