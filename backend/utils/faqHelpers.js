import xss from 'xss';

export const sanitizeInput = (input) => {
  if (typeof input === 'string') return xss(input.trim());
  if (Array.isArray(input)) return input.map(item => sanitizeInput(item));
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const key in input) {
      if (input.hasOwnProperty(key)) sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
};

export const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown';
};
