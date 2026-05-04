import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { MapPin, Truck } from 'lucide-react';
import '../styles/LoginPage.css';

const ShippingPage = () => {
    const { cartItems, saveShippingAddress, savePaymentMethod } = useCart();

    // Fallbacks just in case context isn't fully structured yet
    const storedAddress = JSON.parse(localStorage.getItem('shippingAddress')) || {};

    const [address, setAddress] = useState(storedAddress.address || '');
    const [city, setCity] = useState(storedAddress.city || '');
    const [postalCode, setPostalCode] = useState(storedAddress.postalCode || '');
    const [country, setCountry] = useState(storedAddress.country || '');
    const [phone, setPhone] = useState(storedAddress.phone || '');

    const navigate = useNavigate();

    const submitHandler = (e) => {
        e.preventDefault();
        saveShippingAddress({ address, city, postalCode, country, phone });
        savePaymentMethod('Cash on Delivery');
        navigate('/placeorder');
    };

    return (
        <div className="login-container container animate-fade-in">
            <div className="login-card glass">
                <div className="login-header">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--accent-1)' }}>
                        <Truck size={32} />
                    </div>
                    <h1 className="login-title">Shipping Details</h1>
                    <p className="login-subtitle">Where should we send your luxury items?</p>
                </div>

                <form onSubmit={submitHandler} className="login-form">
                    <div className="form-group">
                        <label htmlFor="address">Street Address</label>
                        <div className="input-wrapper">
                            <MapPin className="input-icon" size={20} />
                            <input
                                type="text"
                                id="address"
                                placeholder="Enter street address"
                                value={address}
                                required
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="city">City</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                id="city"
                                placeholder="Enter city"
                                value={city}
                                required
                                onChange={(e) => setCity(e.target.value)}
                                style={{ paddingLeft: '1rem' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="postalCode">Postal Code</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                id="postalCode"
                                placeholder="Enter postal code"
                                value={postalCode}
                                required
                                onChange={(e) => setPostalCode(e.target.value)}
                                style={{ paddingLeft: '1rem' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone">Contact Number</label>
                        <div className="input-wrapper">
                            <input
                                type="tel"
                                id="phone"
                                placeholder="Enter contact number"
                                value={phone}
                                required
                                onChange={(e) => setPhone(e.target.value)}
                                style={{ paddingLeft: '1rem' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="country">Country</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                id="country"
                                placeholder="Enter country"
                                value={country}
                                required
                                onChange={(e) => setCountry(e.target.value)}
                                style={{ paddingLeft: '1rem' }}
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full login-btn" style={{ marginTop: '2rem' }}>
                        Review Order
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ShippingPage;
