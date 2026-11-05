import type { HostProps } from '../../engine/host/WorldHost';

// The octopus's reactions to a change of preset (platform spec 7.13), as pure data. How each is played is the live preview's
// business (CreatorPreview.tsx), through what a running instance lets the platform do: a held face (`options.expression`), a gaze
// nudge (`attend`) and a platform-drawn sparkle. The engine has no runtime trigger for a blink, a body wiggle or a shimmer (E02b).

/** One of the engine's faces, read off the host's own options type (the platform reaches the engine through a short list of modules). */
export type ExpressionId = NonNullable<HostProps['options']['expression']>;

/** What the creator can change in the octopus's presets. */
export type PresetChange = 'palette' | 'personality' | 'name' | 'template';
export const REACTION_CHANGES: readonly PresetChange[] = ['palette', 'personality', 'name', 'template'];

/** A template change fades the old preview out and the new one in over this long (spec 7.13). */
export const REMOUNT_FADE_MS = 200;

export interface Reaction {
  /** The face held for the reaction (an existing engine face; the instance's own blink and gaze carry on under it). */
  expression?: ExpressionId;
  /** (stand-in) A brief closing of the eyes before the face. The engine has no blink trigger: the preview holds the half-lidded `restful` face for a moment. */
  blink?: boolean;
  /** (stand-in) A sparkle over the picture, drawn by the platform in HTML and CSS: the engine has no shimmer trigger. */
  shimmer?: boolean;
  /** (stand-in) A small happy wiggle, played as a gaze swing side to side with `attend`: the engine has no wiggle trigger, and the body does not move. */
  wiggle?: boolean;
  /** How long the reaction lasts before the octopus is left to its own idle. */
  holdMs: number;
}

/**
 * The reaction to a change: palette, a sparkle shimmer and a small happy wiggle; personality, the new personality's own idle shown
 * for 3 seconds (the preview of a new personality is a new instance, so its idle starts afresh and nothing is held over it);
 * name, a stand-in blink and a smile (`happy`); template, `'remount'` (the preview is mounted again with a 200 ms fade). Pure: each call
 * returns a new object.
 */
export function reactionFor(change: PresetChange): Reaction | 'remount' {
  switch (change) {
    case 'palette':
      return { shimmer: true, wiggle: true, holdMs: 1400 };
    case 'personality':
      return { holdMs: 3000 };
    case 'name':
      return { blink: true, expression: 'happy', holdMs: 1400 };
    case 'template':
      return 'remount';
  }
}

/** One step of the wiggle: from `at` ms into the reaction the character looks at `target` (canvas pixels), or is let go (`null`). */
export interface WiggleStep {
  at: number;
  target: { x: number; y: number } | null;
}

/**
 * The wiggle's gaze targets for a canvas `width` by `height` pixels: out to the left, over to the right, back to the left and
 * then released, about a fifth of the width either side of the centre and slightly above the middle, one swing every 260 ms.
 */
export function wigglePath(width: number, height: number): WiggleStep[] {
  const y = height * 0.45;
  const left = { x: width * 0.3, y };
  const right = { x: width * 0.7, y };
  return [
    { at: 0, target: left },
    { at: 260, target: right },
    { at: 520, target: left },
    { at: 780, target: right },
    { at: 1040, target: null },
  ];
}
