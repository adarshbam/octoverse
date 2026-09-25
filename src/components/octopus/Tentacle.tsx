import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TechNode } from '../../types';
import { TechTeardropOrb } from './TechTeardropOrb';

interface TentacleConfig {
  start: { x: number; y: number };
  end: { x: number; y: number };
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  phase: number;
}

interface TentacleProps {
  tech: TechNode;
  config: TentacleConfig;
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
  const { start, end, cp1, cp2 } = config;

  // Calculate curled presentation coordinates when hovered
  const hoveredEnd = useMemo(() => {
    // Moves upward and curls slightly toward the center
    const dx = end.x * 0.88;
    const dy = end.y - 32;
    return { x: dx, y: dy };
  }, [end]);

  const hoveredCp1 = useMemo(() => {
    return { x: cp1.x * 0.95, y: cp1.y - 15 };
  }, [cp1]);

  const hoveredCp2 = useMemo(() => {
    return { x: cp2.x * 0.9, y: cp2.y - 25 };
  }, [cp2]);

  // Current target positions
  const targetEnd = isHovered ? hoveredEnd : end;
  const targetCp1 = isHovered ? hoveredCp1 : cp1;
  const targetCp2 = isHovered ? hoveredCp2 : cp2;

  // Suction cup locations along the curve
  const suctionCups = useMemo(() => {
    // Generate 3 suction cups at t = 0.35, 0.55, 0.75
    const ts = [0.35, 0.55, 0.75];
    return ts.map((t, idx) => {
      // Cubic Bézier formula: B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
      const u = 1 - t;
      const x =
        u * u * u * start.x +
        3 * u * u * t * targetCp1.x +
        3 * u * t * t * targetCp2.x +
        t * t * t * targetEnd.x;
      const y =
        u * u * u * start.y +
        3 * u * u * t * targetCp1.y +
        3 * u * t * t * targetCp2.y +
        t * t * t * targetEnd.y;
      return { x, y, r: 4.5 - idx * 0.8 };
    });
  }, [start, targetCp1, targetCp2, targetEnd]);

  // SVG Bézier Path string
  const pathD = `M ${start.x} ${start.y} C ${targetCp1.x} ${targetCp1.y}, ${targetCp2.x} ${targetCp2.y}, ${targetEnd.x} ${targetEnd.y}`;

  return (
    <g
      id={`tentacle-${tech.id}`}
      opacity={isDimmed ? 0.25 : 1}
      className="transition-opacity duration-300"
    >
      <defs>
        {/* Bioluminescent Tentacle Shading Gradient */}
        <linearGradient
          id={`tentacle-grad-${tech.id}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#0284c7" />     {/* Deep ocean blue base */}
          <stop offset="60%" stopColor="#38bdf8" />    {/* Bioluminescent cyan mid */}
          <stop offset="100%" stopColor={tech.color} /> {/* Tips glow with tech color */}
        </linearGradient>
      </defs>

      {/* 1. Outer Bioluminescent Glow on Hover */}
      {isHovered && (
        <motion.path
          d={pathD}
          fill="none"
          stroke={tech.glowColor}
          strokeWidth="16"
          strokeLinecap="round"
          filter="blur(8px)"
          opacity={0.7}
        />
      )}

      {/* 2. Main Tentacle Arm (Smooth Tapered Bézier Curve) */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={`url(#tentacle-grad-${tech.id})`}
        strokeWidth={isHovered ? 9 : 7.5}
        strokeLinecap="round"
        className="transition-all duration-300 drop-shadow-[0_4px_12px_rgba(2,132,199,0.3)]"
      />

      {/* 3. Cute Suction Cups from Sketch */}
      {suctionCups.map((cup, i) => (
        <circle
          key={i}
          cx={cup.x}
          cy={cup.y}
          r={cup.r}
          fill="#e0f2fe"
          stroke="#0284c7"
          strokeWidth="1.2"
          opacity={0.85}
        />
      ))}

      {/* 4. Hanging Teardrop Pendant at Tentacle Tip */}
      <g transform={`translate(${targetEnd.x}, ${targetEnd.y + 22})`}>
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
