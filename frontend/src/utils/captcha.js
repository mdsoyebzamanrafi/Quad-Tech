const isLocalCaptchaBypassRequested = () => (
    import.meta.env.VITE_CAPTCHA_ENABLED === 'false' ||
    import.meta.env.VITE_DISABLE_RECAPTCHA === 'true'
);

export const isCaptchaEnabled = !(
    import.meta.env.DEV &&
    isLocalCaptchaBypassRequested()
);

export const getCaptchaTokenForSubmission = (captchaToken) => (
    isCaptchaEnabled ? captchaToken : undefined
);
