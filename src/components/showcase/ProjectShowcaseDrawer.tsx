import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, ShieldCheck, Cpu, Database, CheckCircle2, Terminal } from 'lucide-react';
import { GithubIcon } from '../icons/BrandIcons';
import type { TechNode } from '../../types';

interface ProjectShowcaseDrawerProps {
  tech: TechNode | null;
  onClose: () => void;
}

type TabType = 'architecture' | 'metrics' | 'decisions';

export const ProjectShowcaseDrawer: React.FC<ProjectShowcaseDrawerProps> = ({
  tech,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('architecture');

  if (!tech || !tech.project) return null;
  const project = tech.project;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm cursor-pointer"
        />

        {/* Slide-out Architectural Showcase Drawer */}
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="relative z-10 w-full max-w-xl h-full bg-slate-900/95 border-l border-cyan-500/20 p-6 flex flex-col justify-between overflow-y-auto backdrop-blur-2xl shadow-2xl text-slate-200 select-text"
        >
          <div>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: tech.color }}
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Engineered System
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {project.badge}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  {project.title}
                </h2>
                <p className="text-xs text-cyan-400 font-semibold">
                  {project.tagline}
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 mt-4 p-1 rounded-xl bg-slate-950/60 border border-slate-800">
              <button
                onClick={() => setActiveTab('architecture')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'architecture'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Architecture Flow
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'metrics'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Metrics & Proofs
              </button>
              <button
                onClick={() => setActiveTab('decisions')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'decisions'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Design Decisions
              </button>
            </div>

            {/* Tab Content */}
            <div className="mt-5 space-y-4">
              {/* Tab 1: Architecture Flow */}
              {activeTab === 'architecture' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {project.description}
                  </p>

                  {/* Architecture Topology Box */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-[11px] space-y-2 text-slate-300">
                    <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                      <span className="flex items-center gap-1.5 font-bold text-white">
                        <Terminal size={12} className="text-cyan-400" />
                        System Topology
                      </span>
                      <span className="text-[10px] text-emerald-400">Zero Bottleneck</span>
                    </div>
                    <div className="text-xs leading-relaxed space-y-1.5 text-cyan-200">
                      <div>1. Client Request ──► CloudFront Edge (Cached Static Assets)</div>
                      <div>2. Dynamic API ────► AWS EC2 (PM2 Cluster + Nginx Gateway)</div>
                      <div>3. Direct Upload ──► S3 Presigned URLs (0-RAM Server Overhead)</div>
                      <div>4. Video Stream ───► Cloudflare Worker ($0 Egress Bandwidth)</div>
                    </div>
                  </div>

                  {/* Highlight Metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    {project.metrics.map((m, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center"
                      >
                        <span className="block text-[11px] font-bold text-cyan-400">
                          {m}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Tab 2: Metrics & Proofs */}
              {activeTab === 'metrics' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3">
                    <Cpu className="text-cyan-400 shrink-0 mt-0.5" size={16} />
                    <div className="space-y-1 text-xs">
                      <h4 className="font-bold text-white">Direct-to-S3 Multipart Uploads</h4>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Eliminates memory bottlenecks by offloading 100MB–5GB file chunk streaming directly from the browser to S3 object storage via presigned HMAC URLs.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3">
                    <Database className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                    <div className="space-y-1 text-xs">
                      <h4 className="font-bold text-white">Distributed Redis Rate Limiter</h4>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Token-bucket algorithm and sliding window rate limiters protect auth routes, phone verification, and presigned URL generation with &lt;1ms latency.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3">
                    <ShieldCheck className="text-purple-400 shrink-0 mt-0.5" size={16} />
                    <div className="space-y-1 text-xs">
                      <h4 className="font-bold text-white">Multi-Tier RBAC & ACID Rollups</h4>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        MongoDB transactions ensure directory sizes and hierarchical tree paths remain strictly consistent during folder renames and moves.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tab 3: Design Decisions */}
              {activeTab === 'decisions' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 text-xs"
                >
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      Why CloudFront + S3 for Frontend?
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Serving the SPA from 600+ edge locations eliminates cross-continental latency for US recruiters, reducing load time from ~350ms to &lt;15ms globally under AWS Always-Free Tier.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      Why Cloudflare Worker CDN for Downloads?
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Leveraged the Cloudflare + Backblaze Bandwidth Alliance to achieve $0 egress fees on high-bandwidth video and raw file streaming with HMAC signature verification.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-cyan-500/25 cursor-pointer"
                >
                  <span>Open Live Application</span>
                  <ExternalLink size={12} />
                </a>
              )}
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-panel hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <GithubIcon size={14} />
                <span>View GitHub Code</span>
              </a>
            </div>

            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
};
