import asyncHandler from '../utils/asyncHandler.js';
import FAQ from '../models/FAQ.js';
import FAQFeedback from '../models/FAQFeedback.js';
import { sanitizeInput, getClientIP } from '../utils/faqHelpers.js';

export const getFAQs = asyncHandler(async (req, res) => {
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

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await FAQ.distinct('category', { isActive: true });
  res.json({ success: true, message: 'Categories fetched successfully', data: categories });
});

export const createFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.create(sanitizeInput(req.body));
  res.status(201).json({ success: true, message: 'FAQ created successfully', data: faq });
});

export const updateFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndUpdate(req.params.id, sanitizeInput(req.body), { new: true, runValidators: true });
  if (!faq) {
    res.status(404);
    throw new Error('FAQ not found');
  }
  res.json({ success: true, message: 'FAQ updated successfully', data: faq });
});

export const deleteFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!faq) {
    res.status(404);
    throw new Error('FAQ not found');
  }
  res.json({ success: true, message: 'FAQ deleted successfully' });
});

export const submitFAQFeedback = asyncHandler(async (req, res) => {
  const { helpful } = req.body;
  const faqId = req.params.id;
  const ipAddress = getClientIP(req);
  
  const existingVote = await FAQFeedback.findOne({
    faqId, ipAddress, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
  
  if (existingVote) {
    res.status(400);
    throw new Error('You have already voted on this FAQ recently');
  }
  
  await FAQFeedback.create({ faqId, helpful, ipAddress, userAgent: req.headers['user-agent'] });
  
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

export const getFAQById = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }, { new: true });
  if (!faq) {
    res.status(404);
    throw new Error('FAQ not found');
  }
  res.json({ success: true, message: 'FAQ fetched successfully', data: faq });
});
