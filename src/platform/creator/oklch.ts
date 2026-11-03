// OKLab / OKLCH conversion (Bjorn Ottosson's matrices), sRGB only.

const EPS = 1e-6;

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

export function toOklch(hex: string): { l: number; c: number; h: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) throw new Error(`toOklch: expected #rrggbb, got "${hex}"`);
  const n = parseInt(m[1], 16);
  const r = toLinear(((n >> 16) & 255) / 255);
  const g = toLinear(((n >> 8) & 255) / 255);
  const b = toLinear((n & 255) / 255);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  if (c < 1e-4) h = 0; // achromatic: hue is meaningless
  return { l: L, c, h };
}

function linearRgb(L: number, c: number, hDeg: number): [number, number, number] {
  const hr = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = ([r, g, b]: [number, number, number]) =>
  r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;

const toByte = (v: number) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255);

export function fromOklch(l: number, c: number, h: number): string {
  const L = Math.min(1, Math.max(0, l));
  const hue = ((h % 360) + 360) % 360;
  let chroma = Math.max(0, c);

  if (!inGamut(linearRgb(L, chroma, hue))) {
    let lo = 0;
    let hi = chroma;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(linearRgb(L, mid, hue))) lo = mid;
      else hi = mid;
    }
    chroma = lo;
  }

  const rgb = linearRgb(L, chroma, hue);
  return '#' + rgb.map((v) => toByte(v).toString(16).padStart(2, '0')).join('');
}
