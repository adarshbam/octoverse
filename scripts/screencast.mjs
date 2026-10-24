// Records a page through the browser's screencast and encodes it with ffmpeg (on PATH, libvpx):
// shared by the motion and stage-transition captures.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Runs `script(at)` for `seconds` while recording every frame the page draws; `at(ms)` waits until
 * that point on the recording's timeline. Writes `<out>.webm` (30 fps) and, with `sheet`, a tiled
 * frame sheet `<out>-sheet.png` from an ffmpeg filter chain such as `fps=1.2,crop=...,tile=4x3`.
 * Returns the number of frames the page drew.
 */
export async function screencast(page, { out, seconds, size, sheet }, script) {
  const frames = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, time: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: size.width, maxHeight: size.height });
  const start = Date.now();
  const at = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, start + ms - Date.now())));
  await script(at);
  await at(seconds * 1000);
  await cdp.send('Page.stopScreencast');

  // Each frame shows until the next one arrives; the timeline is cut to `seconds`.
  const t0 = start / 1000;
  const kept = frames.filter(f => f.time >= t0 - 0.2 && f.time <= t0 + seconds);
  if (kept.length < 2) throw new Error(`only ${kept.length} frames were captured`);
  const dir = mkdtempSync(join(tmpdir(), 'nox-cast-'));
  const name = i => join(dir, `f${String(i).padStart(4, '0')}.jpg`).replace(/\\/g, '/');
  let list = '';
  kept.forEach((f, i) => {
    writeFileSync(name(i), Buffer.from(f.data, 'base64'));
    const end = i + 1 < kept.length ? kept[i + 1].time : t0 + seconds;
    list += `file '${name(i)}'\nduration ${Math.max(0.001, end - Math.max(f.time, t0)).toFixed(4)}\n`;
  });
  list += `file '${name(kept.length - 1)}'\n`;
  writeFileSync(join(dir, 'frames.txt'), list);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'), '-vf', 'fps=30', '-t', String(seconds), '-c:v', 'libvpx', '-b:v', '4M', `${out}.webm`]);
  if (sheet) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${out}.webm`, '-vf', sheet, '-frames:v', '1', `${out}-sheet.png`]);
  rmSync(dir, { recursive: true, force: true });
  return kept.length;
}
