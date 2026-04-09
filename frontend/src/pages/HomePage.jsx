import React, { useEffect, useState, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Sparkles, Filter } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/HomePage.css';
import api from '../utils/api';

// Helper component for animated sections
const FadeInSection = ({ children, delay = 0 }) => {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <div
            ref={ref}
            style={{ transitionDelay: `${delay}ms` }}
            className={`transition-fade ${inView ? 'is-visible' : ''}`}
        >
            {children}
        </div>
    );
};

const HomePage = () => {
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('Default'); // Default view
    const [showCategories, setShowCategories] = useState(false);

    // Listen for query parameters from Navbar dropdown
    const location = useLocation();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                // Fetch all products (limit high to ensure we get all 100)
                const { data } = await api.get('/api/products?limit=200');

                // Ensure they are sorted by newest first
                const sortedProducts = (data.products || data).sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
                );

                setAllProducts(sortedProducts);
                setLoading(false);
            } catch (err) {
                setError(err.message || 'Failed to fetch products');
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // Handle deep linking from Navbar
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const categoryParam = params.get('category');
        if (categoryParam) {
            setSelectedCategory(categoryParam);
            setShowCategories(true);
            // Scroll down automatically when navigating from Navbar dropdown
            setTimeout(() => {
                const el = document.getElementById('product-display-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } else if (location.search === '' && selectedCategory !== 'Default') {
            // Reset to default home page view
            setSelectedCategory('Default');
            setShowCategories(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [location]);

    // Extract unique categories from products
    const categories = useMemo(() => {
        const cats = [...new Set(allProducts.map(p => p.category))];
        return cats.sort();
    }, [allProducts]);

    // Compute derived products to display based on category filters
    const displayedProducts = useMemo(() => {
        // Return empty array if products haven't loaded yet
        if (!allProducts || allProducts.length === 0) {
            return [];
        }

        // Home Page Default View: 1 latest item per category (max 10)
        if (selectedCategory === 'Default') {
            const uniqueCategories = new Set();
            const defaultSelection = [];

            for (const product of allProducts) {
                if (!uniqueCategories.has(product.category)) {
                    uniqueCategories.add(product.category);
                    defaultSelection.push(product);
                }
                if (defaultSelection.length >= 10) break;
            }
            return defaultSelection;
        }

        // Specific Category View: Filter by exact match
        return allProducts.filter((product) => product.category === selectedCategory);
    }, [allProducts, selectedCategory]);

    if (loading) return <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}><h2>Loading Products...</h2></div>;
    if (error) return <div className="container" style={{ paddingTop: '6rem', textAlign: 'center', color: 'var(--accent-1)' }}><h2>Error: {error}</h2></div>;

    const handleBrowseCategories = (e) => {
        e.preventDefault();
        setShowCategories(true);

        // Scroll down to the products section smoothly
        document.getElementById('product-display-section').scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="home-page animate-fade-in">
            {/* Hero Section */}
            <section className="hero-section full-width-hero">
                <div className="hero-content">
                    <FadeInSection delay={0}>
                        <div className="badge-pill">
                            <Sparkles size={16} className="text-accent-1" />
                            <span>Introducing the Quad Tech Collection</span>
                        </div>
                    </FadeInSection>

                    <FadeInSection delay={200}>
                        <h1 className="hero-title">
                            Technology that feels <br />
                            <span className="text-gradient">like magic.</span>
                        </h1>
                    </FadeInSection>

                    <FadeInSection delay={400}>
                        <p className="hero-subtitle">
                            Discover devices crafted with uncompromising quality,
                            designed to inspire your everyday moments.
                        </p>
                    </FadeInSection>

                    <FadeInSection delay={600}>
                        <div className="hero-actions">
                            <button className="btn btn-primary btn-large" onClick={() => document.getElementById('product-display-section').scrollIntoView({ behavior: 'smooth' })}>
                                Shop Collection
                            </button>
                            <button className="btn btn-outline btn-large" onClick={handleBrowseCategories}>
                                Browse Categories <Filter size={18} />
                            </button>
                        </div>
                    </FadeInSection>
                </div>

                {/* Abstract decorative element for the playful/vibrant feel */}
                <div className="hero-decoration">
                    <div className="blob blob-1"></div>
                    <div className="blob blob-2"></div>
                </div>
            </section>

            {/* Featured Products */}
            <section id="product-display-section" className="featured-section container" style={{ scrollMarginTop: '100px' }}>
                <FadeInSection>
                    <div className="section-header">
                        <h2>
                            {selectedCategory === 'Default' ? 'Category Highlights'
                                : selectedCategory === 'All' ? 'Everything Quad Tech'
                                    : `${selectedCategory} Collection`}
                        </h2>
                        <p>Take a look at what's new, right now.</p>
                    </div>

                    {showCategories && (
                        <div className="category-filter-container animate-fade-in">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </FadeInSection>

                <div className="products-grid">
                    {displayedProducts.map((product, index) => (
                        <FadeInSection key={product._id} delay={0.05 * (index % 10)}>
                            <Link to={`/product/${product._id}`} className="product-card glass">
                                <div className="product-image">
                                    <img src={product.image} alt={product.name} />
                                </div>
                                <div className="product-info">
                                    <span className="brand-label">{product.category}</span>
                                    <h3 style={{ fontSize: '1rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{product.name}</h3>
                                    <p className="price">${product.price.toFixed(2)}</p>
                                </div>
                            </Link>
                        </FadeInSection>
                    ))}
                </div>
            </section>

            {/* Categories Banner (Only visible on Default home page) */}
            {selectedCategory === 'Default' && (
                <section className="category-banner container">
                    <FadeInSection>
                        <div className="banner-content glass">
                            <h2>Luxury, tailored for you.</h2>
                            <p>Explore our exclusive categories curated for the modern enthusiast.</p>
                            <button className="btn btn-secondary" onClick={handleBrowseCategories}>
                                Browse Categories
                            </button>
                        </div>
                    </FadeInSection>
                </section>
            )}
        </div>
    );
};

export default HomePage;
