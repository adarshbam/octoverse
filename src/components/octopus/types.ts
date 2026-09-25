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
