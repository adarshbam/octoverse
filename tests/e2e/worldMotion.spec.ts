import { expect, test, type Browser } from '@playwright/test';

// The world's own motion (the floor lava pulse and the coral sway) is one uniform each, fed every
// frame from MotionContext. The unit tests cover the maths; this one reads the uniforms the GPU
// is actually given, so a feed that stopped (or a context that was dropped) shows here.

/** Opens the world and reads the live motion uniforms: the floor's `uMotionV.x` and every coral `uMotion`. */
async function readMotion(browser: Browser, query: string, reducedMotion: 'reduce' | 'no-preference') {
  const page = await browser.newPage({ viewport: { width: 384, height: 256 }, deviceScaleFactor: 1, reducedMotion });
  // three.js announces its renderer and scenes to this hook when it is present.
  await page.addInitScript(() => {
    const seen = { renderer: null as unknown, scenes: [] as unknown[] };
    const hook = new EventTarget();
    hook.addEventListener('observe', event => {
      const thing = (event as CustomEvent).detail as { isWebGLRenderer?: boolean; isScene?: boolean };
      if (thing.isWebGLRenderer) seen.renderer = thing;
      if (thing.isScene) seen.scenes.push(thing);
    });
    Object.assign(window, { __THREE_DEVTOOLS__: hook, __seen: seen });
  });
  await page.goto(`/?stage=intro&world${query}`);
  await page.waitForFunction(() => (window as unknown as { __noxReady?: boolean }).__noxReady === true, undefined, { timeout: 60_000 });
  const motion = await page.evaluate(() => {
    type Mat = { uuid: string };
    type Obj = { isMesh?: boolean; material?: Mat | Mat[]; traverse: (visit: (o: Obj) => void) => void };
    const seen = (window as unknown as { __seen: { renderer: { properties: { get: (m: Mat) => { uniforms?: Record<string, { value: unknown }> } } }; scenes: Obj[] } }).__seen;
    const floor: number[] = [];
    const coral: number[] = [];
    for (const scene of seen.scenes) {
      scene.traverse(object => {
        if (!object.isMesh) return;
        for (const material of [object.material].flat() as Mat[]) {
          const uniforms = seen.renderer.properties.get(material).uniforms;
          const lava = uniforms?.uMotionV?.value as { x: number } | undefined;
          if (lava) floor.push(lava.x);
          const sway = uniforms?.uMotion?.value;
          if (typeof sway === 'number') coral.push(sway);
        }
      });
    }
    return { floor, coral };
  });
  await page.close();
  return motion;
}

test('reduced motion and freeze hold the lava pulse and the coral sway at zero; otherwise they run', async ({ browser }) => {
  test.setTimeout(240_000);
  const live = await readMotion(browser, '', 'no-preference');
  expect(live.floor.length).toBeGreaterThan(0);
  expect(live.coral.length).toBeGreaterThan(0);
  expect(live.floor.every(v => v === 1)).toBe(true);
  expect(live.coral.every(v => v === 1)).toBe(true);

  for (const [query, reducedMotion] of [['', 'reduce'], ['&freeze', 'no-preference']] as const) {
    const held = await readMotion(browser, query, reducedMotion);
    expect(held.floor.length, `${query || 'reduced motion'}: floor uniform found`).toBeGreaterThan(0);
    expect(held.coral.length, `${query || 'reduced motion'}: coral uniform found`).toBeGreaterThan(0);
    expect(held.floor.every(v => v === 0), `${query || 'reduced motion'}: lava`).toBe(true);
    expect(held.coral.every(v => v === 0), `${query || 'reduced motion'}: coral`).toBe(true);
  }
});
