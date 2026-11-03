import * as THREE from 'three';
import { faceRedrawDue } from './faceRedraw';
import type { FaceParams } from '../behavior/expressions';
import type { FaceLayout, FacePalette, Point2 } from '../config/types';
import { browStroke } from './browShape';
import { borderWidth, catchlightSpots, eyeOutline, eyelidCrease, irisCenter, pupilShape } from './eyeShape';
import { mouthShape } from './mouthShape';

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
 * How a puff (blowing a bubble, 1 full) changes each cheek's blush: the oval grows by `grow` across
 * and `round` up and down (so it rounds), moves `out` and `down` (head units), with a shine of
 * `shine` opacity on it and a shade of `shade` opacity under it.
 */
const PUFF = { grow: 0.22, round: 0.55, out: 0.02, down: 0.012, shine: 0.38, shade: 0.22 } as const;
/**
 * The round mouth of a blow: an "o" `rx` by `ry` (head units), `drop` below the mouth's centre,
 * its outline `thicken` times the smile line's thickness.
 */
const ROUND_MOUTH = { rx: 0.032, ry: 0.038, drop: 0.012, thicken: 1.1 } as const;
type MouthPoint = 'start' | 'c1' | 'c2' | 'end' | 'l1' | 'l2';
/** The mouth outline's points in drawing order: the smile line, then the lower lip back. */
const MOUTH_POINTS: readonly MouthPoint[] = ['start', 'c1', 'c2', 'end', 'l1', 'l2'];

/**
 * Nox's face, drawn in 2D and projected onto the 3D mantle. Every feature is a
 * parameter (lids, brows, mouth, blush, gaze), so expressions blend instead of
 * swapping drawings. Lids clip the eye, so the lit 3D skin shows when it blinks.
 */
export class FaceCanvas {
  /** The face as the skin samples it: sRGB, mipmapped, anisotropic (the render target `upload` fills). */
  readonly texture: THREE.Texture;
  /**
   * The canvas as uploaded: plain 8-bit RGBA (no sRGB format), because the browser copies a canvas
   * into an sRGB texture by reading it back through the CPU, which stalled the GPU about 20 ms on
   * every redraw (Intel UHD); into this one it copies on the GPU.
   */
  readonly staging: THREE.CanvasTexture;
  readonly target: THREE.WebGLRenderTarget;
  private readonly copy: { scene: THREE.Scene; camera: THREE.Camera; material: THREE.ShaderMaterial };
  private dirty = false;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layout: FaceLayout;
  private readonly palette: FacePalette;
  private last = '';
  private lastDrawn = -Infinity;

  constructor(layout: FaceLayout, palette: FacePalette) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    this.ctx = canvas.getContext('2d')!;
    this.layout = layout;
    this.palette = palette;
    this.staging = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
    this.staging.colorSpace = THREE.NoColorSpace;
    this.staging.generateMipmaps = false;
    this.staging.minFilter = this.staging.magFilter = THREE.NearestFilter;
    // The same texture the skin sampled before (an sRGB canvas texture, mipmapped in linear light):
    // the copy below writes the canvas's bytes into it unchanged.
    this.target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
      colorSpace: THREE.SRGBColorSpace,
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      anisotropy: 8,
    });
    this.texture = this.target.texture;
    const material = new THREE.ShaderMaterial({
      uniforms: { uCanvas: { value: this.staging } },
      vertexShader: /* glsl */ `
        void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      // Texel for texel; decoded to linear here, encoded back to the same sRGB byte by the target.
      fragmentShader: /* glsl */ `
        uniform sampler2D uCanvas;
        void main() {
          vec4 c = texelFetch(uCanvas, ivec2(gl_FragCoord.xy), 0);
          vec3 linear = mix(c.rgb / 12.92, pow((c.rgb + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c.rgb));
          gl_FragColor = vec4(linear, c.a);
        }
      `,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    this.copy = { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
  }

  /**
   * Sends a redrawn face to the GPU: the canvas into the plain staging texture, then copied into
   * the sRGB target the skin samples (which makes its mipmaps). Nothing to do when the face was not
   * redrawn; returns whether it copied.
   */
  upload(gl: THREE.WebGLRenderer): boolean {
    if (!this.dirty) return false;
    this.dirty = false;
    this.staging.needsUpdate = true;
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(this.target);
    gl.render(this.copy.scene, this.copy.camera);
    gl.setRenderTarget(previous);
    return true;
  }

  dispose() {
    this.target.dispose();
    this.staging.dispose();
    this.copy.material.dispose();
    for (const child of this.copy.scene.children) (child as THREE.Mesh).geometry.dispose();
  }

  /**
   * Redraws only when a parameter changed, and at most about 30 times a second (faceRedrawDue);
   * returns whether it was redrawn (`upload` then sends it to the GPU). A change held back is drawn on a later frame.
   */
  draw(p: FaceParams, nowMs = performance.now()): boolean {
    const key = [p.lidRest, p.lidBottom, p.browLift, p.browTilt, p.mouthCurve, p.mouthOpen, p.blush, p.blink, p.gazeX, p.gazeY, p.puff ?? 0, p.mouthRound ?? 0].map(v => v.toFixed(3)).join();
    if (!faceRedrawDue(key, this.last, nowMs, this.lastDrawn)) return false;
    this.last = key;
    this.lastDrawn = nowMs;
    this.ctx.clearRect(0, 0, SIZE, SIZE);
    this.drawBlush(p.blush, p.puff ?? 0);
    this.drawBrows(p);
    this.layout.eye.centers.forEach((center, i) => this.drawEye(center, i === 0 ? -1 : 1, p));
    this.drawMouth(p);
    this.dirty = true;
    return true;
  }

  /**
   * The blush ovals. Puffed (`puff` 0 to 1, blowing a bubble), each cheek swells: its oval grows,
   * rounder and a little out and down, with a soft shine on its upper inner side and a faint
   * shade under it, so it reads as a full, round cheek. At no puff it is drawn exactly as before.
   */
  private drawBlush(amount: number, puff = 0) {
    const { ctx, palette } = this;
    const { centers } = this.layout.blush;
    const rx = this.layout.blush.rx * (1 + PUFF.grow * puff);
    const ry = this.layout.blush.ry * (1 + PUFF.round * puff);
    const r = rx * PX_PER_UNIT;
    for (const [cx, cy] of centers) {
      const side = Math.sign(cx);
      const x = cx + side * PUFF.out * puff;
      const y = cy - PUFF.down * puff;
      if (puff > 0) this.drawCheekShade(x, y, rx, ry, puff);
      ctx.save();
      ctx.translate(px(x), py(y));
      ctx.scale(1, ry / rx);
      // A warm halo first, so the blush glows into the face around it.
      const halo = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.7);
      halo.addColorStop(0, rgba(palette.blushGlow, 0.35));
      halo.addColorStop(1, rgba(palette.blushGlow, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      // A clear oval with a soft rim, stronger as the blush rises.
      g.addColorStop(0, rgba(palette.blush, 0.97));
      g.addColorStop(0.7, rgba(palette.blush, 0.85 + 0.12 * amount));
      g.addColorStop(1, rgba(palette.blush, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (puff > 0) this.drawCheekShine(x, y, rx, ry, side, puff);
    }
  }

  /** A faint shade under a puffed cheek, fading out all round: the cheek's roundness. */
  private drawCheekShade(x: number, y: number, rx: number, ry: number, puff: number) {
    const { ctx, palette } = this;
    const r = rx * PX_PER_UNIT * 1.25;
    ctx.save();
    ctx.translate(px(x), py(y - ry * 0.55));
    ctx.scale(1, (ry / rx) * 0.9);
    const g = ctx.createRadialGradient(0, 0, r * 0.45, 0, 0, r);
    g.addColorStop(0, rgba(palette.mouthInside, 0));
    g.addColorStop(0.55, rgba(palette.mouthInside, PUFF.shade * puff));
    g.addColorStop(1, rgba(palette.mouthInside, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** The shine on a puffed cheek: a soft light oval high on its inner side, as on a full, glossy cheek. */
  private drawCheekShine(x: number, y: number, rx: number, ry: number, side: number, puff: number) {
    const { ctx, palette } = this;
    const sx = rx * 0.42 * PX_PER_UNIT;
    ctx.save();
    ctx.translate(px(x - side * rx * 0.3), py(y + ry * 0.38));
    ctx.rotate(side * 0.25);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sx);
    g.addColorStop(0, rgba(palette.catchlight, PUFF.shine * puff));
    g.addColorStop(0.5, rgba(palette.catchlight, PUFF.shine * 0.55 * puff));
    g.addColorStop(1, rgba(palette.catchlight, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, sx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    // A soft-edged glow, opaque at its centre and fading out to its rim.
    const glow = (x: number, y: number, gx: number, gy: number, stops: [number, string][]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, gy / gx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, gx);
      for (const [at, color] of stops) g.addColorStop(at, color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, gx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    ctx.save();
    ctx.translate(px(cx), py(cy));

    if (!closed) {
      const outline = eyeOutline(eye, blink, p.lidBottom);
      const trace = () => {
        ctx.beginPath();
        outline.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x * U, -q.y * U) : ctx.lineTo(q.x * U, -q.y * U)));
        ctx.closePath();
      };

      // Eyelid, for depth: the lit lid band resting on the border, then the crease as a soft
      // shadow above it, strongest over the eye and fading out at both ends. Both follow a
      // lowering lid part of the way and fade as the eye shuts.
      const sink = 2 * blink * eye.ry * 0.6;
      const fade = 1 - Math.min(1, Math.max(0, (blink - 0.55) / 0.37));
      const lid = eyelidCrease(eye, side);
      ctx.save();
      ctx.lineCap = 'round';
      // Soft edges come from feathering (a wide faint pass under a narrower solid one): canvas
      // blur filters redrawn every frame cost the moving face most of its frame rate.
      const feather = [[1.7, 0.3], [1.0, 1.0]] as const;
      ctx.strokeStyle = palette.lidSkin;
      for (const [grow, alpha] of feather) {
        ctx.lineWidth = eye.fold.band * U * grow;
        for (let i = 0; i < lid.length - 1; i++) {
          const a = lid[i];
          const b = lid[i + 1];
          ctx.globalAlpha = alpha * fade * Math.min(1, ((a.strength + b.strength) / 2) * 2);
          ctx.beginPath();
          ctx.moveTo(a.bx * U, -(a.by - sink) * U);
          ctx.lineTo(b.bx * U, -(b.by - sink) * U);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = palette.lidFold;
      for (const [grow, alpha] of [[2.2, 0.25], [1.0, 0.85]] as const) {
        for (let i = 0; i < lid.length - 1; i++) {
          const a = lid[i];
          const b = lid[i + 1];
          ctx.globalAlpha = alpha * fade * ((a.strength + b.strength) / 2);
          ctx.lineWidth = ((a.width + b.width) / 2) * U * grow;
          ctx.beginPath();
          ctx.moveTo(a.x * U, -(a.y - sink) * U);
          ctx.lineTo(b.x * U, -(b.y - sink) * U);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Border round the whole eye: heavy along the lid, thick on the outer side, thin beside
      // the nose and along the bottom, where the face glow turns it maroon. It is stroked centred on the
      // outline at twice its width; the eye drawn next covers the inner half.
      const tall = ctx.createLinearGradient(0, -ry - eye.border.top * U, 0, ry + eye.border.bottom * U);
      tall.addColorStop(0, palette.border[0]);
      tall.addColorStop(0.6, palette.border[1]);
      tall.addColorStop(1, palette.border[2]);
      ctx.strokeStyle = tall;
      ctx.lineCap = 'round';
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i];
        const b = outline[(i + 1) % outline.length];
        ctx.lineWidth = (borderWidth(eye, a.theta, side) + borderWidth(eye, b.theta, side)) * U;
        ctx.beginPath();
        ctx.moveTo(a.x * U, -a.y * U);
        ctx.lineTo(b.x * U, -b.y * U);
        ctx.stroke();
      }

      ctx.save();
      trace();
      ctx.clip();

      // White of the eye: brightest beside the iris and low down, pink toward the outer edge,
      // with the lid's shadow across the top.
      const sx = -side * rx * 0.15;
      const sy = ry * 0.25;
      const white = ctx.createRadialGradient(sx, sy, 0, sx, sy, rx * 1.25);
      white.addColorStop(0, palette.sclera[1]);
      white.addColorStop(0.6, palette.sclera[1]);
      white.addColorStop(0.8, palette.sclera[2]);
      white.addColorStop(1, palette.sclera[3]);
      ctx.fillStyle = white;
      ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);
      const shade = ctx.createLinearGradient(0, -ry, 0, -ry * 0.15);
      shade.addColorStop(0, rgba(palette.sclera[0], 0.9));
      shade.addColorStop(1, rgba(palette.sclera[0], 0));
      ctx.fillStyle = shade;
      ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 1.1);

      // Iris toward the nose: dark above, glowing red below.
      const iris = irisCenter(eye, side, p.gazeX, p.gazeY);
      const ix = iris.x * U;
      const iy = -iris.y * U;
      const irx = rx * eye.iris.rx;
      const iry = ry * eye.iris.ry;
      const irisPath = () => {
        ctx.beginPath();
        ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
      };
      const body = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
      body.addColorStop(0, palette.iris[0]);
      body.addColorStop(0.3, palette.iris[0]);
      body.addColorStop(0.48, palette.iris[1]);
      body.addColorStop(0.68, palette.iris[2]);
      body.addColorStop(1, palette.iris[2]);
      ctx.fillStyle = body;
      irisPath();
      ctx.fill();

      ctx.save();
      irisPath();
      ctx.clip();
      // The outer iris darkens toward the rim, so the red glows brightest around the pupil.
      glow(ix, iy, irx, iry, [
        [0, rgba(palette.irisRim[0], 0)],
        [0.72, rgba(palette.irisRim[0], 0)],
        [1, rgba(palette.irisRim[0], 0.35)],
      ]);

      // Soft reflected glows in the lower iris, then the warm reflection below the pupil.
      for (const g of eye.glows) {
        glow(ix + g.x * irx, iy - g.y * iry, g.rx * irx, g.ry * iry, [[0, rgba(palette.irisGlow, g.strength)], [1, rgba(palette.irisGlow, 0)]]);
      }
      const { spot } = eye;
      glow(ix + spot.x * irx, iy - spot.y * iry, spot.rx * irx, spot.ry * iry, [
        [0, rgba(palette.irisPool, 1)],
        [0.7, rgba(palette.irisPool, 0.95)],
        [1, rgba(palette.irisPoolEdge, 0)],
      ]);

      // Pupil: a dark ring, heavier away from the light, round a lighter maroon inside.
      const pupil = pupilShape(eye, side, p.gazeX, p.gazeY);
      const { outer: po, inner: pi } = pupil;
      ctx.fillStyle = palette.pupilRing;
      ctx.beginPath();
      ctx.ellipse(po.x * U, -po.y * U, po.rx * U, po.ry * U, 0, 0, Math.PI * 2);
      ctx.fill();
      const inside = ctx.createLinearGradient(0, -(pi.y + pi.ry) * U, 0, -(pi.y - pi.ry) * U);
      inside.addColorStop(0, palette.pupil[0]);
      inside.addColorStop(1, palette.pupil[1]);
      ctx.fillStyle = inside;
      ctx.beginPath();
      ctx.ellipse(pi.x * U, -pi.y * U, pi.rx * U, pi.ry * U, 0, 0, Math.PI * 2);
      ctx.fill();

      // The iris's own dark outer ring, warming to red at the bottom.
      const rim = irx * eye.iris.rim;
      const rimStyle = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
      rimStyle.addColorStop(0, palette.irisRim[0]);
      rimStyle.addColorStop(0.7, palette.irisRim[0]);
      rimStyle.addColorStop(1, palette.irisRim[1]);
      ctx.strokeStyle = rimStyle;
      ctx.lineWidth = rim;
      ctx.beginPath();
      ctx.ellipse(ix, iy, irx - rim / 2, iry - rim / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Two catchlights with a soft halo; they drift less than the iris, like reflections.
      for (const c of catchlightSpots(eye, side, p.gazeX, p.gazeY)) {
        glow(c.x * U, -c.y * U, c.r * U * 1.15, c.r * U * 1.15, [
          [0, rgba(palette.catchlight, 1)],
          [0.84, rgba(palette.catchlight, 1)],
          [0.92, rgba(palette.catchlight, 0.45)],
          [1, rgba(palette.catchlight, 0)],
        ]);
      }

      // Light rim just inside the lower edge, fading out before it climbs the sides; the clip
      // keeps the inner half of the stroke.
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = eye.rim * 2 * U;
      ctx.lineCap = 'round';
      const lower = outline.filter(q => q.theta < -0.55 && q.theta > -Math.PI + 0.55);
      for (let i = 0; i < lower.length - 1; i++) {
        const a = lower[i];
        const b = lower[i + 1];
        const t = (i + 0.5) / (lower.length - 1);
        ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * t) * 2.5);
        ctx.beginPath();
        ctx.moveTo(a.x * U, -a.y * U);
        ctx.lineTo(b.x * U, -b.y * U);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Lash line over the top of the opening, so the lid overhangs the eye.
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
      ctx.lineWidth = lidWidth((u0 + u1) / 2) * (closed ? 1.2 : 1);
      ctx.beginPath();
      ctx.moveTo(x0, lidPoint(Math.max(-rx, Math.min(rx, x0))));
      ctx.lineTo(x1, lidPoint(Math.max(-rx, Math.min(rx, x1))));
      ctx.stroke();
    }

    // Short curved lashes at the outer corner, leaving the outer edge of the border, thick at
    // the base and tapering out.
    for (const lash of eye.lashes) {
      const theta = Math.acos(side * lash.at);
      const out = closed ? 0 : borderWidth(eye, theta, side) * U * 0.75;
      const nl = Math.hypot(Math.cos(theta) / rx, Math.sin(theta) / ry);
      const x = side * rx * lash.at + (Math.cos(theta) / rx / nl) * out;
      const base = lidPoint(Math.max(-rx, Math.min(rx, side * rx * lash.at))) - (Math.sin(theta) / ry / nl) * out;
      const angle = THREE.MathUtils.degToRad(closed ? -lash.angle * 0.5 : lash.angle);
      const length = lash.length * U;
      const tipX = x + side * Math.cos(angle) * length;
      const tipY = base - Math.sin(angle) * length;
      // Curl the tip outward, like a brushed lash.
      const ctrlX = x + side * Math.cos(angle + 0.45) * length * 0.6;
      const ctrlY = base - Math.sin(angle + 0.45) * length * 0.6;
      const segments = 10;
      for (let i = 0; i < segments; i++) {
        const point = (t: number) => [
          (1 - t) * (1 - t) * x + 2 * t * (1 - t) * ctrlX + t * t * tipX,
          (1 - t) * (1 - t) * base + 2 * t * (1 - t) * ctrlY + t * t * tipY,
        ];
        const [ax, ay] = point(i / segments);
        const [bx, by] = point((i + 1) / segments);
        ctx.lineWidth = lash.width * U * (1 - (i + 0.5) / segments) + 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawMouth(p: FaceParams) {
    if ((p.mouthRound ?? 0) > 0) {
      this.drawRoundMouth(p, p.mouthRound!);
      return;
    }
    const { ctx, palette } = this;
    const mouth = this.layout.mouth;
    const shape = mouthShape(mouth, p.mouthCurve, p.mouthOpen);
    const [sx, sy] = [px(shape.start[0]), py(shape.start[1])];
    const [ax, ay] = [px(shape.c1[0]), py(shape.c1[1])];
    const [bx, by] = [px(shape.c2[0]), py(shape.c2[1])];
    const [ex, ey] = [px(shape.end[0]), py(shape.end[1])];
    ctx.strokeStyle = palette.mouth;
    ctx.fillStyle = palette.mouth;
    ctx.lineWidth = mouth.thickness * PX_PER_UNIT;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (shape.lower) {
      // Open smile: a dark inside below the smile line, the tongue filling its bottom third.
      const [lx1, ly1] = [px(shape.lower.c1[0]), py(shape.lower.c1[1])];
      const [lx2, ly2] = [px(shape.lower.c2[0]), py(shape.lower.c2[1])];
      const outline = () => {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(ax, ay, bx, by, ex, ey);
        ctx.bezierCurveTo(lx1, ly1, lx2, ly2, sx, sy);
        ctx.closePath();
      };
      ctx.save();
      outline();
      ctx.fillStyle = palette.mouthInside;
      ctx.fill();
      ctx.clip();
      const bottom = py(shape.lower.bottom);
      ctx.fillStyle = palette.tongue;
      ctx.beginPath();
      ctx.ellipse(px(mouth.center[0]), bottom, (ex - sx) * 0.32, bottom - py(shape.lower.tongueTop), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      outline();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(ax, ay, bx, by, ex, ey);
      ctx.stroke();
    }
    // Round dimples at the corners.
    for (const [x, y] of [[sx, sy], [ex, ey]]) {
      ctx.beginPath();
      ctx.arc(x, y, mouth.dimple * PX_PER_UNIT, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * The mouth rounding to blow (`round` 0 to 1): the smile's line and lips draw in to a small, round
   * "o", dark inside, outlined as the smile line is; the dimples and the tongue go as it rounds.
   * Every point of the mouth's outline moves straight from the smile toward the "o", so it never
   * jumps between shapes.
   */
  private drawRoundMouth(p: FaceParams, round: number) {
    const { ctx, palette } = this;
    const mouth = this.layout.mouth;
    const shape = mouthShape(mouth, p.mouthCurve, p.mouthOpen);
    const r = Math.min(1, round);
    const [cx, cy] = mouth.center;
    const ox = ROUND_MOUTH.rx;
    const oy = ROUND_MOUTH.ry;
    // A cubic with handles 4/3 of the half height out reaches that height: a half ellipse.
    const k = 4 / 3;
    const ocy = cy - ROUND_MOUTH.drop;
    // The "o" as the smile's six points: across the top from left to right, back along the bottom.
    const o: Record<MouthPoint, Point2> = {
      start: [cx - ox, ocy], c1: [cx - ox, ocy + k * oy], c2: [cx + ox, ocy + k * oy], end: [cx + ox, ocy],
      l1: [cx + ox, ocy - k * oy], l2: [cx - ox, ocy - k * oy],
    };
    // A closed smile's lower lip is its own line, back the other way.
    const from: Record<MouthPoint, Point2> = {
      start: shape.start, c1: shape.c1, c2: shape.c2, end: shape.end,
      l1: shape.lower ? shape.lower.c1 : shape.c2, l2: shape.lower ? shape.lower.c2 : shape.c1,
    };
    const at = (key: MouthPoint) => [px(from[key][0] + (o[key][0] - from[key][0]) * r), py(from[key][1] + (o[key][1] - from[key][1]) * r)] as const;
    const [s0, a, b, e, l1, l2] = MOUTH_POINTS.map(at);
    const outline = () => {
      ctx.beginPath();
      ctx.moveTo(s0[0], s0[1]);
      ctx.bezierCurveTo(a[0], a[1], b[0], b[1], e[0], e[1]);
      ctx.bezierCurveTo(l1[0], l1[1], l2[0], l2[1], s0[0], s0[1]);
      ctx.closePath();
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.save();
    outline();
    ctx.fillStyle = palette.mouthInside;
    ctx.fill();
    ctx.clip();
    // The "o"'s own depth: a warm tongue glow low inside it, coming in as it rounds.
    const glowR = ox * PX_PER_UNIT;
    const inner = ctx.createRadialGradient(px(cx), py(ocy - oy * 0.75), 0, px(cx), py(ocy - oy * 0.75), glowR);
    inner.addColorStop(0, rgba(palette.tongue, 0.85 * r));
    inner.addColorStop(1, rgba(palette.tongue, 0));
    ctx.fillStyle = inner;
    ctx.fillRect(px(cx) - glowR, py(ocy) - glowR, 2 * glowR, 2 * glowR);
    if (shape.lower && r < 1) {
      // An open smile's tongue fades as the mouth rounds.
      const bottom = py(shape.lower.bottom);
      ctx.globalAlpha = 1 - r;
      ctx.fillStyle = palette.tongue;
      ctx.beginPath();
      ctx.ellipse(px(cx), bottom, (e[0] - s0[0]) * 0.32, Math.max(0, bottom - py(shape.lower.tongueTop)), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = palette.mouth;
    ctx.fillStyle = palette.mouth;
    ctx.lineWidth = mouth.thickness * PX_PER_UNIT * (1 + (ROUND_MOUTH.thicken - 1) * r);
    outline();
    ctx.stroke();
    // The dimples shrink away as it rounds.
    const dimple = mouth.dimple * PX_PER_UNIT * (1 - r);
    if (dimple > 0.5) {
      for (const [x, y] of [s0, e]) {
        ctx.beginPath();
        ctx.arc(x, y, dimple, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
