import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import {
    formatDate,
    formatMoney,
    getErrorMessage,
    labelize,
    statusTone,
} from '../../utils/adminUtils';

const initialFormState = {
    productId: '',
    feeAmount: '',
    placement: 'both',
    durationDays: 7,
    note: '',
};

const AdminPriorityBoostsPage = () => {
    const [boosts, setBoosts] = useState([]);
    const [summary, setSummary] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [form, setForm] = useState(initialFormState);

    const loadPageData = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const [boostsResponse, summaryResponse, productsResponse] = await Promise.all([
                api.get('/api/priority-boosts'),
                api.get('/api/priority-boosts/summary'),
                api.get('/api/products/admin', {
                    params: {
                        isActive: 'true',
                        stockStatus: 'in_stock',
                        limit: 200,
                        pageNumber: 1,
                    },
                }),
            ]);

            setBoosts(Array.isArray(boostsResponse.data?.boosts) ? boostsResponse.data.boosts : []);
            setSummary(summaryResponse.data?.summary || null);
            setProducts(Array.isArray(productsResponse.data?.products) ? productsResponse.data.products : []);
        } catch (requestError) {
            setBoosts([]);
            setSummary(null);
            setProducts([]);
            setError(getErrorMessage(requestError, 'Failed to load priority boosts'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPageData();
    }, [loadPageData]);

    const updateFormField = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const createBoostHandler = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccessMessage('');

        try {
            await api.post('/api/priority-boosts', {
                productId: form.productId,
                feeAmount: Number(form.feeAmount),
                placement: form.placement,
                durationDays: Number(form.durationDays),
                note: form.note,
            });

            setSuccessMessage('Priority boost created successfully.');
            setForm(initialFormState);
            await loadPageData();
        } catch (requestError) {
            setError(getErrorMessage(requestError, 'Failed to create priority boost'));
        } finally {
            setSubmitting(false);
        }
    };

    const cancelBoostHandler = async (boostId) => {
        if (!window.confirm('Cancel this priority boost?')) {
            return;
        }

        setSubmitting(true);
        setError('');
        setSuccessMessage('');

        try {
            await api.patch(`/api/priority-boosts/${boostId}/cancel`);
            setSuccessMessage('Priority boost cancelled successfully.');
            await loadPageData();
        } catch (requestError) {
            setError(getErrorMessage(requestError, 'Failed to cancel priority boost'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <h1>Priority Boosts</h1>
                    <p>Manage category-normalized paid boosts for personal and gift recommendations.</p>
                </div>
                <div className="admin-actions">
                    <button
                        type="button"
                        className="admin-button secondary"
                        onClick={loadPageData}
                        disabled={loading || submitting}
                    >
                        <RotateCcw size={17} />
                        Refresh
                    </button>
                </div>
            </div>

            {error ? <div className="admin-message error">{error}</div> : null}
            {successMessage ? <div className="admin-message success">{successMessage}</div> : null}

            <div className="admin-grid three">
                <div className="admin-card admin-stat-card">
                    <span>Total boosts</span>
                    <strong>{Number(summary?.totalBoosts || 0)}</strong>
                </div>
                <div className="admin-card admin-stat-card">
                    <span>Active boosts</span>
                    <strong>{Number(summary?.activeBoosts || 0)}</strong>
                </div>
                <div className="admin-card admin-stat-card">
                    <span>Expired boosts</span>
                    <strong>{Number(summary?.expiredBoosts || 0)}</strong>
                </div>
                <div className="admin-card admin-stat-card">
                    <span>Cancelled boosts</span>
                    <strong>{Number(summary?.cancelledBoosts || 0)}</strong>
                </div>
                <div className="admin-card admin-stat-card">
                    <span>Total revenue</span>
                    <strong>{formatMoney(summary?.totalRevenue || 0)}</strong>
                </div>
                <div className="admin-card admin-stat-card">
                    <span>Active revenue</span>
                    <strong>{formatMoney(summary?.activeRevenue || 0)}</strong>
                </div>
            </div>

            <div className="admin-card">
                <div className="admin-page-header">
                    <div>
                        <h2>Create Priority Boost</h2>
                        <p>Boosts stay capped and only apply inside relevant recommendation categories.</p>
                    </div>
                </div>

                <form className="admin-grid" onSubmit={createBoostHandler}>
                    <div className="admin-field admin-grid-span-full">
                        <label htmlFor="priority-boost-product">Product</label>
                        <select
                            id="priority-boost-product"
                            className="admin-select"
                            value={form.productId}
                            onChange={(event) => updateFormField('productId', event.target.value)}
                            required
                        >
                            <option value="">Select a product</option>
                            {products.map((product) => (
                                <option key={product._id} value={product._id}>
                                    {product.name} | {product.category} | {formatMoney(product.price)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="admin-field">
                        <label htmlFor="priority-boost-fee">Fee Amount</label>
                        <input
                            id="priority-boost-fee"
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="admin-input"
                            value={form.feeAmount}
                            onChange={(event) => updateFormField('feeAmount', event.target.value)}
                            required
                        />
                    </div>

                    <div className="admin-field">
                        <label htmlFor="priority-boost-placement">Placement</label>
                        <select
                            id="priority-boost-placement"
                            className="admin-select"
                            value={form.placement}
                            onChange={(event) => updateFormField('placement', event.target.value)}
                        >
                            <option value="both">Both</option>
                            <option value="personal">Personal</option>
                            <option value="gift">Gift</option>
                        </select>
                    </div>

                    <div className="admin-field">
                        <label htmlFor="priority-boost-duration">Duration Days</label>
                        <input
                            id="priority-boost-duration"
                            type="number"
                            min="1"
                            step="1"
                            className="admin-input"
                            value={form.durationDays}
                            onChange={(event) => updateFormField('durationDays', event.target.value)}
                            required
                        />
                    </div>

                    <div className="admin-field admin-grid-span-full">
                        <label htmlFor="priority-boost-note">Note</label>
                        <textarea
                            id="priority-boost-note"
                            className="admin-textarea"
                            value={form.note}
                            onChange={(event) => updateFormField('note', event.target.value)}
                            placeholder="Optional internal note"
                        />
                    </div>

                    <div className="admin-actions admin-grid-span-full">
                        <button type="submit" className="admin-button" disabled={submitting || loading}>
                            <Plus size={17} />
                            {submitting ? 'Saving...' : 'Create Boost'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="admin-card">
                <div className="admin-page-header">
                    <div>
                        <h2>Existing Priority Boosts</h2>
                        <p>Newest boosts appear first.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="admin-empty">Loading priority boosts...</div>
                ) : boosts.length === 0 ? (
                    <div className="admin-empty">No priority boosts found.</div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Category</th>
                                    <th>Fee</th>
                                    <th>Placement</th>
                                    <th>Start</th>
                                    <th>End</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Seller</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {boosts.map((boost) => (
                                    <tr key={boost._id}>
                                        <td>
                                            <div className="admin-table-product">
                                                <img
                                                    src={boost.product?.image}
                                                    alt={boost.product?.name || 'Product'}
                                                    className="admin-product-thumb"
                                                />
                                                <div>
                                                    <div className="admin-strong">
                                                        {boost.product?.name || 'Unknown product'}
                                                    </div>
                                                    <div className="admin-muted">
                                                        {formatMoney(boost.product?.price || 0)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{boost.category || boost.product?.category || 'Not set'}</td>
                                        <td>{formatMoney(boost.feeAmount || 0)}</td>
                                        <td>{labelize(boost.placement)}</td>
                                        <td>{formatDate(boost.startsAt)}</td>
                                        <td>{formatDate(boost.endsAt)}</td>
                                        <td>
                                            <span className={`admin-pill ${statusTone(boost.status)}`}>
                                                {labelize(boost.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`admin-pill ${statusTone(boost.paymentStatus)}`}>
                                                {labelize(boost.paymentStatus)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="admin-strong">
                                                {boost.seller?.name || 'Unknown seller'}
                                            </div>
                                            <div className="admin-muted">
                                                {boost.seller?.email || 'No email'}
                                            </div>
                                        </td>
                                        <td>
                                            {boost.status === 'active' ? (
                                                <button
                                                    type="button"
                                                    className="admin-button danger"
                                                    onClick={() => cancelBoostHandler(boost._id)}
                                                    disabled={submitting}
                                                >
                                                    Cancel
                                                </button>
                                            ) : (
                                                <span className="admin-muted">No action</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPriorityBoostsPage;
