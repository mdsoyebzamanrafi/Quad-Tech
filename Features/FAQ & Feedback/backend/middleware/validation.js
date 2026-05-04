const { body, param, validationResult } = require('express-validator');
const { apiResponse } = require('../utils/helpers');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(apiResponse(false, 'Validation failed', null, { errors: errors.array() }));
  }
  next();
};

const faqValidation = {
  create: [
    body('question').trim().notEmpty().isLength({ max: 500 }),
    body('answer').trim().notEmpty().isLength({ max: 5000 }),
    body('category').trim().notEmpty().isIn(['Orders', 'Payments', 'Shipping & Delivery', 'Returns & Refunds', 'Products', 'Account & Security', 'Support']),
    handleValidationErrors
  ],
  update: [
    param('id').isMongoId(),
    body('question').optional().trim().isLength({ max: 500 }),
    body('answer').optional().trim().isLength({ max: 5000 }),
    handleValidationErrors
  ],
  feedback: [
    param('id').isMongoId(),
    body('helpful').isBoolean(),
    handleValidationErrors
  ]
};

const customerFeedbackValidation = {
  create: [
    body('name').optional().trim().isLength({ max: 100 }),
    body('email').trim().notEmpty().isEmail().normalizeEmail(),
    body('rating').notEmpty().isInt({ min: 1, max: 5 }),
    body('message').trim().notEmpty().isLength({ min: 10, max: 2000 }),
    body('orderId').optional().trim().isLength({ max: 50 }),
    handleValidationErrors
  ]
};

module.exports = { faqValidation, customerFeedbackValidation };