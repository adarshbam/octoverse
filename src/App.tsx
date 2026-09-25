import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OceanBackground } from './components/ocean/OceanBackground';
import { HeaderBar } from './components/navigation/HeaderBar';
import { OctopusCharacter } from './components/octopus/OctopusCharacter';
import { RecruiterDrawer } from './components/recruiter/RecruiterDrawer';
import { DrawingModal } from './components/modals/DrawingModal';
import { TECH_NODES } from './data/techStack';
import type { MousePosition, TechNode } from './types';
import { Sparkles, Heart, ExternalLink } from 'lucide-react';
import { GithubIcon } from './components/icons/BrandIcons';

export const App: React.FC = () => {
  const [isRecruiterDrawerOpen, setIsRecruiterDrawerOpen] = useState(false);
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [hoveredTechId, setHoveredTechId] = useState<string | null>(null);
  const [selectedTech, setSelectedTech] = useState<TechNode | null>(null);

  const [mousePos, setMousePos] = useState<MousePosition>({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
    normalizedX: 0,
    normalizedY: 0,
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
      const normalizedY = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({
        x: e.clientX,
        y: e.clientY,
        normalizedX,
        normalizedY,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const activeTech = TECH_NODES.find((t) => t.id === hoveredTechId);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. Deep Ocean Canvas Environment (Water displacement + bubbles + caustics) */}
      <OceanBackground />

      {/* 2. Top Glassmorphic Navigation */}
      <HeaderBar
        onOpenRecruiterDrawer={() => setIsRecruiterDrawerOpen(true)}
        onOpenDrawingModal={() => setIsDrawingModalOpen(true)}
      />

      {/* 3. Central Living Character Stage with Tentacles & Teardrops */}
      <section className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pt-10 pb-12">
        <div className="relative w-full max-w-4xl mx-auto flex items-center justify-center">
          <OctopusCharacter
            mouseX={mousePos.x}
            mouseY={mousePos.y}
            techNodes={TECH_NODES}
            hoveredTechId={hoveredTechId}
            onHoverTech={setHoveredTechId}
            onSelectTech={(tech) => setSelectedTech(tech)}
          />
        </div>

        {/* 4. Interactive Live Feedback HUD (Shows what the octopus noticed) */}
        <div className="mt-2 text-center max-w-lg pointer-events-auto h-12 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {activeTech ? (
              <motion.div
                key={activeTech.id}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass-panel border-cyan-500/30 text-xs shadow-lg backdrop-blur-md"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: activeTech.color }}
                />
                <span className="font-bold text-white tracking-wide">
                  {activeTech.name}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300 font-medium">
                  {activeTech.description}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="idle-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/60 border border-slate-700/50 text-[11.5px] text-slate-400 font-medium backdrop-blur-sm"
              >
                <Sparkles size={13} className="text-cyan-400" />
                <span>Hover over any tech droplet to see the tentacle curl & react</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* 5. Bottom Telemetry Status Bar */}
      <footer className="fixed bottom-3.5 left-6 right-6 z-30 flex items-center justify-between text-[11px] text-slate-500 font-mono pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>DAY 3 ACTIVE • 11 TENTACLES WITH BÉZIER CURVES & SUCTION CUPS</span>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={() => setIsDrawingModalOpen(true)}
            className="pointer-events-auto flex items-center gap-1.5 text-rose-400/80 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <Heart size={12} className="fill-rose-500/40" />
            <span>Girlfriend's Drawing</span>
          </button>
          <span>•</span>
          <span>CURSOR: [{mousePos.normalizedX.toFixed(2)}, {mousePos.normalizedY.toFixed(2)}]</span>
        </div>
      </footer>

      {/* 6. Quick Preview Modal when any tech is clicked */}
      <AnimatePresence>
        {selectedTech && selectedTech.project && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTech(null)}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-lg glass-panel bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedTech.color }}
                  />
                  <h3 className="text-base font-bold text-white">
                    {selectedTech.project.title}
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {selectedTech.project.badge}
                </span>
              </div>

              <p className="text-xs text-cyan-400 font-semibold">
                {selectedTech.project.tagline}
              </p>

              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedTech.project.description}
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {selectedTech.project.metrics.map((m, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-medium"
                  >
                    ✓ {m}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="flex items-center gap-3">
                  {selectedTech.project.liveUrl && (
                    <a
                      href={selectedTech.project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-cyan-500/20"
                    >
                      <span>Live Production</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                  <a
                    href={selectedTech.project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-panel hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                  >
                    <GithubIcon size={13} />
                    <span>View Repository</span>
                  </a>
                </div>
                <button
                  onClick={() => setSelectedTech(null)}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Drawers & Modals */}
      <RecruiterDrawer
        isOpen={isRecruiterDrawerOpen}
        onClose={() => setIsRecruiterDrawerOpen(false)}
      />

      <DrawingModal
        isOpen={isDrawingModalOpen}
        onClose={() => setIsDrawingModalOpen(false)}
      />
    </main>
  );
};

export default App;
