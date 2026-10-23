import * as THREE from 'three';
import type { FaceParams } from '../behavior/expressions';
import type { FaceLayout, FacePalette, Point2 } from '../config/types';

const SIZE = 1024;
/** Face canvas covers this square of head-local x/y (origin = HeadShape.faceOrigin). */
export const FACE_RECT = new THREE.Vector4(-0.8, -0.8, 1.6, 1.6);
const PX_PER_UNIT = SIZE / FACE_RECT.z;

const px = (x: number) => (x - FACE_RECT.x) * PX_PER_UNIT;
const py = (y: number) => (FACE_RECT.y + FACE_RECT.w - y) * PX_PER_UNIT;
const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = [1, 3, 5].map(o => parseInt(hex.slice(o, o + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Nox's face, drawn in 2D and projected onto the 3D mantle. Every feature is a
 * parameter (lids, brows, mouth, blush, gaze), so expressions blend instead of
 * swapping drawings. Lids clip the eye, so the lit 3D skin shows when it blinks.
 */
export class FaceCanvas {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layout: FaceLayout;
  private readonly palette: FacePalette;
  private last = '';

  constructor(layout: FaceLayout, palette: FacePalette) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    this.ctx = canvas.getContext('2d')!;
    this.layout = layout;
    this.palette = palette;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  /** Redraws only when a parameter changed; returns whether the texture was updated. */
  draw(p: FaceParams): boolean {
    const key = [p.lidRest, p.lidBottom, p.browLift, p.browTilt, p.mouthCurve, p.mouthOpen, p.blush, p.blink, p.gazeX, p.gazeY].map(v => v.toFixed(3)).join();
    if (key === this.last) return false;
    this.last = key;
    this.ctx.clearRect(0, 0, SIZE, SIZE);
    this.drawBlush(p.blush);
    this.drawBrows(p);
    this.layout.eye.centers.forEach((center, i) => this.drawEye(center, i === 0 ? -1 : 1, p));
    this.drawMouth(p);
    this.texture.needsUpdate = true;
    return true;
  }

  private drawBlush(amount: number) {
    const { ctx, palette } = this;
    const { centers, rx, ry } = this.layout.blush;
    const r = rx * PX_PER_UNIT;
    for (const [x, y] of centers) {
      ctx.save();
      ctx.translate(px(x), py(y));
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(palette.blush, 0.96));
      g.addColorStop(0.6, rgba(palette.blush, 0.72 + 0.2 * amount));
      g.addColorStop(1, rgba(palette.blush, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBrows(p: FaceParams) {
    const { ctx } = this;
    const { centers, width, thickness } = this.layout.brow;
    ctx.strokeStyle = this.palette.brow;
    ctx.lineCap = 'round';
    ctx.lineWidth = thickness * PX_PER_UNIT;
    const half = (width / 2) * PX_PER_UNIT;
    centers.forEach(([cx, cy], i) => {
      const side = i === 0 ? -1 : 1;
      const x = px(cx);
      const y = py(cy) - p.gazeY * 6 - p.browLift * 0.04 * PX_PER_UNIT;
      const outer = side * half;
      ctx.save();
      ctx.translate(x, y);
      // Positive tilt raises the inner ends (worried/curious); negative angles them down (focused).
      ctx.rotate(side * p.browTilt * THREE.MathUtils.degToRad(12));
      ctx.beginPath();
      ctx.moveTo(outer, 8);
      ctx.quadraticCurveTo(side * 4, -12, -outer, 3);
      ctx.stroke();
      ctx.restore();
    });
  }

  private drawEye([cx, cy]: Point2, side: number, p: FaceParams) {
    const { ctx, palette } = this;
    const rx = this.layout.eye.rx * PX_PER_UNIT;
    const ry = this.layout.eye.ry * PX_PER_UNIT;
    const blink = Math.min(1, p.lidRest + p.blink * (1 - p.lidRest));
    const closed = blink >= 0.92;
    const edge = (x: number, r: number, k: number) => k * r * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
    const lidY = (x: number) => edge(x, ry, 2 * blink - 1);
    const lowY = (x: number) => edge(x, ry, 1 - 0.6 * p.lidBottom);
    ctx.save();
    ctx.translate(px(cx), py(cy));

    if (!closed) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-rx, 0);
      for (let i = 0; i <= 32; i++) {
        const x = -rx + (2 * rx * i) / 32;
        ctx.lineTo(x, lidY(x));
      }
      for (let i = 32; i >= 0; i--) {
        const x = -rx + (2 * rx * i) / 32;
        ctx.lineTo(x, lowY(x));
      }
      ctx.closePath();
      ctx.clip();

      const sclera = ctx.createLinearGradient(0, -ry, 0, ry);
      sclera.addColorStop(0, palette.sclera[0]);
      sclera.addColorStop(0.6, palette.sclera[1]);
      sclera.addColorStop(1, palette.sclera[2]);
      ctx.fillStyle = sclera;
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

      // Iris sits toward the nose, so the white shows as a crescent on the outer side only.
      const irx = rx * 0.84;
      const iry = ry * 0.9;
      const ix = -side * rx * 0.15 + p.gazeX * rx * 0.14;
      const iy = ry * 0.06 - p.gazeY * ry * 0.1;
      const iris = ctx.createRadialGradient(ix, iy - iry * 0.1, iry * 0.15, ix, iy, iry);
      iris.addColorStop(0, palette.iris[0]);
      iris.addColorStop(0.5, palette.iris[1]);
      iris.addColorStop(1, palette.iris[2]);
      ctx.fillStyle = iris;
      ctx.beginPath();
      ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Warm reflected glow pooling in the lower iris.
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
      ctx.clip();
      const pool = ctx.createRadialGradient(ix, iy + iry * 0.95, iry * 0.1, ix, iy + iry * 0.75, iry * 0.75);
      pool.addColorStop(0, rgba(palette.irisPool, 1));
      pool.addColorStop(0.5, 'rgba(246, 48, 54, 0.85)');
      pool.addColorStop(1, 'rgba(200, 20, 40, 0)');
      ctx.fillStyle = pool;
      ctx.fillRect(ix - irx, iy - iry, irx * 2, iry * 2);
      ctx.restore();

      ctx.fillStyle = rgba(palette.pupil, 0.78);
      ctx.beginPath();
      ctx.ellipse(ix, iy - iry * 0.12, irx * 0.5, iry * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      // Two catchlights near the top; they drift less than the iris, like reflections.
      const hx = ix * 0.6;
      const hy = iy * 0.6 - iry * 0.42;
      ctx.fillStyle = '#fff8f6';
      ctx.beginPath();
      ctx.arc(hx - irx * 0.32, hy, irx * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx + irx * 0.36, hy + iry * 0.02, irx * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
    }

    // Heavy upper lid line, thickest at the outer corner, with two outer lashes.
    ctx.strokeStyle = palette.lid;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lidPoint = (x: number) => (closed ? edge(x, ry, 0.22) : lidY(x));
    for (const [from, to, width] of [[-1.02, 1.02, 12], [0.25, 1.04, 17]] as const) {
      ctx.lineWidth = closed ? 11 : width;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const u = from + ((to - from) * i) / 24;
        const x = side * u * rx;
        const y = lidPoint(Math.max(-rx, Math.min(rx, x)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 7;
    for (const [at, len, rise] of [[0.93, 24, 0.55], [0.78, 22, 0.95]] as const) {
      const x = side * rx * at;
      const base = lidPoint(Math.max(-rx, Math.min(rx, x)));
      const dirY = closed ? 0.3 : -rise;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + side * len * 0.6, base + dirY * len * 0.3, x + side * len, base + dirY * len * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMouth(p: FaceParams) {
    const { ctx } = this;
    const [mx, my] = this.layout.mouth.center;
    const x = px(mx);
    const y = py(my);
    const w = this.layout.mouth.halfWidth * PX_PER_UNIT + p.mouthCurve * 6;
    const depth = 26 + p.mouthCurve * 10;
    ctx.strokeStyle = this.palette.mouth;
    ctx.fillStyle = this.palette.mouth;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - w, y - depth * 0.35);
    ctx.bezierCurveTo(x - w * 0.5, y + depth * 0.75, x + w * 0.5, y + depth * 0.75, x + w, y - depth * 0.35);
    if (p.mouthOpen > 0.01) {
      // Open smile: the lower lip drops below the smile line and the shape is filled.
      const drop = depth * (0.75 + 1.4 * p.mouthOpen);
      ctx.bezierCurveTo(x + w * 0.45, y + drop, x - w * 0.45, y + drop, x - w, y - depth * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    ctx.stroke();
  }
}
