import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Gift, TicketPercent, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/CartPage.css';
import { getProductOptionSummary } from '../utils/productUtils';

const formatMoney = (value) => `$${(Number(value || 0)).toFixed(2)}`;

const OrderPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userInfo } = useAuth();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!userInfo) {
            navigate('/login');
            return;
        }

        const fetchOrder = async () => {
            setLoading(true);
            setError('');

            try {
                const { data } = await api.get(`/api/orders/${id}`);
                setOrder(data);
            } catch (fetchError) {
                setError(fetchError.response?.data?.message || 'Failed to load order');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id, navigate, userInfo]);

    if (loading) {
        return <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>Loading order...</div>;
    }

    if (error || !order) {
        return (
            <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
                <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--error)' }}>{error || 'Order not found'}</p>
                    <Link to="/orders" className="btn btn-secondary" style={{ marginTop: '1rem' }}>Back to Orders</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
                <Link to="/orders" className="btn btn-secondary">
                    <ArrowLeft size={18} />
                    Back to Orders
                </Link>
            </div>

            <div className="cart-grid" style={{ alignItems: 'flex-start' }}>
                <div className="cart-items-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                            <Truck className="text-accent-1" />
                            <h1 style={{ fontSize: '1.8rem' }}>Order {order._id}</h1>
                        </div>
                        <p style={{ color: 'var(--text-main)', lineHeight: 1.7 }}>
                            <strong>Status:</strong> {order.orderStatus}<br />
                            <strong>Payment:</strong> {order.paymentStatus}<br />
                            <strong>Placed:</strong> {new Date(order.createdAt).toLocaleString()}<br />
                            <strong>Shipping:</strong> {order.shippingAddress?.address}, {order.shippingAddress?.city}, {order.shippingAddress?.postalCode}, {order.shippingAddress?.country}
                        </p>
                    </div>

                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                            <CreditCard className="text-accent-1" />
                            <h2 style={{ fontSize: '1.25rem' }}>Order Items</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {(order.orderItems || []).map((item) => (
                                <div key={item._id || item.product} style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                    <img src={item.image} alt={item.name} style={{ width: '64px', borderRadius: '10px' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{item.name}</div>
                                        {getProductOptionSummary(item) && (
                                            <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                {getProductOptionSummary(item)}
                                            </div>
                                        )}
                                        <div style={{ color: 'var(--text-muted)' }}>Qty: {item.qty}</div>
                                    </div>
                                    <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                        {formatMoney(item.lineTotal)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="cart-summary-column">
                    <div className="summary-box glass">
                        <h2 className="summary-title">Discount Breakdown</h2>

                        <div className="summary-row">
                            <span>Gross Items Price</span>
                            <span>{formatMoney(order.grossItemsPrice || order.itemsPrice)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Coupon Code</span>
                            <span>{order.coupon?.code || 'None'}</span>
                        </div>
                        <div className="summary-row">
                            <span>Coupon Discount</span>
                            <span>- {formatMoney(order.coupon?.discountAmount)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Tokens Used</span>
                            <span>{order.tokenDiscount?.tokensUsed || 0}</span>
                        </div>
                        <div className="summary-row">
                            <span>Token Discount</span>
                            <span>- {formatMoney(order.tokenDiscount?.discountAmount)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Total Discount</span>
                            <span>- {formatMoney(order.totalDiscount || order.discount)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Net Items Price</span>
                            <span>{formatMoney(order.netItemsPrice)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Tax</span>
                            <span>{formatMoney(order.taxPrice || order.tax)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Shipping</span>
                            <span>{formatMoney(order.shippingPrice || order.shippingFee)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Tokens Earned</span>
                            <span>{order.rewardTokensEarned || 0}</span>
                        </div>
                        <div className="summary-divider"></div>
                        <div className="summary-row total-row">
                            <span>Final Total</span>
                            <span className="text-gradient">{formatMoney(order.totalPrice || order.total)}</span>
                        </div>

                        <div style={{ marginTop: '1.25rem', display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-muted)' }}>
                                <TicketPercent size={18} />
                                Coupon discount is recorded at order creation.
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-muted)' }}>
                                <Gift size={18} />
                                Reward tokens are deducted and earned only after payment succeeds.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderPage;
