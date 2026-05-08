import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Power, RotateCcw, Save, Trash2, XCircle } from 'lucide-react';
import {
    createDiscountRule,
    deleteDiscountRule,
    getDiscountRules,
    toggleDiscountRule,
    updateDiscountRule,
} from '../../services/discountService';
import { useCurrency } from '../../context/CurrencyContext';
import { formatDateTime, getErrorMessage, labelize } from '../../utils/adminUtils';

const createEmptyForm = () => ({
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    maxDiscountAmount: '',
    minCartTotal: '',
    minOrderCount: '',
    maxOrderCount: '',
    firstOrderOnly: false,
    returningCustomerOnly: false,
    category: '',
    inactiveDays: '',
    startDate: '',
    endDate: '',
    active: true,
});

const toDateTimeLocalInput = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const offset = date.getTimezoneOffset();
    const normalized = new Date(date.getTime() - offset * 60000);
    return normalized.toISOString().slice(0, 16);
};

const buildPayload = (form) => ({
    name: form.name.trim(),
    description: form.description.trim(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    maxDiscountAmount: form.maxDiscountAmount === '' ? null : Number(form.maxDiscountAmount),
    minCartTotal: form.minCartTotal === '' ? null : Number(form.minCartTotal),
    minOrderCount: form.minOrderCount === '' ? null : Number(form.minOrderCount),
    maxOrderCount: form.maxOrderCount === '' ? null : Number(form.maxOrderCount),
    firstOrderOnly: Boolean(form.firstOrderOnly),
    returningCustomerOnly: Boolean(form.returningCustomerOnly),
    category: form.category.trim(),
    inactiveDays: form.inactiveDays === '' ? null : Number(form.inactiveDays),
    startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
    endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    active: Boolean(form.active),
});

const getConditionChips = (rule, formatCurrency) => {
    const conditions = rule?.conditions || {};
    const chips = [];

    if (conditions.minCartTotal !== null && conditions.minCartTotal !== undefined) {
        chips.push(`Min cart ${formatCurrency(conditions.minCartTotal)}`);
    }
    if (conditions.minOrderCount !== null && conditions.minOrderCount !== undefined) {
        chips.push(`Min orders ${conditions.minOrderCount}`);
    }
    if (conditions.maxOrderCount !== null && conditions.maxOrderCount !== undefined) {
        chips.push(`Max orders ${conditions.maxOrderCount}`);
    }
    if (conditions.firstOrderOnly) {
        chips.push('First order only');
    }
    if (conditions.returningCustomerOnly) {
        chips.push('Returning customer');
    }
    if (conditions.category) {
        chips.push(`Category ${conditions.category}`);
    }
    if (conditions.inactiveDays !== null && conditions.inactiveDays !== undefined) {
        chips.push(`Inactive ${conditions.inactiveDays}+ days`);
    }

    return chips.length > 0 ? chips : ['Applies broadly'];
};

const getWindowLabel = (rule) => {
    if (!rule?.startDate && !rule?.endDate) {
        return 'Always on';
    }

    const start = rule?.startDate ? formatDateTime(rule.startDate) : 'Now';
    const end = rule?.endDate ? formatDateTime(rule.endDate) : 'No end date';
    return `${start} -> ${end}`;
};

const AdminDiscountsPage = () => {
    const { formatCurrency } = useCurrency();
    const [rules, setRules] = useState([]);
    const [form, setForm] = useState(createEmptyForm());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState('');
    const [editingRuleId, setEditingRuleId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const data = await getDiscountRules();
            setRules(Array.isArray(data) ? data : []);
        } catch (fetchError) {
            setError(getErrorMessage(fetchError, 'Failed to load smart discount rules'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const changeHandler = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((current) => ({
            ...current,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const resetForm = () => {
        setEditingRuleId('');
        setForm(createEmptyForm());
    };

    const editRuleHandler = (rule) => {
        const conditions = rule?.conditions || {};

        setEditingRuleId(rule._id);
        setError('');
        setSuccess('');
        setForm({
            name: rule.name || '',
            description: rule.description || '',
            discountType: rule.discountType || 'percentage',
            discountValue: String(rule.discountValue ?? ''),
            maxDiscountAmount: rule.maxDiscountAmount ?? '',
            minCartTotal: conditions.minCartTotal ?? '',
            minOrderCount: conditions.minOrderCount ?? '',
            maxOrderCount: conditions.maxOrderCount ?? '',
            firstOrderOnly: Boolean(conditions.firstOrderOnly),
            returningCustomerOnly: Boolean(conditions.returningCustomerOnly),
            category: conditions.category || '',
            inactiveDays: conditions.inactiveDays ?? '',
            startDate: toDateTimeLocalInput(rule.startDate),
            endDate: toDateTimeLocalInput(rule.endDate),
            active: Boolean(rule.active),
        });
    };

    const submitHandler = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload = buildPayload(form);

            if (editingRuleId) {
                await updateDiscountRule(editingRuleId, payload);
                setSuccess('Smart discount rule updated.');
            } else {
                await createDiscountRule(payload);
                setSuccess('Smart discount rule created.');
            }

            resetForm();
            await fetchRules();
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Failed to save smart discount rule'));
        } finally {
            setSaving(false);
        }
    };

    const toggleRuleHandler = async (ruleId) => {
        setActionLoading(`toggle-${ruleId}`);
        setError('');
        setSuccess('');

        try {
            await toggleDiscountRule(ruleId);
            setSuccess('Rule status updated.');
            await fetchRules();
        } catch (toggleError) {
            setError(getErrorMessage(toggleError, 'Failed to update rule status'));
        } finally {
            setActionLoading('');
        }
    };

    const deleteRuleHandler = async (ruleId) => {
        if (!window.confirm('Delete this smart discount rule?')) {
            return;
        }

        setActionLoading(`delete-${ruleId}`);
        setError('');
        setSuccess('');

        try {
            const data = await deleteDiscountRule(ruleId);
            setSuccess(data.message || 'Rule deleted.');

            if (editingRuleId === ruleId) {
                resetForm();
            }

            await fetchRules();
        } catch (deleteError) {
            setError(getErrorMessage(deleteError, 'Failed to delete rule'));
        } finally {
            setActionLoading('');
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <h1>Smart Discount Rules</h1>
                    <p>Automatic behavior-based discounts that apply the single best eligible rule at checkout.</p>
                </div>
                <div className="admin-actions">
                    <button type="button" className="admin-button secondary" onClick={fetchRules} disabled={loading}>
                        <RotateCcw size={17} />
                        Refresh
                    </button>
                    {editingRuleId && (
                        <button type="button" className="admin-button secondary" onClick={resetForm} disabled={saving}>
                            <XCircle size={17} />
                            Cancel edit
                        </button>
                    )}
                </div>
            </div>

            <form className="admin-card" onSubmit={submitHandler}>
                {error && <div className="admin-message error">{error}</div>}
                {success && <div className="admin-message success">{success}</div>}

                <div className="admin-page-header" style={{ marginBottom: '1rem' }}>
                    <div>
                        <h3>{editingRuleId ? 'Edit Rule' : 'Create Rule'}</h3>
                        <p>Define when the rule applies and what discount it grants.</p>
                    </div>
                </div>

                <div className="admin-grid three">
                    <div className="admin-field">
                        <label htmlFor="discount-rule-name">Name</label>
                        <input id="discount-rule-name" name="name" className="admin-input" value={form.name} onChange={changeHandler} required />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-type">Discount Type</label>
                        <select id="discount-rule-type" name="discountType" className="admin-select" value={form.discountType} onChange={changeHandler}>
                            <option value="percentage">Percentage</option>
                            <option value="fixed">Fixed</option>
                        </select>
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-value">Discount Value</label>
                        <input id="discount-rule-value" name="discountValue" type="number" min="0" step="0.01" className="admin-input" value={form.discountValue} onChange={changeHandler} required />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-max-amount">Max Discount Amount</label>
                        <input id="discount-rule-max-amount" name="maxDiscountAmount" type="number" min="0" step="0.01" className="admin-input" value={form.maxDiscountAmount} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-min-cart">Minimum Cart Total</label>
                        <input id="discount-rule-min-cart" name="minCartTotal" type="number" min="0" step="0.01" className="admin-input" value={form.minCartTotal} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-category">Category</label>
                        <input id="discount-rule-category" name="category" className="admin-input" value={form.category} onChange={changeHandler} placeholder="Laptops" />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-min-orders">Minimum Order Count</label>
                        <input id="discount-rule-min-orders" name="minOrderCount" type="number" min="0" step="1" className="admin-input" value={form.minOrderCount} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-max-orders">Maximum Order Count</label>
                        <input id="discount-rule-max-orders" name="maxOrderCount" type="number" min="0" step="1" className="admin-input" value={form.maxOrderCount} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-inactive-days">Inactive Customer Days</label>
                        <input id="discount-rule-inactive-days" name="inactiveDays" type="number" min="0" step="1" className="admin-input" value={form.inactiveDays} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-start-date">Start Date</label>
                        <input id="discount-rule-start-date" name="startDate" type="datetime-local" className="admin-input" value={form.startDate} onChange={changeHandler} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="discount-rule-end-date">End Date</label>
                        <input id="discount-rule-end-date" name="endDate" type="datetime-local" className="admin-input" value={form.endDate} onChange={changeHandler} />
                    </div>
                    <label className="admin-field admin-checkbox-field">
                        <input name="active" type="checkbox" checked={form.active} onChange={changeHandler} />
                        Active
                    </label>
                    <label className="admin-field admin-checkbox-field">
                        <input name="firstOrderOnly" type="checkbox" checked={form.firstOrderOnly} onChange={changeHandler} />
                        First order only
                    </label>
                    <label className="admin-field admin-checkbox-field">
                        <input name="returningCustomerOnly" type="checkbox" checked={form.returningCustomerOnly} onChange={changeHandler} />
                        Returning customer only
                    </label>
                    <div className="admin-field admin-grid-span-full">
                        <label htmlFor="discount-rule-description">Description</label>
                        <textarea
                            id="discount-rule-description"
                            name="description"
                            className="admin-textarea"
                            value={form.description}
                            onChange={changeHandler}
                            placeholder="Optional internal note for admins"
                        />
                    </div>
                </div>

                <div className="admin-actions" style={{ marginTop: '1rem' }}>
                    <button className="admin-button" disabled={saving}>
                        <Save size={17} />
                        {saving ? 'Saving...' : editingRuleId ? 'Update rule' : 'Create rule'}
                    </button>
                </div>
            </form>

            <div className="admin-card" style={{ marginTop: '1rem' }}>
                {loading ? (
                    <div className="admin-empty">Loading smart discount rules...</div>
                ) : rules.length === 0 ? (
                    <div className="admin-empty">No smart discount rules found.</div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Rule</th>
                                    <th>Discount</th>
                                    <th>Conditions</th>
                                    <th>Window</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rules.map((rule) => (
                                    <tr key={rule._id}>
                                        <td>
                                            <div className="admin-strong">{rule.name}</div>
                                            <div className="admin-muted" style={{ marginTop: '0.35rem' }}>
                                                {rule.description || 'No description'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="admin-strong">
                                                {rule.discountType === 'percentage'
                                                    ? `${rule.discountValue}%`
                                                    : formatCurrency(rule.discountValue)}
                                            </div>
                                            <div className="admin-muted" style={{ marginTop: '0.35rem' }}>
                                                {rule.maxDiscountAmount ? `Cap ${formatCurrency(rule.maxDiscountAmount)}` : 'No cap'}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                {getConditionChips(rule, formatCurrency).map((chip) => (
                                                    <span key={`${rule._id}-${chip}`} className="admin-pill">
                                                        {chip}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>{getWindowLabel(rule)}</td>
                                        <td>
                                            <span className={`admin-pill ${rule.active ? 'success' : 'danger'}`}>
                                                {rule.active ? 'Active' : 'Inactive'}
                                            </span>
                                            <div className="admin-muted" style={{ marginTop: '0.45rem' }}>
                                                {labelize(rule.discountType)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="admin-actions">
                                                <button
                                                    type="button"
                                                    className="admin-icon-button"
                                                    onClick={() => editRuleHandler(rule)}
                                                    aria-label="Edit rule"
                                                >
                                                    <Pencil size={17} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-icon-button"
                                                    onClick={() => toggleRuleHandler(rule._id)}
                                                    disabled={actionLoading === `toggle-${rule._id}`}
                                                    aria-label="Toggle rule status"
                                                >
                                                    <Power size={17} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-icon-button danger"
                                                    onClick={() => deleteRuleHandler(rule._id)}
                                                    disabled={actionLoading === `delete-${rule._id}`}
                                                    aria-label="Delete rule"
                                                >
                                                    <Trash2 size={17} />
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

export default AdminDiscountsPage;
