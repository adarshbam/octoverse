import React from 'react';
import type { TechNode } from '../../types';
import { Tentacle } from './Tentacle';

interface TentacleSystemProps {
  techNodes: TechNode[];
  hoveredTechId: string | null;
  onHoverTech: (id: string | null) => void;
  onSelectTech: (tech: TechNode) => void;
}

// Coordinate mapping matching the girlfriend's exact notebook sketch
const TENTACLE_CONFIGS: Record<
  string,
  {
    start: { x: number; y: number };
    end: { x: number; y: number };
    cp1: { x: number; y: number };
    cp2: { x: number; y: number };
    phase: number;
  }
> = {
  // --- Left Tentacles (curving leftwards) ---
  nodejs: {
    start: { x: -85, y: 55 },
    end: { x: -245, y: -45 },
    cp1: { x: -140, y: 15 },
    cp2: { x: -205, y: -25 },
    phase: 0.1,
  },
  express: {
    start: { x: -95, y: 70 },
    end: { x: -265, y: 45 },
    cp1: { x: -160, y: 55 },
    cp2: { x: -225, y: 35 },
    phase: 0.5,
  },
  docker: {
    start: { x: -90, y: 88 },
    end: { x: -255, y: 135 },
    cp1: { x: -155, y: 95 },
    cp2: { x: -215, y: 125 },
    phase: 0.9,
  },
  aws: {
    start: { x: -75, y: 105 },
    end: { x: -225, y: 220 },
    cp1: { x: -135, y: 140 },
    cp2: { x: -185, y: 205 },
    phase: 1.3,
  },

  // --- Bottom Tentacles (flowing downwards) ---
  redis: {
    start: { x: -50, y: 115 },
    end: { x: -135, y: 275 },
    cp1: { x: -80, y: 165 },
    cp2: { x: -115, y: 230 },
    phase: 1.7,
  },
  mongodb: {
    start: { x: -25, y: 120 },
    end: { x: -68, y: 290 },
    cp1: { x: -40, y: 175 },
    cp2: { x: -58, y: 245 },
    phase: 2.1,
  },
  typescript: {
    start: { x: 0, y: 122 },
    end: { x: 0, y: 298 },
    cp1: { x: 0, y: 180 },
    cp2: { x: 0, y: 250 },
    phase: 2.5,
  },
  react: {
    start: { x: 25, y: 120 },
    end: { x: 68, y: 290 },
    cp1: { x: 40, y: 175 },
    cp2: { x: 58, y: 245 },
    phase: 2.9,
  },
  git: {
    start: { x: 50, y: 115 },
    end: { x: 135, y: 275 },
    cp1: { x: 80, y: 165 },
    cp2: { x: 115, y: 230 },
    phase: 3.3,
  },

  // --- Right Tentacles (curving rightwards) ---
  htmlcss: {
    start: { x: 80, y: 95 },
    end: { x: 240, y: 155 },
    cp1: { x: 145, y: 110 },
    cp2: { x: 200, y: 145 },
    phase: 3.7,
  },
  security: {
    start: { x: 90, y: 65 },
    end: { x: 250, y: 35 },
    cp1: { x: 150, y: 40 },
    cp2: { x: 210, y: 20 },
    phase: 4.1,
  },
};

export const TentacleSystem: React.FC<TentacleSystemProps> = ({
  techNodes,
  hoveredTechId,
  onHoverTech,
  onSelectTech,
}) => {
  return (
    <g id="tentacle-system">
      {techNodes.map((tech) => {
        const config = TENTACLE_CONFIGS[tech.id];
        if (!config) return null;

        const isHovered = hoveredTechId === tech.id;

        return (
          <Tentacle
            key={tech.id}
            tech={tech}
            config={config}
            isHovered={isHovered}
            onHover={onHoverTech}
            onClick={onSelectTech}
          />
        );
      })}
    </g>
  );
};
