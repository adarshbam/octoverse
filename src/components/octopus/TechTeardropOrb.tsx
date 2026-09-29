import React from 'react';
import { motion } from 'framer-motion';
import type { TechNode } from '../../types';

interface TechTeardropOrbProps {
  tech: TechNode;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (tech: TechNode) => void;
}

// Minimal 100% Native SVG vector brand emblems
const BrandSvgIcon: React.FC<{ techId: string; color: string; isHovered: boolean }> = ({
  techId,
  color,
  isHovered,
}) => {
  const iconColor = isHovered ? '#ffffff' : color;

  switch (techId) {
    case 'nodejs':
      return (
        <g>
          <path d="M 0 -9 L 8 -4.5 L 8 4.5 L 0 9 L -8 4.5 L -8 -4.5 Z" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M -3 -3 L 0 -1 L 0 5 M 0 -1 L 3 -3" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'express':
      return <text x="0" y="3.5" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="system-ui, sans-serif" fill={iconColor} letterSpacing="-0.06em">ex</text>;
    case 'docker':
      return (
        <g fill={iconColor}>
          <rect x="-6" y="-6" width="3" height="2.2" rx="0.4" />
          <rect x="-2" y="-6" width="3" height="2.2" rx="0.4" />
          <rect x="2" y="-6" width="3" height="2.2" rx="0.4" />
          <rect x="-4" y="-3.2" width="3" height="2.2" rx="0.4" />
          <rect x="0" y="-3.2" width="3" height="2.2" rx="0.4" />
          <path d="M -9 0.5 C -7 5.5, 4 5.5, 8.5 0.5 C 8.5 -1.2, 5 0, 3 0 C -4 0, -8 -1.2, -9 0.5 Z" />
          <circle cx="9.5" cy="-0.5" r="0.8" />
        </g>
      );
    case 'aws':
      return (
        <g stroke={iconColor} fill="none">
          <path d="M -6 0 C -8 -2, -5 -5, -2 -4 C -1 -7, 4 -7, 5 -4 C 8 -4, 9 -1, 7 1 C 5 2, -4 2, -6 0 Z" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M -5 3.5 Q 0 7 5 3.5" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M 3.8 2.5 L 5.5 3.5 L 3.8 4.8" fill={iconColor} strokeWidth="0.8" />
        </g>
      );
    case 'redis':
      return (
        <g>
          <polygon points="0,-7 6,-3.5 0,0 -6,-3.5" fill={iconColor} opacity="0.95" />
          <polygon points="-6,-3.5 0,0 0,6 -6,2.5" fill={iconColor} opacity="0.75" />
          <polygon points="0,0 6,-3.5 6,2.5 0,6" fill={iconColor} opacity="0.6" />
        </g>
      );
    case 'mongodb':
      return (
        <g>
          <path d="M 0 -8.5 C 4.5 -4.5, 6 1.5, 0 8.5 C -6 1.5, -4.5 -4.5, 0 -8.5 Z" fill={iconColor} />
          <path d="M 0 -7.5 L 0 7.5" stroke="#052e16" strokeWidth="1" opacity="0.6" />
        </g>
      );
    case 'typescript':
      return (
        <g>
          <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#2563eb" />
          <text x="0" y="3.8" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#ffffff" letterSpacing="-0.04em">TS</text>
        </g>
      );
    case 'react':
      return (
        <g stroke={iconColor} fill="none" strokeWidth="1.2">
          <circle cx="0" cy="0" r="2.2" fill={iconColor} stroke="none" />
          <ellipse cx="0" cy="0" rx="8" ry="3" />
          <ellipse cx="0" cy="0" rx="8" ry="3" transform="rotate(60)" />
          <ellipse cx="0" cy="0" rx="8" ry="3" transform="rotate(120)" />
        </g>
      );
    case 'git':
      return (
        <g fill={iconColor} stroke={iconColor}>
          <circle cx="-3" cy="-4.5" r="2" />
          <circle cx="-3" cy="4.5" r="2" />
          <circle cx="4" cy="0" r="2" />
          <path d="M -3 -2.5 L -3 2.5 M -3 0 C 0 0, 2 0, 4 0" fill="none" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case 'security':
      return (
        <g>
          <path d="M 0 -8.5 L 6.5 -5 C 6.5 2.5, 3.5 7, 0 8.5 C -3.5 7, -6.5 2.5, -6.5 -5 Z" fill={`rgba(192, 132, 252, 0.25)`} stroke={iconColor} strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="0" cy="-0.5" r="1.5" fill="#ffffff" />
          <rect x="-1" y="0.5" width="2" height="2.8" fill="#ffffff" rx="0.4" />
        </g>
      );
    case 'htmlcss':
      return (
        <g stroke={iconColor} fill="none">
          <path d="M -6 -7.5 L 6 -7.5 L 5 4.5 L 0 7 L -5 4.5 Z" strokeWidth="1.5" strokeLinejoin="round" />
          <text x="0" y="2.5" textAnchor="middle" fontSize="7" fontWeight="900" fontFamily="system-ui, sans-serif" fill={iconColor} stroke="none">&lt;/&gt;</text>
        </g>
      );
    default:
      return <circle cx="0" cy="0" r="4" fill={iconColor} />;
  }
};

export const TechTeardropOrb: React.FC<TechTeardropOrbProps> = ({
  tech,
  isHovered,
  onHover,
  onClick,
}) => {
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
        scale: isHovered ? 1.15 : 1,
      }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <defs>
        {/* Magical Luminous Pearl/Orb Gradient */}
        <radialGradient
          id={`orb-grad-${tech.id}`}
          cx="40%"
          cy="30%"
          r="65%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity={isHovered ? 0.95 : 0.4} />
          <stop offset="40%" stopColor={tech.color} stopOpacity={isHovered ? 0.8 : 0.3} />
          <stop offset="85%" stopColor="#041224" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#010610" stopOpacity="0.98" />
        </radialGradient>

        {/* Crisp Glass Specular Highlight */}
        <linearGradient id={`orb-glint-${tech.id}`} x1="0%" y1="0%" x2="60%" y2="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 1. Ambient Glow Bloom */}
      <circle
        cx="0"
        cy="0"
        r={isHovered ? 26 : 22}
        fill={tech.glowColor}
        filter="blur(10px)"
        opacity={isHovered ? 0.9 : 0.5}
        className="transition-all duration-300"
      />

      {/* 2. Glass Orb Vessel */}
      <circle
        cx="0"
        cy="0"
        r="18"
        fill={`url(#orb-grad-${tech.id})`}
        stroke={isHovered ? tech.color : 'rgba(56, 189, 248, 0.4)'}
        strokeWidth={isHovered ? 2 : 1.2}
        className="transition-all duration-300"
      />

      {/* 3. Glass Specular Curve */}
      <path
        d="M -10 -10
           C -15 -5, -16 2, -14 8
           C -10 2, -6 -6, -3 -9
           C -5 -10, -8 -10, -10 -10 Z"
        fill={`url(#orb-glint-${tech.id})`}
      />

      {/* 4. Tech Logo inside the Orb */}
      <BrandSvgIcon techId={tech.id} color={tech.color} isHovered={isHovered} />

      {/* 5. Clean Luminous Label */}
      <text
        x="0"
        y="30"
        textAnchor="middle"
        fontSize={isHovered ? '10' : '9'}
        fontWeight={isHovered ? '800' : '600'}
        fill={isHovered ? '#ffffff' : '#94a3b8'}
        letterSpacing="0.05em"
        className="pointer-events-none transition-all duration-200"
        style={{
          filter: isHovered ? `drop-shadow(0 0 5px ${tech.color})` : undefined,
        }}
      >
        {tech.name}
      </text>
    </motion.g>
  );
};
