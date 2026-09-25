import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OceanBackground } from './components/ocean/OceanBackground';
import { HeaderBar } from './components/navigation/HeaderBar';
import { OctopusCharacter } from './components/octopus/OctopusCharacter';
import { CategoryFilterBar, type CategoryFilter } from './components/navigation/CategoryFilterBar';
import { LiveTelemetryPill } from './components/telemetry/LiveTelemetryPill';
import { ProjectShowcaseDrawer } from './components/showcase/ProjectShowcaseDrawer';
import { RecruiterDrawer } from './components/recruiter/RecruiterDrawer';
import { DrawingModal } from './components/modals/DrawingModal';
import { useAudioSynth } from './utils/useAudioSynth';
import { TECH_NODES } from './data/techStack';
import type { MousePosition, TechNode } from './types';
import { Sparkles, Heart } from 'lucide-react';

export const App: React.FC = () => {
  const [isRecruiterDrawerOpen, setIsRecruiterDrawerOpen] = useState(false);
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [hoveredTechId, setHoveredTechId] = useState<string | null>(null);
  const [selectedTech, setSelectedTech] = useState<TechNode | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [isMuted, setIsMuted] = useState(true);

  // Procedural Web Audio Synthesizer
  const { playBubblePop, playChime, playBlushChime } = useAudioSynth(isMuted);

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

  const handleHoverTech = (id: string | null) => {
    if (id && id !== hoveredTechId) {
      playBubblePop();
    }
    setHoveredTechId(id);
  };

  const handleSelectTech = (tech: TechNode) => {
    playChime();
    setSelectedTech(tech);
  };

  const activeTech = TECH_NODES.find((t) => t.id === hoveredTechId);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. Deep Ocean Canvas Environment (Water displacement + bubbles + caustics) */}
      <OceanBackground />

      {/* 2. Top Glassmorphic Navigation */}
      <HeaderBar
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        onOpenRecruiterDrawer={() => setIsRecruiterDrawerOpen(true)}
        onOpenDrawingModal={() => setIsDrawingModalOpen(true)}
      />

      {/* 3. Category Filter Bar (Floating beneath header) */}
      <div className="fixed top-16 sm:top-18 left-0 right-0 z-30 flex items-center justify-center px-4 pointer-events-none">
        <CategoryFilterBar
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />
      </div>

      {/* 4. Central Living Character Stage with Tentacles & Teardrops */}
      <section className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pt-14 pb-12">
        <div className="relative w-full max-w-4xl mx-auto flex items-center justify-center">
          <OctopusCharacter
            mouseX={mousePos.x}
            mouseY={mousePos.y}
            techNodes={TECH_NODES}
            hoveredTechId={hoveredTechId}
            activeCategory={activeCategory}
            onHoverTech={handleHoverTech}
            onSelectTech={handleSelectTech}
            onHeadClick={playBlushChime}
          />
        </div>

        {/* 5. Interactive Live Feedback HUD (Shows what the octopus noticed) */}
        <div className="mt-1 text-center max-w-lg pointer-events-auto h-11 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {activeTech ? (
              <motion.div
                key={activeTech.id}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => handleSelectTech(activeTech)}
                className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass-panel border-cyan-500/40 text-xs shadow-lg backdrop-blur-md cursor-pointer hover:bg-slate-800/80 active:scale-95 transition-all"
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
                <span className="text-[10px] text-cyan-400 font-bold ml-1">
                  (Click to inspect)
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
                <span>Hover over any tech droplet • Click to explore architectural proofs</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* 6. Bottom Telemetry Status Bar with Live Cloud Health Probe */}
      <footer className="fixed bottom-3.5 left-6 right-6 z-30 flex items-center justify-between pointer-events-none">
        {/* Live Cloud Telemetry Gauge */}
        <div className="pointer-events-auto">
          <LiveTelemetryPill />
        </div>

        {/* Cursor Coordinates & Tribute Link */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 font-mono">
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

      {/* 7. Comprehensive Architectural Project Showcase Drawer */}
      <ProjectShowcaseDrawer
        tech={selectedTech}
        onClose={() => setSelectedTech(null)}
      />

      {/* 8. Recruiter Brief Drawer */}
      <RecruiterDrawer
        isOpen={isRecruiterDrawerOpen}
        onClose={() => setIsRecruiterDrawerOpen(false)}
      />

      {/* 9. Sketch Lightbox Modal */}
      <DrawingModal
        isOpen={isDrawingModalOpen}
        onClose={() => setIsDrawingModalOpen(false)}
      />
    </main>
  );
};

export default App;
