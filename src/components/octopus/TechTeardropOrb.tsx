import React from 'react';
import { motion } from 'framer-motion';
import type { TechNode } from '../../types';
import {
  Server,
  Zap,
  Container,
  Cloud,
  Cpu,
  Database,
  Code2,
  Atom,
  GitBranch,
  ShieldCheck,
  Palette,
} from 'lucide-react';

interface TechTeardropOrbProps {
  tech: TechNode;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (tech: TechNode) => void;
}

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  Server,
  Zap,
  Container,
  Cloud,
  Cpu,
  Database,
  Code2,
  Atom,
  GitBranch,
  ShieldCheck,
  Palette,
};

export const TechTeardropOrb: React.FC<TechTeardropOrbProps> = ({
  tech,
  isHovered,
  onHover,
  onClick,
}) => {
  const IconComponent = ICON_MAP[tech.iconName] || Code2;

  return (
    <motion.g
      id={`orb-${tech.id}`}
      onMouseEnter={() => onHover(tech.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(tech);
      }}
      className="cursor-pointer select-none"
      animate={{
        scale: isHovered ? 1.18 : 1,
      }}
      transition={{ type: 'spring', damping: 18, stiffness: 280 }}
    >
      <defs>
        {/* Bioluminescent Gradient for the Droplet */}
        <radialGradient
          id={`drop-grad-${tech.id}`}
          cx="45%"
          cy="40%"
          r="65%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity={isHovered ? 0.9 : 0.35} />
          <stop offset="35%" stopColor={tech.color} stopOpacity={isHovered ? 0.85 : 0.25} />
          <stop offset="85%" stopColor="#091b33" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#020617" stopOpacity={0.95} />
        </radialGradient>

        {/* Specular Glint Gradient */}
        <linearGradient id={`drop-glint-${tech.id}`} x1="0%" y1="0%" x2="60%" y2="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* 1. Ambient Glow when hovered */}
      {isHovered && (
        <circle
          cx="0"
          cy="8"
          r="34"
          fill={tech.glowColor}
          filter="blur(14px)"
          opacity={0.8}
        />
      )}

      {/* 2. Teardrop / Water Drop SVG Geometry (matching girlfriend's sketch) */}
      {/* Pointed at top (0, -22) connecting to tentacle, rounded bulbous at bottom */}
      <path
        d="M 0 -22
           C -12 -12, -22 2, -22 15
           C -22 27, -12 36, 0 36
           C 12 36, 22 27, 22 15
           C 22 2, 12 -12, 0 -22 Z"
        fill={`url(#drop-grad-${tech.id})`}
        stroke={isHovered ? tech.color : 'rgba(56, 189, 248, 0.45)'}
        strokeWidth={isHovered ? 2.8 : 1.8}
        className="transition-colors duration-300"
      />

      {/* 3. Glass Specular Highlight (top-left glint) */}
      <path
        d="M -6 -12
           C -14 -4, -16 6, -14 16
           C -12 8, -10 -4, -6 -12 Z"
        fill={`url(#drop-glint-${tech.id})`}
      />

      {/* 4. Tech Icon inside Teardrop */}
      <g transform="translate(0, 8)">
        <foreignObject x="-12" y="-12" width="24" height="24">
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <IconComponent
              size={18}
              className="transition-all duration-300 drop-shadow-md"
              style={{
                color: isHovered ? '#ffffff' : tech.color,
                filter: isHovered ? `drop-shadow(0 0 6px ${tech.color})` : undefined,
              }}
            />
          </div>
        </foreignObject>
      </g>

      {/* 5. Minimalist Text Label below drop */}
      <text
        x="0"
        y="48"
        textAnchor="middle"
        fontSize={isHovered ? "11.5" : "10"}
        fontWeight={isHovered ? "800" : "600"}
        fill={isHovered ? "#ffffff" : "#94a3b8"}
        letterSpacing="0.04em"
        className="pointer-events-none transition-all duration-200"
        style={{
          filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' : undefined,
        }}
      >
        {tech.name}
      </text>
    </motion.g>
  );
};
