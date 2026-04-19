import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/LoginPage.css';

const SetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { userInfo, updateUserInfo } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!userInfo || !userInfo.needsPassword) {
            navigate('/');
        }
    }, [userInfo, navigate]);

    const submitHandler = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match');
            return;
        }
        setIsLoading(true);
        try {
            const { data } = await api.post('/api/users/setpassword', { password }, {
                headers: { Authorization: `Bearer ${userInfo.token}` }
            });
            setSuccessMsg(data.message);
            const updatedUser = { ...userInfo, needsPassword: false };
            updateUserInfo(updatedUser);
            navigate('/');
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Error setting password');
            setSuccessMsg('');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header" style={{ marginBottom: '4rem' }}>
                    <h2>Secure Your Account</h2>
                    <p className="login-subtitle">Because you logged in with Google, you don't have a native password. Set one now so you can login with your email directly next time.</p>
                </div>

                {errorMsg && <div className="error-message">{errorMsg}</div>}
                {successMsg && <div style={{ color: 'green', marginBottom: '1rem', textAlign: 'center' }}>{successMsg}</div>}

                <form onSubmit={submitHandler} className="login-form">
                    <div className="form-group">
                        <label>Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                placeholder="Enter password"
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
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                        {isLoading ? <Loader className="spinner" size={20} /> : 'Set Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SetPasswordPage;
