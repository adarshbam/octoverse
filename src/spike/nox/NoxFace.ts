import * as THREE from 'three';

const SIZE = 1024;
/** Face canvas covers this square of head-local x/y (head centre = 0,0). */
export const FACE_RECT = new THREE.Vector4(-0.8, -0.8, 1.6, 1.6);

const px = (x: number) => ((x - FACE_RECT.x) / FACE_RECT.z) * SIZE;
const py = (y: number) => ((FACE_RECT.y + FACE_RECT.w - y) / FACE_RECT.w) * SIZE;

export interface FaceState {
  gazeX: number;
  gazeY: number;
  blink: number;
  smile: number;
  blush: number;
}

// Positions and sizes measured from panel 2 (see scripts/ref_grid.py).
const EYE = { rx: 114, ry: 120 };
const EYES = [
  { side: -1, x: px(-0.358), y: py(-0.213) },
  { side: 1, x: px(0.358), y: py(-0.213) },
];

/**
 * Nox's face is drawn in 2D and projected onto the 3D mantle. Eyelids clip the
 * eye instead of painting skin, so the lit 3D skin shows through when it blinks.
 */
export class NoxFace {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private last = '';

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    this.ctx = canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  draw(state: FaceState) {
    const key = [state.gazeX, state.gazeY, state.blink, state.smile, state.blush].map(v => v.toFixed(3)).join();
    if (key === this.last) return;
    this.last = key;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    this.drawBlush(state.blush);
    this.drawBrows(state);
    for (const eye of EYES) this.drawEye(eye, state);
    this.drawMouth(state.smile);
    this.texture.needsUpdate = true;
  }

  private drawBlush(amount: number) {
    const ctx = this.ctx;
    for (const x of [px(-0.535), px(0.535)]) {
      const y = py(-0.43);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.48);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 66);
      g.addColorStop(0, 'rgba(255, 98, 134, 0.96)');
      g.addColorStop(0.6, `rgba(255, 92, 128, ${0.72 + 0.2 * amount})`);
      g.addColorStop(1, 'rgba(255, 90, 125, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 66, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBrows(state: FaceState) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(18, 8, 26, 0.92)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    const lift = state.gazeY * 6;
    for (const { side } of EYES) {
      const x = px(side * 0.4);
      const y = py(0.13) - lift;
      const outer = side * 54;
      ctx.beginPath();
      ctx.moveTo(x + outer, y + 8);
      ctx.quadraticCurveTo(x + side * 4, y - 12, x - outer, y + 3);
      ctx.stroke();
    }
  }

  private drawEye(eye: (typeof EYES)[number], state: FaceState) {
    const ctx = this.ctx;
    const { rx, ry } = EYE;
    const blink = state.blink;
    const closed = blink >= 0.92;
    const edge = (x: number, r: number, k: number) => k * r * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
    const lidY = (x: number) => edge(x, ry, 2 * blink - 1);
    ctx.save();
    ctx.translate(eye.x, eye.y);

    if (!closed) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-rx, 0);
      for (let i = 0; i <= 32; i++) {
        const x = -rx + (2 * rx * i) / 32;
        ctx.lineTo(x, lidY(x));
      }
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI, false);
      ctx.closePath();
      ctx.clip();

      const sclera = ctx.createLinearGradient(0, -ry, 0, ry);
      sclera.addColorStop(0, '#d9a6b6');
      sclera.addColorStop(0.6, '#f4d2da');
      sclera.addColorStop(1, '#e08ea2');
      ctx.fillStyle = sclera;
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

      // Iris sits toward the nose, so the white shows as a crescent on the outer side only.
      const irx = rx * 0.84;
      const iry = ry * 0.9;
      const ix = -eye.side * rx * 0.15 + state.gazeX * rx * 0.14;
      const iy = ry * 0.06 - state.gazeY * ry * 0.1;
      const iris = ctx.createRadialGradient(ix, iy - iry * 0.1, iry * 0.15, ix, iy, iry);
      iris.addColorStop(0, '#3e0714');
      iris.addColorStop(0.5, '#951226');
      iris.addColorStop(1, '#de2232');
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
      pool.addColorStop(0, 'rgba(255, 120, 86, 1)');
      pool.addColorStop(0.5, 'rgba(246, 48, 54, 0.85)');
      pool.addColorStop(1, 'rgba(200, 20, 40, 0)');
      ctx.fillStyle = pool;
      ctx.fillRect(ix - irx, iy - iry, irx * 2, iry * 2);
      ctx.restore();

      ctx.fillStyle = 'rgba(16, 2, 8, 0.78)';
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

      ctx.strokeStyle = '#2a0814';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
    }

    // Heavy upper lid line, thickest at the outer corner, with two outer lashes.
    ctx.strokeStyle = '#120510';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lidPoint = (x: number) => (closed ? edge(x, ry, 0.22) : lidY(x));
    for (const [from, to, width] of [[-1.02, 1.02, 12], [0.25, 1.04, 17]] as const) {
      ctx.lineWidth = closed ? 11 : width;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const u = from + ((to - from) * i) / 24;
        const x = eye.side * u * rx;
        const y = lidPoint(Math.max(-rx, Math.min(rx, x)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 7;
    for (const [at, len, rise] of [[0.93, 24, 0.55], [0.78, 22, 0.95]] as const) {
      const x = eye.side * rx * at;
      const base = lidPoint(Math.max(-rx, Math.min(rx, x)));
      const dirY = closed ? 0.3 : -rise;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + eye.side * len * 0.6, base + dirY * len * 0.3, x + eye.side * len, base + dirY * len * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMouth(smile: number) {
    const ctx = this.ctx;
    const x = px(0.015);
    const y = py(-0.432);
    const w = 78 + smile * 6;
    const depth = 26 + smile * 10;
    ctx.strokeStyle = '#26091a';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - w, y - depth * 0.35);
    ctx.bezierCurveTo(x - w * 0.5, y + depth * 0.75, x + w * 0.5, y + depth * 0.75, x + w, y - depth * 0.35);
    ctx.stroke();
  }
}
