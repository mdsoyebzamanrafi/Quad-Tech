const express = require('express');
const router = express.Router();
const CustomerFeedback = require('../models/CustomerFeedback');
const { apiResponse, sanitizeInput, getClientIP } = require('../utils/helpers');
const { customerFeedbackValidation } = require('../middleware/validation');
const { feedbackRateLimit } = require('../middleware/rateLimit');

// GET /api/feedback
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'newest', rating, minRating, featured = 'false' } = req.query;
    let query = { isApproved: true };
    
    if (rating) query.rating = parseInt(rating);
    if (minRating) query.rating = { $gte: parseInt(minRating) };
    if (featured === 'true') query.isFeatured = true;
    
    let sortOption = {};
    switch (sortBy) {
      case 'highest': sortOption = { rating: -1, createdAt: -1 }; break;
      case 'lowest': sortOption = { rating: 1, createdAt: -1 }; break;
      case 'oldest': sortOption = { createdAt: 1 }; break;
      default: sortOption = { createdAt: -1 };
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const [feedbacks, totalCount] = await Promise.all([
      CustomerFeedback.find(query).sort(sortOption).skip(skip).limit(limitNum).select('-ipAddress -userAgent'),
      CustomerFeedback.countDocuments(query)
    ]);
    
    const stats = await CustomerFeedback.aggregate([
      { $match: { isApproved: true } },
      { $group: { _id: null, averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 }, ratingDistribution: { $push: '$rating' } } }
    ]);
    
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats.length > 0) {
      stats[0].ratingDistribution.forEach(r => { ratingDistribution[r] = (ratingDistribution[r] || 0) + 1; });
    }
    
    res.json(apiResponse(true, 'Feedback fetched successfully', feedbacks, {
      pagination: { currentPage: pageNum, totalPages: Math.ceil(totalCount / limitNum), totalItems: totalCount, itemsPerPage: limitNum },
      stats: stats.length > 0 ? { averageRating: Math.round(stats[0].averageRating * 10) / 10, totalReviews: stats[0].totalReviews, ratingDistribution } : null
    }));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to fetch feedback'));
  }
});

// GET stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await CustomerFeedback.aggregate([
      { $match: { isApproved: true } },
      { $group: { _id: null, averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 }, ratingDistribution: { $push: '$rating' } } }
    ]);
    
    const recentFeedback = await CustomerFeedback.find({ isApproved: true, isFeatured: true })
      .sort({ createdAt: -1 }).limit(5).select('-ipAddress -userAgent');
    
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats.length > 0) {
      stats[0].ratingDistribution.forEach(r => { ratingDistribution[r] = (ratingDistribution[r] || 0) + 1; });
    }
    
    res.json(apiResponse(true, 'Statistics fetched successfully', {
      averageRating: stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0,
      totalReviews: stats.length > 0 ? stats[0].totalReviews : 0,
      ratingDistribution,
      recentFeedback
    }));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to fetch statistics'));
  }
});

// POST feedback
router.post('/', feedbackRateLimit, customerFeedbackValidation.create, async (req, res) => {
  try {
    const sanitizedData = sanitizeInput(req.body);
    const ipAddress = getClientIP(req);
    
    const recentSubmission = await CustomerFeedback.findOne({
      email: sanitizedData.email, createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });
    
    if (recentSubmission) {
      return res.status(429).json(apiResponse(false, 'You have already submitted feedback recently. Please wait before submitting again.'));
    }
    
    const feedback = await CustomerFeedback.create({
      ...sanitizedData, ipAddress, userAgent: req.headers['user-agent']
    });
    
    res.status(201).json(apiResponse(true, 'Thank you for your feedback! It will be reviewed shortly.', {
      feedback: { id: feedback._id, name: feedback.name, rating: feedback.rating, message: feedback.message, createdAt: feedback.createdAt }
    }));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to submit feedback'));
  }
});

module.exports = router;