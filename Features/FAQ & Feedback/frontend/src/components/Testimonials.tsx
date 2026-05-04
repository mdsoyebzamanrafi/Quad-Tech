import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { CustomerFeedback } from '../types';
import StarRating from './StarRating';

interface TestimonialsProps {
  feedbacks: CustomerFeedback[];
}

const Testimonials: React.FC<TestimonialsProps> = ({ feedbacks }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  if (feedbacks.length === 0) return null;

  const next = () => setCurrentIndex((prev) => (prev + 1) % feedbacks.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + feedbacks.length) % feedbacks.length);
  const current = feedbacks[currentIndex];

  return (
    <section className="w-full bg-gradient-to-br from-indigo-50 to-purple-50 py-16">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">What Our Customers Say</h2>
          <p className="text-gray-500">Real feedback from real shoppers</p>
        </motion.div>

        <div className="relative">
          <motion.div key={current._id} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 md:p-10 text-center">
            <Quote className="w-10 h-10 text-indigo-200 mx-auto mb-4" />
            <StarRating rating={current.rating} size="md" className="justify-center mb-4" />
            <p className="text-lg text-gray-700 leading-relaxed mb-6 max-w-2xl mx-auto">"{current.message}"</p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                {current.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-gray-900">{current.name || 'Anonymous'}</h4>
                <p className="text-sm text-gray-500">{new Date(current.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </motion.div>

          {feedbacks.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button onClick={next} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {feedbacks.length > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {feedbacks.map((_, idx) => (
              <button key={idx} onClick={() => setCurrentIndex(idx)} className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentIndex ? 'bg-indigo-600 w-6' : 'bg-gray-300'}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Testimonials;