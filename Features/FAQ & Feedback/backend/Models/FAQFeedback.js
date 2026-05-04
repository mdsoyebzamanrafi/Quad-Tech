const mongoose = require('mongoose');

const faqFeedbackSchema = new mongoose.Schema({
  faqId: { type: mongoose.Schema.Types.ObjectId, ref: 'FAQ', required: true },
  helpful: { type: Boolean, required: true },
  ipAddress: { type: String, required: true },
  userAgent: { type: String }
}, { timestamps: true });

faqFeedbackSchema.index({ faqId: 1, ipAddress: 1, createdAt: 1 });
module.exports = mongoose.model('FAQFeedback', faqFeedbackSchema);