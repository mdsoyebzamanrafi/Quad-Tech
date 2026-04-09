import React from 'react';
import '../styles/Footer.css';

const Footer = () => {
    return (
        <footer className="footer-container">
            <div className="container">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3>Quad Tech</h3>
                        <p>Your one-stop destination for premium quality products.</p>
                    </div>
                    <div className="footer-section">
                        <h4>Quick Links</h4>
                        <ul>
                            <li><a href="/">Home</a></li>
                            <li><a href="/products">Products</a></li>
                            <li><a href="/about">About Us</a></li>
                        </ul>
                    </div>
                    <div className="footer-section">
                        <h4>Contact</h4>
                        <p>Email: support@quadtech.com</p>
                        <p>Phone: +1 234 567 890</p>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} Quad Tech. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
