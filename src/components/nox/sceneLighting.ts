export type SceneLight = {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  strength: number;
};

export type NoxSceneLighting = {
  overhead: SceneLight;
  crimson: readonly SceneLight[];
  roots: SceneLight;
};

// Light origins use the same 507 x 505 coordinates as the approved character.
export const noxSceneLighting: NoxSceneLighting = {
  overhead: { id: 'overhead', x: 380, y: -12, radius: 310, color: '#6ab9ed', strength: 0.65 },
  crimson: [
    { id: 'left-inscription', x: 49, y: 157, radius: 67, color: '#f32d57', strength: 0.72 },
    { id: 'left-lower', x: 77, y: 440, radius: 105, color: '#fa345d', strength: 0.8 },
    { id: 'right-inscription', x: 465, y: 263, radius: 92, color: '#f13360', strength: 0.74 },
    { id: 'right-lower', x: 411, y: 457, radius: 105, color: '#ff395a', strength: 0.8 },
  ],
  roots: { id: 'roots', x: 256, y: 347, radius: 63, color: '#f46769', strength: 0.85 },
};
