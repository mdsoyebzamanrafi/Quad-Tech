import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in
        const storedUser = localStorage.getItem('userInfo');
        if (storedUser) {
            setUserInfo(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password, captchaToken) => {
        try {
            const { data } = await api.post('/api/users/login', { email, password, captchaToken });
            setUserInfo(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'Login failed';
        }
    };

    const googleLogin = async (token) => {
        try {
            const { data } = await api.post('/api/users/google', { token });
            setUserInfo(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'Google Login failed';
        }
    };

    const register = async (name, email, password, captchaToken) => {
        try {
            const { data } = await api.post('/api/users', { name, email, password, captchaToken });
            if (data.status === 'pending_verification') {
                return data;
            }
            setUserInfo(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'Registration failed';
        }
    };

    const logout = () => {
        localStorage.removeItem('userInfo');
        setUserInfo(null);
    };

    const updateUserInfo = (data) => {
        setUserInfo(data);
        localStorage.setItem('userInfo', JSON.stringify(data));
    };

    const verifyOTP = async (email, otpCode) => {
        try {
            const { data } = await api.post('/api/users/verify', { email, otpCode });
            setUserInfo(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'Verification failed';
        }
    };

    const value = {
        userInfo,
        login,
        register,
        verifyOTP,
        googleLogin,
        logout,
        updateUserInfo,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
