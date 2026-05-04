const { checkRateLimit, apiResponse, getClientIP } = require('../utils/helpers');

const feedbackRateLimit = (req, res, next) => {
  const ip = getClientIP(req);
  const result = checkRateLimit(`feedback:${ip}`, 3, 3600000);
  if (!result.allowed) {
    return res.status(429).json(apiResponse(false, 'Too many feedback submissions. Please try again later.'));
  }
  next();
};

const faqVoteRateLimit = (req, res, next) => {
  const ip = getClientIP(req);
  const faqId = req.params.id;
  const result = checkRateLimit(`faq-vote:${ip}:${faqId}`, 1, 86400000);
  if (!result.allowed) {
    return res.status(429).json(apiResponse(false, 'You have already voted on this FAQ. Please try again tomorrow.'));
  }
  next();
};

module.exports = { feedbackRateLimit, faqVoteRateLimit };