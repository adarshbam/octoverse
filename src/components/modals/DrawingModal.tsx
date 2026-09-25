import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Sparkles } from 'lucide-react';

interface DrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DrawingModal: React.FC<DrawingModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative z-10 w-full max-w-lg max-h-[90vh] bg-slate-900/95 border border-rose-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col glass-panel"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-300">
                <Heart size={18} className="fill-rose-500/40 text-rose-400" />
                <h3 className="font-bold text-sm sm:text-base text-white">
                  The Original Sketch & Story
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body with Sketch */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-700/60 shadow-inner bg-slate-950/40">
                <img
                  src="/sketch.png"
                  alt="Original octopus sketch by girlfriend"
                  className="w-full h-auto object-contain max-h-[55vh] mx-auto rounded-lg"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs text-rose-200/90 leading-relaxed space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-rose-300">
                  <Sparkles size={14} />
                  <span>How This Portfolio Was Born</span>
                </div>
                <p>
                  Hand-drawn in a student notebook by my girlfriend. She envisioned an octopus holding glowing water droplets with each technology I’ve mastered. What started as an adorable doodle became the entire interactive information architecture of this portfolio.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
