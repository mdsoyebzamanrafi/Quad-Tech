import React, { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../utils/api';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

const initialState = {
    cartItems: localStorage.getItem('cartItems') ? JSON.parse(localStorage.getItem('cartItems')) : [],
    shippingAddress: localStorage.getItem('shippingAddress') ? JSON.parse(localStorage.getItem('shippingAddress')) : {},
    paymentMethod: localStorage.getItem('paymentMethod') ? JSON.parse(localStorage.getItem('paymentMethod')) : 'PayPal',
};

const cartReducer = (state, action) => {
    switch (action.type) {
        case 'CART_ADD_ITEM':
            const item = action.payload;
            const existItem = state.cartItems.find((x) => x.product === item.product);

            if (existItem) {
                return {
                    ...state,
                    cartItems: state.cartItems.map((x) =>
                        x.product === existItem.product ? item : x
                    ),
                };
            } else {
                return {
                    ...state,
                    cartItems: [...state.cartItems, item],
                };
            }

        case 'CART_REMOVE_ITEM':
            return {
                ...state,
                cartItems: state.cartItems.filter((x) => x.product !== action.payload),
            };

        case 'CART_CLEAR_ITEMS':
            return {
                ...state,
                cartItems: [],
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

    const addToCart = async (id, qty) => {
        try {
            const { data } = await api.get(`/api/products/${id}`);
            dispatch({
                type: 'CART_ADD_ITEM',
                payload: {
                    product: data._id,
                    name: data.name,
                    image: data.image,
                    price: data.price,
                    countInStock: data.countInStock,
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

    const value = {
        cartItems: state.cartItems,
        shippingAddress: state.shippingAddress,
        paymentMethod: state.paymentMethod,
        addToCart,
        removeFromCart,
        clearCart,
        saveShippingAddress,
        savePaymentMethod,
    };

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};
