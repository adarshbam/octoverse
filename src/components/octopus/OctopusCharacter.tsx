import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TechNode } from '../../types';
import { OctopusHead } from './OctopusHead';
import { OctopusEyes } from './OctopusEyes';
import { OctopusMouth } from './OctopusMouth';
import { TentacleSystem } from './TentacleSystem';
import { Heart } from 'lucide-react';

interface OctopusCharacterProps {
  mouseX: number;
  mouseY: number;
  techNodes: TechNode[];
  hoveredTechId: string | null;
  onHoverTech: (id: string | null) => void;
  onSelectTech: (tech: TechNode) => void;
}

export const OctopusCharacter: React.FC<OctopusCharacterProps> = ({
  mouseX,
  mouseY,
  techNodes,
  hoveredTechId,
  onHoverTech,
  onSelectTech,
}) => {
  const [isBlushing, setIsBlushing] = useState(false);
  const [blushSparkles, setBlushSparkles] = useState<number[]>([]);

  const handleHeadClick = () => {
    setIsBlushing(true);
    setBlushSparkles((prev) => [...prev, Date.now()]);

    // Reset blush after 3 seconds
    window.setTimeout(() => {
      setIsBlushing(false);
    }, 3000);
  };

  const isDelighted = Boolean(hoveredTechId) || isBlushing;

  return (
    <div className="relative w-full max-w-4xl mx-auto flex items-center justify-center pointer-events-auto select-none">
      {/* Interactive Floating Blush Heart Particles */}
      <AnimatePresence>
        {blushSparkles.map((id) => (
          <motion.div
            key={id}
            initial={{ opacity: 1, scale: 0.5, y: 0 }}
            animate={{ opacity: 0, scale: 1.4, y: -80 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            onAnimationComplete={() =>
              setBlushSparkles((prev) => prev.filter((item) => item !== id))
            }
            className="absolute top-12 z-30 pointer-events-none text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.9)]"
          >
            <Heart size={32} className="fill-rose-400" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Main Living Octopus SVG Canvas */}
      {/* ViewBox -340 -190 680 560 provides ample space for full tentacle reach */}
      <motion.svg
        viewBox="-330 -180 660 550"
        className="w-full h-auto max-h-[82vh] overflow-visible select-none drop-shadow-[0_25px_50px_rgba(2,132,199,0.35)]"
        animate={{
          y: [0, -10, 0],
          scaleY: [1, 1.02, 1],
          scaleX: [1, 0.99, 1],
          rotate: [-0.5, 0.5, -0.5],
        }}
        transition={{
          duration: 5.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* 1. TENTACLES & TEARDROP ORBS (Rendered behind head mantle) */}
        <TentacleSystem
          techNodes={techNodes}
          hoveredTechId={hoveredTechId}
          onHoverTech={onHoverTech}
          onSelectTech={onSelectTech}
        />

        {/* 2. HEAD MANTLE & CHEEKS (Renders over tentacle roots) */}
        <OctopusHead isBlushing={isBlushing} onClickHead={handleHeadClick} />

        {/* 3. EXPRESSIVE EYES (Tracks cursor & blinks) */}
        <OctopusEyes
          mouseX={mouseX}
          mouseY={mouseY}
          isHappy={isBlushing}
        />

        {/* 4. REACTIVE MOUTH (Opens to "Oh!" when tech is hovered) */}
        <OctopusMouth isOpen={isDelighted} isHappy={isBlushing} />
      </motion.svg>
    </div>
  );
};
