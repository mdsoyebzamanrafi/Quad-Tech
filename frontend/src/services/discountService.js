import api from '../utils/api';

const getDiscountRules = async () => {
    const { data } = await api.get('/api/admin/discounts');
    return data;
};

const createDiscountRule = async (payload) => {
    const { data } = await api.post('/api/admin/discounts', payload);
    return data;
};

const updateDiscountRule = async (id, payload) => {
    const { data } = await api.put(`/api/admin/discounts/${id}`, payload);
    return data;
};

const deleteDiscountRule = async (id) => {
    const { data } = await api.delete(`/api/admin/discounts/${id}`);
    return data;
};

const toggleDiscountRule = async (id) => {
    const { data } = await api.patch(`/api/admin/discounts/${id}/toggle`);
    return data;
};

const getEligibleSmartDiscount = async (cartItems) => {
    const { data } = await api.post('/api/discounts/eligible', { cartItems });
    return data;
};

export {
    getDiscountRules,
    createDiscountRule,
    updateDiscountRule,
    deleteDiscountRule,
    toggleDiscountRule,
    getEligibleSmartDiscount,
};
