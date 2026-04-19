import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/LoginPage.css';

const OTPVerificationPage = () => {
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { verifyOTP } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // The email was passed via state from RegisterPage
    const email = location.state?.email;

    if (!email) {
        navigate('/register');
        return null;
    }

    const handleChange = (e, index) => {
        const val = e.target.value;
        if (isNaN(val)) return;

        const newOtp = [...otpValues];
        newOtp[index] = val.substring(val.length - 1);
        setOtpValues(newOtp);

        if (val && index < 5 && inputRefs.current[index + 1]) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
        
        if (pastedData.length > 0) {
            const newOtp = [...otpValues];
            pastedData.forEach((char, i) => {
                newOtp[i] = char;
            });
            setOtpValues(newOtp);
            
            // Auto focus next empty box
            const focusIndex = Math.min(pastedData.length, 5);
            if (inputRefs.current[focusIndex]) {
                inputRefs.current[focusIndex].focus();
            }
        }
    };

    const submitHandler = async (e) => {
        e.preventDefault();
        const fullOtp = otpValues.join('');
        if (fullOtp.length !== 6) {
            setErrorMsg('Please enter all 6 digits');
            return;
        }
        setIsLoading(true);
        try {
            await verifyOTP(email, fullOtp);
            navigate('/');
        } catch (err) {
            setErrorMsg(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header" style={{ marginBottom: '4rem' }}>
                    <h2>Verify Your Email</h2>
                    <p className="login-subtitle">We sent a 6-digit code to {email}</p>
                </div>

                {errorMsg && <div className="error-message">{errorMsg}</div>}

                <form onSubmit={submitHandler} className="login-form">
                        <div 
                            style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                gap: '12px',
                                maxWidth: '350px', 
                                margin: '0 auto 2rem auto' 
                            }}
                        >
                            {otpValues.map((val, index) => (
                                <input
                                    key={index}
                                    ref={(el) => (inputRefs.current[index] = el)}
                                    type="text"
                                    value={val}
                                    maxLength="1"
                                    onChange={(e) => handleChange(e, index)}
                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                    onPaste={handlePaste}
                                    style={{
                                        width: '45px',
                                        height: '55px',
                                        fontSize: '24px',
                                        textAlign: 'center',
                                        borderRadius: '8px',
                                        border: '2px solid var(--border-color)',
                                        backgroundColor: 'var(--bg-secondary)',
                                        color: 'white',
                                        outline: 'none',
                                        fontWeight: 'bold',
                                        transition: 'border-color 0.2s ease',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                />
                            ))}
                        </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                        {isLoading ? <Loader className="spinner" size={20} /> : 'Verify Account'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default OTPVerificationPage;
