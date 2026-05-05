import React, { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../utils/api';
import { buildCartItemKey } from '../utils/productUtils';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

const emptyDiscountState = {
    couponCode: '',
    couponDiscount: 0,
    useRewardTokens: false,
    requestedTokens: 0,
    tokenDiscount: 0,
};

const normalizeCartItem = (item) => {
    const selectedColor = typeof item?.selectedColor === 'string' ? item.selectedColor.trim() : '';
    const selectedSize = typeof item?.selectedSize === 'string' ? item.selectedSize.trim() : '';

    return {
        ...item,
        selectedColor,
        selectedSize,
        cartItemKey:
            item?.cartItemKey ||
            buildCartItemKey(item?.product || '', selectedColor, selectedSize),
    };
};

const persistedDiscountState = {
    couponCode: localStorage.getItem('couponCode') ? JSON.parse(localStorage.getItem('couponCode')) : '',
    couponDiscount: localStorage.getItem('couponDiscount') ? JSON.parse(localStorage.getItem('couponDiscount')) : 0,
    useRewardTokens: localStorage.getItem('useRewardTokens') ? JSON.parse(localStorage.getItem('useRewardTokens')) : false,
    requestedTokens: localStorage.getItem('requestedTokens') ? JSON.parse(localStorage.getItem('requestedTokens')) : 0,
    tokenDiscount: localStorage.getItem('tokenDiscount') ? JSON.parse(localStorage.getItem('tokenDiscount')) : 0,
};

const initialState = {
    cartItems: localStorage.getItem('cartItems')
        ? JSON.parse(localStorage.getItem('cartItems')).map(normalizeCartItem)
        : [],
    shippingAddress: localStorage.getItem('shippingAddress') ? JSON.parse(localStorage.getItem('shippingAddress')) : {},
    paymentMethod: localStorage.getItem('paymentMethod') ? JSON.parse(localStorage.getItem('paymentMethod')) : 'Cash on Delivery',
    ...persistedDiscountState,
};

const cartReducer = (state, action) => {
    switch (action.type) {
        case 'CART_ADD_ITEM': {
            const item = normalizeCartItem(action.payload);
            const existItem = state.cartItems.find((x) => x.cartItemKey === item.cartItemKey);

            if (existItem) {
                return {
                    ...state,
                    cartItems: state.cartItems.map((x) =>
                        x.cartItemKey === existItem.cartItemKey ? item : x
                    ),
                    ...emptyDiscountState,
                };
            }

            return {
                ...state,
                cartItems: [...state.cartItems, item],
                ...emptyDiscountState,
            };
        }

        case 'CART_REMOVE_ITEM':
            return {
                ...state,
                cartItems: state.cartItems.filter((x) => x.cartItemKey !== action.payload),
                ...emptyDiscountState,
            };

        case 'CART_CLEAR_ITEMS':
            return {
                ...state,
                cartItems: [],
                ...emptyDiscountState,
            };

        case 'CART_SAVE_SHIPPING_ADDRESS':
            return {
                ...state,
                shippingAddress: action.payload,
            };

        case 'CART_SAVE_PAYMENT_METHOD':
            return {
                ...state,
                paymentMethod: action.payload,
            };

        case 'CART_SAVE_COUPON_PREVIEW':
            return {
                ...state,
                couponCode: action.payload.couponCode,
                couponDiscount: action.payload.couponDiscount,
            };

        case 'CART_REMOVE_COUPON':
            return {
                ...state,
                couponCode: '',
                couponDiscount: 0,
            };

        case 'CART_SAVE_TOKEN_USAGE':
            return {
                ...state,
                useRewardTokens: Boolean(action.payload.useRewardTokens),
                requestedTokens: action.payload.requestedTokens,
                tokenDiscount: action.payload.tokenDiscount,
            };

        case 'CART_CLEAR_DISCOUNTS':
            return {
                ...state,
                ...emptyDiscountState,
            };

        default:
            return state;
    }
};

export const CartProvider = ({ children }) => {
    const [state, dispatch] = useReducer(cartReducer, initialState);

    useEffect(() => {
        localStorage.setItem('cartItems', JSON.stringify(state.cartItems));
    }, [state.cartItems]);

    useEffect(() => {
        localStorage.setItem('shippingAddress', JSON.stringify(state.shippingAddress));
    }, [state.shippingAddress]);

    useEffect(() => {
        localStorage.setItem('paymentMethod', JSON.stringify(state.paymentMethod));
    }, [state.paymentMethod]);

    useEffect(() => {
        localStorage.setItem('couponCode', JSON.stringify(state.couponCode));
        localStorage.setItem('couponDiscount', JSON.stringify(state.couponDiscount));
        localStorage.setItem('useRewardTokens', JSON.stringify(state.useRewardTokens));
        localStorage.setItem('requestedTokens', JSON.stringify(state.requestedTokens));
        localStorage.setItem('tokenDiscount', JSON.stringify(state.tokenDiscount));
    }, [state.couponCode, state.couponDiscount, state.useRewardTokens, state.requestedTokens, state.tokenDiscount]);

    const addToCart = async (id, qty, options = {}) => {
        try {
            const { data } = await api.get(`/api/products/${id}`);
            const selectedColor =
                typeof options.selectedColor === 'string' ? options.selectedColor.trim() : '';
            const selectedSize =
                typeof options.selectedSize === 'string' ? options.selectedSize.trim() : '';

            dispatch({
                type: 'CART_ADD_ITEM',
                payload: {
                    product: data._id,
                    cartItemKey: buildCartItemKey(data._id, selectedColor, selectedSize),
                    name: data.name,
                    image: data.image,
                    price: data.price,
                    countInStock: data.countInStock,
                    selectedColor,
                    selectedSize,
                    qty,
                },
            });
        } catch (error) {
            console.error('Failed to add to cart:', error);
        }
    };

    const removeFromCart = (id) => {
        dispatch({
            type: 'CART_REMOVE_ITEM',
            payload: id,
        });
    };

    const clearCart = () => {
        dispatch({
            type: 'CART_CLEAR_ITEMS'
        });
        localStorage.removeItem('cartItems');
        localStorage.removeItem('couponCode');
        localStorage.removeItem('couponDiscount');
        localStorage.removeItem('useRewardTokens');
        localStorage.removeItem('requestedTokens');
        localStorage.removeItem('tokenDiscount');
    };

    const saveShippingAddress = (data) => {
        dispatch({
            type: 'CART_SAVE_SHIPPING_ADDRESS',
            payload: data,
        });
    };

    const savePaymentMethod = (data) => {
        dispatch({
            type: 'CART_SAVE_PAYMENT_METHOD',
            payload: data,
        });
    };

    const applyCouponPreview = (data) => {
        dispatch({
            type: 'CART_SAVE_COUPON_PREVIEW',
            payload: {
                couponCode: data.couponCode || '',
                couponDiscount: Number(data.couponDiscount) || 0,
            },
        });
    };

    const saveCouponPreview = applyCouponPreview;

    const removeCoupon = () => {
        dispatch({ type: 'CART_REMOVE_COUPON' });
    };

    const saveTokenUsage = (data) => {
        dispatch({
            type: 'CART_SAVE_TOKEN_USAGE',
            payload: {
                useRewardTokens: Boolean(data.useRewardTokens),
                requestedTokens: Number(data.requestedTokens) || 0,
                tokenDiscount: Number(data.tokenDiscount) || 0,
            },
        });
    };

    const clearDiscounts = () => {
        dispatch({ type: 'CART_CLEAR_DISCOUNTS' });
    };

    const value = {
        cartItems: state.cartItems,
        shippingAddress: state.shippingAddress,
        paymentMethod: state.paymentMethod,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
        useRewardTokens: state.useRewardTokens,
        requestedTokens: state.requestedTokens,
        tokenDiscount: state.tokenDiscount,
        addToCart,
        removeFromCart,
        clearCart,
        saveShippingAddress,
        savePaymentMethod,
        applyCouponPreview,
        saveCouponPreview,
        removeCoupon,
        saveTokenUsage,
        clearDiscounts,
    };

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};
