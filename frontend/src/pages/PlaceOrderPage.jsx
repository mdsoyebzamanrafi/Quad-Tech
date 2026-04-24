import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Package, Truck, CreditCard } from 'lucide-react';
import api from '../utils/api';
import '../styles/CartPage.css'; // Let's reuse some summary styles

const PlaceOrderPage = () => {
    const navigate = useNavigate();
    const { cartItems, shippingAddress, paymentMethod, clearCart } = useCart();
    const { userInfo } = useAuth();

    // Calculate Prices
    const addDecimals = (num) => {
        return (Math.round(num * 100) / 100).toFixed(2);
    };

    const itemsPrice = addDecimals(cartItems.reduce((acc, item) => acc + item.price * item.qty, 0));
    const shippingPrice = addDecimals(itemsPrice > 100 ? 0 : 10);
    const taxPrice = addDecimals(Number((0.15 * itemsPrice).toFixed(2))); // 15% tax
    const totalPrice = (Number(itemsPrice) + Number(shippingPrice) + Number(taxPrice)).toFixed(2);

    useEffect(() => {
        if (!shippingAddress.address) {
            navigate('/shipping');
        } else if (!paymentMethod) {
            navigate('/payment');
        }
    }, [shippingAddress, paymentMethod, navigate]);

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
                itemsPrice: itemsPrice,
                shippingPrice: shippingPrice,
                taxPrice: taxPrice,
                totalPrice: totalPrice,
            });
            clearCart();
            // In a real app, we'd redirect to /order/123 to complete payment
            alert('Order placed successfully! Backend response ID: ' + data._id);
            navigate('/');
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
                                        <Link to={`/product/${item.product}`} style={{ flex: 1, color: 'var(--text-main)', textDecoration: 'none', fontWeight: '500' }}>
                                            {item.name}
                                        </Link>
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
                            <span>Shipping</span>
                            <span>${shippingPrice}</span>
                        </div>

                        <div className="summary-row">
                            <span>Tax</span>
                            <span>${taxPrice}</span>
                        </div>

                        <div className="summary-divider"></div>

                        <div className="summary-row total-row">
                            <span>Order Total</span>
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
