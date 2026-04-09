import React, { useState } from 'react';
import { ShoppingCart, User, Search, Sun, Moon, LogOut, Package, Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import '../styles/Navbar.css';

const Navbar = () => {
    const { isDarkMode, toggleTheme } = useTheme();
    const { userInfo, logout } = useAuth();
    const { cartItems } = useCart();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const dropdownRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const logoutHandler = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="navbar-container glass">
            {/* Overlay for sidebar */}
            {isSidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
            )}

            {/* Sidebar */}
            <div className={`categories-sidebar glass ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h3>Categories</h3>
                    <button onClick={() => setIsSidebarOpen(false)} className="close-sidebar-btn">
                        <X size={24} />
                    </button>
                </div>
                <div className="sidebar-content">
                    {['Smartphones', 'Laptops', 'Wearables', 'Audio', 'Gaming', 'Smart Home', 'Cameras', 'Tablets', 'Accessories', 'Drones'].map(cat => (
                        <Link key={cat} to={`/?category=${cat}`} className="sidebar-category-link" onClick={() => setIsSidebarOpen(false)}>
                            {cat}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="container navbar">
                <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => setIsSidebarOpen(true)} className="menu-btn" aria-label="Open Categories">
                        <Menu size={24} color="var(--text-main)" />
                    </button>
                    <Link to="/">
                        <h2>Quad <span className="text-gradient">Tech</span></h2>
                    </Link>
                </div>

                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search for luxury..." />
                </div>

                <nav className="nav-links">
                    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    {userInfo ? (
                        <div className="nav-item user-dropdown" ref={dropdownRef}>
                            <div className="user-dropdown-toggle" onClick={() => setDropdownOpen(!dropdownOpen)}>
                                <User size={20} />
                                <span className="nav-text">{userInfo.name.split(' ')[0]}</span>
                            </div>
                            {dropdownOpen && (
                                <div className="dropdown-menu glass animate-fade-in">
                                    <Link to="/profile" className="dropdown-item">
                                        <User size={16} /> Profile
                                    </Link>
                                    <Link to="/orders" className="dropdown-item">
                                        <Package size={16} /> Orders
                                    </Link>
                                    <button onClick={logoutHandler} className="dropdown-item" style={{ color: 'var(--error)' }}>
                                        <LogOut size={16} /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link to="/login" className="nav-item">
                            <User size={20} />
                            <span className="nav-text">Sign In</span>
                        </Link>
                    )}

                    <Link to="/cart" className="btn btn-primary nav-cart">
                        <ShoppingCart size={18} />
                        <span>Cart</span>
                        {cartItems.length > 0 && (
                            <div className="cart-badge">
                                {cartItems.reduce((a, c) => a + c.qty, 0)}
                            </div>
                        )}
                    </Link>
                </nav>
            </div>
        </header>
    );
};

export default Navbar;
