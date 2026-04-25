import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Power, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import { formatDateTime, formatMoney, getErrorMessage, labelize } from '../../utils/adminUtils';

const CouponListPage = () => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchCoupons = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const { data } = await api.get('/api/coupons');
            setCoupons(data || []);
        } catch (fetchError) {
            setError(getErrorMessage(fetchError, 'Failed to load coupons'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCoupons();
    }, [fetchCoupons]);

    const disableCouponHandler = async (couponId) => {
        if (!window.confirm('Disable this coupon?')) {
            return;
        }

        setActionLoading(couponId);
        setError('');
        setSuccess('');

        try {
            const { data } = await api.delete(`/api/coupons/${couponId}`);
            setSuccess(data.message || 'Coupon disabled.');
            await fetchCoupons();
        } catch (actionError) {
            setError(getErrorMessage(actionError, 'Failed to disable coupon'));
        } finally {
            setActionLoading('');
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <h1>Coupons</h1>
                    <p>Create, review, and disable checkout discounts.</p>
                </div>
                <div className="admin-actions">
                    <button className="admin-button secondary" onClick={fetchCoupons} disabled={loading}>
                        <RotateCcw size={17} />
                        Refresh
                    </button>
                    <Link to="/admin/coupon/create" className="admin-button">
                        <Plus size={17} />
                        Create coupon
                    </Link>
                </div>
            </div>

            <div className="admin-card">
                {error && <div className="admin-message error">{error}</div>}
                {success && <div className="admin-message success">{success}</div>}

                {loading ? (
                    <div className="admin-empty">Loading coupons...</div>
                ) : coupons.length === 0 ? (
                    <div className="admin-empty">No coupons found.</div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Type</th>
                                    <th>Value</th>
                                    <th>Min Order</th>
                                    <th>Max Discount</th>
                                    <th>Used</th>
                                    <th>Usage Limit</th>
                                    <th>Expires</th>
                                    <th>Active</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.map((coupon) => (
                                    <tr key={coupon._id}>
                                        <td className="admin-strong">{coupon.code}</td>
                                        <td>{labelize(coupon.discountType)}</td>
                                        <td>
                                            {coupon.discountType === 'percentage'
                                                ? `${coupon.discountValue}%`
                                                : formatMoney(coupon.discountValue)}
                                        </td>
                                        <td>{formatMoney(coupon.minimumOrderAmount || 0)}</td>
                                        <td>{coupon.maxDiscountAmount ? formatMoney(coupon.maxDiscountAmount) : 'No cap'}</td>
                                        <td>{coupon.usedCount || 0}</td>
                                        <td>{coupon.usageLimit || 'Unlimited'}</td>
                                        <td>{formatDateTime(coupon.expiresAt)}</td>
                                        <td>
                                            <span className={`admin-pill ${coupon.isActive ? 'success' : 'danger'}`}>
                                                {coupon.isActive ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="admin-actions">
                                                <Link className="admin-icon-link" to={`/admin/coupon/${coupon._id}/edit`} aria-label="Edit coupon">
                                                    <Pencil size={17} />
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="admin-icon-button danger"
                                                    onClick={() => disableCouponHandler(coupon._id)}
                                                    disabled={actionLoading === coupon._id || !coupon.isActive}
                                                    aria-label="Disable coupon"
                                                >
                                                    <Power size={17} />
                                                </button>
                                            </div>
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

export default CouponListPage;
