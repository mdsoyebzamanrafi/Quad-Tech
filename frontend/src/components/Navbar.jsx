import React, { useState } from 'react';
import {
    ShoppingCart,
    User,
    Search,
    Sun,
    Moon,
    LogOut,
    Package,
    Menu,
    X,
    ShieldCheck,
    Heart,
    Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { isAdminUser } from '../utils/adminUtils';
import {
    ELECTRONICS_NAV_CATEGORIES,
    FASHION_NAV_CATEGORIES,
} from '../utils/catalog';
import '../styles/Navbar.css';

const Navbar = () => {
    const { isDarkMode, toggleTheme } = useTheme();
    const { userInfo, logout } = useAuth();
    const { cartItems } = useCart();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const dropdownRef = React.useRef(null);
    const searchRef = React.useRef(null);
    const canAccessAdmin = isAdminUser(userInfo);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    React.useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (keyword.trim().length > 1) {
                try {
                    const { data } = await api.get(
                        `/api/products/search/suggestions?q=${encodeURIComponent(keyword)}`
                    );
                    setSuggestions(data);
                    setShowSuggestions(true);
                } catch (error) {
                    console.error('Suggestions fetch error:', error);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [keyword]);

    const logoutHandler = () => {
        logout();
        navigate('/login');
    };

    const submitHandler = (e) => {
        if (e) {
            e.preventDefault();
        }

        if (keyword.trim()) {
            navigate(`/?keyword=${encodeURIComponent(keyword.trim())}`);
            setShowSuggestions(false);
        } else {
            navigate('/');
        }
    };

    const suggestionClickHandler = (suggestion) => {
        setKeyword(suggestion);
        setShowSuggestions(false);
        navigate(`/?keyword=${encodeURIComponent(suggestion)}`);
    };

    const closeSidebar = () => {
        setIsSidebarOpen(false);
    };

    const getCategoryLink = (department, category) =>
        `/?department=${encodeURIComponent(department)}&category=${encodeURIComponent(category)}`;

    return (
        <header className="navbar-container glass">
            {isSidebarOpen && (
                <div className="sidebar-overlay" onClick={closeSidebar}></div>
            )}

            <div className={`categories-sidebar glass ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h3>Browse Marketplace</h3>
                    <button onClick={closeSidebar} className="close-sidebar-btn">
                        <X size={24} />
                    </button>
                </div>
                <div className="sidebar-content">
                    <Link to="/" className="sidebar-category-link sidebar-home-link" onClick={closeSidebar}>
                        All Departments
                    </Link>

                    <div className="sidebar-section">
                        <p className="sidebar-section-title">Electronics</p>
                        {ELECTRONICS_NAV_CATEGORIES.map((category) => (
                            <Link
                                key={category}
                                to={getCategoryLink('electronics', category)}
                                className="sidebar-category-link"
                                onClick={closeSidebar}
                            >
                                {category}
                            </Link>
                        ))}
                    </div>

                    <hr className="sidebar-divider" />

                    <div className="sidebar-section">
                        <p className="sidebar-section-title">Fashion</p>
                        {FASHION_NAV_CATEGORIES.map((category) => (
                            <Link
                                key={category}
                                to={getCategoryLink('fashion', category)}
                                className="sidebar-category-link"
                                onClick={closeSidebar}
                            >
                                {category}
                            </Link>
                        ))}
                    </div>
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

                <div className="search-container desktop-search" ref={searchRef}>
                    <form onSubmit={submitHandler} className="search-bar">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search electronics, fashion, brands..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onFocus={() => keyword.trim().length > 1 && setShowSuggestions(true)}
                        />
                    </form>
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="search-suggestions glass animate-fade-in">
                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={`${suggestion}-${index}`}
                                    className="suggestion-item"
                                    onClick={() => suggestionClickHandler(suggestion)}
                                >
                                    <Search size={14} className="sug-icon" />
                                    <span>{suggestion}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <nav className="nav-links">
                    <button
                        onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                        className="mobile-search-toggle"
                        aria-label="Toggle Search"
                    >
                        {isMobileSearchOpen ? <X size={20} /> : <Search size={20} />}
                    </button>

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
                                    {canAccessAdmin && (
                                        <Link to="/admin" className="dropdown-item">
                                            <ShieldCheck size={16} /> Admin
                                        </Link>
                                    )}
                                    <button
                                        onClick={logoutHandler}
                                        className="dropdown-item"
                                        style={{ color: 'var(--error)' }}
                                    >
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

                    {userInfo && (
                        <>
                            <Link to="/wishlist" className="nav-item" aria-label="Wishlist">
                                <Heart size={20} />
                            </Link>
                            <Link to="/friends" className="nav-item" aria-label="Friends">
                                <Users size={20} />
                            </Link>
                        </>
                    )}

                    <Link to="/cart" className="btn btn-primary nav-cart">
                        <ShoppingCart size={18} />
                        <span>Cart</span>
                        {cartItems.length > 0 && (
                            <div className="cart-badge">
                                {cartItems.reduce((accumulator, currentItem) => accumulator + currentItem.qty, 0)}
                            </div>
                        )}
                    </Link>
                </nav>
            </div>

            {isMobileSearchOpen && (
                <div className="mobile-search-container glass animate-fade-in">
                    <form
                        onSubmit={(e) => {
                            setIsMobileSearchOpen(false);
                            submitHandler(e);
                        }}
                        className="mobile-search-bar"
                    >
                        <input
                            type="text"
                            placeholder="Search electronics or fashion..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onFocus={() => keyword.trim().length > 1 && setShowSuggestions(true)}
                            autoFocus
                        />
                        <button type="submit" className="mobile-search-submit">
                            <Search size={18} />
                        </button>
                    </form>

                    {showSuggestions && suggestions.length > 0 && (
                        <div className="search-suggestions glass animate-fade-in" style={{ position: 'relative', marginTop: '10px' }}>
                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={`${suggestion}-${index}`}
                                    className="suggestion-item"
                                    onClick={() => {
                                        setIsMobileSearchOpen(false);
                                        suggestionClickHandler(suggestion);
                                    }}
                                >
                                    <Search size={14} className="sug-icon" />
                                    <span>{suggestion}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </header>
    );
};

export default Navbar;
