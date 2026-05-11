import React, { useEffect, useMemo, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Sparkles, Filter, Search, Heart } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';
import api from '../utils/api';
import { DEPARTMENT_OPTIONS } from '../utils/catalog';
import ImageProductSearch from '../components/ImageProductSearch';
import RecommendedForYou from '../components/RecommendedForYou';
import { useCurrency } from '../context/CurrencyContext';
import {
    buildFashionMetaLine,
    getDepartmentLabel,
    getStockStatusLabel,
    matchesProductKeyword,
    normalizeDepartment,
    normalizeStringList,
} from '../utils/productUtils';

const DEFAULT_FILTERS = {
    department: 'all',
    category: 'all',
    brand: 'all',
    priceRange: 'all',
    gender: 'all',
    size: 'all',
    color: 'all',
    season: 'all',
    occasion: 'all',
    styleTag: 'all',
};

const PRICE_RANGES = [
    { value: 'all', label: 'All Prices' },
    { value: 'under-1000', label: 'Under 1000', min: 0, max: 999 },
    { value: '1000-2500', label: '1000 - 2500', min: 1000, max: 2500 },
    { value: '2501-5000', label: '2501 - 5000', min: 2501, max: 5000 },
    { value: '5001-plus', label: '5001+', min: 5001, max: Infinity },
];

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
    const [keyword, setKeyword] = useState('');
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [isLandingView, setIsLandingView] = useState(true);
    const [imageSearchFile, setImageSearchFile] = useState(null);
    const [imageSearchPreview, setImageSearchPreview] = useState('');
    const [imageSearchLoading, setImageSearchLoading] = useState(false);
    const [imageSearchError, setImageSearchError] = useState('');
    const [imageSearchResult, setImageSearchResult] = useState(null);
    const [imageSearchActive, setImageSearchActive] = useState(false);

    const { formatCurrency } = useCurrency();

    const navigate = useNavigate();
    const location = useLocation();

    const handleAddToWishlist = async (e, productId) => {
        e.preventDefault();
        try {
            await api.post('/api/wishlist', { productId });
            alert('Added to wishlist!');
        } catch {
            alert('Please login to add to wishlist');
        }
    };

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const { data } = await api.get('/api/products?limit=500');
                const products = Array.isArray(data) ? data : data.products || [];
                const sortedProducts = products.sort(
                    (firstProduct, secondProduct) =>
                        new Date(secondProduct.createdAt || 0) - new Date(firstProduct.createdAt || 0)
                );

                setAllProducts(sortedProducts);
                setLoading(false);
            } catch (fetchError) {
                setError(fetchError.message || 'Failed to fetch products');
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    useEffect(() => {
        if (!imageSearchFile) {
            setImageSearchPreview('');
            return undefined;
        }

        const previewUrl = URL.createObjectURL(imageSearchFile);
        setImageSearchPreview(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [imageSearchFile]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const queryKeyword = params.get('keyword') || '';
        const queryDepartment = params.get('department') || 'all';
        const queryCategory = params.get('category') || 'all';
        const queryBrand = params.get('brand') || 'all';
        const hasQueryParams = Array.from(params.keys()).length > 0;

        if (hasQueryParams) {
            setKeyword(queryKeyword);
            setFilters({
                ...DEFAULT_FILTERS,
                department: ['fashion', 'electronics'].includes(queryDepartment)
                    ? queryDepartment
                    : 'all',
                category: queryCategory,
                brand: queryBrand,
            });
            setIsLandingView(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setKeyword('');
            setFilters(DEFAULT_FILTERS);
            setIsLandingView(true);
        }
    }, [location.search]);

    const normalizedProducts = useMemo(
        () =>
            allProducts.map((product) => ({
                ...product,
                department: normalizeDepartment(product.department),
                colors: normalizeStringList(product.colors),
                sizes: normalizeStringList(product.sizes),
                styleTags: normalizeStringList(product.styleTags),
            })),
        [allProducts]
    );

    const imageSearchProducts = useMemo(
        () =>
            (Array.isArray(imageSearchResult?.products) ? imageSearchResult.products : []).map((product) => ({
                ...product,
                department: normalizeDepartment(product.department),
                colors: normalizeStringList(product.colors),
                sizes: normalizeStringList(product.sizes),
                styleTags: normalizeStringList(product.styleTags),
            })),
        [imageSearchResult]
    );

    const productsForSelectedDepartment = useMemo(() => {
        if (filters.department === 'all') {
            return normalizedProducts;
        }

        return normalizedProducts.filter((product) => product.department === filters.department);
    }, [filters.department, normalizedProducts]);

    const availableCategories = useMemo(() => {
        const categorySet = new Set(productsForSelectedDepartment.map((product) => product.category).filter(Boolean));
        return Array.from(categorySet).sort((firstCategory, secondCategory) =>
            firstCategory.localeCompare(secondCategory)
        );
    }, [productsForSelectedDepartment]);

    const productsForBrandOptions = useMemo(() => {
        return productsForSelectedDepartment.filter((product) => {
            if (filters.category !== 'all' && product.category !== filters.category) {
                return false;
            }

            return true;
        });
    }, [filters.category, productsForSelectedDepartment]);

    const availableBrands = useMemo(() => {
        const brandSet = new Set(productsForBrandOptions.map((product) => product.brand).filter(Boolean));
        return Array.from(brandSet).sort((firstBrand, secondBrand) => firstBrand.localeCompare(secondBrand));
    }, [productsForBrandOptions]);

    const fashionOptionSource = useMemo(() => {
        return normalizedProducts.filter((product) => {
            if (product.department !== 'fashion') {
                return false;
            }

            if (filters.department === 'electronics') {
                return false;
            }

            if (filters.category !== 'all' && product.category !== filters.category) {
                return false;
            }

            if (filters.brand !== 'all' && product.brand !== filters.brand) {
                return false;
            }

            if (keyword && !matchesProductKeyword(product, keyword)) {
                return false;
            }

            return true;
        });
    }, [filters.brand, filters.category, filters.department, keyword, normalizedProducts]);

    const getUniqueOptions = (selector) =>
        Array.from(
            new Set(
                fashionOptionSource
                    .flatMap((product) => selector(product))
                    .filter((value) => typeof value === 'string' && value.trim())
            )
        ).sort((firstValue, secondValue) => firstValue.localeCompare(secondValue));

    const fashionFilterOptions = useMemo(
        () => ({
            genders: getUniqueOptions((product) => [product.gender]),
            sizes: getUniqueOptions((product) => product.sizes),
            colors: getUniqueOptions((product) => product.colors),
            seasons: getUniqueOptions((product) => [product.season]),
            occasions: getUniqueOptions((product) => [product.occasion]),
            styleTags: getUniqueOptions((product) => product.styleTags),
        }),
        [fashionOptionSource]
    );

    const hasFiltersApplied = useMemo(
        () =>
            Boolean(keyword) ||
            Object.entries(filters).some(([, value]) => value !== 'all'),
        [filters, keyword]
    );

    const displayedProducts = useMemo(() => {
        if (imageSearchActive) {
            return imageSearchProducts;
        }

        let filteredProducts = [...normalizedProducts];

        if (keyword) {
            filteredProducts = filteredProducts.filter((product) => matchesProductKeyword(product, keyword));
        }

        if (filters.department !== 'all') {
            filteredProducts = filteredProducts.filter(
                (product) => product.department === filters.department
            );
        }

        if (filters.category !== 'all') {
            filteredProducts = filteredProducts.filter(
                (product) => product.category === filters.category
            );
        }

        if (filters.brand !== 'all') {
            filteredProducts = filteredProducts.filter(
                (product) => product.brand === filters.brand
            );
        }

        if (filters.priceRange !== 'all') {
            const selectedPriceRange = PRICE_RANGES.find(
                (priceRange) => priceRange.value === filters.priceRange
            );

            if (selectedPriceRange) {
                filteredProducts = filteredProducts.filter((product) => {
                    const price = Number(product.price) || 0;
                    return price >= selectedPriceRange.min && price <= selectedPriceRange.max;
                });
            }
        }

        if (filters.department === 'fashion') {
            if (filters.gender !== 'all') {
                filteredProducts = filteredProducts.filter(
                    (product) => product.gender === filters.gender
                );
            }

            if (filters.size !== 'all') {
                filteredProducts = filteredProducts.filter((product) =>
                    product.sizes.includes(filters.size)
                );
            }

            if (filters.color !== 'all') {
                filteredProducts = filteredProducts.filter((product) =>
                    product.colors.includes(filters.color)
                );
            }

            if (filters.season !== 'all') {
                filteredProducts = filteredProducts.filter(
                    (product) => product.season === filters.season
                );
            }

            if (filters.occasion !== 'all') {
                filteredProducts = filteredProducts.filter(
                    (product) => product.occasion === filters.occasion
                );
            }

            if (filters.styleTag !== 'all') {
                filteredProducts = filteredProducts.filter((product) =>
                    product.styleTags.includes(filters.styleTag)
                );
            }
        }

        if (!hasFiltersApplied && isLandingView) {
            const uniqueCategories = new Set();
            const highlightProducts = [];

            for (const product of filteredProducts) {
                if (!uniqueCategories.has(product.category)) {
                    uniqueCategories.add(product.category);
                    highlightProducts.push(product);
                }

                if (highlightProducts.length >= 12) {
                    break;
                }
            }

            return highlightProducts;
        }

        return filteredProducts;
    }, [filters, hasFiltersApplied, imageSearchActive, imageSearchProducts, isLandingView, keyword, normalizedProducts]);

    const sectionTitle = useMemo(() => {
        if (imageSearchActive) {
            return 'Image search results';
        }

        if (keyword) {
            return `Results for "${keyword}"`;
        }

        if (!hasFiltersApplied && isLandingView) {
            return 'Marketplace Highlights';
        }

        if (filters.category !== 'all') {
            return `${filters.category} Collection`;
        }

        if (filters.department === 'fashion') {
            return 'Fashion Collection';
        }

        if (filters.department === 'electronics') {
            return 'Electronics Collection';
        }

        return 'All Products';
    }, [filters.category, filters.department, hasFiltersApplied, imageSearchActive, isLandingView, keyword]);

    const handleImageSearchFileChange = (event) => {
        const file = event.target.files?.[0] || null;

        if (!file) {
            setImageSearchFile(null);
            return;
        }

        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
        if (!allowedTypes.has(file.type)) {
            setImageSearchError('Only JPEG, PNG, or WebP images are allowed.');
            setImageSearchFile(null);
            setImageSearchResult(null);
            setImageSearchActive(false);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setImageSearchError('Image must be 5MB or less.');
            setImageSearchFile(null);
            setImageSearchResult(null);
            setImageSearchActive(false);
            return;
        }

        setImageSearchError('');
        setImageSearchFile(file);
        setImageSearchResult(null);
        setImageSearchActive(false);
    };

    const handleClearImageSearch = () => {
        setImageSearchFile(null);
        setImageSearchPreview('');
        setImageSearchLoading(false);
        setImageSearchError('');
        setImageSearchResult(null);
        setImageSearchActive(false);
    };

    const handleSubmitImageSearch = async () => {
        if (!imageSearchFile || imageSearchLoading) {
            return;
        }

        const formData = new FormData();
        formData.append('image', imageSearchFile);

        try {
            setImageSearchLoading(true);
            setImageSearchError('');

            const { data } = await api.post('/api/recommendations/image-search', formData);

            setImageSearchResult(data);
            setImageSearchActive(true);
            setIsLandingView(false);

            window.setTimeout(() => {
                document
                    .getElementById('product-display-section')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
        } catch (requestError) {
            setImageSearchResult(null);
            setImageSearchActive(false);
            setImageSearchError(
                requestError.response?.data?.message || 'Could not analyze that image right now.'
            );
        } finally {
            setImageSearchLoading(false);
        }
    };

    const updateFilter = (key, value) => {
        setIsLandingView(false);
        setFilters((currentFilters) => ({
            ...currentFilters,
            [key]: value,
            ...(key === 'department'
                ? {
                    category: 'all',
                    brand: 'all',
                    gender: 'all',
                    size: 'all',
                    color: 'all',
                    season: 'all',
                    occasion: 'all',
                    styleTag: 'all',
                }
                : {}),
            ...(key === 'category'
                ? {
                    brand: 'all',
                    gender: 'all',
                    size: 'all',
                    color: 'all',
                    season: 'all',
                    occasion: 'all',
                    styleTag: 'all',
                }
                : {}),
            ...(key === 'brand'
                ? {
                    gender: 'all',
                    size: 'all',
                    color: 'all',
                    season: 'all',
                    occasion: 'all',
                    styleTag: 'all',
                }
                : {}),
        }));
    };

    const resetFilters = () => {
        setKeyword('');
        setFilters(DEFAULT_FILTERS);
        setIsLandingView(true);
        navigate('/');
    };

    const handleBrowseCategories = (event) => {
        event.preventDefault();
        setIsLandingView(false);
        setFilters(DEFAULT_FILTERS);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}>
                <h2>Loading Products...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="container"
                style={{ paddingTop: '6rem', textAlign: 'center', color: 'var(--accent-1)' }}
            >
                <h2>Error: {error}</h2>
            </div>
        );
    }

    return (
        <div className="home-page animate-fade-in">
            {isLandingView && !keyword && (
                <section className="hero-section full-width-hero">
                    <div className="hero-content">
                        <FadeInSection delay={0}>
                            <div className="badge-pill">
                                <Sparkles size={16} className="text-accent-1" />
                                <span>Mixed marketplace for electronics and fashion</span>
                            </div>
                        </FadeInSection>

                        <FadeInSection delay={200}>
                            <h1 className="hero-title">
                                Technology and style, <br />
                                <span className="text-gradient">side by side.</span>
                            </h1>
                        </FadeInSection>

                        <FadeInSection delay={400}>
                            <p className="hero-subtitle">
                                Discover laptops, headphones, sneakers, festive wear, and everyday essentials
                                in one curated Quad Tech marketplace.
                            </p>
                        </FadeInSection>

                        <FadeInSection delay={600}>
                            <div className="hero-actions">
                                <button
                                    className="btn btn-primary btn-large"
                                    onClick={() =>
                                        document
                                            .getElementById('product-display-section')
                                            .scrollIntoView({ behavior: 'smooth' })
                                    }
                                >
                                    Shop Marketplace
                                </button>
                                <button className="btn btn-outline btn-large" onClick={handleBrowseCategories}>
                                    Browse Filters <Filter size={18} />
                                </button>
                            </div>
                        </FadeInSection>
                    </div>

                    <div className="hero-decoration">
                        <div className="blob blob-1"></div>
                        <div className="blob blob-2"></div>
                    </div>
                </section>
            )}

            <section className="container">
                <FadeInSection>
                    <RecommendedForYou />
                </FadeInSection>
            </section>

            <section
                id="product-display-section"
                className="featured-section container"
                style={{
                    scrollMarginTop: '100px',
                    paddingTop: !isLandingView || keyword ? '3rem' : '0',
                }}
            >
                <FadeInSection>
                    <div className="section-header">
                        <h2>{sectionTitle}</h2>
                        <p>
                            {imageSearchActive
                                ? imageSearchResult?.message || 'Found products similar to your image.'
                                : 'Browse the full mix of electronics and fashion with safe optional filters.'}
                        </p>
                    </div>

                    <div className="marketplace-filter-panel glass">
                        <ImageProductSearch
                            imageSearchFile={imageSearchFile}
                            imageSearchPreview={imageSearchPreview}
                            imageSearchLoading={imageSearchLoading}
                            imageSearchError={imageSearchError}
                            imageSearchResult={imageSearchResult}
                            imageSearchActive={imageSearchActive}
                            onFileChange={handleImageSearchFileChange}
                            onSubmit={handleSubmitImageSearch}
                            onClear={handleClearImageSearch}
                        />

                        <div className="department-pill-row">
                            {DEPARTMENT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    className={`department-pill ${filters.department === option.value ? 'active' : ''}`}
                                    onClick={() => updateFilter('department', option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="filter-grid">
                            <label className="filter-field">
                                <span>Category</span>
                                <select
                                    value={filters.category}
                                    onChange={(event) => updateFilter('category', event.target.value)}
                                >
                                    <option value="all">All Categories</option>
                                    {availableCategories.map((category) => (
                                        <option key={category} value={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="filter-field">
                                <span>Brand</span>
                                <select
                                    value={filters.brand}
                                    onChange={(event) => updateFilter('brand', event.target.value)}
                                >
                                    <option value="all">All Brands</option>
                                    {availableBrands.map((brand) => (
                                        <option key={brand} value={brand}>
                                            {brand}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="filter-field">
                                <span>Price</span>
                                <select
                                    value={filters.priceRange}
                                    onChange={(event) => updateFilter('priceRange', event.target.value)}
                                >
                                    {PRICE_RANGES.map((priceRange) => (
                                        <option key={priceRange.value} value={priceRange.value}>
                                            {priceRange.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>



                        {filters.department === 'fashion' && (
                            <div className="fashion-filter-grid">
                                <label className="filter-field">
                                    <span>Gender</span>
                                    <select
                                        value={filters.gender}
                                        onChange={(event) => updateFilter('gender', event.target.value)}
                                    >
                                        <option value="all">All Genders</option>
                                        {fashionFilterOptions.genders.map((gender) => (
                                            <option key={gender} value={gender}>
                                                {gender}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="filter-field">
                                    <span>Size</span>
                                    <select
                                        value={filters.size}
                                        onChange={(event) => updateFilter('size', event.target.value)}
                                    >
                                        <option value="all">All Sizes</option>
                                        {fashionFilterOptions.sizes.map((size) => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="filter-field">
                                    <span>Color</span>
                                    <select
                                        value={filters.color}
                                        onChange={(event) => updateFilter('color', event.target.value)}
                                    >
                                        <option value="all">All Colors</option>
                                        {fashionFilterOptions.colors.map((color) => (
                                            <option key={color} value={color}>
                                                {color}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="filter-field">
                                    <span>Season</span>
                                    <select
                                        value={filters.season}
                                        onChange={(event) => updateFilter('season', event.target.value)}
                                    >
                                        <option value="all">All Seasons</option>
                                        {fashionFilterOptions.seasons.map((season) => (
                                            <option key={season} value={season}>
                                                {season}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="filter-field">
                                    <span>Occasion</span>
                                    <select
                                        value={filters.occasion}
                                        onChange={(event) => updateFilter('occasion', event.target.value)}
                                    >
                                        <option value="all">All Occasions</option>
                                        {fashionFilterOptions.occasions.map((occasion) => (
                                            <option key={occasion} value={occasion}>
                                                {occasion}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="filter-field">
                                    <span>Style Tag</span>
                                    <select
                                        value={filters.styleTag}
                                        onChange={(event) => updateFilter('styleTag', event.target.value)}
                                    >
                                        <option value="all">All Style Tags</option>
                                        {fashionFilterOptions.styleTags.map((styleTag) => (
                                            <option key={styleTag} value={styleTag}>
                                                {styleTag}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        )}
                    </div>
                </FadeInSection>

                <div className="products-grid">
                    {displayedProducts.length > 0 ? (
                        displayedProducts.map((product, index) => {
                            const fashionMeta = buildFashionMetaLine(product);
                            const departmentLabel = getDepartmentLabel(product.department);
                            const stockLabel = getStockStatusLabel(product.countInStock);

                            return (
                                <FadeInSection key={product._id} delay={0.05 * (index % 10)}>
                                    <Link to={`/product/${product._id}`} className="product-card glass" style={{ position: 'relative' }}>
                                        <button 
                                            onClick={(e) => handleAddToWishlist(e, product._id)}
                                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, color: 'var(--accent-1)' }}
                                            title="Add to wishlist"
                                        >
                                            <Heart size={16} />
                                        </button>
                                        <div className="product-image">
                                            <div className="product-badge-stack">
                                                <span className={`product-badge badge-${product.department}`}>
                                                    {departmentLabel}
                                                </span>
                                                {product.isNewArrival && (
                                                    <span className="product-badge badge-new">New Arrival</span>
                                                )}
                                                {product.isSponsored && (
                                                    <span className="product-badge badge-sponsored">Sponsored</span>
                                                )}
                                                {product.countInStock === 0 && (
                                                    <span className="product-badge badge-out">Out of Stock</span>
                                                )}
                                                {product.countInStock > 0 && product.countInStock <= 5 && (
                                                    <span className="product-badge badge-low">Low Stock</span>
                                                )}
                                            </div>
                                            <img src={product.image} alt={product.name} />
                                        </div>
                                        <div className="product-info">
                                            <div className="product-topline">
                                                <span className="brand-label">{product.brand}</span>
                                                {typeof product.rating === 'number' && (
                                                    <span className="rating-pill">
                                                        {product.rating.toFixed(1)} ★
                                                    </span>
                                                )}
                                            </div>
                                            <h3>{product.name}</h3>
                                            <p className="product-category-text">{product.category}</p>
                                            {fashionMeta && (
                                                <p className="fashion-meta-line">{fashionMeta}</p>
                                            )}
                                            <div className="product-card-footer">
                                                <p className="price">{formatCurrency(product.price)}</p>
                                                <span
                                                    className={`stock-pill ${
                                                        stockLabel === 'Out of Stock'
                                                            ? 'stock-out'
                                                            : stockLabel === 'Low Stock'
                                                                ? 'stock-low'
                                                                : 'stock-in'
                                                    }`}
                                                >
                                                    {stockLabel}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </FadeInSection>
                            );
                        })
                    ) : (
                        <div
                            className="no-results container animate-fade-in"
                            style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0' }}
                        >
                            <div className="no-results-icon" style={{ marginBottom: '1.5rem', opacity: 0.5 }}>
                                <Search size={64} />
                            </div>
                            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                                {imageSearchActive ? 'No similar products found' : 'No results found'}
                            </h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                                {imageSearchActive
                                    ? 'We could not find products close to this image right now. Try a clearer photo or remove image search to browse normally.'
                                    : 'No products matched the current search or filters. Try another department, category, or fashion attribute.'}
                            </p>
                            <button
                                className="btn btn-outline"
                                onClick={imageSearchActive ? handleClearImageSearch : resetFilters}
                            >
                                {imageSearchActive ? 'Clear Image Search' : 'Clear Filters'}
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {isLandingView && (
                <section className="category-banner container">
                    <FadeInSection>
                        <div className="banner-content glass">
                            <h2>From flagship gadgets to everyday fits.</h2>
                            <p>Use the department and category filters to move between electronics and fashion without leaving the same storefront.</p>
                            <button className="btn btn-secondary" onClick={handleBrowseCategories}>
                                Browse Marketplace
                            </button>
                        </div>
                    </FadeInSection>
                </section>
            )}
        </div>
    );
};

export default HomePage;
