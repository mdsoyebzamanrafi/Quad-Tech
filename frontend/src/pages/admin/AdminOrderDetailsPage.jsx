import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../../utils/api';
import {
    ORDER_STATUSES,
    PAYMENT_STATUSES,
    formatDateTime,
    formatMoney,
    getErrorMessage,
    labelize,
    shortId,
    statusTone,
} from '../../utils/adminUtils';

const AdminOrderDetailsPage = () => {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [statusDraft, setStatusDraft] = useState('');
    const [paymentDraft, setPaymentDraft] = useState('');
    const [statusNote, setStatusNote] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [adminNoteDraft, setAdminNoteDraft] = useState('');

    const customer = useMemo(() => {
        if (!order) return {};
        return typeof order.user === 'object' && order.user ? order.user : {};
    }, [order]);

    const fetchOrder = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const { data } = await api.get(`/api/orders/admin/${id}`);
            setOrder(data);
            setStatusDraft(data.orderStatus || '');
            setPaymentDraft(data.paymentStatus || '');
            setAdminNoteDraft(data.adminNote || '');
        } catch (fetchError) {
            setError(getErrorMessage(fetchError, 'Failed to load order'));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    const commitOrderStatus = async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!statusDraft || statusDraft === order?.orderStatus) return;

        if (!window.confirm('This order status change may trigger backend lifecycle side effects. Continue?')) {
            return;
        }

        setSaving('status');
        setError('');
        setSuccess('');

        try {
            const body = { orderStatus: statusDraft };
            if (statusNote.trim()) body.note = statusNote.trim();
            const { data } = await api.patch(`/api/orders/admin/${id}/status`, body);
            setOrder(data);
            setStatusDraft(data.orderStatus || '');
            setPaymentDraft(data.paymentStatus || '');
            setAdminNoteDraft(data.adminNote || '');
            setStatusNote('');
            setSuccess('Order status updated.');
        } catch (statusError) {
            setError(getErrorMessage(statusError, 'Failed to update order status'));
        } finally {
            setSaving('');
        }
    };

    const commitPaymentStatus = async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!paymentDraft || paymentDraft === order?.paymentStatus) return;

        if (!window.confirm('This payment status change may trigger backend payment lifecycle behavior. Continue?')) {
            return;
        }

        setSaving('payment');
        setError('');
        setSuccess('');

        try {
            const body = { paymentStatus: paymentDraft };
            if (paymentNote.trim()) body.note = paymentNote.trim();
            const { data } = await api.patch(`/api/orders/admin/${id}/payment-status`, body);
            setOrder(data);
            setStatusDraft(data.orderStatus || '');
            setPaymentDraft(data.paymentStatus || '');
            setAdminNoteDraft(data.adminNote || '');
            setPaymentNote('');
            setSuccess('Payment status updated.');
        } catch (paymentError) {
            setError(getErrorMessage(paymentError, 'Failed to update payment status'));
        } finally {
            setSaving('');
        }
    };

    const commitAdminNote = async (event) => {
        event.preventDefault();
        if (saving) return;
        const note = adminNoteDraft.trim();
        if (!note) {
            setError('Admin note cannot be empty.');
            return;
        }

        setSaving('note');
        setError('');
        setSuccess('');

        try {
            const { data } = await api.patch(`/api/orders/admin/${id}/admin-note`, { adminNote: note });
            setOrder(data);
            setAdminNoteDraft(data.adminNote || '');
            setSuccess('Admin note updated.');
        } catch (noteError) {
            setError(getErrorMessage(noteError, 'Failed to update admin note'));
        } finally {
            setSaving('');
        }
    };

    if (loading) {
        return <div className="admin-card admin-empty">Loading order...</div>;
    }

    if (!order) {
        return (
            <div className="admin-card">
                {error && <div className="admin-message error">{error}</div>}
                <Link to="/admin/orders" className="admin-button secondary">Back to orders</Link>
            </div>
        );
    }

    const auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <Link to="/admin/orders" className="admin-button secondary">
                        <ArrowLeft size={17} />
                        Orders
                    </Link>
                    <h1>Order {shortId(order._id)}</h1>
                    <p>Created {formatDateTime(order.createdAt)}</p>
                </div>
                <div className="admin-actions">
                    <span className={`admin-pill ${statusTone(order.orderStatus)}`}>{labelize(order.orderStatus)}</span>
                    <span className={`admin-pill ${statusTone(order.paymentStatus)}`}>{labelize(order.paymentStatus)}</span>
                </div>
            </div>

            {error && <div className="admin-message error">{error}</div>}
            {success && <div className="admin-message success">{success}</div>}

            <div className="admin-grid">
                <div className="admin-card">
                    <h3>Customer</h3>
                    <div className="admin-detail-list">
                        <div className="admin-detail-row"><span>Name</span><strong>{customer.name || order.shippingName || 'Not set'}</strong></div>
                        <div className="admin-detail-row"><span>Email</span><strong>{customer.email || 'Not set'}</strong></div>
                        <div className="admin-detail-row"><span>Phone</span><strong>{order.shippingPhone || 'Not set'}</strong></div>
                        <div className="admin-detail-row"><span>Role</span><strong>{labelize(customer.role)}</strong></div>
                    </div>
                </div>

                <div className="admin-card">
                    <h3>Shipping</h3>
                    <div className="admin-detail-list">
                        <div className="admin-detail-row"><span>Recipient</span><strong>{order.shippingName || 'Not set'}</strong></div>
                        <div className="admin-detail-row"><span>Address</span><strong>{order.shippingAddress?.address || order.shippingAddressText || 'Not set'}</strong></div>
                        <div className="admin-detail-row"><span>City</span><strong>{order.shippingCity || order.shippingAddress?.city || 'Not set'}</strong></div>
                        <div className="admin-detail-row"><span>Country</span><strong>{order.shippingCountry || order.shippingAddress?.country || 'Not set'}</strong></div>
                    </div>
                </div>
            </div>

            <div className="admin-card">
                <h3>Items</h3>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Unit</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(order.orderItems || []).map((item) => (
                                <tr key={item._id || item.product}>
                                    <td>
                                        <div className="admin-strong">{item.name || item.productName}</div>
                                        <div className="admin-muted">{shortId(item.productId || item.product)}</div>
                                    </td>
                                    <td>{item.qty || item.quantity}</td>
                                    <td>{formatMoney(item.price ?? item.unitPrice)}</td>
                                    <td>{formatMoney(item.lineTotal ?? ((item.price ?? item.unitPrice) * (item.qty || item.quantity || 0)))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="admin-grid three">
                <div className="admin-card">
                    <h3>Totals</h3>
                    <div className="admin-detail-list">
                        <div className="admin-detail-row"><span>Gross Items</span><strong>{formatMoney(order.grossItemsPrice ?? order.subtotal ?? order.itemsPrice)}</strong></div>
                        <div className="admin-detail-row"><span>Coupon Code</span><strong>{order.coupon?.code || 'None'}</strong></div>
                        <div className="admin-detail-row"><span>Coupon Discount</span><strong>{formatMoney(order.coupon?.discountAmount)}</strong></div>
                        <div className="admin-detail-row"><span>Smart Discount Rule</span><strong>{order.smartDiscount?.ruleName || 'None'}</strong></div>
                        <div className="admin-detail-row"><span>Smart Discount</span><strong>{formatMoney(order.smartDiscount?.discountAmount)}</strong></div>
                        <div className="admin-detail-row"><span>Tokens Used</span><strong>{order.tokenDiscount?.tokensUsed || 0}</strong></div>
                        <div className="admin-detail-row"><span>Token Discount</span><strong>{formatMoney(order.tokenDiscount?.discountAmount)}</strong></div>
                        <div className="admin-detail-row"><span>Total Discount</span><strong>{formatMoney(order.totalDiscount ?? order.discount)}</strong></div>
                        <div className="admin-detail-row"><span>Net Items</span><strong>{formatMoney(order.netItemsPrice)}</strong></div>
                        <div className="admin-detail-row"><span>Tax</span><strong>{formatMoney(order.tax ?? order.taxPrice)}</strong></div>
                        <div className="admin-detail-row"><span>Shipping</span><strong>{formatMoney(order.shippingFee ?? order.shippingPrice)}</strong></div>
                        <div className="admin-detail-row"><span>Tokens Earned</span><strong>{order.rewardTokensEarned || 0}</strong></div>
                        <div className="admin-detail-row"><span>Total</span><strong>{formatMoney(order.total ?? order.totalPrice)}</strong></div>
                    </div>
                </div>

                <form className="admin-card" onSubmit={commitOrderStatus}>
                    <h3>Order Status</h3>
                    <div className="admin-field">
                        <label htmlFor="order-status-update">Status</label>
                        <select
                            id="order-status-update"
                            className="admin-select"
                            value={statusDraft}
                            onChange={(event) => setStatusDraft(event.target.value)}
                            disabled={Boolean(saving)}
                        >
                            {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>{labelize(status)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="admin-field">
                        <label htmlFor="status-note">Note</label>
                        <input id="status-note" className="admin-input" value={statusNote} onChange={(event) => setStatusNote(event.target.value)} disabled={Boolean(saving)} />
                    </div>
                    <button className="admin-button" disabled={Boolean(saving) || statusDraft === order.orderStatus}>
                        <Save size={17} />
                        {saving === 'status' ? 'Saving...' : 'Update'}
                    </button>
                </form>

                <form className="admin-card" onSubmit={commitPaymentStatus}>
                    <h3>Payment Status</h3>
                    <div className="admin-field">
                        <label htmlFor="payment-status-update">Payment</label>
                        <select
                            id="payment-status-update"
                            className="admin-select"
                            value={paymentDraft}
                            onChange={(event) => setPaymentDraft(event.target.value)}
                            disabled={Boolean(saving)}
                        >
                            {PAYMENT_STATUSES.map((status) => (
                                <option key={status} value={status}>{labelize(status)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="admin-field">
                        <label htmlFor="payment-note">Note</label>
                        <input id="payment-note" className="admin-input" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} disabled={Boolean(saving)} />
                    </div>
                    <button className="admin-button" disabled={Boolean(saving) || paymentDraft === order.paymentStatus}>
                        <Save size={17} />
                        {saving === 'payment' ? 'Saving...' : 'Update'}
                    </button>
                </form>
            </div>

            <form className="admin-card" onSubmit={commitAdminNote}>
                <h3>Admin Note</h3>
                <textarea
                    className="admin-textarea"
                    value={adminNoteDraft}
                    onChange={(event) => setAdminNoteDraft(event.target.value)}
                    placeholder="Internal order note"
                    disabled={Boolean(saving)}
                />
                <div className="admin-actions" style={{ marginTop: '0.75rem' }}>
                    <button className="admin-button" disabled={Boolean(saving) || !adminNoteDraft.trim()}>
                        <Save size={17} />
                        {saving === 'note' ? 'Saving...' : 'Save note'}
                    </button>
                </div>
            </form>

            <div className="admin-card">
                <h3>Audit Trail</h3>
                {auditTrail.length === 0 ? (
                    <div className="admin-empty">No audit entries returned.</div>
                ) : (
                    auditTrail.map((entry) => (
                        <div className="admin-audit-item" key={entry._id || `${entry.action}-${entry.createdAt}`}>
                            <div>
                                <strong>{labelize(entry.action)}</strong>
                                <span className="admin-muted"> | {formatDateTime(entry.createdAt)} | {labelize(entry.actorRole)}</span>
                            </div>
                            {entry.note && <div>{entry.note}</div>}
                            <pre className="admin-code">{JSON.stringify({ oldValue: entry.oldValue, newValue: entry.newValue }, null, 2)}</pre>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminOrderDetailsPage;
