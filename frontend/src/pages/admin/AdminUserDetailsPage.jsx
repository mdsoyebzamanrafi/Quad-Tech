import { useCurrency } from '../../context/CurrencyContext';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
    EDITABLE_USER_STATUSES,
    USER_ROLES,
    formatDateTime,
    getErrorMessage,
    isSuperAdmin,
    labelize,
    shortId,
    statusTone,
} from '../../utils/adminUtils';

const AdminUserDetailsPage = () => {
    const { formatCurrency } = useCurrency();
    const { id } = useParams();
    const { userInfo } = useAuth();
    const canManageRoles = isSuperAdmin(userInfo);
    const [user, setUser] = useState(null);
    const [orderSummary, setOrderSummary] = useState(null);
    const [statusDraft, setStatusDraft] = useState('');
    const [roleDraft, setRoleDraft] = useState('');
    const [actionNote, setActionNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchUser = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const { data } = await api.get(`/api/users/admin/${id}`);
            setUser(data.user);
            setOrderSummary(data.orderSummary || null);
            setStatusDraft(data.user?.status || '');
            setRoleDraft(data.user?.role || '');
        } catch (fetchError) {
            setError(getErrorMessage(fetchError, 'Failed to load user'));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const commitStatus = async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!statusDraft || statusDraft === user?.status) return;

        if (statusDraft !== 'active' && !window.confirm('This will restrict the user account. Continue?')) {
            return;
        }

        setSaving('status');
        setError('');
        setSuccess('');

        try {
            const body = { status: statusDraft };
            if (actionNote.trim()) body.note = actionNote.trim();
            const { data } = await api.patch(`/api/users/admin/${id}/status`, body);
            setUser(data);
            setStatusDraft(data.status);
            setRoleDraft(data.role);
            setActionNote('');
            setSuccess('User status updated.');
        } catch (statusError) {
            setError(getErrorMessage(statusError, 'Failed to update user status'));
        } finally {
            setSaving('');
        }
    };

    const commitRole = async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!canManageRoles || !roleDraft || roleDraft === user?.role) return;

        if (!window.confirm('Role changes alter admin privileges. Continue?')) {
            return;
        }

        setSaving('role');
        setError('');
        setSuccess('');

        try {
            const body = { role: roleDraft };
            if (actionNote.trim()) body.note = actionNote.trim();
            const { data } = await api.patch(`/api/users/admin/${id}/role`, body);
            setUser(data);
            setStatusDraft(data.status);
            setRoleDraft(data.role);
            setActionNote('');
            setSuccess('User role updated.');
        } catch (roleError) {
            setError(getErrorMessage(roleError, 'Failed to update user role'));
        } finally {
            setSaving('');
        }
    };

    const softDeleteUser = async () => {
        if (saving) return;

        if (!window.confirm('Soft delete this user account? This is a destructive admin action.')) {
            return;
        }

        setSaving('delete');
        setError('');
        setSuccess('');

        try {
            const body = {};
            if (actionNote.trim()) body.note = actionNote.trim();
            const { data } = await api.delete(`/api/users/admin/${id}`, { data: body });
            setUser(data);
            setStatusDraft(data.status);
            setRoleDraft(data.role);
            setActionNote('');
            setSuccess('User soft deleted.');
        } catch (deleteError) {
            setError(getErrorMessage(deleteError, 'Failed to delete user'));
        } finally {
            setSaving('');
        }
    };

    if (loading) {
        return <div className="admin-card admin-empty">Loading user...</div>;
    }

    if (!user) {
        return (
            <div className="admin-card">
                {error && <div className="admin-message error">{error}</div>}
                <Link to="/admin/users" className="admin-button secondary">Back to users</Link>
            </div>
        );
    }

    const isSelf = String(userInfo?._id) === String(user._id);
    const isDeleted = user.status === 'deleted' || Boolean(user.deletedAt);

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <Link to="/admin/users" className="admin-button secondary">
                        <ArrowLeft size={17} />
                        Users
                    </Link>
                    <h1>{user.name || 'User'}</h1>
                    <p>{user.email}</p>
                </div>
                <div className="admin-actions">
                    <span className="admin-pill">{labelize(user.role)}</span>
                    <span className={`admin-pill ${statusTone(user.status)}`}>{labelize(user.status)}</span>
                </div>
            </div>

            {error && <div className="admin-message error">{error}</div>}
            {success && <div className="admin-message success">{success}</div>}

            <div className="admin-grid">
                <div className="admin-card">
                    <h3>Profile</h3>
                    <div className="admin-detail-list">
                        <div className="admin-detail-row"><span>ID</span><strong>{shortId(user._id)}</strong></div>
                        <div className="admin-detail-row"><span>Name</span><strong>{user.name || 'Not set'}</strong></div>
                        <div className="admin-detail-row"><span>Email</span><strong>{user.email}</strong></div>
                        <div className="admin-detail-row"><span>Phone</span><strong>{user.phone || 'Not set'}</strong></div>
                        <div className="admin-detail-row"><span>Verified</span><strong>{user.isVerified ? 'Yes' : 'No'}</strong></div>
                    </div>
                </div>

                <div className="admin-card">
                    <h3>Account</h3>
                    <div className="admin-detail-list">
                        <div className="admin-detail-row"><span>Role</span><strong>{labelize(user.role)}</strong></div>
                        <div className="admin-detail-row"><span>Status</span><strong>{labelize(user.status)}</strong></div>
                        <div className="admin-detail-row"><span>Last login</span><strong>{formatDateTime(user.lastLogin)}</strong></div>
                        <div className="admin-detail-row"><span>Created</span><strong>{formatDateTime(user.createdAt)}</strong></div>
                        <div className="admin-detail-row"><span>Deleted</span><strong>{formatDateTime(user.deletedAt)}</strong></div>
                    </div>
                </div>
            </div>

            <div className="admin-grid three">
                <div className="admin-card">
                    <h3>Order Summary</h3>
                    <div className="admin-detail-list">
                        <div className="admin-detail-row"><span>Total orders</span><strong>{orderSummary?.totalOrders || 0}</strong></div>
                        <div className="admin-detail-row"><span>Total spent</span><strong>{formatCurrency(orderSummary?.totalSpent)}</strong></div>
                        <div className="admin-detail-row"><span>Last order</span><strong>{formatDateTime(orderSummary?.lastOrderAt)}</strong></div>
                    </div>
                </div>

                <form className="admin-card" onSubmit={commitStatus}>
                    <h3>Status</h3>
                    <div className="admin-field">
                        <label htmlFor="user-status-update">Status</label>
                        <select
                            id="user-status-update"
                            className="admin-select"
                            value={statusDraft}
                            onChange={(event) => setStatusDraft(event.target.value)}
                            disabled={Boolean(saving) || isDeleted}
                        >
                            {EDITABLE_USER_STATUSES.map((status) => (
                                <option key={status} value={status}>{labelize(status)}</option>
                            ))}
                        </select>
                    </div>
                    <button className="admin-button" disabled={Boolean(saving) || statusDraft === user.status || isDeleted}>
                        <Save size={17} />
                        {saving === 'status' ? 'Saving...' : 'Update'}
                    </button>
                </form>

                <div className="admin-card">
                    <h3>Delete</h3>
                    <p className="admin-muted" style={{ marginBottom: '1rem' }}>
                        Soft delete keeps history but blocks normal account access.
                    </p>
                    <button
                        className="admin-button danger"
                        onClick={softDeleteUser}
                        disabled={Boolean(saving) || isDeleted || isSelf}
                    >
                        <Trash2 size={17} />
                        {saving === 'delete' ? 'Deleting...' : 'Soft delete'}
                    </button>
                </div>
            </div>

            <div className="admin-card">
                <h3>Action Note</h3>
                <textarea
                    className="admin-textarea"
                    value={actionNote}
                    onChange={(event) => setActionNote(event.target.value)}
                    placeholder="Optional note for status, role, or delete audit logs"
                    disabled={Boolean(saving)}
                />
            </div>

            {canManageRoles && (
                <form className="admin-card" onSubmit={commitRole}>
                    <h3>Role Management</h3>
                    <div className="admin-grid">
                        <div className="admin-field">
                            <label htmlFor="user-role-update">Role</label>
                            <select
                                id="user-role-update"
                                className="admin-select"
                                value={roleDraft}
                                onChange={(event) => setRoleDraft(event.target.value)}
                                disabled={Boolean(saving) || isDeleted || isSelf}
                            >
                                {USER_ROLES.map((role) => (
                                    <option key={role} value={role}>{labelize(role)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="admin-actions" style={{ alignItems: 'end' }}>
                            <button className="admin-button" disabled={Boolean(saving) || roleDraft === user.role || isDeleted || isSelf}>
                                <Save size={17} />
                                {saving === 'role' ? 'Saving...' : 'Update role'}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            <div className="admin-card">
                <h3>Recent Orders</h3>
                {!orderSummary?.recentOrders?.length ? (
                    <div className="admin-empty">No recent orders returned.</div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Total</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orderSummary.recentOrders.map((order) => (
                                    <tr key={order._id}>
                                        <td>
                                            <Link className="admin-strong" to={`/admin/orders/${order._id}`}>
                                                {shortId(order._id)}
                                            </Link>
                                        </td>
                                        <td><span className={`admin-pill ${statusTone(order.orderStatus)}`}>{labelize(order.orderStatus)}</span></td>
                                        <td><span className={`admin-pill ${statusTone(order.paymentStatus)}`}>{labelize(order.paymentStatus)}</span></td>
                                        <td>{formatCurrency(order.total)}</td>
                                        <td>{formatDateTime(order.createdAt)}</td>
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

export default AdminUserDetailsPage;
