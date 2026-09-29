import React from 'react';
import { motion } from 'framer-motion';
import type { TechNode } from '../../types';
import type { VolumetricTentacleDef } from './types';
import { TechTeardropOrb } from './TechTeardropOrb';

interface TentacleProps {
  tech: TechNode;
  config: VolumetricTentacleDef;
  isHovered: boolean;
  isDimmed?: boolean;
  onHover: (id: string | null) => void;
  onClick: (tech: TechNode) => void;
}

export const Tentacle: React.FC<TentacleProps> = ({
  tech,
  config,
  isHovered,
  isDimmed = false,
  onHover,
  onClick,
}) => {
  const { pathD, tip, suctionCups } = config;

  return (
    <g
      id={`volumetric-tentacle-${tech.id}`}
      opacity={isDimmed ? 0.3 : 1}
      className="transition-opacity duration-300"
    >
      <defs>
        {/* Veyra Bioluminescent Teal Tentacle Gradient */}
        <linearGradient
          id={`tentacle-skin-${tech.id}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#4fd1c5" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#319795" stopOpacity="0.95" />
          <stop offset="85%" stopColor="#285e61" />
          <stop offset="100%" stopColor="#1d4044" />
        </linearGradient>

        {/* Soft Translucent Suction Cup Gradient */}
        <radialGradient id={`suction-grad-${tech.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e6fffa" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#81e6d9" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#319795" stopOpacity="0.1" />
        </radialGradient>
      </defs>

      {/* 1. Outer Bioluminescent Bloom on Hover */}
      {isHovered && (
        <motion.path
          d={pathD}
          fill="none"
          stroke={tech.glowColor}
          strokeWidth="20"
          strokeLinecap="round"
          filter="blur(12px)"
          opacity={0.7}
        />
      )}

      {/* 2. Main Volumetric Tapered Limb (Closed Fleshy Path) */}
      <motion.path
        d={pathD}
        fill={`url(#tentacle-skin-${tech.id})`}
        stroke="rgba(178, 245, 234, 0.4)"
        strokeWidth={isHovered ? 2 : 1.2}
        strokeLinejoin="round"
        className="transition-all duration-300"
        style={{
          filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))',
        }}
        animate={{
          scale: isHovered ? 1.01 : 1,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      />

      {/* 3. Luminous Translucent Suction Cups along inner curve */}
      <g id={`suction-cups-${tech.id}`} className="pointer-events-none">
        {suctionCups.map((cup, i) => (
          <ellipse
            key={i}
            cx={cup.cx}
            cy={cup.cy}
            rx={cup.rx}
            ry={cup.ry}
            transform={cup.angle ? `rotate(${cup.angle} ${cup.cx} ${cup.cy})` : undefined}
            fill={`url(#suction-grad-${tech.id})`}
            stroke="rgba(129, 230, 217, 0.5)"
            strokeWidth="0.5"
            className="drop-shadow-[0_0_4px_rgba(79,209,197,0.4)]"
          />
        ))}
      </g>

      {/* 4. Magical Glowing Artifact (Orb) at Curled Tip */}
      <g transform={`translate(${tip.x}, ${tip.y + 12})`}>
        <TechTeardropOrb
          tech={tech}
          isHovered={isHovered}
          onHover={onHover}
          onClick={onClick}
        />
      </g>
    </g>
  );
};
