export type OctopusMood = 'idle' | 'happy' | 'surprised' | 'curious' | 'blushing';

export interface EyeGazeOffset {
  x: number;
  y: number;
}

export interface OctopusState {
  mood: OctopusMood;
  isBlushing: boolean;
  isHovered: boolean;
  activeTechId: string | null;
}

export interface SuctionCupDef {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  angle?: number;
}

export interface VolumetricTentacleDef {
  id: string;
  layer: 'back' | 'front';
  pathD: string;
  tip: { x: number; y: number };
  suctionCups: SuctionCupDef[];
  phase: number;
}
