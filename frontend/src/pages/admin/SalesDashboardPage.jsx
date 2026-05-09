import { useCurrency } from '../../context/CurrencyContext';
import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import { getErrorMessage } from '../../utils/adminUtils';

const metricCards = [
    { key: 'totalRevenue', label: 'Total Revenue' },
    { key: 'grossSales', label: 'Gross Sales' },
    { key: 'totalOrders', label: 'Total Orders', numeric: true },
    { key: 'averageOrderValue', label: 'Average Order Value' },
    { key: 'couponDiscount', label: 'Coupon Discount' },
    { key: 'tokenDiscount', label: 'Token Discount' },
    { key: 'totalDiscount', label: 'Total Discount' },
    { key: 'totalProductsSold', label: 'Products Sold', numeric: true },
];

const SalesDashboardPage = () => {
    const { formatCurrency } = useCurrency();
    const [summary, setSummary] = useState({});
    const [dailySales, setDailySales] = useState([]);
    const [productSales, setProductSales] = useState([]);
    const [couponSales, setCouponSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ startDate: '', endDate: '' });

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const dailyParams = {
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
            };

            const [summaryRes, dailyRes, productRes, couponRes] = await Promise.all([
                api.get('/api/sales/summary'),
                api.get('/api/sales/daily', { params: dailyParams }),
                api.get('/api/sales/products'),
                api.get('/api/sales/coupons'),
            ]);

            setSummary(summaryRes.data || {});
            setDailySales(dailyRes.data || []);
            setProductSales(productRes.data || []);
            setCouponSales(couponRes.data || []);
        } catch (fetchError) {
            setError(getErrorMessage(fetchError, 'Failed to load sales dashboard'));
        } finally {
            setLoading(false);
        }
    }, [filters.endDate, filters.startDate]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    return (
        <div>
            <div className="admin-page-header">
                <div>
                    <h1>Sales Dashboard</h1>
                    <p>Track paid-order revenue, discount performance, and product movement.</p>
                </div>
                <div className="admin-actions">
                    <button className="admin-button secondary" onClick={fetchDashboard} disabled={loading}>
                        <RotateCcw size={17} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="admin-card">
                <div className="admin-actions" style={{ marginBottom: '1rem' }}>
                    <div className="admin-field">
                        <label htmlFor="sales-start-date">Start Date</label>
                        <input
                            id="sales-start-date"
                            type="date"
                            className="admin-input"
                            value={filters.startDate}
                            onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                        />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="sales-end-date">End Date</label>
                        <input
                            id="sales-end-date"
                            type="date"
                            className="admin-input"
                            value={filters.endDate}
                            onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                        />
                    </div>
                </div>

                {error && <div className="admin-message error">{error}</div>}

                {loading ? (
                    <div className="admin-empty">Loading dashboard...</div>
                ) : (
                    <>
                        <div className="admin-grid three" style={{ marginBottom: '1rem' }}>
                            {metricCards.map((metric) => (
                                <div className="admin-card" key={metric.key} style={{ padding: '1rem' }}>
                                    <div className="admin-muted" style={{ marginBottom: '0.35rem' }}>{metric.label}</div>
                                    <div className="admin-strong" style={{ fontSize: '1.4rem' }}>
                                        {metric.numeric ? (summary[metric.key] ?? 0) : formatCurrency(summary[metric.key] ?? 0)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="admin-card">
                            <div className="admin-page-header" style={{ marginBottom: '0.75rem' }}>
                                <div>
                                    <h3>Daily Sales</h3>
                                </div>
                                <BarChart3 size={18} />
                            </div>
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Revenue</th>
                                            <th>Orders</th>
                                            <th>Gross Sales</th>
                                            <th>Discount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySales.length === 0 ? (
                                            <tr><td colSpan="5" className="admin-muted">No paid orders found for this range.</td></tr>
                                        ) : dailySales.map((item) => (
                                            <tr key={item.date}>
                                                <td>{item.date}</td>
                                                <td>{formatCurrency(item.revenue)}</td>
                                                <td>{item.orders}</td>
                                                <td>{formatCurrency(item.grossSales)}</td>
                                                <td>{formatCurrency(item.discount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="admin-grid" style={{ marginTop: '1rem' }}>
                            <div className="admin-card">
                                <h3 style={{ marginBottom: '0.75rem' }}>Best-Selling Products</h3>
                                <div className="admin-table-wrap">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Quantity Sold</th>
                                                <th>Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productSales.length === 0 ? (
                                                <tr><td colSpan="3" className="admin-muted">No product sales yet.</td></tr>
                                            ) : productSales.map((item) => (
                                                <tr key={item.productId}>
                                                    <td>{item.name}</td>
                                                    <td>{item.quantitySold}</td>
                                                    <td>{formatCurrency(item.revenue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="admin-card">
                                <h3 style={{ marginBottom: '0.75rem' }}>Coupon Performance</h3>
                                <div className="admin-table-wrap">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Coupon Code</th>
                                                <th>Uses</th>
                                                <th>Total Discount</th>
                                                <th>Revenue After Discount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {couponSales.length === 0 ? (
                                                <tr><td colSpan="4" className="admin-muted">No coupon-driven sales yet.</td></tr>
                                            ) : couponSales.map((item) => (
                                                <tr key={item.code}>
                                                    <td>{item.code}</td>
                                                    <td>{item.uses}</td>
                                                    <td>{formatCurrency(item.totalDiscount)}</td>
                                                    <td>{formatCurrency(item.revenueAfterDiscount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SalesDashboardPage;
