import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ArrowUpDown, Loader2, AlertCircle, MessageCircleQuestion } from 'lucide-react';
import FAQAccordion from './FAQAccordion';
import { useFAQs } from '../hooks/useFAQs';
import { FAQSortOption } from '../types';

const FAQSection: React.FC = () => {
  const { faqs, categories, loading, error, search, setSearch, category, setCategory, sortBy, setSortBy, voteFAQ, viewFAQ } = useFAQs();
  const totalFAQs = Object.values(faqs).flat().length;
  const hasResults = totalFAQs > 0;
  const allFAQs = Object.values(faqs).flat();
  const popularFAQIds = allFAQs.sort((a, b) => b.helpfulVotes - a.helpfulVotes).slice(0, 3).map(f => f._id);

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h2>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto">Find answers to common questions about orders, payments, shipping, and more.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-8">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="pl-9 pr-8 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white appearance-none cursor-pointer min-w-[160px]">
                <option value="all">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as FAQSortOption)}
                className="pl-9 pr-8 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white appearance-none cursor-pointer min-w-[140px]">
                <option value="order">Default</option>
                <option value="popular">Most Helpful</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>
        </div>
        {search && <div className="mt-3 text-sm text-gray-500">
          {hasResults ? <span>Found <strong>{totalFAQs}</strong> result{totalFAQs !== 1 ? 's' : ''} for "{search}"</span> : <span>No results found for "{search}"</span>}
        </div>}
      </motion.div>

      {loading && <div className="flex flex-col items-center justify-center py-16"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" /><p className="text-gray-500">Loading FAQs...</p></div>}
      {error && !loading && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center"><AlertCircle className="w-12 h-12 text-red-400 mb-3" /><h3 className="text-lg font-semibold text-gray-800 mb-1">Failed to load FAQs</h3><p className="text-gray-500 mb-4">{error}</p><button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Try Again</button></motion.div>}
      {!loading && !error && !hasResults && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center"><MessageCircleQuestion className="w-16 h-16 text-gray-300 mb-4" /><h3 className="text-xl font-semibold text-gray-800 mb-2">No FAQs found</h3><p className="text-gray-500 max-w-md">We couldn't find any FAQs matching your search. Try different keywords or browse all categories.</p></motion.div>}

      {!loading && !error && hasResults && (
        <div className="space-y-8">
          <AnimatePresence mode="wait">
            {Object.entries(faqs).map(([cat, categoryFaqs]) => (
              <motion.div key={cat} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span>{cat}<span className="text-sm font-normal text-gray-400">({categoryFaqs.length})</span></h3>
                <div className="space-y-3">
                  {categoryFaqs.map((faq) => <FAQAccordion key={faq._id} faq={faq} onVote={voteFAQ} onView={viewFAQ} isPopular={popularFAQIds.includes(faq._id)} />)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
};

export default FAQSection;