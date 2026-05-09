import React, { createContext, useContext, useState, useEffect } from 'react';

const CurrencyContext = createContext();

export const SUPPORTED_CURRENCIES = [
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'GBP', symbol: '£', label: 'British Pound' },
    { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka' },
    { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
    { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
    { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
];

export const CurrencyProvider = ({ children }) => {
    const [currency, setCurrency] = useState(() => {
        return localStorage.getItem('selectedCurrency') || 'USD';
    });
    const [exchangeRates, setExchangeRates] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const data = await response.json();
                if (data && data.rates) {
                    setExchangeRates(data.rates);
                }
            } catch (error) {
                console.error('Failed to fetch exchange rates:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRates();
    }, []);

    const changeCurrency = (newCurrency) => {
        setCurrency(newCurrency);
        localStorage.setItem('selectedCurrency', newCurrency);
    };

    const formatCurrency = (usdAmount) => {
        const amount = Number(usdAmount) || 0;
        const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
        
        let convertedAmount = amount;
        if (exchangeRates && currency !== 'USD' && exchangeRates[currency]) {
            convertedAmount = amount * exchangeRates[currency];
        }

        const formattedNumber = convertedAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        // Fallback or custom styling for specific currencies that Intl might render clunkily
        if (currencyObj.code === 'BDT') {
            return `৳${formattedNumber}`;
        }
        
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
                currencyDisplay: 'narrowSymbol',
            }).format(convertedAmount);
        } catch (e) {
            return `${currencyObj.symbol}${formattedNumber}`;
        }
    };

    return (
        <CurrencyContext.Provider value={{
            currency,
            changeCurrency,
            formatCurrency,
            supportedCurrencies: SUPPORTED_CURRENCIES,
            ratesLoaded: !loading && !!exchangeRates
        }}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = () => {
    return useContext(CurrencyContext);
};
