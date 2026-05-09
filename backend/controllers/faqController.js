import asyncHandler from '../utils/asyncHandler.js';
import FAQ from '../models/FAQ.js';
import FAQFeedback from '../models/FAQFeedback.js';
import { sanitizeInput, getClientIP } from '../utils/faqHelpers.js';

/**
 * @desc    Fetch all active FAQs with optional search, category filtering, and sorting
 * @route   GET /api/faqs
 * @access  Public
 */
export const getFAQs = asyncHandler(async (req, res) => {
  const { search, category, sortBy = 'order' } = req.query;
  let query = { isActive: true }; // Only fetch FAQs that are marked as active
  
  // Apply category filter if provided
  if (category && category !== 'all') query.category = category;
  
  // Apply text search across question, answer, and category fields
  if (search && search.trim()) {
    const sanitizedSearch = sanitizeInput(search.trim());
    query.$or = [
      { question: { $regex: sanitizedSearch, $options: 'i' } },
      { answer: { $regex: sanitizedSearch, $options: 'i' } },
      { category: { $regex: sanitizedSearch, $options: 'i' } }
    ];
  }
  
  // Determine sorting logic based on user preference
  let sortOption = {};
  switch (sortBy) {
    case 'popular': sortOption = { helpfulVotes: -1, viewCount: -1 }; break;
    case 'newest': sortOption = { createdAt: -1 }; break;
    default: sortOption = { category: 1, order: 1 };
  }
  
  // Fetch FAQs from database with applied query and sorting
  const faqs = await FAQ.find(query).sort(sortOption);
  
  // Group FAQs by category for a better frontend presentation
  const groupedFAQs = faqs.reduce((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = [];
    acc[faq.category].push(faq);
    return acc;
  }, {});
  
  res.json({
    success: true,
    message: 'FAQs fetched successfully',
    data: groupedFAQs,
    meta: {
      total: faqs.length,
      categories: Object.keys(groupedFAQs)
    }
  });
});

/**
 * @desc    Get all unique categories from active FAQs
 * @route   GET /api/faqs/categories
 * @access  Public
 */
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await FAQ.distinct('category', { isActive: true });
  res.json({ success: true, message: 'Categories fetched successfully', data: categories });
});

/**
 * @desc    Create a new FAQ (Admin only)
 * @route   POST /api/faqs
 * @access  Private/Admin
 */
export const createFAQ = asyncHandler(async (req, res) => {
  // Sanitize input to prevent injection and create the FAQ record
  const faq = await FAQ.create(sanitizeInput(req.body));
  res.status(201).json({ success: true, message: 'FAQ created successfully', data: faq });
});

/**
 * @desc    Update an existing FAQ (Admin only)
 * @route   PUT /api/faqs/:id
 * @access  Private/Admin
 */
export const updateFAQ = asyncHandler(async (req, res) => {
  // Update FAQ by ID and return the updated document
  const faq = await FAQ.findByIdAndUpdate(req.params.id, sanitizeInput(req.body), { new: true, runValidators: true });
  if (!faq) {
    res.status(404);
    throw new Error('FAQ not found');
  }
  res.json({ success: true, message: 'FAQ updated successfully', data: faq });
});

/**
 * @desc    Soft delete an FAQ by marking it inactive (Admin only)
 * @route   DELETE /api/faqs/:id
 * @access  Private/Admin
 */
export const deleteFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!faq) {
    res.status(404);
    throw new Error('FAQ not found');
  }
  res.json({ success: true, message: 'FAQ deleted successfully' });
});

/**
 * @desc    Submit helpfulness feedback for an FAQ
 * @route   POST /api/faqs/:id/feedback
 * @access  Public (Limited by IP address)
 */
export const submitFAQFeedback = asyncHandler(async (req, res) => {
  const { helpful } = req.body;
  const faqId = req.params.id;
  const ipAddress = getClientIP(req);
  
  // Check if this IP has already voted on this FAQ in the last 24 hours to prevent spam
  const existingVote = await FAQFeedback.findOne({
    faqId, ipAddress, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
  
  if (existingVote) {
    res.status(400);
    throw new Error('You have already voted on this FAQ recently');
  }
  
  // Log the feedback in a separate collection for auditing
  await FAQFeedback.create({ faqId, helpful, ipAddress, userAgent: req.headers['user-agent'] });
  
  // Increment either helpful or notHelpful votes in the main FAQ document
  const updateField = helpful ? { $inc: { helpfulVotes: 1 } } : { $inc: { notHelpfulVotes: 1 } };
  const faq = await FAQ.findByIdAndUpdate(faqId, updateField, { new: true });
  
  if (!faq) {
    res.status(404);
    throw new Error('FAQ not found');
  }
  
  res.json({
    success: true,
    message: 'Thank you for your feedback!',
    data: {
      helpfulVotes: faq.helpfulVotes,
      notHelpfulVotes: faq.notHelpfulVotes,
      helpfulnessScore: faq.helpfulnessScore
    }
  });
});

/**
 * @desc    Get a single FAQ by ID and increment its view count
 * @route   GET /api/faqs/:id
 * @access  Public
 */
export const getFAQById = asyncHandler(async (req, res) => {
  // Find FAQ and increment view count for popularity tracking
  const faq = await FAQ.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }, { new: true });
  if (!faq) {
    res.status(404);
    throw new Error('FAQ not found');
  }
  res.json({ success: true, message: 'FAQ fetched successfully', data: faq });
});

