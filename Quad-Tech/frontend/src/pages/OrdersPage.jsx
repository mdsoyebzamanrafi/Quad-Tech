import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/LoginPage.css';

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

    // Filter to only current orders (not delivered)
    const currentOrders = orders.filter(o => !o.isDelivered);

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
                                    order.orderItems.map((item) => (
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
                                                {order.isPaid ? (
                                                    <span style={{ color: 'var(--success)' }}>Paid</span>
                                                ) : (
                                                    <span style={{ color: 'var(--error)' }}>Pending</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem 0' }}>
                                                <button
                                                    onClick={() => markAsReceivedHandler(order._id)}
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                                >
                                                    Received
                                                </button>
                                            </td>
                                        </tr>
                                    ))
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
