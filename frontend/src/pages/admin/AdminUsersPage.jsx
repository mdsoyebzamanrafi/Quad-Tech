import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Filter, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import {
    USER_ROLES,
    USER_STATUSES,
    formatDate,
    getErrorMessage,
    labelize,
    statusTone,
} from '../../utils/adminUtils';

const AdminUsersPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const filters = useMemo(() => ({
        search: searchParams.get('search') || '',
        role: searchParams.get('role') || '',
        status: searchParams.get('status') || '',
        includeDeleted: searchParams.get('includeDeleted') === 'true',
        page: searchParams.get('page') || '1',
    }), [searchParams]);

    const [draft, setDraft] = useState(filters);

    useEffect(() => {
        setDraft(filters);
    }, [filters]);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            setError('');

            try {
                const params = {
                    page: filters.page,
                    limit: 20,
                    search: filters.search || undefined,
                    role: filters.role || undefined,
                    status: filters.status || undefined,
                    includeDeleted: filters.includeDeleted || filters.status === 'deleted' ? 'true' : undefined,
                };
                const { data } = await api.get('/api/users/admin', { params });
                setUsers(data.items || []);
                setPagination(data.pagination || { page: 1, pages: 1, total: 0, limit: 20 });
            } catch (fetchError) {
                setUsers([]);
                setPagination({ page: 1, pages: 1, total: 0, limit: 20 });
                setError(getErrorMessage(fetchError, 'Failed to load admin users'));
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [filters]);

    const applyFilters = (event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        ['search', 'role', 'status'].forEach((key) => {
            if (draft[key]) next.set(key, draft[key]);
        });
        if (draft.includeDeleted || draft.status === 'deleted') next.set('includeDeleted', 'true');
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
                    <h1>Users</h1>
                    <p>Manage account status and inspect customer order activity.</p>
                </div>
            </div>

            <div className="admin-card">
                <form className="admin-toolbar users" onSubmit={applyFilters}>
                    <div className="admin-field">
                        <label htmlFor="user-search">Search</label>
                        <input
                            id="user-search"
                            className="admin-input"
                            value={draft.search}
                            onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
                            placeholder="Name, email, phone"
                        />
                    </div>

                    <div className="admin-field">
                        <label htmlFor="role-filter">Role</label>
                        <select
                            id="role-filter"
                            className="admin-select"
                            value={draft.role}
                            onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
                        >
                            <option value="">All roles</option>
                            {USER_ROLES.map((role) => (
                                <option key={role} value={role}>{labelize(role)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="admin-field">
                        <label htmlFor="status-filter">Status</label>
                        <select
                            id="status-filter"
                            className="admin-select"
                            value={draft.status}
                            onChange={(event) => {
                                const status = event.target.value;
                                setDraft((current) => ({
                                    ...current,
                                    status,
                                    includeDeleted: status === 'deleted' ? true : current.includeDeleted,
                                }));
                            }}
                        >
                            <option value="">All statuses</option>
                            {USER_STATUSES.map((status) => (
                                <option key={status} value={status}>{labelize(status)}</option>
                            ))}
                        </select>
                    </div>

                    <label className="admin-field admin-checkbox-field" htmlFor="include-deleted">
                        <input
                            id="include-deleted"
                            type="checkbox"
                            checked={draft.includeDeleted}
                            onChange={(event) => setDraft((current) => ({ ...current, includeDeleted: event.target.checked }))}
                        />
                        Include deleted
                    </label>

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
                    <div className="admin-empty">Loading users...</div>
                ) : users.length === 0 ? (
                    <div className="admin-empty">No users match these filters.</div>
                ) : (
                    <>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Last Login</th>
                                        <th>Created</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user._id}>
                                            <td className="admin-strong">{user.name || 'Not set'}</td>
                                            <td>{user.email}</td>
                                            <td>{labelize(user.role)}</td>
                                            <td>
                                                <span className={`admin-pill ${statusTone(user.status)}`}>
                                                    {labelize(user.status)}
                                                </span>
                                            </td>
                                            <td>{formatDate(user.lastLogin)}</td>
                                            <td>{formatDate(user.createdAt)}</td>
                                            <td>
                                                <Link className="admin-icon-link" to={`/admin/users/${user._id}`} aria-label="View user">
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
                            <span>Page {pagination.page} of {pagination.pages} | {pagination.total} users</span>
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

export default AdminUsersPage;
