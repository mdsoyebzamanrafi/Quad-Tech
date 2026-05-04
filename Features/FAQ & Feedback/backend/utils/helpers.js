const xss = require('xss');

const sanitizeInput = (input) => {
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

const apiResponse = (success, message, data = null, meta = null) => {
  const response = { success, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return response;
};

const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown';
};

const rateLimitStore = new Map();

const checkRateLimit = (key, limit = 5, windowMs = 3600000) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  if (!rateLimitStore.has(key)) rateLimitStore.set(key, []);
  const requests = rateLimitStore.get(key).filter(time => time > windowStart);
  if (requests.length >= limit) return { allowed: false, remaining: 0 };
  requests.push(now);
  rateLimitStore.set(key, requests);
  return { allowed: true, remaining: limit - requests.length - 1 };
};

module.exports = { sanitizeInput, apiResponse, getClientIP, checkRateLimit };