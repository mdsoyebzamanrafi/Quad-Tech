import axios from 'axios';

// Create a configured axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to attach JWT token if it exists in local storage
api.interceptors.request.use(
    (config) => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            const { token } = JSON.parse(userInfo);
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token expiration/401s universally
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // If unauthorized, clear local storage and force login logic could go here
        if (error.response && error.response.status === 401) {
            console.error('Unauthorized response caught by axios interceptor');
        }
        return Promise.reject(error);
    }
);

export default api;
