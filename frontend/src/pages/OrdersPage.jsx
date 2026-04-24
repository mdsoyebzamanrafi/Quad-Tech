import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/LoginPage.css';

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

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'refunded', 'failed']);

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

const getOrderPrimaryAction = (order) => {
    const status = getOrderStatus(order);

    if (canMarkAsReceived(order)) {
        return { type: 'receive', label: 'Mark as Received', disabled: false };
    }

    if (canCancelOrder(order)) {
        return { type: 'cancel', label: 'Cancel', disabled: false };
    }

    if (status === 'delivered') {
        return { type: 'none', label: 'Completed', disabled: true };
    }

    if (status === 'cancelled') {
        return { type: 'none', label: 'Cancelled', disabled: true };
    }

    if (status === 'refunded') {
        return { type: 'none', label: 'Refunded', disabled: true };
    }

    if (status === 'refund_requested') {
        return { type: 'none', label: 'Refund Requested', disabled: true };
    }

    if (status === 'failed') {
        return { type: 'none', label: 'Failed', disabled: true };
    }

    return { type: 'none', label: 'In Progress', disabled: true };
};

const OrdersPage = () => {
    const [orders, setOrders] = useState([]);

    const { userInfo } = useAuth();
    const navigate = useNavigate();

    const getMyOrders = async () => {
        try {
            const { data } = await api.get('/api/orders/myorders');
            setOrders(data);
        } catch (error) {
            console.error('Failed to fetch orders', error);
        }
    };

    useEffect(() => {
        if (!userInfo) {
            navigate('/login');
        } else {
            getMyOrders();
        }
    }, [navigate, userInfo]);

    const markAsReceivedHandler = async (orderId) => {
        try {
            await api.put(`/api/orders/${orderId}/deliver`);
            getMyOrders();
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
            getMyOrders();
        } catch (error) {
            console.error('Failed to cancel order', error);
            alert(error.response?.data?.message || 'Failed to cancel order');
        }
    };

    const actionHandler = async (order) => {
        const action = getOrderPrimaryAction(order);
        if (action.type === 'receive') {
            await markAsReceivedHandler(order._id);
            return;
        }
        if (action.type === 'cancel') {
            await cancelOrderHandler(order._id);
        }
    };

    // Show all non-terminal and actionable order states here.
    const currentOrders = orders.filter((order) => !TERMINAL_ORDER_STATUSES.has(getOrderStatus(order)));

    return (
        <div className="container animate-fade-in" style={{ paddingTop: '4rem', display: 'flex', justifyContent: 'center' }}>
            <div className="glass" style={{ width: '100%', maxWidth: '1000px', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                    <Package className="text-accent-1" />
                    <h2 style={{ fontSize: '1.5rem' }}>Current Orders</h2>
                </div>

                {currentOrders.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>You have no current orders.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem 0' }}>PRODUCT</th>
                                    <th style={{ padding: '1rem 0' }}>DATE</th>
                                    <th style={{ padding: '1rem 0' }}>PRICE</th>
                                    <th style={{ padding: '1rem 0' }}>STATUS</th>
                                    <th style={{ padding: '1rem 0' }}>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentOrders.flatMap((order) =>
                                    order.orderItems.map((item) => {
                                        const status = getOrderStatus(order);
                                        const statusLabel = getOrderStatusLabel(order);
                                        const action = getOrderPrimaryAction(order);

                                        return (
                                            <tr key={`${order._id}-${item.product}`} style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.9 }}>
                                                <td style={{ padding: '1rem 0' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <img src={item.image} alt={item.name} style={{ width: '40px', borderRadius: '4px' }} />
                                                        <span style={{ fontWeight: '500' }}>{item.name} (x{item.qty})</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 0' }}>{order.createdAt.substring(0, 10)}</td>
                                                <td style={{ padding: '1rem 0' }}>${(item.price * item.qty).toFixed(2)}</td>
                                                <td style={{ padding: '1rem 0' }}>
                                                    <span style={{ color: getOrderStatusColor(status), fontWeight: 600 }}>{statusLabel}</span>
                                                </td>
                                                <td style={{ padding: '1rem 0' }}>
                                                    {action.type === 'none' ? (
                                                        <span style={{ color: 'var(--text-muted)' }}>{action.label}</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => actionHandler(order)}
                                                            className={action.type === 'cancel' ? 'btn btn-secondary' : 'btn btn-primary'}
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
            </div>
        </div>
    );
};

export default OrdersPage;
