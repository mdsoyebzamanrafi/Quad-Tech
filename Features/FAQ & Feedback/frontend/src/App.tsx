import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, HelpCircle, Star } from 'lucide-react';
import FAQSection from './components/FAQSection';
import FeedbackForm from './components/FeedbackForm';
import FeedbackList from './components/FeedbackList';
import RatingStats from './components/RatingStats';
import Testimonials from './components/Testimonials';
import { useFeedback } from './hooks/useFeedback';

const App: React.FC = () => {
  const {
    feedbacks, stats, loading, error, page, setPage, totalPages,
    sortBy, setSortBy, filterRating, setFilterRating, submitCustomerFeedback,
  } = useFeedback();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">T</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Trail</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#faq" className="text-gray-600 hover:text-indigo-600 transition-colors">FAQ</a>
            <a href="#feedback" className="text-gray-600 hover:text-indigo-600 transition-colors">Reviews</a>
            <a href="#contact" className="text-gray-600 hover:text-indigo-600 transition-colors">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-bold mb-4">
            How Can We Help You?
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-indigo-100 text-lg max-w-2xl mx-auto">
            Find answers to your questions, share your feedback, and help us improve your shopping experience.
          </motion.p>
        </div>
      </section>

      {/* Testimonials */}
      {stats?.recentFeedback && stats.recentFeedback.length > 0 && <Testimonials feedbacks={stats.recentFeedback} />}

      {/* FAQ Section */}
      <section id="faq" className="py-16"><FAQSection /></section>

      {/* Feedback Section */}
      <section id="feedback" className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium mb-4">
              <MessageSquare className="w-4 h-4" />Customer Reviews
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Share Your Experience</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Your feedback helps us improve and helps other customers make informed decisions.</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1"><RatingStats stats={stats} loading={loading} /></div>
            <div className="lg:col-span-2 space-y-8">
              <FeedbackForm onSubmit={submitCustomerFeedback} />
              <div className="pt-8 border-t border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400" />All Reviews
                </h3>
                <FeedbackList feedbacks={feedbacks} loading={loading} error={error} page={page} totalPages={totalPages}
                  sortBy={sortBy} filterRating={filterRating} onPageChange={setPage} onSortChange={setSortBy} onFilterChange={setFilterRating} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contact" className="py-16 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <HelpCircle className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Still Need Help?</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">Our support team is available Saturday-Thursday, 9 AM - 9 PM. Reach out and we'll get back to you shortly.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:support@trail.com" className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">Email Support</a>
            <a href="tel:+8801234567890" className="px-6 py-3 border border-gray-600 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors">Call Us</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p>© 2024 Trail. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;