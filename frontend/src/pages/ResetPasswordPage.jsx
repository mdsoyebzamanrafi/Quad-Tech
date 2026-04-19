import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Loader } from 'lucide-react';
import api from '../utils/api';
import '../styles/LoginPage.css';

const ResetPasswordPage = () => {
    const location = useLocation();
    const email = location.state?.email;

    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef([]);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const navigate = useNavigate();

    useEffect(() => {
        if (!email) {
            navigate('/forgotpassword');
        }
    }, [email, navigate]);

    const handleOtpChange = (e, index) => {
        const val = e.target.value;
        if (isNaN(val)) return;

        const newOtp = [...otpValues];
        newOtp[index] = val.substring(val.length - 1);
        setOtpValues(newOtp);

        if (val && index < 5 && inputRefs.current[index + 1]) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleOtpKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
        
        if (pastedData.length > 0) {
            const newOtp = [...otpValues];
            pastedData.forEach((char, i) => {
                newOtp[i] = char;
            });
            setOtpValues(newOtp);
            
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
            setErrorMsg('Please enter all 6 digits of the OTP');
            return;
        }

        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match');
            return;
        }
        setIsLoading(true);
        try {
            const { data } = await api.post(`/api/users/resetpassword`, { email, otpCode: fullOtp, password });
            setSuccessMsg(data.message);
            setErrorMsg('');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Error resetting password');
            setSuccessMsg('');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header" style={{ marginBottom: '4rem' }}>
                    <h2>Submit Code & Reset</h2>
                    <p className="login-subtitle">We sent a 6-digit verification code to {email}</p>
                </div>

                {errorMsg && <div className="error-message">{errorMsg}</div>}
                {successMsg && <div style={{ color: 'green', marginBottom: '1rem', textAlign: 'center' }}>{successMsg}</div>}

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
                                onChange={(e) => handleOtpChange(e, index)}
                                onKeyDown={(e) => handleOtpKeyDown(e, index)}
                                onPaste={handleOtpPaste}
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

                    <div className="form-group">
                        <label>New Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                placeholder="Enter your new secure password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                placeholder="Confirm your new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                        {isLoading ? <Loader className="spinner" size={20} /> : 'Finalize Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
