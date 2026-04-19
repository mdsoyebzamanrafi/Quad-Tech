import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({ children }) => {
    return (
        <div className="app-container">
            <Navbar />
            <main className="main-content container animate-fade-in">
                {children}
            </main>
            <Footer />
        </div>
    );
};

export default Layout;
