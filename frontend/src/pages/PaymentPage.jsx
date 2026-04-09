import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { CreditCard } from 'lucide-react';
import '../styles/LoginPage.css';

const PaymentPage = () => {
    const { shippingAddress, savePaymentMethod } = useCart();
    const navigate = useNavigate();

    // Ensure the user has actually filled out shipping before they handle payment
    if (!shippingAddress.address) {
        navigate('/shipping');
    }

    const [paymentMethod, setPaymentMethod] = useState('PayPal');

    const submitHandler = (e) => {
        e.preventDefault();
        savePaymentMethod(paymentMethod);
        navigate('/placeorder');
    };

    return (
        <div className="login-container container animate-fade-in">
            <div className="login-card glass">
                <div className="login-header">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--accent-1)' }}>
                        <CreditCard size={32} />
                    </div>
                    <h1 className="login-title">Payment Method</h1>
                    <p className="login-subtitle">Select how you want to pay</p>
                </div>

                <form onSubmit={submitHandler} className="login-form">
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label>Select Method</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-main)' }}>
                                <input
                                    type="radio"
                                    id="PayPal"
                                    name="paymentMethod"
                                    value="PayPal"
                                    checked={paymentMethod === 'PayPal'}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    style={{ width: '20px', height: '20px', accentColor: 'var(--accent-1)' }}
                                />
                                PayPal or Credit Card
                            </label>

                            {/* Stripe or other gateways can be added similarly */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-main)' }}>
                                <input
                                    type="radio"
                                    id="Stripe"
                                    name="paymentMethod"
                                    value="Stripe"
                                    checked={paymentMethod === 'Stripe'}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    style={{ width: '20px', height: '20px', accentColor: 'var(--accent-1)' }}
                                />
                                Stripe
                            </label>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full login-btn">
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PaymentPage;
