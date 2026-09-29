import React, { useState, useEffect } from 'react';
import { OceanBackground } from './components/ocean/OceanBackground';
import { OctopusCharacter } from './components/octopus/OctopusCharacter';
import { useAudioSynth } from './utils/useAudioSynth';
import { useIdleTimer } from './components/octopus/useIdleTimer';
import { TECH_NODES } from './data/techStack';
import type { MousePosition, TechNode } from './types';

export const App: React.FC = () => {
  const [hoveredTechId, setHoveredTechId] = useState<string | null>(null);
  const [isWinking, setIsWinking] = useState(false);

  // Inactivity detection (32s idle -> peaceful sleep mode)
  const isIdle = useIdleTimer(32000);
  const isSleeping = isIdle && !hoveredTechId;

  // Procedural Web Audio Synthesizer
  const { playBubblePop, playChime, playBlushChime } = useAudioSynth(true);

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

  const handleDoubleClickEyes = () => {
    setIsWinking(true);
    playChime();
    window.setTimeout(() => setIsWinking(false), 1200);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const normalizedX = (touch.clientX / window.innerWidth) * 2 - 1;
      const normalizedY = (touch.clientY / window.innerHeight) * 2 - 1;
      setMousePos({
        x: touch.clientX,
        y: touch.clientY,
        normalizedX,
        normalizedY,
      });
    }
  };

  const handleHoverTech = (id: string | null) => {
    if (id && id !== hoveredTechId) {
      playBubblePop();
    }
    setHoveredTechId(id);
  };

  const handleSelectTech = (tech: TechNode) => {
    playChime();
    console.log('Selected tech:', tech.id);
  };

  return (
    <main
      onTouchMove={handleTouchMove}
      className="relative w-screen h-screen overflow-hidden bg-[#00050a] font-sans select-none"
    >
      {/* 1. Deep Ocean Canvas Environment */}
      <OceanBackground />

      {/* 2. Central Living Character Stage */}
      <section className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pt-4 pb-4">
        <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
          <OctopusCharacter
            mouseX={mousePos.x}
            mouseY={mousePos.y}
            techNodes={TECH_NODES}
            hoveredTechId={hoveredTechId}
            isSleeping={isSleeping}
            isWinking={isWinking}
            onHoverTech={handleHoverTech}
            onSelectTech={handleSelectTech}
            onHeadClick={playBlushChime}
            onDoubleClickEyes={handleDoubleClickEyes}
          />
        </div>
      </section>
    </main>
  );
};

export default App;
