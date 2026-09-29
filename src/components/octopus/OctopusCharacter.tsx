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
  activeCategory?: string;
  isSleeping?: boolean;
  isWinking?: boolean;
  onHoverTech: (id: string | null) => void;
  onSelectTech: (tech: TechNode) => void;
  onHeadClick?: () => void;
  onDoubleClickEyes?: () => void;
}

export const OctopusCharacter: React.FC<OctopusCharacterProps> = ({
  mouseX,
  mouseY,
  techNodes,
  hoveredTechId,
  activeCategory = 'all',
  isSleeping = false,
  isWinking = false,
  onHoverTech,
  onSelectTech,
  onHeadClick,
  onDoubleClickEyes,
}) => {
  const [isBlushing, setIsBlushing] = useState(false);
  const [blushSparkles, setBlushSparkles] = useState<number[]>([]);

  const handleHeadClick = () => {
    setIsBlushing(true);
    setBlushSparkles((prev) => [...prev, Date.now()]);
    onHeadClick?.();

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
        {/* 1. TENTACLES & TEARDROP ORBS (Rendered behind head mantle so roots anchor under skirt) */}
        <TentacleSystem
          techNodes={techNodes}
          hoveredTechId={hoveredTechId}
          activeCategory={activeCategory}
          onHoverTech={onHoverTech}
          onSelectTech={onSelectTech}
        />

        {/* 2. HEAD MANTLE & CHEEKS (Smooth bioluminescent dome covering tentacle origins) */}
        <OctopusHead isBlushing={isBlushing} onClickHead={handleHeadClick} />

        {/* 3. EXPRESSIVE EYES (Tracks cursor, blinks, winks, sleeps) */}
        <OctopusEyes
          mouseX={mouseX}
          mouseY={mouseY}
          isHappy={isBlushing}
          isSleeping={isSleeping}
          isWinking={isWinking}
          onDoubleClickEyes={onDoubleClickEyes}
        />

        {/* 4. REACTIVE MOUTH (Opens to "Oh!" when tech is hovered, relaxed when asleep) */}
        <OctopusMouth
          isOpen={isDelighted && !isSleeping}
          isHappy={isBlushing}
          isSleeping={isSleeping}
        />

        {/* 5. FLOATING SLEEP "Zzz" BUBBLES */}
        {isSleeping && (
          <g id="octopus-sleeping-zzz" className="pointer-events-none select-none">
            {[
              { id: 1, x: 50, y: -90, size: 16, delay: 0 },
              { id: 2, x: 75, y: -120, size: 22, delay: 0.6 },
              { id: 3, x: 105, y: -155, size: 28, delay: 1.2 },
            ].map((z) => (
              <motion.text
                key={z.id}
                x={z.x}
                y={z.y}
                fill="#38bdf8"
                fontSize={z.size}
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
                opacity={0.8}
                className="drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                animate={{
                  y: [z.y, z.y - 25, z.y - 45],
                  x: [z.x, z.x + 8, z.x + 4],
                  opacity: [0, 0.9, 0],
                  scale: [0.8, 1.1, 1.25],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  delay: z.delay,
                  ease: 'easeInOut',
                }}
              >
                z
              </motion.text>
            ))}
          </g>
        )}
      </motion.svg>
    </div>
  );
};
