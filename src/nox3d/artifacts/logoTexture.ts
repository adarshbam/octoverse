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

/**
 * The colour a logo is drawn in on its orb: the brand colour with its hue and lightness kept and its
 * saturation raised (x1.3, plus 0.2 so muted brands such as Node's green reach the painting's
 * neon), so it stays vivid inside the glass. Worked out in sRGB, the space the canvas draws in.
 */
export function logoDrawColour(iconKey: string) {
  const c = new THREE.Color(logoColour(iconKey));
  const hsl = c.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
  return `#${c.setHSL(hsl.h, Math.min(1, hsl.s * 1.3 + 0.2), hsl.l, THREE.SRGBColorSpace).getHexString()}`;
}

/** Badge logos whose letters the painting fills (white, or black on JavaScript's yellow). */
const INNER: Record<string, string> = {
  html: '#ffffff',
  css: '#ffffff',
  javascript: '#1a1a1a',
  typescript: '#ffffff',
  redis: '#ffffff',
  git: '#ffffff',
  burp: '#ffffff',
  python: '#ffffff',
};

export function logoInnerColour(iconKey: string): string | undefined {
  return INNER[iconKey];
}

/**
 * The enclosed gaps of a mark on a square canvas (alpha per pixel, row by row): 1 where a pixel is
 * empty but cannot be reached from the canvas edge through empty pixels, so it lies inside the
 * mark (the counters of its letters), else 0.
 */
export function holeMask(alpha: Uint8ClampedArray, size: number) {
  const outside = new Uint8Array(size * size);
  const stack: number[] = [];
  const visit = (i: number) => {
    if (alpha[i] < 128 && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let k = 0; k < size; k++) {
    visit(k);
    visit((size - 1) * size + k);
    visit(k * size);
    visit(k * size + size - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % size;
    const y = (i - x) / size;
    if (x > 0) visit(i - 1);
    if (x < size - 1) visit(i + 1);
    if (y > 0) visit(i - size);
    if (y < size - 1) visit(i + size);
  }
  const holes = new Uint8Array(size * size);
  for (let i = 0; i < holes.length; i++) holes[i] = alpha[i] < 128 && !outside[i] ? 1 : 0;
  return holes;
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
    ctx.fillStyle = logoDrawColour(iconKey);
    ctx.fill(new Path2D(icon.path));
    const inner = logoInnerColour(iconKey);
    if (inner) {
      // Fill the letters behind the mark, a pixel wider so no gap shows at the anti-aliased edge.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const image = ctx.getImageData(0, 0, size, size);
      const alpha = new Uint8ClampedArray(size * size);
      for (let i = 0; i < alpha.length; i++) alpha[i] = image.data[i * 4 + 3];
      const holes = holeMask(alpha, size);
      const fill = new THREE.Color(inner);
      const back = ctx.createImageData(size, size);
      for (let i = 0; i < holes.length; i++) {
        const x = i % size;
        const near = holes[i] || (x > 0 && holes[i - 1]) || (x < size - 1 && holes[i + 1]) || holes[i - size] || holes[i + size];
        if (!near) continue;
        back.data[i * 4] = fill.r * 255;
        back.data[i * 4 + 1] = fill.g * 255;
        back.data[i * 4 + 2] = fill.b * 255;
        back.data[i * 4 + 3] = 255;
      }
      const layer = document.createElement('canvas');
      layer.width = layer.height = size;
      layer.getContext('2d')!.putImageData(back, 0, 0);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(layer, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  cache.set(iconKey, texture);
  return texture;
}
