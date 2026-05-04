import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Send, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { FeedbackFormData } from '../types';

interface FeedbackFormProps {
  onSubmit: (data: FeedbackFormData) => Promise<{ success: boolean; error?: string }>;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<FeedbackFormData>({ name: '', email: '', rating: 0, message: '', orderId: '' });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^\\S+@\\S+\\.\\S+$/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (formData.rating === 0) newErrors.rating = 'Please select a rating';
    if (!formData.message.trim()) newErrors.message = 'Message is required';
    else if (formData.message.trim().length < 10) newErrors.message = 'Message must be at least 10 characters';
    else if (formData.message.trim().length > 2000) newErrors.message = 'Message cannot exceed 2000 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const result = await onSubmit(formData);
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
      setFormData({ name: '', email: '', rating: 0, message: '', orderId: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } else {
      setErrors({ submit: result.error || 'Failed to submit feedback. Please try again.' });
    }
  };

  if (submitted) return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-green-800 mb-2">Thank You!</h3>
      <p className="text-green-600">Your feedback has been submitted successfully. We appreciate your time and will review it shortly.</p>
    </motion.div>
  );

  return (
    <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Share Your Experience</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Name <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Your name"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
          <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com"
            className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}`} />
          <AnimatePresence>{errors.email && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-500 text-sm mt-1">{errors.email}</motion.p>}</AnimatePresence>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Rating <span className="text-red-500">*</span></label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => setFormData({ ...formData, rating: star })} onMouseEnter={() => setHoveredRating(star)} onMouseLeave={() => setHoveredRating(0)} className="p-1 transition-transform hover:scale-110">
              <Star className={`w-8 h-8 transition-colors ${star <= (hoveredRating || formData.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-500">{formData.rating > 0 && ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][formData.rating - 1]}</span>
        </div>
        <AnimatePresence>{errors.rating && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-500 text-sm mt-1">{errors.rating}</motion.p>}</AnimatePresence>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Order ID <span className="text-gray-400 font-normal">(optional)</span></label>
        <input type="text" value={formData.orderId} onChange={(e) => setFormData({ ...formData, orderId: e.target.value })} placeholder="e.g., TRL-2024-001234"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Feedback <span className="text-red-500">*</span></label>
        <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="Tell us about your experience..." rows={5}
          className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${errors.message ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}`} />
        <div className="flex justify-between mt-1">
          <AnimatePresence>{errors.message && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-500 text-sm">{errors.message}</motion.p>}</AnimatePresence>
          <span className={`text-xs ml-auto ${formData.message.length > 2000 ? 'text-red-500' : 'text-gray-400'}`}>{formData.message.length}/2000</span>
        </div>
      </div>

      <AnimatePresence>{errors.submit && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-red-500 shrink-0" /><p className="text-red-700 text-sm">{errors.submit}</p></motion.div>}</AnimatePresence>

      <button type="submit" disabled={submitting}
        className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
        {submitting ? <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</> : <><Send className="w-5 h-5" />Submit Feedback</>}
      </button>
    </motion.form>
  );
};

export default FeedbackForm;