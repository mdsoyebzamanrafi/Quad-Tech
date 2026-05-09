import { useCurrency } from '../../context/CurrencyContext';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Power, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import { getErrorMessage } from '../../utils/adminUtils';

const getStockStatus = (countInStock) => {
    const stock = Number(countInStock ?? 0);

    if (stock === 0) {
        return { label: 'Out of Stock', tone: 'danger' };
    }

    if (stock <= 5) {
        return { label: 'Low Stock', tone: 'warning' };
    }

    return { label: 'In Stock', tone: 'success' };
};

const isProductActive = (product) => product?.isActive !== false;

const AdminProductsPage = () => {
    const { formatCurrency } = useCurrency();
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const filters = useMemo(() => ({
        keyword: searchParams.get('keyword') || '',
        isActive: searchParams.get('isActive') || '',
        stockStatus: searchParams.get('stockStatus') || '',
        limit: searchParams.get('limit') || '10',
        pageNumber: searchParams.get('pageNumber') || '1',
    }), [searchParams]);

    const [draft, setDraft] = useState(filters);

    useEffect(() => {
        setDraft(filters);
    }, [filters]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const params = {
                pageNumber: filters.pageNumber,
                limit: filters.limit,
                keyword: filters.keyword || undefined,
                isActive: filters.isActive || undefined,
                stockStatus: filters.stockStatus || undefined,
            };

            const { data } = await api.get('/api/products/admin', { params });
            setProducts(data.products || []);
            setPagination({
                page: data.page || 1,
                pages: data.pages || 1,
                total: data.total || 0,
                limit: Number(filters.limit) || 10,
            });
        } catch (fetchError) {
            setProducts([]);
            setPagination({ page: 1, pages: 1, total: 0, limit: Number(filters.limit) || 10 });
            setError(getErrorMessage(fetchError, 'Failed to load products'));
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const applyFilters = (event) => {
        event.preventDefault();
        const next = new URLSearchParams();

        if (draft.keyword.trim()) next.set('keyword', draft.keyword.trim());
        if (draft.isActive) next.set('isActive', draft.isActive);
        if (draft.stockStatus) next.set('stockStatus', draft.stockStatus);
        if (draft.limit) next.set('limit', draft.limit);
        next.set('pageNumber', '1');

        setSearchParams(next);
        setSuccess('');
    };

    const resetFilters = () => {
        setDraft({
            keyword: '',
            isActive: '',
            stockStatus: '',
            limit: '10',
            pageNumber: '1',
        });
        setSearchParams({ pageNumber: '1', limit: '10' });
        setSuccess('');
    };

    const goToPage = (pageNumber) => {
        const next = new URLSearchParams(searchParams);
        next.set('pageNumber', String(pageNumber));
        if (!next.get('limit')) next.set('limit', draft.limit || '10');
        setSearchParams(next);
    };

    const deactivateHandler = async (product) => {
        if (!window.confirm(`Deactivate ${product.name}?`)) {
            return;
        }

        setActionLoading(product._id);
        setError('');
        setSuccess('');

        try {
            const { data } = await api.patch(`/api/products/admin/${product._id}/deactivate`);
            setSuccess(data.message || 'Product deactivated.');
            await fetchProducts();
        } catch (actionError) {
            setError(getErrorMessage(actionError, 'Failed to deactivate product'));
        } finally {
            setActionLoading('');
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <h1>Products</h1>
                    <p>Search, filter, edit, and deactivate catalog items.</p>
                </div>
                <div className="admin-actions">
                    <button className="admin-button secondary" onClick={fetchProducts} disabled={loading}>
                        <RotateCcw size={17} />
                        Refresh
                    </button>
                    <Link to="/admin/products/new" className="admin-button">
                        <Plus size={17} />
                        Create Product
                    </Link>
                </div>
            </div>

            <div className="admin-card">
                <form className="admin-toolbar" onSubmit={applyFilters}>
                    <div className="admin-field">
                        <label htmlFor="product-search">Search</label>
                        <input
                            id="product-search"
                            className="admin-input"
                            value={draft.keyword}
                            onChange={(event) => setDraft((current) => ({ ...current, keyword: event.target.value }))}
                            placeholder="Search by product name"
                        />
                    </div>

                    <div className="admin-field">
                        <label htmlFor="active-filter">Status</label>
                        <select
                            id="active-filter"
                            className="admin-select"
                            value={draft.isActive}
                            onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.value }))}
                        >
                            <option value="">All</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>

                    <div className="admin-field">
                        <label htmlFor="stock-filter">Stock Status</label>
                        <select
                            id="stock-filter"
                            className="admin-select"
                            value={draft.stockStatus}
                            onChange={(event) => setDraft((current) => ({ ...current, stockStatus: event.target.value }))}
                        >
                            <option value="">All</option>
                            <option value="in_stock">In Stock</option>
                            <option value="low_stock">Low Stock</option>
                            <option value="out_of_stock">Out of Stock</option>
                        </select>
                    </div>

                    <div className="admin-field">
                        <label htmlFor="limit-filter">Per Page</label>
                        <select
                            id="limit-filter"
                            className="admin-select"
                            value={draft.limit}
                            onChange={(event) => setDraft((current) => ({ ...current, limit: event.target.value }))}
                        >
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                        </select>
                    </div>

                    <div className="admin-actions">
                        <button type="submit" className="admin-button" disabled={loading}>
                            Apply
                        </button>
                        <button type="button" className="admin-button secondary" onClick={resetFilters} disabled={loading}>
                            Reset
                        </button>
                    </div>
                </form>

                {error && <div className="admin-message error">{error}</div>}
                {success && <div className="admin-message success">{success}</div>}

                {loading ? (
                    <div className="admin-empty">Loading products...</div>
                ) : products.length === 0 ? (
                    <div className="admin-empty">No products match these filters.</div>
                ) : (
                    <>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Image</th>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Brand</th>
                                        <th>Price</th>
                                        <th>Stock</th>
                                        <th>Stock Status</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) => {
                                        const stockStatus = getStockStatus(product.countInStock);
                                        const active = isProductActive(product);

                                        return (
                                            <tr key={product._id}>
                                                <td>
                                                    <img
                                                        src={product.image}
                                                        alt={product.name}
                                                        className="admin-product-thumb"
                                                    />
                                                </td>
                                                <td>
                                                    <div className="admin-strong">{product.name}</div>
                                                    <div className="admin-muted">{product.description || 'No description'}</div>
                                                </td>
                                                <td>{product.category || 'Not set'}</td>
                                                <td>{product.brand || 'Not set'}</td>
                                                <td>{formatCurrency(product.price)}</td>
                                                <td>{product.countInStock ?? 0}</td>
                                                <td>
                                                    <span className={`admin-pill ${stockStatus.tone}`}>
                                                        {stockStatus.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`admin-pill ${active ? 'success' : 'danger'}`}>
                                                        {active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="admin-actions">
                                                        <Link
                                                            className="admin-icon-link"
                                                            to={`/admin/products/${product._id}`}
                                                            aria-label="Edit product"
                                                        >
                                                            <Pencil size={17} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="admin-icon-button danger"
                                                            onClick={() => deactivateHandler(product)}
                                                            disabled={!active || actionLoading === product._id}
                                                            aria-label="Deactivate product"
                                                        >
                                                            <Power size={17} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="admin-pagination">
                            <button
                                className="admin-button secondary"
                                disabled={loading || pagination.page <= 1}
                                onClick={() => goToPage(pagination.page - 1)}
                            >
                                Previous
                            </button>
                            <span>Page {pagination.page} of {pagination.pages} | {pagination.total} products</span>
                            <button
                                className="admin-button secondary"
                                disabled={loading || pagination.page >= pagination.pages}
                                onClick={() => goToPage(pagination.page + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminProductsPage;
