import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn, User, Loader } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import { useAuth } from '../context/AuthContext';
import '../styles/LoginPage.css';

const RegisterPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState('');

    const { register, googleLogin, userInfo } = useAuth();
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
        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match');
            return;
        }
        setIsLoading(true);
        try {
            const res = await register(name, email, password, captchaToken);
            if (res && res.status === 'pending_verification') {
                navigate('/verify', { state: { email } });
                return;
            }
        } catch (err) {
            setErrorMsg(err);
        } finally {
            setIsLoading(false);
        }
    };

    const googleAuthHandler = async (tokenResponse) => {
        try {
            const data = await googleLogin(tokenResponse.access_token);
            if (data && data.needsPassword) {
                navigate('/setpassword');
            }
        } catch (err) {
            setErrorMsg(err);
        }
    };

    const handleGoogleLogin = useGoogleLogin({
        onSuccess: googleAuthHandler,
        onError: () => setErrorMsg('Google signup failed')
    });

    return (
        <div className="login-container container animate-fade-in">
            <div className="login-card glass">
                <div className="login-header">
                    <h1 className="login-title">Join Us</h1>
                    <p className="login-subtitle">Create your Quad Tech account today</p>
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
                    <span>or sign up with email</span>
                </div>

                <form onSubmit={submitHandler} className="login-form">
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <div className="input-wrapper">
                            <User className="input-icon" size={20} />
                            <input
                                type="text"
                                id="name"
                                placeholder="Enter full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
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
                                required
                            />
                        </div>
                    </div>

                    <div style={{ margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
                        <ReCAPTCHA
                            sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                            onChange={(token) => setCaptchaToken(token)}
                            theme="dark"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-full login-btn" disabled={isLoading || !captchaToken}>
                        {isLoading ? <Loader className="spinner" size={20} /> : 'Create Account'}
                    </button>

                    {errorMsg && <div className="error-message" style={{ color: 'var(--color-accent-1)', marginTop: '0.5rem', textAlign: 'center', fontWeight: '500' }}>{errorMsg}</div>}
                </form>

                <div className="login-footer">
                    Already have an account?{' '}
                    <Link to="/login" className="text-accent-1 hover-underline">
                        Sign In Here
                    </Link>
                </div>
            </div>
        </div >
    );
};

export default RegisterPage;
