import * as icons from 'simple-icons';
import * as THREE from 'three';

/** Each technology's `iconKey` to its simple-icons export. */
export const LOGO_SLUGS: Record<string, string> = {
  html: 'siHtml5',
  css: 'siCss',
  javascript: 'siJavascript',
  typescript: 'siTypescript',
  node: 'siNodedotjs',
  redis: 'siRedis',
  docker: 'siDocker',
  github: 'siGithub',
  git: 'siGit',
  python: 'siPython',
  mongodb: 'siMongodb',
  linux: 'siLinux',
  kali: 'siKalilinux',
  burp: 'siBurpsuite',
  express: 'siExpress',
};

interface SimpleIcon {
  title: string;
  hex: string;
  path: string;
}

export function logoIcon(iconKey: string): SimpleIcon | undefined {
  const slug = LOGO_SLUGS[iconKey];
  return slug ? ((icons as unknown as Record<string, SimpleIcon>)[slug] ?? undefined) : undefined;
}

/** Marks the painting shows in white rather than in their brand colour. */
const WHITE_MARKS = new Set(['kali']);

/**
 * The logo's brand colour; near-black marks (GitHub, Express) and Kali, as in the painting, turn
 * white so they show on dark glass.
 */
export function logoColour(iconKey: string) {
  if (WHITE_MARKS.has(iconKey)) return '#FFFFFF';
  const hex = logoIcon(iconKey)?.hex ?? 'FFFFFF';
  const c = new THREE.Color(`#${hex}`);
  const luminance = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return luminance < 0.02 ? '#FFFFFF' : `#${hex.toUpperCase()}`;
}

const cache = new Map<string, THREE.CanvasTexture>();

/** The logo drawn in its colour on a transparent square, for the face of an orb. */
export function logoTexture(iconKey: string) {
  const known = cache.get(iconKey);
  if (known) return known;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const icon = logoIcon(iconKey);
  if (icon) {
    // simple-icons paths sit in a 24 x 24 box; the logo fills the middle 60%.
    const scale = (size * 0.6) / 24;
    ctx.translate(size * 0.2, size * 0.2);
    ctx.scale(scale, scale);
    ctx.fillStyle = logoColour(iconKey);
    ctx.fill(new Path2D(icon.path));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  cache.set(iconKey, texture);
  return texture;
}
