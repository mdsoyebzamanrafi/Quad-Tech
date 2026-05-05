import ApiError from '../errors/ApiError.js';

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off']);
const LOCAL_BYPASS_ENVIRONMENTS = new Set(['development', 'dev', 'local']);

const normalizeBoolean = (value) => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) {
        return true;
    }

    if (FALSE_VALUES.has(normalized)) {
        return false;
    }

    return undefined;
};

const getRuntimeEnvironment = () => (process.env.NODE_ENV || '').trim().toLowerCase();

const isLocalBypassFlagEnabled = () => {
    const explicitEnable = normalizeBoolean(process.env.CAPTCHA_ENABLED);
    if (explicitEnable === false) {
        return true;
    }

    const legacyDisable = normalizeBoolean(process.env.DISABLE_RECAPTCHA);
    return legacyDisable === true;
};

export const isCaptchaVerificationEnabled = () => {
    const runtimeEnvironment = getRuntimeEnvironment();

    if (runtimeEnvironment === 'test') {
        return false;
    }

    if (!LOCAL_BYPASS_ENVIRONMENTS.has(runtimeEnvironment)) {
        return true;
    }

    return !isLocalBypassFlagEnabled();
};

export const verifyCaptchaToken = async (token) => {
    if (!isCaptchaVerificationEnabled()) {
        return true;
    }

    if (!process.env.RECAPTCHA_SECRET_KEY) {
        throw new ApiError(500, 'reCAPTCHA secret key is not configured');
    }

    if (typeof token !== 'string' || token.trim() === '') {
        return false;
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            secret: process.env.RECAPTCHA_SECRET_KEY,
            response: token,
        }),
    });

    const outcome = await response.json();
    return outcome?.success === true;
};
