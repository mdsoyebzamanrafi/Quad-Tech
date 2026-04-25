import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../../utils/api';
import { getErrorMessage } from '../../utils/adminUtils';

const toDateTimeLocalInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    const normalized = new Date(date.getTime() - offset * 60000);
    return normalized.toISOString().slice(0, 16);
};

const CouponEditPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchCoupon = async () => {
            setLoading(true);
            setError('');

            try {
                const { data } = await api.get(`/api/coupons/${id}`);
                setForm({
                    code: data.code || '',
                    discountType: data.discountType || 'percentage',
                    discountValue: String(data.discountValue ?? ''),
                    minimumOrderAmount: String(data.minimumOrderAmount ?? 0),
                    maxDiscountAmount: data.maxDiscountAmount ?? '',
                    usageLimit: data.usageLimit ?? '',
                    perUserLimit: String(data.perUserLimit ?? 1),
                    expiresAt: toDateTimeLocalInput(data.expiresAt),
                    isActive: Boolean(data.isActive),
                });
            } catch (fetchError) {
                setError(getErrorMessage(fetchError, 'Failed to load coupon'));
            } finally {
                setLoading(false);
            }
        };

        fetchCoupon();
    }, [id]);

    const payload = useMemo(() => {
        if (!form) return null;

        return {
            ...form,
            code: form.code.trim().toUpperCase(),
            discountValue: Number(form.discountValue),
            minimumOrderAmount: Number(form.minimumOrderAmount || 0),
            maxDiscountAmount: form.maxDiscountAmount === '' ? null : Number(form.maxDiscountAmount),
            usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
            perUserLimit: form.perUserLimit === '' ? 1 : Number(form.perUserLimit),
            expiresAt: new Date(form.expiresAt).toISOString(),
        };
    }, [form]);

    const changeHandler = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((current) => ({
            ...current,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const submitHandler = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await api.put(`/api/coupons/${id}`, payload);
            setSuccess('Coupon updated.');
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Failed to update coupon'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="admin-card admin-empty">Loading coupon...</div>;
    }

    if (!form) {
        return (
            <div className="admin-card">
                {error && <div className="admin-message error">{error}</div>}
                <button type="button" className="admin-button secondary" onClick={() => navigate('/admin/coupons')}>Back</button>
            </div>
        );
    }

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <Link to="/admin/coupons" className="admin-button secondary">
                        <ArrowLeft size={17} />
                        Coupons
                    </Link>
                    <h1>Edit Coupon</h1>
                    <p>Update availability, limits, and pricing rules.</p>
                </div>
            </div>

            <form className="admin-card" onSubmit={submitHandler}>
                {error && <div className="admin-message error">{error}</div>}
                {success && <div className="admin-message success">{success}</div>}

                <div className="admin-grid three">
                    <div className="admin-field">
                        <label htmlFor="code">Code</label>
                        <input id="code" name="code" className="admin-input" value={form.code} onChange={changeHandler} required />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discountType">Discount Type</label>
                        <select id="discountType" name="discountType" className="admin-select" value={form.discountType} onChange={changeHandler}>
                            <option value="percentage">Percentage</option>
                            <option value="fixed">Fixed</option>
                        </select>
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discountValue">Discount Value</label>
                        <input id="discountValue" name="discountValue" type="number" min="0" step="0.01" className="admin-input" value={form.discountValue} onChange={changeHandler} required />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="minimumOrderAmount">Minimum Order</label>
                        <input id="minimumOrderAmount" name="minimumOrderAmount" type="number" min="0" step="0.01" className="admin-input" value={form.minimumOrderAmount} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="maxDiscountAmount">Max Discount</label>
                        <input id="maxDiscountAmount" name="maxDiscountAmount" type="number" min="0" step="0.01" className="admin-input" value={form.maxDiscountAmount} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="usageLimit">Usage Limit</label>
                        <input id="usageLimit" name="usageLimit" type="number" min="0" className="admin-input" value={form.usageLimit} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="perUserLimit">Per User Limit</label>
                        <input id="perUserLimit" name="perUserLimit" type="number" min="1" className="admin-input" value={form.perUserLimit} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="expiresAt">Expires At</label>
                        <input id="expiresAt" name="expiresAt" type="datetime-local" className="admin-input" value={form.expiresAt} onChange={changeHandler} required />
                    </div>
                    <label className="admin-field admin-checkbox-field">
                        <input name="isActive" type="checkbox" checked={form.isActive} onChange={changeHandler} />
                        Active
                    </label>
                </div>

                <div className="admin-actions" style={{ marginTop: '1rem' }}>
                    <button className="admin-button" disabled={saving}>
                        <Save size={17} />
                        {saving ? 'Saving...' : 'Update coupon'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CouponEditPage;
