import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ThumbsUp, ThumbsDown, CheckCircle, Eye } from 'lucide-react';
import { FAQ } from '../types';

interface FAQAccordionProps {
  faq: FAQ;
  onVote: (faqId: string, helpful: boolean) => Promise<{ success: boolean; error?: string }>;
  onView?: (faqId: string) => void;
  isPopular?: boolean;
}

const FAQAccordion: React.FC<FAQAccordionProps> = ({ faq, onVote, onView, isPopular = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [voted, setVoted] = useState<'helpful' | 'not-helpful' | null>(null);
  const [voteLoading, setVoteLoading] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);

  useEffect(() => {
    if (isOpen && !hasViewed && onView) {
      onView(faq._id);
      setHasViewed(true);
    }
  }, [isOpen, hasViewed, onView, faq._id]);

  const handleVote = async (helpful: boolean) => {
    if (voted || voteLoading) return;
    setVoteLoading(true);
    const result = await onVote(faq._id, helpful);
    setVoteLoading(false);
    if (result.success) {
      setVoted(helpful ? 'helpful' : 'not-helpful');
      setShowThanks(true);
      setTimeout(() => setShowThanks(false), 3000);
    }
  };

  const totalVotes = faq.helpfulVotes + faq.notHelpfulVotes;
  const helpfulPercent = totalVotes > 0 ? Math.round((faq.helpfulVotes / totalVotes) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl overflow-hidden transition-all duration-200 ${isOpen ? 'border-indigo-300 shadow-md bg-white' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'} ${isPopular ? 'ring-1 ring-amber-200' : ''}`}>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-5 text-left group">
        <div className="flex items-center gap-3 flex-1">
          {isPopular && <span className="shrink-0 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">Popular</span>}
          <h3 className={`font-medium text-base transition-colors ${isOpen ? 'text-indigo-700' : 'text-gray-800 group-hover:text-indigo-600'}`}>{faq.question}</h3>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 ml-4">
          <ChevronDown className={`w-5 h-5 ${isOpen ? 'text-indigo-500' : 'text-gray-400'}`} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-5 pb-5">
              <div className="pt-2 pb-4 text-gray-600 leading-relaxed border-t border-gray-100">{faq.answer}</div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{faq.viewCount} views</span>
                  {totalVotes > 0 && <span className="text-green-600 font-medium">{helpfulPercent}% found this helpful</span>}
                </div>
                <div className="flex items-center gap-2">
                  {showThanks ? (
                    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1 text-sm text-green-600 font-medium">
                      <CheckCircle className="w-4 h-4" />Thanks for your feedback!
                    </motion.span>
                  ) : (
                    <>
                      <span className="text-sm text-gray-500 mr-2">Did this help?</span>
                      <button onClick={() => handleVote(true)} disabled={voteLoading || voted !== null}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${voted === 'helpful' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                        <ThumbsUp className="w-3.5 h-3.5" />Yes ({faq.helpfulVotes})
                      </button>
                      <button onClick={() => handleVote(false)} disabled={voteLoading || voted !== null}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${voted === 'not-helpful' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                        <ThumbsDown className="w-3.5 h-3.5" />No ({faq.notHelpfulVotes})
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FAQAccordion;