import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Package, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/LoginPage.css';
import { getProductOptionSummary } from '../utils/productUtils';

const ProfilePage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
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
            setName(userInfo.name);
            setEmail(userInfo.email);
            getMyOrders();
        }
    }, [navigate, userInfo]);

    const submitHandler = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage('Passwords do not match');
        } else {
            try {
                // Future Implementation: api.put('/api/users/profile', { id: userInfo._id, name, email, password })
                setMessage('Profile Updated (Simulated)');
            } catch (error) {
                setMessage(error.message);
            }
        }
    };

    return (
        <div className="container animate-fade-in" style={{ paddingTop: '4rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

            {/* Profile Update Section */}
            <div className="login-card glass" style={{ flex: '1', minWidth: '300px', margin: '0' }}>
                <div className="login-header">
                    <h2 className="login-title">User Profile</h2>
                    <p className="login-subtitle">Update your personal details</p>
                </div>

                {message && <div style={{ color: message.includes('Passwords') ? 'var(--error)' : 'var(--success)', marginBottom: '1rem', textAlign: 'center' }}>{message}</div>}

                <form onSubmit={submitHandler} className="login-form">
                    <div className="form-group">
                        <label htmlFor="name">Name</label>
                        <div className="input-wrapper">
                            <User className="input-icon" size={20} />
                            <input
                                type="text"
                                id="name"
                                placeholder="Enter name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={20} />
                            <input
                                type="email"
                                id="email"
                                placeholder="Enter email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                id="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                id="confirmPassword"
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full login-btn">
                        Update
                    </button>
                </form>
            </div>

            {/* My Orders Section */}
            <div className="glass" style={{ flex: '2', minWidth: '300px', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                    <Package className="text-accent-1" />
                    <h2 style={{ fontSize: '1.5rem' }}>Past Orders</h2>
                </div>

                {/* Orders Content */}
                {(() => {
                    const pastOrders = orders.filter(o => o.isDelivered);

                    if (pastOrders.length === 0) {
                        return <p style={{ color: 'var(--text-muted)' }}>You have no past orders.</p>;
                    }

                    return (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '1rem 0' }}>PRODUCT</th>
                                        <th style={{ padding: '1rem 0' }}>DATE</th>
                                        <th style={{ padding: '1rem 0' }}>PRICE</th>
                                        <th style={{ padding: '1rem 0' }}>DELIVERED</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pastOrders.flatMap((order) =>
                                        order.orderItems.map((item) => (
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
                                                <td style={{ padding: '1rem 0' }}>${(item.price * item.qty).toFixed(2)}</td>
                                                <td style={{ padding: '1rem 0' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>{order.deliveredAt.substring(0, 10)}</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default ProfilePage;
