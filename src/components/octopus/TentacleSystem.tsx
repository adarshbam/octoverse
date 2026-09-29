import React from 'react';
import type { TechNode } from '../../types';
import type { VolumetricTentacleDef } from './types';
import { Tentacle } from './Tentacle';

interface TentacleSystemProps {
  techNodes: TechNode[];
  hoveredTechId: string | null;
  activeCategory?: string;
  onHoverTech: (id: string | null) => void;
  onSelectTech: (tech: TechNode) => void;
}

// 8 Canonical Veyra Tentacles
// Thick at the base, smoothly tapering to delicate curled tips.
// S and C curves to feel like relaxed floating limbs.
export const VOLUMETRIC_TENTACLES: Record<string, VolumetricTentacleDef> = {
  // --- Back Left (Sweeping up and left) ---
  nodejs: {
    id: 'nodejs',
    layer: 'back',
    pathD: 'M -80 70 C -120 70, -180 30, -220 -10 C -240 -30, -230 -40, -210 -30 C -160 0, -110 50, -50 90 Z',
    tip: { x: -220, y: -20 },
    phase: 0.1,
    suctionCups: [
      { cx: -130, cy: 40, rx: 4, ry: 3, angle: -20 },
      { cx: -170, cy: 15, rx: 3, ry: 2, angle: -30 },
      { cx: -200, cy: -10, rx: 2, ry: 1.5, angle: -40 },
    ],
  },
  
  // --- Wide Left (Sweeping directly left) ---
  express: {
    id: 'express',
    layer: 'back',
    pathD: 'M -90 100 C -150 100, -220 70, -270 50 C -290 40, -280 30, -250 40 C -190 60, -130 90, -70 110 Z',
    tip: { x: -270, y: 40 },
    phase: 0.5,
    suctionCups: [
      { cx: -150, cy: 85, rx: 4, ry: 3, angle: -10 },
      { cx: -200, cy: 65, rx: 3, ry: 2, angle: -15 },
      { cx: -240, cy: 50, rx: 2, ry: 1.5, angle: -20 },
    ],
  },

  // --- Front Left (Sweeping down and curling) ---
  docker: {
    id: 'docker',
    layer: 'front',
    pathD: 'M -80 120 C -130 150, -180 200, -200 250 C -210 270, -190 280, -170 260 C -140 220, -100 170, -40 130 Z',
    tip: { x: -185, y: 265 },
    phase: 0.9,
    suctionCups: [
      { cx: -115, cy: 165, rx: 4, ry: 3, angle: 30 },
      { cx: -150, cy: 205, rx: 3, ry: 2, angle: 40 },
      { cx: -175, cy: 240, rx: 2, ry: 1.5, angle: 50 },
    ],
  },

  // --- Inner Left (Curled gently in front) ---
  react: {
    id: 'react',
    layer: 'front',
    pathD: 'M -40 140 C -60 190, -70 260, -40 310 C -30 330, -10 320, -20 300 C -40 260, -30 190, 0 140 Z',
    tip: { x: -25, y: 315 },
    phase: 1.3,
    suctionCups: [
      { cx: -45, cy: 195, rx: 4, ry: 3, angle: 60 },
      { cx: -48, cy: 245, rx: 3, ry: 2, angle: 70 },
      { cx: -38, cy: 290, rx: 2, ry: 1.5, angle: 80 },
    ],
  },

  // --- Inner Right (Curled gently in front) ---
  typescript: {
    id: 'typescript',
    layer: 'front',
    pathD: 'M 40 140 C 60 190, 70 260, 40 310 C 30 330, 10 320, 20 300 C 40 260, 30 190, 0 140 Z',
    tip: { x: 25, y: 315 },
    phase: 1.7,
    suctionCups: [
      { cx: 45, cy: 195, rx: 4, ry: 3, angle: -60 },
      { cx: 48, cy: 245, rx: 3, ry: 2, angle: -70 },
      { cx: 38, cy: 290, rx: 2, ry: 1.5, angle: -80 },
    ],
  },

  // --- Front Right (Sweeping down and curling) ---
  aws: {
    id: 'aws',
    layer: 'front',
    pathD: 'M 80 120 C 130 150, 180 200, 200 250 C 210 270, 190 280, 170 260 C 140 220, 100 170, 40 130 Z',
    tip: { x: 185, y: 265 },
    phase: 2.1,
    suctionCups: [
      { cx: 115, cy: 165, rx: 4, ry: 3, angle: -30 },
      { cx: 150, cy: 205, rx: 3, ry: 2, angle: -40 },
      { cx: 175, cy: 240, rx: 2, ry: 1.5, angle: -50 },
    ],
  },

  // --- Wide Right (Sweeping directly right) ---
  redis: {
    id: 'redis',
    layer: 'back',
    pathD: 'M 90 100 C 150 100, 220 70, 270 50 C 290 40, 280 30, 250 40 C 190 60, 130 90, 70 110 Z',
    tip: { x: 270, y: 40 },
    phase: 2.5,
    suctionCups: [
      { cx: 150, cy: 85, rx: 4, ry: 3, angle: 10 },
      { cx: 200, cy: 65, rx: 3, ry: 2, angle: 15 },
      { cx: 240, cy: 50, rx: 2, ry: 1.5, angle: 20 },
    ],
  },

  // --- Back Right (Sweeping up and right) ---
  mongodb: {
    id: 'mongodb',
    layer: 'back',
    pathD: 'M 80 70 C 120 70, 180 30, 220 -10 C 240 -30, 230 -40, 210 -30 C 160 0, 110 50, 50 90 Z',
    tip: { x: 220, y: -20 },
    phase: 2.9,
    suctionCups: [
      { cx: 130, cy: 40, rx: 4, ry: 3, angle: 20 },
      { cx: 170, cy: 15, rx: 3, ry: 2, angle: 30 },
      { cx: 200, cy: -10, rx: 2, ry: 1.5, angle: 40 },
    ],
  },
};

export const TentacleSystem: React.FC<TentacleSystemProps> = ({
  techNodes,
  hoveredTechId,
  activeCategory = 'all',
  onHoverTech,
  onSelectTech,
}) => {
  return (
    <g id="tentacle-system">
      {/* Background layer */}
      {techNodes.map((tech) => {
        const config = VOLUMETRIC_TENTACLES[tech.id];
        if (!config || config.layer !== 'back') return null;
        return (
          <Tentacle
            key={tech.id}
            tech={tech}
            config={config}
            isHovered={hoveredTechId === tech.id}
            isDimmed={activeCategory !== 'all' && tech.category !== activeCategory}
            onHover={onHoverTech}
            onClick={onSelectTech}
          />
        );
      })}
      
      {/* Foreground layer is rendered afterwards (by OctopusCharacter.tsx placing the head in between, wait...
          Ah! OctopusCharacter renders <TentacleSystem> then <OctopusHead>.
          So all tentacles are behind the head. That's fine! The front/back layer inside TentacleSystem just dictates overlap among tentacles.
      */}
      {techNodes.map((tech) => {
        const config = VOLUMETRIC_TENTACLES[tech.id];
        if (!config || config.layer !== 'front') return null;
        return (
          <Tentacle
            key={tech.id}
            tech={tech}
            config={config}
            isHovered={hoveredTechId === tech.id}
            isDimmed={activeCategory !== 'all' && tech.category !== activeCategory}
            onHover={onHoverTech}
            onClick={onSelectTech}
          />
        );
      })}
    </g>
  );
};
