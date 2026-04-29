import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../../utils/api';
import { getErrorMessage } from '../../utils/adminUtils';

const createEmptyForm = () => ({
    name: '',
    image: '',
    brand: '',
    category: '',
    description: '',
    price: '0',
    countInStock: '0',
    isActive: true,
});

const toFormState = (product) => ({
    name: product?.name || '',
    image: product?.image || '',
    brand: product?.brand || '',
    category: product?.category || '',
    description: product?.description || '',
    price: String(product?.price ?? 0),
    countInStock: String(product?.countInStock ?? 0),
    isActive: product?.isActive !== false,
});

const validateForm = (form) => {
    if (!form.name.trim() || !form.image.trim() || !form.brand.trim() || !form.category.trim() || !form.description.trim()) {
        return 'Please provide name, image, brand, category, and description.';
    }

    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
        return 'Price must be greater than or equal to 0.';
    }

    const countInStock = Number(form.countInStock);
    if (!Number.isInteger(countInStock) || countInStock < 0) {
        return 'Stock must be a whole number greater than or equal to 0.';
    }

    return '';
};

const AdminProductFormPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isCreateMode = !id;
    const [form, setForm] = useState(createEmptyForm());
    const [loading, setLoading] = useState(!isCreateMode);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (isCreateMode) {
            setForm(createEmptyForm());
            setLoading(false);
            return;
        }

        const fetchProduct = async () => {
            setLoading(true);
            setError('');

            try {
                const { data } = await api.get(`/api/products/admin/${id}`);
                setForm(toFormState(data));
            } catch (fetchError) {
                setError(getErrorMessage(fetchError, 'Failed to load product'));
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [id, isCreateMode]);

    const payload = useMemo(() => ({
        name: form.name.trim(),
        image: form.image.trim(),
        brand: form.brand.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        countInStock: Number(form.countInStock),
        isActive: Boolean(form.isActive),
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
        setError('');
        setSuccess('');

        const validationError = validateForm(form);
        if (validationError) {
            setError(validationError);
            return;
        }

        setSaving(true);

        try {
            if (isCreateMode) {
                await api.post('/api/products', payload);
                navigate('/admin/products');
                return;
            }

            const { data } = await api.put(`/api/products/${id}`, payload);
            setForm(toFormState(data));
            setSuccess('Product updated.');
        } catch (submitError) {
            setError(getErrorMessage(submitError, isCreateMode ? 'Failed to create product' : 'Failed to update product'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="admin-card admin-empty">Loading product...</div>;
    }

    if (!isCreateMode && error && !form.name && !form.image) {
        return (
            <div className="admin-card">
                <div className="admin-message error">{error}</div>
                <button type="button" className="admin-button secondary" onClick={() => navigate('/admin/products')}>
                    Back
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <Link to="/admin/products" className="admin-button secondary">
                        <ArrowLeft size={17} />
                        Products
                    </Link>
                    <h1>{isCreateMode ? 'Create Product' : 'Edit Product'}</h1>
                    <p>{isCreateMode ? 'Add a new product to the catalog.' : 'Update product details, stock, and visibility.'}</p>
                </div>
            </div>

            <form className="admin-card" onSubmit={submitHandler}>
                {error && <div className="admin-message error">{error}</div>}
                {success && <div className="admin-message success">{success}</div>}

                <div className="admin-grid three">
                    <div className="admin-field">
                        <label htmlFor="name">Name</label>
                        <input id="name" name="name" className="admin-input" value={form.name} onChange={changeHandler} required />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="brand">Brand</label>
                        <input id="brand" name="brand" className="admin-input" value={form.brand} onChange={changeHandler} required />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="category">Category</label>
                        <input id="category" name="category" className="admin-input" value={form.category} onChange={changeHandler} required />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="image">Image</label>
                        <input id="image" name="image" className="admin-input" value={form.image} onChange={changeHandler} required />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="price">Price</label>
                        <input
                            id="price"
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            className="admin-input"
                            value={form.price}
                            onChange={changeHandler}
                            required
                        />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="countInStock">Stock Count</label>
                        <input
                            id="countInStock"
                            name="countInStock"
                            type="number"
                            min="0"
                            step="1"
                            className="admin-input"
                            value={form.countInStock}
                            onChange={changeHandler}
                            required
                        />
                    </div>
                    <div className="admin-field admin-grid-span-full">
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            name="description"
                            className="admin-textarea"
                            value={form.description}
                            onChange={changeHandler}
                            required
                        />
                    </div>
                    <label className="admin-field admin-checkbox-field">
                        <input name="isActive" type="checkbox" checked={form.isActive} onChange={changeHandler} />
                        Active
                    </label>
                </div>

                <div className="admin-actions" style={{ marginTop: '1rem' }}>
                    <button className="admin-button" disabled={saving}>
                        <Save size={17} />
                        {saving ? 'Saving...' : isCreateMode ? 'Create product' : 'Save changes'}
                    </button>
                    <button
                        type="button"
                        className="admin-button secondary"
                        onClick={() => navigate('/admin/products')}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminProductFormPage;
