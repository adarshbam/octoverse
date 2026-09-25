export interface TechNode {
  id: string;
  name: string;
  category: 'backend' | 'frontend' | 'cloud' | 'security' | 'database';
  color: string;
  glowColor: string;
  iconName: string;
  description: string;
  side: 'left' | 'bottom' | 'right';
  angleIndex: number;
  project?: {
    title: string;
    tagline: string;
    description: string;
    metrics: string[];
    liveUrl?: string;
    githubUrl: string;
    badge: string;
  };
}

export interface MousePosition {
  x: number;
  y: number;
  normalizedX: number; // -1 to 1 from screen center
  normalizedY: number; // -1 to 1 from screen center
}

export interface TentacleControlPoints {
  start: { x: number; y: number };
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  end: { x: number; y: number };
}
