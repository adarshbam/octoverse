import * as THREE from 'three';
import type { FaceParams } from '../behavior/expressions';
import type { FaceLayout, FacePalette, Point2 } from '../config/types';
import { browStroke } from './browShape';
import { catchlightSpots, irisCenter } from './eyeShape';

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
    ctx.strokeStyle = this.palette.brow;
    ctx.lineCap = 'round';
    for (const side of [-1, 1] as const) {
      const stroke = browStroke(this.layout.brow, side, p.browLift, p.browTilt);
      // Short round-capped segments, each as thick as the brow at that point: a smooth taper with round ends.
      for (let i = 0; i < stroke.length - 1; i++) {
        const a = stroke[i];
        const b = stroke[i + 1];
        ctx.lineWidth = ((a.width + b.width) / 2) * PX_PER_UNIT;
        ctx.beginPath();
        ctx.moveTo(px(a.x), py(a.y) - p.gazeY * 6);
        ctx.lineTo(px(b.x), py(b.y) - p.gazeY * 6);
        ctx.stroke();
      }
    }
  }

  private drawEye([cx, cy]: Point2, side: -1 | 1, p: FaceParams) {
    const { ctx, palette } = this;
    const eye = this.layout.eye;
    const U = PX_PER_UNIT;
    const rx = eye.rx * U;
    const ry = eye.ry * U;
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

      // White of the eye, shadowed under the lid.
      const sclera = ctx.createLinearGradient(0, -ry, 0, ry);
      sclera.addColorStop(0, palette.sclera[0]);
      sclera.addColorStop(0.45, palette.sclera[1]);
      sclera.addColorStop(1, palette.sclera[2]);
      ctx.fillStyle = sclera;
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

      // A large dark iris toward the nose, so the white shows only as an outer crescent.
      const iris = irisCenter(eye, side, p.gazeX, p.gazeY);
      const ix = iris.x * U;
      const iy = -iris.y * U;
      const irx = rx * eye.iris.rx;
      const iry = ry * eye.iris.ry;
      const fill = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
      fill.addColorStop(0, palette.iris[0]);
      fill.addColorStop(0.45, palette.iris[1]);
      fill.addColorStop(1, palette.iris[2]);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Warm glow pooled in the lower iris, around the bottom of the pupil.
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
      ctx.clip();
      const pool = ctx.createRadialGradient(ix, iy + iry * 0.95, iry * 0.05, ix, iy + iry * 0.85, iry * 1.05);
      pool.addColorStop(0, rgba(palette.irisPool, 1));
      pool.addColorStop(0.3, rgba(palette.irisPoolEdge, 0.95));
      pool.addColorStop(0.65, rgba(palette.irisPoolEdge, 0.45));
      pool.addColorStop(1, rgba(palette.irisPoolEdge, 0));
      ctx.fillStyle = pool;
      ctx.fillRect(ix - irx, iy - iry, irx * 2, iry * 2);
      ctx.restore();

      // Soft-edged pupil that melts into the dark top of the iris.
      const prx = irx * eye.pupil.rx;
      const pry = iry * eye.pupil.ry;
      const pcy = iy + iry * eye.pupil.drop;
      ctx.save();
      ctx.translate(ix, pcy);
      ctx.scale(1, pry / prx);
      const pupil = ctx.createRadialGradient(0, 0, 0, 0, 0, prx);
      pupil.addColorStop(0, rgba(palette.pupil, 1));
      pupil.addColorStop(0.75, rgba(palette.pupil, 1));
      pupil.addColorStop(1, rgba(palette.pupil, 0));
      ctx.fillStyle = pupil;
      ctx.beginPath();
      ctx.arc(0, 0, prx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      for (const spot of catchlightSpots(eye, side, p.gazeX, p.gazeY)) {
        const x = spot.x * U;
        const y = -spot.y * U;
        const r = spot.r * U;
        const shine = ctx.createRadialGradient(x, y, 0, x, y, r);
        shine.addColorStop(0, rgba(palette.catchlight, 1));
        shine.addColorStop(0.7, rgba(palette.catchlight, 1));
        shine.addColorStop(1, rgba(palette.catchlight, 0));
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Soft light rim along the lower edge instead of a dark outline.
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = eye.rim * U;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const x = -rx * 0.94 + (1.88 * rx * i) / 32;
        if (i === 0) ctx.moveTo(x, lowY(x));
        else ctx.lineTo(x, lowY(x));
      }
      ctx.stroke();
    }

    // Upper lid line: thin at the inner end, heaviest at the outer corner.
    ctx.strokeStyle = palette.lid;
    ctx.lineCap = 'round';
    const lidPoint = (x: number) => (closed ? edge(x, ry, 0.22) : lidY(x));
    const lidWidth = (u: number) => (eye.lid.inner + (eye.lid.outer - eye.lid.inner) * ((u + 1) / 2) ** 1.5) * U;
    const steps = 28;
    for (let i = 0; i < steps; i++) {
      const u0 = -1 + (2.02 * i) / steps;
      const u1 = -1 + (2.02 * (i + 1)) / steps;
      const x0 = side * u0 * rx;
      const x1 = side * u1 * rx;
      ctx.lineWidth = lidWidth((u0 + u1) / 2) * (closed ? 0.7 : 1);
      ctx.beginPath();
      ctx.moveTo(x0, lidPoint(Math.max(-rx, Math.min(rx, x0))));
      ctx.lineTo(x1, lidPoint(Math.max(-rx, Math.min(rx, x1))));
      ctx.stroke();
    }

    // The outline carries on down the outer side of the white, thinning into the light rim.
    if (!closed) {
      for (let i = 0; i < 10; i++) {
        const x0 = side * rx * (1 - (0.45 * i) / 10);
        const x1 = side * rx * (1 - (0.45 * (i + 1)) / 10);
        ctx.lineWidth = eye.lid.outer * U * 0.75 * (1 - (i + 0.5) / 10);
        ctx.beginPath();
        ctx.moveTo(x0, lowY(x0));
        ctx.lineTo(x1, lowY(x1));
        ctx.stroke();
      }
    }

    // Short curved lashes at the outer corner, thick at the base and tapering out.
    for (const lash of eye.lashes) {
      const x = side * rx * lash.at;
      const base = lidPoint(Math.max(-rx, Math.min(rx, x)));
      const angle = THREE.MathUtils.degToRad(closed ? -lash.angle * 0.5 : lash.angle);
      const length = lash.length * U;
      const tipX = x + side * Math.cos(angle) * length;
      const tipY = base - Math.sin(angle) * length;
      // Curl the tip outward, like a brushed lash.
      const ctrlX = x + side * Math.cos(angle + 0.35) * length * 0.55;
      const ctrlY = base - Math.sin(angle + 0.35) * length * 0.55;
      const segments = 6;
      for (let i = 0; i < segments; i++) {
        const point = (t: number) => [
          (1 - t) * (1 - t) * x + 2 * t * (1 - t) * ctrlX + t * t * tipX,
          (1 - t) * (1 - t) * base + 2 * t * (1 - t) * ctrlY + t * t * tipY,
        ];
        const [ax, ay] = point(i / segments);
        const [bx, by] = point((i + 1) / segments);
        ctx.lineWidth = eye.lid.outer * U * 0.5 * (1 - (i + 0.5) / segments) + 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
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
