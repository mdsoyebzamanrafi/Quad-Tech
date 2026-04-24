import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Filter, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import {
    ORDER_STATUSES,
    PAYMENT_STATUSES,
    formatDate,
    formatMoney,
    getErrorMessage,
    labelize,
    shortId,
    statusTone,
} from '../../utils/adminUtils';

const AdminOrdersPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const filters = useMemo(() => ({
        search: searchParams.get('search') || '',
        status: searchParams.get('status') || '',
        paymentStatus: searchParams.get('paymentStatus') || '',
        dateFrom: searchParams.get('dateFrom') || '',
        dateTo: searchParams.get('dateTo') || '',
        page: searchParams.get('page') || '1',
    }), [searchParams]);

    const [draft, setDraft] = useState(filters);

    useEffect(() => {
        setDraft(filters);
    }, [filters]);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            setError('');

            try {
                const params = {
                    page: filters.page,
                    limit: 20,
                    search: filters.search || undefined,
                    status: filters.status || undefined,
                    paymentStatus: filters.paymentStatus || undefined,
                    dateFrom: filters.dateFrom ? `${filters.dateFrom}T00:00:00.000Z` : undefined,
                    dateTo: filters.dateTo ? `${filters.dateTo}T23:59:59.999Z` : undefined,
                };
                const { data } = await api.get('/api/orders/admin', { params });
                setOrders(data.items || []);
                setPagination(data.pagination || { page: 1, pages: 1, total: 0, limit: 20 });
            } catch (fetchError) {
                setOrders([]);
                setPagination({ page: 1, pages: 1, total: 0, limit: 20 });
                setError(getErrorMessage(fetchError, 'Failed to load admin orders'));
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [filters]);

    const applyFilters = (event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        ['search', 'status', 'paymentStatus', 'dateFrom', 'dateTo'].forEach((key) => {
            if (draft[key]) next.set(key, draft[key]);
        });
        next.set('page', '1');
        setSearchParams(next);
    };

    const resetFilters = () => {
        setSearchParams({ page: '1' });
    };

    const goToPage = (page) => {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(page));
        setSearchParams(next);
    };

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <h1>Orders</h1>
                    <p>Review customer orders, payment state, and fulfillment progress.</p>
                </div>
            </div>

            <div className="admin-card">
                <form className="admin-toolbar" onSubmit={applyFilters}>
                    <div className="admin-field">
                        <label htmlFor="order-search">Search</label>
                        <input
                            id="order-search"
                            className="admin-input"
                            value={draft.search}
                            onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
                            placeholder="Order, customer, phone"
                        />
                    </div>

                    <div className="admin-field">
                        <label htmlFor="order-status">Status</label>
                        <select
                            id="order-status"
                            className="admin-select"
                            value={draft.status}
                            onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                        >
                            <option value="">All statuses</option>
                            {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>{labelize(status)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="admin-field">
                        <label htmlFor="payment-status">Payment</label>
                        <select
                            id="payment-status"
                            className="admin-select"
                            value={draft.paymentStatus}
                            onChange={(event) => setDraft((current) => ({ ...current, paymentStatus: event.target.value }))}
                        >
                            <option value="">All payments</option>
                            {PAYMENT_STATUSES.map((status) => (
                                <option key={status} value={status}>{labelize(status)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="admin-field">
                        <label htmlFor="date-from">From</label>
                        <input
                            id="date-from"
                            type="date"
                            className="admin-input"
                            value={draft.dateFrom}
                            onChange={(event) => setDraft((current) => ({ ...current, dateFrom: event.target.value }))}
                        />
                    </div>

                    <div className="admin-field">
                        <label htmlFor="date-to">To</label>
                        <input
                            id="date-to"
                            type="date"
                            className="admin-input"
                            value={draft.dateTo}
                            onChange={(event) => setDraft((current) => ({ ...current, dateTo: event.target.value }))}
                        />
                    </div>

                    <div className="admin-actions">
                        <button type="submit" className="admin-button" aria-label="Apply filters" disabled={loading}>
                            <Filter size={17} />
                        </button>
                        <button type="button" className="admin-icon-button" onClick={resetFilters} aria-label="Reset filters" disabled={loading}>
                            <RotateCcw size={17} />
                        </button>
                    </div>
                </form>

                {error && <div className="admin-message error">{error}</div>}

                {loading ? (
                    <div className="admin-empty">Loading orders...</div>
                ) : orders.length === 0 ? (
                    <div className="admin-empty">No orders match these filters.</div>
                ) : (
                    <>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Customer</th>
                                        <th>Total</th>
                                        <th>Status</th>
                                        <th>Payment</th>
                                        <th>Created</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => (
                                        <tr key={order._id}>
                                            <td>
                                                <span className="admin-strong">{shortId(order._id)}</span>
                                            </td>
                                            <td>
                                                <div className="admin-strong">{order.user?.name || order.shippingName || 'Guest'}</div>
                                                <div className="admin-muted">{order.user?.email || order.shippingPhone || 'No contact'}</div>
                                            </td>
                                            <td>{formatMoney(order.total ?? order.totalPrice)}</td>
                                            <td>
                                                <span className={`admin-pill ${statusTone(order.orderStatus)}`}>
                                                    {labelize(order.orderStatus)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`admin-pill ${statusTone(order.paymentStatus)}`}>
                                                    {labelize(order.paymentStatus)}
                                                </span>
                                            </td>
                                            <td>{formatDate(order.createdAt)}</td>
                                            <td>
                                                <Link className="admin-icon-link" to={`/admin/orders/${order._id}`} aria-label="View order">
                                                    <Eye size={17} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
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
                            <span>Page {pagination.page} of {pagination.pages} | {pagination.total} orders</span>
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

export default AdminOrdersPage;
