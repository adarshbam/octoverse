import type { Page } from '@playwright/test';

// Text contrast against what is really behind the text (platform Task 21a; spec 7.15: at least 4.5:1 on glass).
//
// HOW THE BACKDROP IS SAMPLED. The platform's text sits on glass (a translucent indigo panel with a blur) over the reef, over a still, or
// over the live host, so the colour behind a letter is not any one CSS colour. For each screen of the page this takes ONE screenshot of
// the page with every glyph made transparent (`color` and `-webkit-text-fill-color` transparent, no transitions, the gradient title's background
// removed; a text SHADOW is left, it is part of the backdrop the letters stand on and is still drawn for transparent glyphs): what is left
// is the real composite, the glass's alpha laid over the blurred backdrop, the buttons' own fills, the card stills, at every pixel. The screenshot is decoded in the page (createImageBitmap on a canvas) and, for
// every text element, the pixels of its text boxes (a Range over its own text nodes, so a wrapped paragraph is its lines, not a bounding
// box of white space) are each compared with the element's computed text colour (its alpha and its ancestors' opacity composited over
// that pixel). Only the pixels the text itself changes count (a second screenshot of the same screen with the text drawn, compared
// with the text-less one: the letters' pixels, antialiased edges included; the spaces between letters are not what is read), when
// the screen holds still (the host pages are opened with `?freeze` for this). The element's contrast is the 5th percentile of those
// per-pixel ratios (the worst few are a letter's soft edge), and the median is reported beside it. WCAG 2.x relative
// luminance and ratio. The gradient wordmark (`background-clip: text`, a transparent colour) is judged pixel by pixel against the gradient's colour at that pixel's x
// (the stops with their positions, interpolated), and its own `filter: drop-shadow` halo is NOT in the sample (a filter of absent glyphs draws nothing): its numbers are therefore pessimistic.
// Skipped: a disabled control (exempt by WCAG 1.4.3: inactive component), text that is covered by another element at its centre, text
// that is not drawn, the engine's own DOM inside a live preview layer.

export interface ContrastItem {
  text: string;
  tag: string;
  color: string;
  fontSize: number;
  weight: number;
  /** 5th-percentile contrast over the text's pixels. */
  p5: number;
  median: number;
  /** Where the element is (CSS px, viewport at the time). */
  at: [number, number];
}

export interface ContrastRun {
  items: ContrastItem[];
  sampled: number;
}

const SELECTOR_SKIP = 'script, style, noscript, [hidden], [inert], .oct-sr-only, .oct-live-layer, canvas, svg, option';

/** In the page: marks and describes the text elements fully on screen that no earlier step has described. */
function collectScript({ skipEngine, skip }: { skipEngine: boolean; skip: string }) {
  const w = window as unknown as { __cnext?: number; __cdone?: WeakMap<Element, number> };
  w.__cdone ??= new WeakMap();
  w.__cnext ??= 1;
  const out: unknown[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const parse = (value: string) => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (!m) return null;
    const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  };
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    if (el.closest(skip)) continue;
    if (skipEngine && el.closest('[data-world], [data-preview], .oct-landing') && !el.closest('.oct-layer')) continue;
    const isField = el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
    let own = '';
    for (const node of el.childNodes) if (node.nodeType === 3) own += node.textContent ?? '';
    own = own.trim();
    if (!own && !(isField && ((el as HTMLInputElement).value || (el as HTMLInputElement).placeholder))) continue;
    if (w.__cdone.has(el)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    let opacity = 1;
    for (let n: HTMLElement | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
    if (opacity < 0.05) continue;
    if (el.closest(':disabled, [aria-disabled="true"]')) {
      w.__cdone.set(el, 0);
      continue;
    }
    // The text's boxes.
    const boxes: { left: number; top: number; right: number; bottom: number }[] = [];
    if (isField) {
      const r = el.getBoundingClientRect();
      boxes.push({ left: r.left + 4, top: r.top + 4, right: r.right - 4, bottom: r.bottom - 4 });
    } else {
      const range = document.createRange();
      for (const node of el.childNodes) {
        if (node.nodeType !== 3 || !(node.textContent ?? '').trim()) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) boxes.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
    }
    if (boxes.length === 0) continue;
    // Fully on screen (a box cut by the window's edge is sampled at the next scroll step).
    if (boxes.some(b => b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5)) continue;
    // Covered by something that paints (a panel, a picture, other text) above it: not seen at this scroll position. Layout shells that
    // paint nothing (the landing's full-window layers) do not cover anything; every element takes hits while this measures, so the
    // stack at the text's centre is the whole stack.
    const cx = (boxes[0].left + boxes[0].right) / 2;
    const cy = (boxes[0].top + boxes[0].bottom) / 2;
    let covered = true;
    for (const above of document.elementsFromPoint(cx, cy)) {
      if (above === el || el.contains(above) || above.contains(el)) {
        covered = false;
        break;
      }
      const s2 = getComputedStyle(above);
      const paints =
        above.matches('img, canvas, svg, video, input, textarea, select') ||
        !/^(rgba\(\d+, \d+, \d+, 0\)|transparent)$/.test(s2.backgroundColor) ||
        (s2.backgroundImage !== 'none' && (s2.webkitBackgroundClip || s2.backgroundClip) !== 'text') ||
        [...above.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
      if (paints) break;
    }
    if (covered) continue;
    const clipText = (style.webkitBackgroundClip || style.backgroundClip) === 'text';
    let colors: { r: number; g: number; b: number; a: number }[] = [];
    let gradient: { stops: { r: number; g: number; b: number; a: number; at: number }[]; left: number; width: number } | null = null;
    if (clipText) {
      // A left-to-right gradient clipped to the letters: each letter has the colour of the gradient where it stands, so a pixel is
      // compared with the stop colour at its own x, not with every stop.
      const stops: { r: number; g: number; b: number; a: number; at: number }[] = [];
      for (const m of style.backgroundImage.matchAll(/(rgba?\([^)]+\))\s*([\d.]+)%/g)) {
        const c = parse(m[1]);
        if (c) stops.push({ ...c, at: Number(m[2]) / 100 });
      }
      const box = el.getBoundingClientRect();
      if (stops.length) {
        gradient = { stops, left: box.left, width: box.width };
        colors = [stops[0]];
      }
      el.setAttribute('data-ct', '');
    } else {
      const c = parse(isField && !(el as HTMLInputElement).value ? getComputedStyle(el, '::placeholder').color : style.color);
      if (c) colors = [c];
    }
    if (colors.length === 0) continue;
    const id = w.__cnext++;
    w.__cdone.set(el, id);
    out.push({
      id,
      text: (own || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder).slice(0, 40),
      tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''),
      colors,
      gradient,
      opacity,
      fontSize: parseFloat(style.fontSize),
      weight: Number(style.fontWeight),
      boxes,
    });
  }
  return out;
}

/** In the page: scroll positions to visit (the page scroller's, and any sideways rows'). */
function scrollerScript() {
  const scroller = document.querySelector<HTMLElement>('.oct-page');
  const rows = [...document.querySelectorAll<HTMLElement>('[data-hscroll]')].filter(r => r.scrollWidth > r.clientWidth + 1);
  return {
    vertical: scroller ? { height: scroller.scrollHeight, client: scroller.clientHeight } : null,
    rows: rows.map(r => ({ width: r.scrollWidth, client: r.clientWidth })),
  };
}

/** In the page: ratio of each text element's pixels against the decoded screenshot. */
async function scoreScript({ png, inked, items }: { png: string; inked: string; items: { id: number; text: string; tag: string; colors: { r: number; g: number; b: number; a: number }[]; gradient: { stops: { r: number; g: number; b: number; a: number; at: number }[]; left: number; width: number } | null; opacity: number; fontSize: number; weight: number; boxes: { left: number; top: number; right: number; bottom: number }[] }[] }) {
  const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  // The same screen with the text drawn: a pixel the text changes is a pixel of a letter (antialiased edges included).
  const inkedBytes = Uint8Array.from(atob(inked), c => c.charCodeAt(0));
  const inkedBitmap = await createImageBitmap(new Blob([inkedBytes], { type: 'image/png' }));
  const inkedCanvas = document.createElement('canvas');
  inkedCanvas.width = inkedBitmap.width;
  inkedCanvas.height = inkedBitmap.height;
  const inkedCtx = inkedCanvas.getContext('2d', { willReadFrequently: true })!;
  inkedCtx.drawImage(inkedBitmap, 0, 0);
  const scale = bitmap.width / window.innerWidth;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const results: { id: number; p5: number; median: number }[] = [];
  for (const item of items) {
    const ratios: number[] = [];
    const allRatios: number[] = [];
    const at = (g: NonNullable<typeof item.gradient>, x: number) => {
      const t = Math.min(1, Math.max(0, (x - g.left) / g.width));
      const stops = g.stops;
      if (t <= stops[0].at) return stops[0];
      for (let k = 1; k < stops.length; k++) {
        if (t <= stops[k].at) {
          const u = (t - stops[k - 1].at) / (stops[k].at - stops[k - 1].at || 1);
          const a = stops[k - 1];
          const b = stops[k];
          return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u, a: 1 };
        }
      }
      return stops[stops.length - 1];
    };
    for (const box of item.boxes) {
      const x = Math.max(0, Math.floor(box.left * scale));
      const y = Math.max(0, Math.floor(box.top * scale));
      const w = Math.max(1, Math.min(canvas.width - x, Math.ceil((box.right - box.left) * scale)));
      const h = Math.max(1, Math.min(canvas.height - y, Math.ceil((box.bottom - box.top) * scale)));
      const data = ctx.getImageData(x, y, w, h).data;
      const drawn = inkedCtx.getImageData(x, y, w, h).data;
      for (let i = 0; i < data.length; i += 4) {
        const isInk = Math.abs(drawn[i] - data[i]) + Math.abs(drawn[i + 1] - data[i + 1]) + Math.abs(drawn[i + 2] - data[i + 2]) >= 3;
        const color = item.gradient ? at(item.gradient, (x + ((i / 4) % w)) / scale) : item.colors[0];
        const alpha = color.a * item.opacity;
        const bgL = lum(data[i], data[i + 1], data[i + 2]);
        const fr = color.r * alpha + data[i] * (1 - alpha);
        const fg = color.g * alpha + data[i + 1] * (1 - alpha);
        const fb = color.b * alpha + data[i + 2] * (1 - alpha);
        const fgL = lum(fr, fg, fb);
        const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
        allRatios.push(ratio);
        if (isInk) ratios.push(ratio);
      }
    }
    // The letters' own pixels when there are enough of them to say (the gaps between letters and lines are not what is read); otherwise the whole box.
    const used = ratios.length >= 30 ? ratios : allRatios;
    used.sort((a, b) => a - b);
    const worst = { p5: used[Math.floor(used.length * 0.05)] ?? 21, median: used[Math.floor(used.length / 2)] ?? 21 };
    results.push({ id: item.id, ...worst });
  }
  return results;
}

/**
 * The contrast of every text element on the page as it is now, scrolled through screen by screen (the page scroller `.oct-page`, and any
 * sideways row). `skipEngine`: leave out the engine's own DOM (a world visit, the creator's full preview, the landing's host).
 */
export async function measureContrast(page: Page, { skipEngine = true } = {}): Promise<ContrastRun> {
  const itemsOut: ContrastItem[] = [];
  let sampled = 0;
  const layout = await page.evaluate(scrollerScript);
  const xSteps = layout.rows.length ? Math.ceil(layout.rows[0].width / layout.rows[0].client) : 1;
  const viewport = page.viewportSize()!;
  const ySteps = layout.vertical ? Math.max(1, Math.ceil(layout.vertical.height / Math.max(1, layout.vertical.client - 80))) : 1;
  await page.evaluate(() => {
    const w = window as unknown as { __cdone?: WeakMap<Element, number> };
    w.__cdone = new WeakMap();
  });
  // A colour that is still in a transition (a tab just pressed) is not the colour the text settles on: nothing transitions while this measures. Every element takes hits, so the "is something else on top of this text" test (elementFromPoint) sees the landing's text, which lies on the host with `pointer-events: none`.
  const still = await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; pointer-events: auto !important; }' });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  for (let xi = 0; xi < xSteps; xi++) {
    for (let yi = 0; yi < ySteps; yi++) {
      await page.evaluate(
        ({ xi: x, yi: y, ySteps: ys }) => {
          const scroller = document.querySelector<HTMLElement>('.oct-page');
          if (scroller) scroller.scrollTo(0, y === 0 ? 0 : y * Math.max(1, scroller.clientHeight - 80));
          for (const row of document.querySelectorAll<HTMLElement>('[data-hscroll]')) row.scrollTo(x * row.clientWidth, 0);
          void ys;
        },
        { xi, yi, ySteps },
      );
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      const items = (await page.evaluate(collectScript, { skipEngine, skip: SELECTOR_SKIP })) as { id: number }[];
      if (items.length === 0) continue;
      const inked = (await page.screenshot({ type: 'png' })).toString('base64');
      await page.addStyleTag({
        content: '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; transition: none !important; caret-color: transparent !important; } [data-ct] { background-image: none !important; } ::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }',
      }).then(async handle => {
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        const png = (await page.screenshot({ type: 'png' })).toString('base64');
        await handle.evaluate(node => node.remove());
        const scored = (await page.evaluate(scoreScript, { png, inked, items: items as Parameters<typeof scoreScript>[0]['items'] })) as { id: number; p5: number; median: number }[];
        const byId = new Map(scored.map(s => [s.id, s]));
        for (const item of items as (Parameters<typeof scoreScript>[0]['items'][number])[]) {
          const s = byId.get(item.id)!;
          const c = item.colors[0];
          itemsOut.push({
            text: item.text,
            tag: item.tag,
            color: `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`,
            fontSize: item.fontSize,
            weight: item.weight,
            p5: Math.round(s.p5 * 100) / 100,
            median: Math.round(s.median * 100) / 100,
            at: [Math.round(item.boxes[0].left), Math.round(item.boxes[0].top)],
          });
          sampled++;
        }
      });
    }
  }
  await still.evaluate(node => node.remove());
  void viewport;
  return { items: itemsOut, sampled };
}
