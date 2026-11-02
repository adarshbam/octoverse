// Usage: node scripts/perf.mjs [--gpu] [--secs=6] "stage=intro&tier=high" "stage=intro&tier=low" ...
// Measures the stage at 1536x1024, pixel ratio 1 by default, headless Edge, one page per query: waits for
// window.__noxReady (set 40 frames after the world loads), then prints the median and slow10 frame
// rate (the rate of the slowest tenth of frames) over `secs` seconds.
// `--gpu` also prints the GPU time per frame from EXT_disjoint_timer_query_webgl2 around each
// animation-frame callback (the renderer draws inside it): median and best10 (the fastest tenth).
// `--dpr=2` sets the device pixel ratio (default 1). Close the browser pane first.
// NOX_URL picks the server (default http://localhost:5191). Derived from spike-env/perf.mjs.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const gpu = args.includes('--gpu');
const secs = Number(args.find(a => a.startsWith('--secs='))?.slice(7) ?? 6);
const dpr = Number(args.find(a => a.startsWith('--dpr='))?.slice(6) ?? 1);
const queries = args.filter(a => !a.startsWith('--'));
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

// Times each animation-frame callback on the GPU. Installed before the page's scripts run.
const TIMER = `(() => {
  window.__gpuMs = [];
  let gl2 = null; const open = [];
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = get.call(this, type, ...rest);
    if (c && type === 'webgl2' && !gl2) gl2 = c;
    return c;
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => {
    const ext = gl2 && gl2.getExtension('EXT_disjoint_timer_query_webgl2');
    let q = null;
    if (ext && window.__gpuOn) { q = gl2.createQuery(); gl2.beginQuery(ext.TIME_ELAPSED_EXT, q); }
    try { cb(t); } finally {
      if (q) { gl2.endQuery(ext.TIME_ELAPSED_EXT); open.push(q); }
      for (let i = open.length - 1; i >= 0; i--) {
        const k = open[i];
        if (gl2.getQueryParameter(k, gl2.QUERY_RESULT_AVAILABLE)) {
          if (!gl2.getParameter(ext.GPU_DISJOINT_EXT)) window.__gpuMs.push(gl2.getQueryParameter(k, gl2.QUERY_RESULT) / 1e6);
          gl2.deleteQuery(k); open.splice(i, 1);
        }
      }
    }
  });
})();`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', args: ['--ignore-gpu-blocklist', '--disable-frame-rate-limit'] });
try {
  for (const raw of queries.length ? queries : ['stage=intro&tier=high']) {
    const query = raw;
    const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: dpr });
    if (gpu) await page.addInitScript(TIMER);
    await page.goto(`${base}/?${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__noxReady === true, null, { timeout: 180000, polling: 250 });
    await page.waitForTimeout(1500);
    const { times, gpuMs } = await page.evaluate(ms => new Promise(done => {
      window.__gpuOn = true; window.__gpuMs = window.__gpuMs || [];
      window.__gpuMs.length = 0;
      const times = [];
      let last = performance.now();
      const start = last;
      const step = now => {
        times.push(now - last);
        last = now;
        if (now - start < ms) requestAnimationFrame(step);
        else { window.__gpuOn = false; setTimeout(() => done({ times, gpuMs: [...window.__gpuMs] }), 300); }
      };
      requestAnimationFrame(step);
    }), secs * 1000);
    const sorted = [...times].sort((a, b) => a - b);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    let line = `${raw.padEnd(40)} median ${(1000 / pct(sorted, 0.5)).toFixed(1).padStart(5)} fps  slow10 ${(1000 / pct(sorted, 0.9)).toFixed(1).padStart(5)} fps  mean ${(1000 / mean).toFixed(1).padStart(5)} fps  (${times.length} frames)`;
    if (gpu) {
      const g = gpuMs.filter(v => v > 1).sort((a, b) => a - b);
      line += g.length ? `  gpu median ${pct(g, 0.5).toFixed(2)} ms  best10 ${pct(g, 0.1).toFixed(2)} ms  (${g.length} timed)` : '  gpu: no timer query';
    }
    console.log(line);
    await page.close();
  }

} finally {
  await browser.close();
}
