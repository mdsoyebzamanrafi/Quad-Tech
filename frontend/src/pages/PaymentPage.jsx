import React from 'react';
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

    const submitHandler = (e) => {
        e.preventDefault();
        savePaymentMethod('Cash on Delivery');
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
                    <p className="login-subtitle">Cash on Delivery is currently the only supported method.</p>
                </div>

                <form onSubmit={submitHandler} className="login-form">
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label>Selected Method</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'not-allowed', fontSize: '1rem', color: 'var(--text-main)' }}>
                                <input
                                    type="radio"
                                    id="COD"
                                    name="paymentMethod"
                                    value="Cash on Delivery"
                                    checked={true}
                                    readOnly
                                    style={{ width: '20px', height: '20px', accentColor: 'var(--accent-1)' }}
                                />
                                Cash on Delivery
                            </label>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full login-btn">
                        Continue to Order
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PaymentPage;
