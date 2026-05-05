import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import api from '../utils/api';
import { getCaptchaTokenForSubmission, isCaptchaEnabled } from '../utils/captcha';
import '../styles/LoginPage.css';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState('');
    
    const navigate = useNavigate();

    const submitHandler = async (e) => {
        e.preventDefault();
        if (isCaptchaEnabled && !captchaToken) {
            setErrorMsg('Please complete the CAPTCHA before requesting a reset code.');
            return;
        }

        setIsLoading(true);
        setErrorMsg('');
        try {
            const captchaTokenForSubmission = getCaptchaTokenForSubmission(captchaToken);
            await api.post('/api/users/forgotpassword', captchaTokenForSubmission
                ? { email, captchaToken: captchaTokenForSubmission }
                : { email });
            setSuccessMsg('OTP Code sent! Redirecting...');
            setErrorMsg('');
            setTimeout(() => {
                navigate('/resetpassword', { state: { email } });
            }, 1000);
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Error sending request');
            setSuccessMsg('');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h2>Forgot Password</h2>
                    <p className="login-subtitle">Enter your email and we'll send you a proprietary 6-digit OTP code.</p>
                </div>

                {errorMsg && <div className="error-message">{errorMsg}</div>}
                {successMsg && <div style={{ color: 'green', marginBottom: '1rem', textAlign: 'center' }}>{successMsg}</div>}

                <form onSubmit={submitHandler} className="login-form">
                    <div className="form-group">
                        <label>Email Address</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={20} />
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {!isCaptchaEnabled ? (
                        <div className="dev-captcha-note">
                            CAPTCHA is disabled for local development.
                        </div>
                    ) : (
                        <div style={{ margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
                            <ReCAPTCHA
                                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                                onChange={(token) => setCaptchaToken(token)}
                                onExpired={() => setCaptchaToken('')}
                                onErrored={() => {
                                    setCaptchaToken('');
                                    setErrorMsg('CAPTCHA could not load. Check the site key or use the local dev bypass.');
                                }}
                                theme="dark"
                            />
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-full" disabled={isLoading || (isCaptchaEnabled && !captchaToken)}>
                        {isLoading ? <Loader className="spinner" size={20} /> : 'Send Code'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
