import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../../utils/api';
import { getErrorMessage } from '../../utils/adminUtils';

const toDateTimeLocalInput = (value) => {
    const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const offset = date.getTimezoneOffset();
    const normalized = new Date(date.getTime() - offset * 60000);
    return normalized.toISOString().slice(0, 16);
};

const CouponCreatePage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        code: '',
        discountType: 'percentage',
        discountValue: '',
        minimumOrderAmount: '0',
        maxDiscountAmount: '',
        usageLimit: '',
        perUserLimit: '1',
        expiresAt: toDateTimeLocalInput(),
        isActive: true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const payload = useMemo(() => ({
        ...form,
        code: form.code.trim().toUpperCase(),
        discountValue: Number(form.discountValue),
        minimumOrderAmount: Number(form.minimumOrderAmount || 0),
        maxDiscountAmount: form.maxDiscountAmount === '' ? null : Number(form.maxDiscountAmount),
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        perUserLimit: form.perUserLimit === '' ? 1 : Number(form.perUserLimit),
        expiresAt: new Date(form.expiresAt).toISOString(),
    }), [form]);

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

        try {
            const { data } = await api.post('/api/coupons', payload);
            navigate(`/admin/coupon/${data._id}/edit`);
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Failed to create coupon'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <Link to="/admin/coupons" className="admin-button secondary">
                        <ArrowLeft size={17} />
                        Coupons
                    </Link>
                    <h1>Create Coupon</h1>
                    <p>Configure discount rules and checkout constraints.</p>
                </div>
            </div>

            <form className="admin-card" onSubmit={submitHandler}>
                {error && <div className="admin-message error">{error}</div>}

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
                        {saving ? 'Saving...' : 'Create coupon'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CouponCreatePage;
