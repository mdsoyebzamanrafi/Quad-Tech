import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, ClipboardList, HelpCircle, LayoutDashboard, Package, Percent, ShieldCheck, TicketPercent, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/Admin.css';

const AdminLayout = () => {
    const { userInfo } = useAuth();

    return (
        <section className="admin-shell">
            <aside className="admin-sidebar glass">
                <div className="admin-sidebar-title">
                    <LayoutDashboard size={22} />
                    <div>
                        <span>Admin</span>
                        <small>{userInfo?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</small>
                    </div>
                </div>

                <nav className="admin-nav">
                    <NavLink to="/admin/orders" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                        <ClipboardList size={18} />
                        Orders
                    </NavLink>
                    <NavLink to="/admin/products" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                        <Package size={18} />
                        Products
                    </NavLink>
                    <NavLink to="/admin/coupons" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                        <TicketPercent size={18} />
                        Coupons
                    </NavLink>
                    <NavLink to="/admin/discounts" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                        <Percent size={18} />
                        Smart Discount Rules
                    </NavLink>
                    <NavLink to="/admin/sales" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                        <BarChart3 size={18} />
                        Sales Dashboard
                    </NavLink>
                    <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                        <Users size={18} />
                        Users
                    </NavLink>
                    <NavLink to="/admin/faqs" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                        <HelpCircle size={18} />
                        FAQs
                    </NavLink>
                </nav>

                {userInfo?.role === 'super_admin' && (
                    <div className="admin-role-note">
                        <ShieldCheck size={16} />
                        Role management enabled
                    </div>
                )}
                
                <div style={{ marginTop: 'auto', padding: '1rem' }}>
                    <button 
                        className="btn btn-outline" 
                        style={{ width: '100%' }}
                        onClick={() => {
                            localStorage.setItem('adminViewMode', 'customer');
                            window.location.href = '/';
                        }}
                    >
                        View as Customer
                    </button>
                </div>
            </aside>

            <div className="admin-content">
                <Outlet />
            </div>
        </section>
    );
};

export default AdminLayout;
