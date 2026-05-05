import React from 'react';
import RecommendedForYou from '../components/RecommendedForYou';
import '../styles/RecommendationsPage.css';

const RecommendationsPage = () => {
    return (
        <div className="recommendations-page container animate-fade-in">
            <div className="recommendations-page-copy">
                <p className="recommendations-page-kicker">Recommended For You</p>
                <h1>Recommended For You</h1>
                <p>Based on your orders, wishlist, and preferences.</p>
            </div>

            <RecommendedForYou variant="page" />
        </div>
    );
};

export default RecommendationsPage;
