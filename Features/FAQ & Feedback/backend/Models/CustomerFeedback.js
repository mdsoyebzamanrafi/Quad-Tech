const mongoose = require('mongoose');

const customerFeedbackSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 100, default: 'Anonymous' },
  email: { type: String, required: true, trim: true, lowercase: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  orderId: { type: String, trim: true },
  isApproved: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  ipAddress: { type: String, required: true },
  userAgent: { type: String }
}, { timestamps: true });

customerFeedbackSchema.index({ email: 1, createdAt: -1 });
customerFeedbackSchema.index({ isApproved: 1, createdAt: -1 });
customerFeedbackSchema.index({ isFeatured: 1, rating: -1 });

module.exports = mongoose.model('CustomerFeedback', customerFeedbackSchema);