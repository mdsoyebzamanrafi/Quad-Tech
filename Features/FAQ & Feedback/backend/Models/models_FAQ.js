const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, maxlength: 500 },
  answer: { type: String, required: true, trim: true, maxlength: 5000 },
  category: {
    type: String,
    required: true,
    enum: ['Orders', 'Payments', 'Shipping & Delivery', 'Returns & Refunds', 'Products', 'Account & Security', 'Support']
  },
  helpfulVotes: { type: Number, default: 0 },
  notHelpfulVotes: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

faqSchema.index({ question: 'text', answer: 'text', category: 'text' });
faqSchema.index({ category: 1, order: 1 });

faqSchema.virtual('helpfulnessScore').get(function() {
  const total = this.helpfulVotes + this.notHelpfulVotes;
  return total === 0 ? 0 : Math.round((this.helpfulVotes / total) * 100);
});

module.exports = mongoose.model('FAQ', faqSchema);