import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Loader } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import { useAuth } from '../context/AuthContext';
import '../styles/LoginPage.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState('');
    const isDevCaptchaDisabled = import.meta.env.DEV && import.meta.env.VITE_DISABLE_RECAPTCHA === 'true';

    const { login, googleLogin, userInfo } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const redirect = location.search ? location.search.split('=')[1] : '/';

    useEffect(() => {
        if (userInfo) {
            navigate(redirect);
        }
    }, [navigate, userInfo, redirect]);

    const submitHandler = async (e) => {
        e.preventDefault();
        if (!isDevCaptchaDisabled && !captchaToken) {
            setErrorMsg('Please complete the CAPTCHA before signing in.');
            return;
        }

        setIsLoading(true);
        setErrorMsg('');
        try {
            await login(email, password, isDevCaptchaDisabled ? 'dev-recaptcha-disabled' : captchaToken);
        } catch (err) {
            setErrorMsg(err);
        } finally {
            setIsLoading(false);
        }
    };

    const googleAuthHandler = async (credentialResponse) => {
        try {
            // useGoogleLogin provides an access_token, we pass it to the backend
            const data = await googleLogin(credentialResponse.access_token);
            if (data && data.needsPassword) {
                navigate('/setpassword');
            }
        } catch (err) {
            setErrorMsg(err);
        }
    };

    const handleGoogleLogin = useGoogleLogin({
        onSuccess: googleAuthHandler,
        onError: () => setErrorMsg('Google login failed')
    });

    return (
        <div className="login-container container animate-fade-in">
            <div className="login-card glass">
                <div className="login-header">
                    <h1 className="login-title">Welcome Back</h1>
                    <p className="login-subtitle">Sign in to your Quad Tech account</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                    <button 
                        className="btn-google-custom"
                        onClick={() => handleGoogleLogin()}
                        type="button"
                    >
                        <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" />
                        Continue with Google
                    </button>
                </div>

                <div className="login-divider">
                    <span>or sign in with email</span>
                </div>

                <form onSubmit={submitHandler} className="login-form">
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
                                required
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
                                required
                            />
                        </div>
                    </div>

                    {isDevCaptchaDisabled ? (
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

                    <button type="submit" className="btn btn-primary btn-full" disabled={isLoading || (!isDevCaptchaDisabled && !captchaToken)}>
                        {isLoading ? <Loader className="spinner" size={20} /> : 'Sign In'}
                    </button>
                    
                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                        <Link to="/forgotpassword" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>
                            Forgot Password?
                        </Link>
                    </div>

                    {errorMsg && <div className="error-message" style={{ color: 'var(--color-accent-1)', marginTop: '0.5rem', textAlign: 'center', fontWeight: '500' }}>{errorMsg}</div>}
                </form>

                <div className="login-footer">
                    New Customer?{' '}
                    <Link to="/register" className="text-accent-1 hover-underline">
                        Register Here
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
