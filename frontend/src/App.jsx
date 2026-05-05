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
import OrderPage from './pages/OrderPage';
import ProfilePage from './pages/ProfilePage';
import OrdersPage from './pages/OrdersPage';
import OTPVerificationPage from './pages/OTPVerificationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SetPasswordPage from './pages/SetPasswordPage';
import FAQPage from './pages/FAQPage';
import FeedbackPage from './pages/FeedbackPage';
import WishlistPage from './pages/WishlistPage';
import FriendsPage from './pages/FriendsPage';
import RecommendationsPage from './pages/RecommendationsPage';
import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminOrderDetailsPage from './pages/admin/AdminOrderDetailsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserDetailsPage from './pages/admin/AdminUserDetailsPage';
import AdminFAQPage from './pages/admin/AdminFAQPage';
import CouponListPage from './pages/admin/CouponListPage';
import CouponCreatePage from './pages/admin/CouponCreatePage';
import CouponEditPage from './pages/admin/CouponEditPage';
import SalesDashboardPage from './pages/admin/SalesDashboardPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminProductFormPage from './pages/admin/AdminProductFormPage';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';

const RequirePassword = ({ children }) => {
  const { userInfo } = useAuth();
  const location = useLocation();

  if (userInfo && userInfo.needsPassword && location.pathname !== '/setpassword') {
    return <Navigate to="/setpassword" replace />;
  }
  return children;
};

function AppContent() {
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
          <Route path="/order/:id" element={<OrderPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="/admin/orders" replace />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="products/new" element={<AdminProductFormPage />} />
            <Route path="products/:id" element={<AdminProductFormPage />} />
            <Route path="coupons" element={<CouponListPage />} />
            <Route path="coupon/create" element={<CouponCreatePage />} />
            <Route path="coupon/:id/edit" element={<CouponEditPage />} />
            <Route path="sales" element={<SalesDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailsPage />} />
            <Route path="faqs" element={<AdminFAQPage />} />
          </Route>
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
