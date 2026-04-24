import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdminUser } from '../../utils/adminUtils';

const AdminRoute = ({ children }) => {
    const { userInfo } = useAuth();
    const location = useLocation();

    if (!userInfo) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (userInfo.needsPassword && location.pathname !== '/setpassword') {
        return <Navigate to="/setpassword" replace />;
    }

    if (!isAdminUser(userInfo)) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default AdminRoute;
