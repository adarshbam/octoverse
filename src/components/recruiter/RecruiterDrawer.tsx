import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, Mail, Shield, Zap, Server } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GithubIcon, LinkedinIcon } from '../icons/BrandIcons';

interface RecruiterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecruiterDrawer: React.FC<RecruiterDrawerProps> = ({ isOpen, onClose }) => {
  const handleDownloadResume = () => {
    try {
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#38bdf8', '#10b981', '#fbbf24', '#ffffff'],
        shapes: ['circle'],
        zIndex: 99999,
      });
    } catch {
      // Confetti fallback
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 cursor-pointer"
          />

          {/* Slide-out Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-slate-900/95 border-l border-cyan-500/20 z-50 p-6 flex flex-col justify-between overflow-y-auto backdrop-blur-2xl shadow-2xl text-slate-200"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <h2 className="text-base font-bold text-white tracking-wide">
                    Recruiter Executive Brief
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Candidate Snapshot */}
              <div className="mt-5 space-y-2">
                <h3 className="text-lg font-black text-white">Adarsh Singh</h3>
                <p className="text-xs text-cyan-400 font-semibold tracking-wide">
                  Software Engineer • Distributed Systems & Backend Focus
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Specialized in stream-based high-concurrency architectures, direct S3 multipart uploading, zero-egress edge caching, and scalable full-stack React systems.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <a
                  href="/resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleDownloadResume}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-cyan-500/20"
                >
                  <Download size={14} />
                  <span>Download Resume</span>
                </a>
                <a
                  href="mailto:adarshbambahadur@gmail.com"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl glass-panel hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                >
                  <Mail size={14} className="text-cyan-400" />
                  <span>Send Email</span>
                </a>
              </div>

              {/* High-Signal Engineering Proofs */}
              <div className="mt-6 space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Key Systems Engineered
                </h4>

                {/* Vault Cloud Storage */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Server size={14} className="text-emerald-400" />
                      Vault Cloud Storage Engine
                    </span>
                    <a
                      href="https://yourvaultstorage.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      Live App <ExternalLink size={10} />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Direct-to-S3 chunk uploads, Cloudflare Edge Worker HMAC verification ($0 egress fees), and Redis-backed session locks.
                  </p>
                </div>

                {/* Custom CI/CD Pipeline */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-400" />
                      Self-Hosted CI/CD Runner
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Active Production</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    GitHub Webhook listener with HMAC verification, child process runner mutex locks, and zero-downtime PM2 reload orchestration.
                  </p>
                </div>

                {/* Security Research */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Shield size={14} className="text-rose-400" />
                      JWT Vulnerability Research Lab
                    </span>
                    <a
                      href="https://github.com/adarshbam/exployting-jwt-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      GitHub <ExternalLink size={10} />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Algorithmic confusion exploit testbed (RS256 vs HS256), signature stripping attacks, and defensive cryptographic mitigations.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Links */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <a
                  href="https://linkedin.com/in/adarsh-singh-bam"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <LinkedinIcon size={14} className="text-blue-400" /> LinkedIn
                </a>
                <a
                  href="https://github.com/adarshbam"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <GithubIcon size={14} /> GitHub
                </a>
              </div>
              <span className="text-[11px] text-slate-500">Target: US Remote / 50+ LPA</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
