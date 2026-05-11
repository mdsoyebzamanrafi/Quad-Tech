import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import api from '../utils/api';
import '../styles/LoginPage.css';
import { getProductOptionSummary } from '../utils/productUtils';

const ORDER_STATUS_LABELS = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refund_requested: 'Refund Requested',
    refunded: 'Refunded',
    failed: 'Failed',
};

// Only delivered and cancelled appear in "Previously Ordered"
const PREVIOUS_ORDER_STATUSES = new Set(['delivered', 'cancelled']);

const getOrderStatus = (order) => {
    if (order?.orderStatus) {
        return String(order.orderStatus).toLowerCase();
    }

    if (order?.isDelivered) {
        return 'delivered';
    }

    return 'pending';
};

const getOrderStatusLabel = (order) => {
    const status = getOrderStatus(order);
    return ORDER_STATUS_LABELS[status] || 'Pending';
};

const getOrderStatusColor = (status) => {
    if (status === 'delivered' || status === 'confirmed') return 'var(--success)';
    if (status === 'cancelled' || status === 'failed') return 'var(--error)';
    if (status === 'refunded') return 'var(--text-muted)';
    if (status === 'shipped') return 'var(--accent-1)';
    if (status === 'refund_requested') return 'var(--accent-1)';
    if (status === 'processing') return 'var(--accent-1)';
    return 'var(--text-main)';
};

const canMarkAsReceived = (order) => getOrderStatus(order) === 'shipped';
const canCancelOrder = (order) => {
    const status = getOrderStatus(order);
    return status === 'pending' || status === 'confirmed';
};

const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('current');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewItem, setReviewItem] = useState(null);
    const [isEditingReview, setIsEditingReview] = useState(false);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [reviewSuccess, setReviewSuccess] = useState('');
    const [userReviews, setUserReviews] = useState({});
    const [loadingOrders, setLoadingOrders] = useState(true);

    const { userInfo } = useAuth();
    const { formatCurrency } = useCurrency();
    const navigate = useNavigate();

    const getMyOrders = useCallback(async () => {
        setLoadingOrders(true);
        try {
            const { data } = await api.get('/api/orders/myorders');
            setOrders(data);
            return data;
        } catch (error) {
            console.error('Failed to fetch orders', error);
            return [];
        } finally {
            setLoadingOrders(false);
        }
    }, []);

    const fetchUserReviews = useCallback(async (ordersData) => {
        // Collect unique product IDs from delivered orders
        const productIds = new Set();
        for (const order of ordersData) {
            const status = getOrderStatus(order);
            if (status === 'delivered') {
                for (const item of order.orderItems || []) {
                    if (item.product) {
                        productIds.add(typeof item.product === 'object' ? item.product._id || item.product : item.product);
                    }
                }
            }
        }

        if (productIds.size === 0) {
            setUserReviews({});
            return;
        }

        try {
            const { data } = await api.get('/api/products/user-reviews', {
                params: { productIds: Array.from(productIds).join(',') },
            });
            setUserReviews(data || {});
        } catch (error) {
            console.error('Failed to fetch user reviews', error);
        }
    }, []);

    useEffect(() => {
        if (!userInfo) {
            navigate('/login');
        } else {
            getMyOrders().then((data) => {
                if (data && data.length > 0) {
                    fetchUserReviews(data);
                }
            });
        }
    }, [navigate, userInfo, getMyOrders, fetchUserReviews]);

    const markAsReceivedHandler = async (orderId) => {
        try {
            await api.put(`/api/orders/${orderId}/deliver`);
            const data = await getMyOrders();
            if (data && data.length > 0) fetchUserReviews(data);
        } catch (error) {
            console.error('Failed to mark as received', error);
            alert(error.response?.data?.message || 'Failed to update order');
        }
    };

    const cancelOrderHandler = async (orderId) => {
        if (!window.confirm('Are you sure you want to cancel this order?')) {
            return;
        }

        try {
            await api.patch(`/api/orders/my/${orderId}/cancel`, {
                reason: 'Cancelled by customer from current orders page',
            });
            const data = await getMyOrders();
            if (data && data.length > 0) fetchUserReviews(data);
        } catch (error) {
            console.error('Failed to cancel order', error);
            alert(error.response?.data?.message || 'Failed to cancel order');
        }
    };

    const openReviewModal = (order, item, editing) => {
        const productId = typeof item.product === 'object' ? item.product._id || item.product : item.product;
        const existingReview = userReviews[productId];

        setReviewItem({ order, item });
        setIsEditingReview(editing);
        setShowReviewModal(true);
        setReviewError('');
        setReviewSuccess('');

        if (editing && existingReview) {
            setRating(existingReview.rating || 0);
            setComment(existingReview.comment || '');
        } else {
            setRating(0);
            setComment('');
        }
    };

    const handleActionClick = async (order, item) => {
        const status = getOrderStatus(order);

        // Current orders tab actions
        if (canMarkAsReceived(order)) {
            await markAsReceivedHandler(order._id);
            return;
        }

        if (canCancelOrder(order)) {
            await cancelOrderHandler(order._id);
            return;
        }

        // Pending order: if somehow a review button is shown, show prompt
        if (status === 'pending' || status === 'confirmed' || status === 'processing' || status === 'shipped') {
            alert('Please wait until product delivery.');
            return;
        }

        // Delivered: open review modal
        if (status === 'delivered') {
            const productId = typeof item.product === 'object' ? item.product._id || item.product : item.product;
            const hasReview = !!userReviews[productId];
            openReviewModal(order, item, hasReview);
        }
    };

    const submitReviewHandler = async (e) => {
        e.preventDefault();
        setReviewLoading(true);
        setReviewError('');
        setReviewSuccess('');

        const productId = typeof reviewItem.item.product === 'object'
            ? reviewItem.item.product._id || reviewItem.item.product
            : reviewItem.item.product;

        try {
            if (isEditingReview) {
                await api.put(`/api/products/${productId}/reviews`, {
                    rating,
                    comment,
                });
                setReviewSuccess('Review updated successfully!');
            } else {
                await api.post(`/api/products/${productId}/reviews`, {
                    rating,
                    comment,
                });
                setReviewSuccess('Review submitted successfully!');
            }

            // Update local review cache immediately
            setUserReviews((prev) => ({
                ...prev,
                [productId]: { rating, comment, updatedAt: new Date().toISOString() },
            }));

            setReviewLoading(false);

            // Close modal after brief success display
            setTimeout(() => {
                setShowReviewModal(false);
                setReviewItem(null);
                setReviewSuccess('');
            }, 1200);
        } catch (error) {
            setReviewError(error.response?.data?.message || 'Failed to submit review');
            setReviewLoading(false);
        }
    };

    // Previously Ordered: only delivered & cancelled
    const currentOrders = orders.filter((order) => !PREVIOUS_ORDER_STATUSES.has(getOrderStatus(order)));
    const previousOrders = orders.filter((order) => PREVIOUS_ORDER_STATUSES.has(getOrderStatus(order)));
    const displayOrders = activeTab === 'current' ? currentOrders : previousOrders;

    const getActionForCurrentOrder = (order) => {
        if (canMarkAsReceived(order)) {
            return { type: 'receive', label: 'Mark as Received', disabled: false };
        }
        if (canCancelOrder(order)) {
            return { type: 'cancel', label: 'Cancel', disabled: false };
        }
        const status = getOrderStatus(order);
        if (status === 'refunded') return { type: 'none', label: 'Refunded', disabled: true };
        if (status === 'refund_requested') return { type: 'none', label: 'Refund Requested', disabled: true };
        if (status === 'failed') return { type: 'none', label: 'Failed', disabled: true };
        return { type: 'none', label: 'In Progress', disabled: true };
    };

    const getPreviousOrderAction = (order, item) => {
        const status = getOrderStatus(order);

        if (status === 'cancelled') {
            return { type: 'reorder', label: 'Reorder', disabled: false };
        }

        if (status === 'delivered') {
            const productId = typeof item.product === 'object' ? item.product._id || item.product : item.product;
            const hasReview = !!userReviews[productId];
            return {
                type: 'review',
                label: hasReview ? 'Change Review' : 'Review',
                disabled: false,
                isEdit: hasReview,
            };
        }

        return { type: 'none', label: '', disabled: true };
    };

    const handlePreviousAction = (order, item, action) => {
        if (action.type === 'reorder') {
            const productId = typeof item.product === 'object' ? item.product._id || item.product : item.product;
            navigate(`/product/${productId}`);
            return;
        }
        if (action.type === 'review') {
            openReviewModal(order, item, action.isEdit);
        }
    };

    return (
        <div className="container animate-fade-in" style={{ paddingTop: '4rem', display: 'flex', justifyContent: 'center' }}>
            <div className="glass" style={{ width: '100%', maxWidth: '1000px', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <button 
                        onClick={() => setActiveTab('current')} 
                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', fontWeight: activeTab === 'current' ? 'bold' : 'normal', color: activeTab === 'current' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0 }}
                    >
                        <Package className="text-accent-1" /> Current Orders
                    </button>
                    <button 
                        onClick={() => setActiveTab('previous')} 
                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', fontWeight: activeTab === 'previous' ? 'bold' : 'normal', color: activeTab === 'previous' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0 }}
                    >
                        <Package className="text-accent-1" /> Previously Ordered
                    </button>
                </div>

                {loadingOrders ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading orders...</p>
                ) : displayOrders.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>You have no {activeTab === 'current' ? 'current' : 'previous'} orders.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem 0' }}>PRODUCT</th>
                                    <th style={{ padding: '1rem 0' }}>DATE</th>
                                    <th style={{ padding: '1rem 0' }}>PRICE</th>
                                    <th style={{ padding: '1rem 0' }}>STATUS</th>
                                    <th style={{ padding: '1rem 0' }}>DISCOUNT</th>
                                    <th style={{ padding: '1rem 0' }}>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayOrders.flatMap((order) =>
                                    order.orderItems.map((item) => {
                                        const status = getOrderStatus(order);
                                        const statusLabel = getOrderStatusLabel(order);

                                        const isCurrent = activeTab === 'current';
                                        const action = isCurrent
                                            ? getActionForCurrentOrder(order)
                                            : getPreviousOrderAction(order, item);

                                        return (
                                            <tr key={`${order._id}-${item.product}`} style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.9 }}>
                                                <td style={{ padding: '1rem 0' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <img src={item.customDesign?.previewImageUrl || item.image} alt={item.name} style={{ width: '40px', borderRadius: '4px' }} />
                                                        <div>
                                                            <div style={{ fontWeight: '500' }}>{item.name} (x{item.qty})</div>
                                                            {getProductOptionSummary(item) && (
                                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                                                                    {getProductOptionSummary(item)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 0' }}>{order.createdAt.substring(0, 10)}</td>
                                                <td style={{ padding: '1rem 0' }}>{formatCurrency(item.price * item.qty)}</td>
                                                <td style={{ padding: '1rem 0' }}>
                                                    <span style={{ color: getOrderStatusColor(status), fontWeight: 600 }}>{statusLabel}</span>
                                                </td>
                                                <td style={{ padding: '1rem 0' }}>
                                                    <div>{formatCurrency(order.totalDiscount || order.discount || 0)}</div>
                                                    <Link to={`/order/${order._id}`} style={{ color: 'var(--accent-1)', fontSize: '0.85rem' }}>
                                                        View details
                                                    </Link>
                                                </td>
                                                <td style={{ padding: '1rem 0' }}>
                                                    {activeTab === 'previous' && status === 'cancelled' ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                                                            <span style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.85rem' }}>Cancelled</span>
                                                            <button
                                                                onClick={() => handlePreviousAction(order, item, action)}
                                                                className="btn btn-primary"
                                                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                                                            >
                                                                Reorder
                                                            </button>
                                                        </div>
                                                    ) : action.type === 'none' ? (
                                                        <span style={{ color: 'var(--text-muted)' }}>{action.label}</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                if (isCurrent) {
                                                                    handleActionClick(order, item);
                                                                } else {
                                                                    handlePreviousAction(order, item, action);
                                                                }
                                                            }}
                                                            className={
                                                                action.type === 'cancel'
                                                                    ? 'btn btn-secondary'
                                                                    : action.type === 'review' && action.isEdit
                                                                        ? 'btn btn-secondary'
                                                                        : 'btn btn-primary'
                                                            }
                                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                                            disabled={action.disabled}
                                                        >
                                                            {action.label}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {showReviewModal && reviewItem && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className="glass" style={{ width: '90%', maxWidth: '500px', padding: '2rem', borderRadius: 'var(--radius-lg)', position: 'relative' }}>
                            <button type="button" onClick={() => setShowReviewModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                            <h3 style={{ marginBottom: '1rem' }}>
                                {isEditingReview ? 'Update Review for' : 'Review'} {reviewItem.item.name}
                            </h3>
                            {reviewError && <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{reviewError}</p>}
                            {reviewSuccess && <p style={{ color: 'var(--success)', marginBottom: '1rem' }}>{reviewSuccess}</p>}
                            <form onSubmit={submitReviewHandler}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Rating</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star 
                                                key={star} 
                                                size={24} 
                                                onClick={() => setRating(star)} 
                                                style={{ cursor: 'pointer', color: rating >= star ? 'var(--accent-1)' : 'var(--text-muted)' }}
                                                className={`star-icon ${rating >= star ? 'filled' : 'empty'}`}
                                                fill={rating >= star ? 'currentColor' : 'none'}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Comment</label>
                                    <textarea 
                                        className="form-control" 
                                        rows="4" 
                                        value={comment} 
                                        onChange={(e) => setComment(e.target.value)} 
                                        required 
                                        style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', resize: 'vertical' }}
                                    ></textarea>
                                </div>
                                <button type="submit" className="btn btn-primary w-100" disabled={reviewLoading || rating === 0}>
                                    {reviewLoading
                                        ? (isEditingReview ? 'Updating...' : 'Submitting...')
                                        : (isEditingReview ? 'Update Review' : 'Submit Review')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrdersPage;
