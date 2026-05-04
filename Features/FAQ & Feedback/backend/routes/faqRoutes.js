const express = require('express');
const router = express.Router();
const FAQ = require('../models/models_FAQ');
const FAQFeedback = require('../models/FAQFeedback');
const { apiResponse, sanitizeInput, getClientIP } = require('../utils/helpers');
const { faqValidation } = require('../middleware/validation');
const { faqVoteRateLimit } = require('../middleware/rateLimit');

// GET /api/faqs - Fetch all FAQs
router.get('/', async (req, res) => {
  try {
    const { search, category, sortBy = 'order' } = req.query;
    let query = { isActive: true };
    
    if (category && category !== 'all') query.category = category;
    
    if (search && search.trim()) {
      const sanitizedSearch = sanitizeInput(search.trim());
      query.$or = [
        { question: { $regex: sanitizedSearch, $options: 'i' } },
        { answer: { $regex: sanitizedSearch, $options: 'i' } },
        { category: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }
    
    let sortOption = {};
    switch (sortBy) {
      case 'popular': sortOption = { helpfulVotes: -1, viewCount: -1 }; break;
      case 'newest': sortOption = { createdAt: -1 }; break;
      default: sortOption = { category: 1, order: 1 };
    }
    
    const faqs = await FAQ.find(query).sort(sortOption);
    
    const groupedFAQs = faqs.reduce((acc, faq) => {
      if (!acc[faq.category]) acc[faq.category] = [];
      acc[faq.category].push(faq);
      return acc;
    }, {});
    
    res.json(apiResponse(true, 'FAQs fetched successfully', groupedFAQs, {
      total: faqs.length,
      categories: Object.keys(groupedFAQs)
    }));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to fetch FAQs'));
  }
});

// GET categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await FAQ.distinct('category', { isActive: true });
    res.json(apiResponse(true, 'Categories fetched successfully', categories));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to fetch categories'));
  }
});

// POST new FAQ
router.post('/', faqValidation.create, async (req, res) => {
  try {
    const faq = await FAQ.create(sanitizeInput(req.body));
    res.status(201).json(apiResponse(true, 'FAQ created successfully', faq));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to create FAQ'));
  }
});

// PUT update FAQ
router.put('/:id', faqValidation.update, async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndUpdate(req.params.id, sanitizeInput(req.body), { new: true, runValidators: true });
    if (!faq) return res.status(404).json(apiResponse(false, 'FAQ not found'));
    res.json(apiResponse(true, 'FAQ updated successfully', faq));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to update FAQ'));
  }
});

// DELETE FAQ (soft)
router.delete('/:id', async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!faq) return res.status(404).json(apiResponse(false, 'FAQ not found'));
    res.json(apiResponse(true, 'FAQ deleted successfully'));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to delete FAQ'));
  }
});

// POST vote on FAQ
router.post('/:id/feedback', faqVoteRateLimit, faqValidation.feedback, async (req, res) => {
  try {
    const { helpful } = req.body;
    const faqId = req.params.id;
    const ipAddress = getClientIP(req);
    
    const existingVote = await FAQFeedback.findOne({
      faqId, ipAddress, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    if (existingVote) {
      return res.status(400).json(apiResponse(false, 'You have already voted on this FAQ recently'));
    }
    
    await FAQFeedback.create({ faqId, helpful, ipAddress, userAgent: req.headers['user-agent'] });
    
    const updateField = helpful ? { $inc: { helpfulVotes: 1 } } : { $inc: { notHelpfulVotes: 1 } };
    const faq = await FAQ.findByIdAndUpdate(faqId, updateField, { new: true });
    
    if (!faq) return res.status(404).json(apiResponse(false, 'FAQ not found'));
    
    res.json(apiResponse(true, 'Thank you for your feedback!', {
      helpfulVotes: faq.helpfulVotes,
      notHelpfulVotes: faq.notHelpfulVotes,
      helpfulnessScore: faq.helpfulnessScore
    }));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to submit feedback'));
  }
});

// GET single FAQ
router.get('/:id', async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }, { new: true });
    if (!faq) return res.status(404).json(apiResponse(false, 'FAQ not found'));
    res.json(apiResponse(true, 'FAQ fetched successfully', faq));
  } catch (error) {
    res.status(500).json(apiResponse(false, 'Failed to fetch FAQ'));
  }
});

module.exports = router;