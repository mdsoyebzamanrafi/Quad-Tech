import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProductDetails from './pages/ProductDetails';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ShippingPage from './pages/ShippingPage';
import PaymentPage from './pages/PaymentPage';
import PlaceOrderPage from './pages/PlaceOrderPage';
import ProfilePage from './pages/ProfilePage';
import OrdersPage from './pages/OrdersPage';
import OTPVerificationPage from './pages/OTPVerificationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SetPasswordPage from './pages/SetPasswordPage';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';

function AppContent() {
  const { userInfo } = useAuth();
  const location = useLocation();

  const RequirePassword = ({ children }) => {
    if (userInfo && userInfo.needsPassword && location.pathname !== '/setpassword') {
      return <Navigate to="/setpassword" replace />;
    }
    return children;
  };

  return (
    <Layout>
      <RequirePassword>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<OTPVerificationPage />} />
          <Route path="/forgotpassword" element={<ForgotPasswordPage />} />
          <Route path="/resetpassword" element={<ResetPasswordPage />} />
          <Route path="/setpassword" element={<SetPasswordPage />} />
          <Route path="/shipping" element={<ShippingPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/placeorder" element={<PlaceOrderPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Routes>
      </RequirePassword>
    </Layout>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'fallback-id'}>
      <ThemeProvider>
        <Router>
          <ScrollToTop />
          <AppContent />
        </Router>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
