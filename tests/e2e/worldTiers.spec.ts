import { expect, test, type Page } from '@playwright/test';
import { SEABED_ORDER, WATER_SKY_ORDER } from '../../src/engine/world/drawOrder';

// GL checks for the performance tiers, the floor's baked noise, the face texture and the opaque draw order. three.js announces its renderer
// to __THREE_DEVTOOLS__ when the hook is present; the dev server's `__noxSetTier` forces a tier.

type Win = {
  __seen: { renderer: { getContext: () => WebGL2RenderingContext; properties: { get: (o: object) => { uniforms?: Record<string, { value: unknown }>; __webglTexture?: WebGLTexture } } }; scenes: { traverse: (v: (o: { isMesh?: boolean; material?: object | object[] }) => void) => void }[] };
  __noxReady?: boolean;
  __noxSetTier?: (tier: string) => void;
};

async function open(page: Page, query: string, stage = 'intro') {
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
  await page.goto(`/?stage=${stage}${query}`);
  await page.waitForFunction(() => (window as unknown as Win).__noxReady === true, undefined, { timeout: 90_000 });
}


test('a tier change from medium to low leaves one set of far plate textures on the GPU, not two', async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await browser.newPage({ viewport: { width: 384, height: 256 }, deviceScaleFactor: 1 });
  // Counts the compressed textures alive on the GPU (the kit's and the far plate's; the count must not grow):
  // uploaded and not yet deleted.
  await page.addInitScript(() => {
    const live = new Set<WebGLTexture>();
    const proto = WebGL2RenderingContext.prototype;
    for (const name of ['compressedTexImage2D', 'compressedTexSubImage2D'] as const) {
      const original = proto[name] as (...a: unknown[]) => void;
      (proto as unknown as Record<string, unknown>)[name] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
        const bound = this.getParameter(this.TEXTURE_BINDING_2D) as WebGLTexture | null;
        if (bound) live.add(bound);
        return original.apply(this, args);
      };
    }
    const del = proto.deleteTexture;
    proto.deleteTexture = function (this: WebGL2RenderingContext, t: WebGLTexture | null) {
      if (t) live.delete(t);
      return del.call(this, t);
    };
    Object.defineProperty(window, '__compressedLive', { get: () => live.size });
  });
  // After the first load the layers answer slowly, so frames draw between the change and the reload
  // (a slow disk or network): a texture disposed while still drawn would be uploaded again.
  let slow = false;
  await page.route('**/far-*.ktx2', async route => {
    if (slow) await new Promise(r => setTimeout(r, 2500));
    await route.continue();
  });
  await open(page, '&tier=medium');
  const live = () => page.evaluate(() => (window as unknown as { __compressedLive: number }).__compressedLive);
  const layers = await live();
  slow = true;
  await page.evaluate(() => (window as unknown as Win).__noxSetTier!('low'));
  await page.waitForTimeout(6000);
  expect(await live()).toBe(layers);
  await page.close();
});

/** The red and green bytes of the first row and a middle row of the floor's noise texture, read straight from the GPU. */
function readFloorNoise(page: Page) {
  return page.evaluate(() => {
    const { renderer, scenes } = (window as unknown as Win).__seen;
    const gl = renderer.getContext();
    let texture: object | undefined;
    for (const scene of scenes)
      scene.traverse(o => {
        if (!o.isMesh) return;
        for (const m of [o.material].flat() as object[]) {
          const t = renderer.properties.get(m).uniforms?.uFloorNoise?.value;
          if (t) texture = t as object;
        }
      });
    const handle = renderer.properties.get(texture!).__webglTexture;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, handle ?? null, 0);
    const px = new Uint8Array(4 * 8);
    const out: number[] = [];
    for (const [x, y] of [[40, 40], [200, 500], [350, 900], [100, 700]]) {
      gl.readPixels(x, y, 2, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      out.push(...px.slice(0, 8));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    return out;
  });
}

test('the floor noise is drawn, and drawn again after the context is lost and restored', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ viewport: { width: 384, height: 256 }, deviceScaleFactor: 1 });
  await open(page, '&tier=low');
  const before = await readFloorNoise(page);
  expect(before.some(v => v > 0)).toBe(true);
  await page.evaluate(async () => {
    const ext = (window as unknown as Win).__seen.renderer.getContext().getExtension('WEBGL_lose_context')!;
    ext.loseContext();
    await new Promise(r => setTimeout(r, 300));
    ext.restoreContext();
    await new Promise(r => setTimeout(r, 1500));
  });
  await page.waitForTimeout(1500);
  expect(await readFloorNoise(page)).toEqual(before);
  await page.close();
});

test('__noxReady still fires when a far plate layer never answers', async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await browser.newPage({ viewport: { width: 384, height: 256 }, deviceScaleFactor: 1 });
  await page.route('**/far-1.ktx2', () => {});
  const started = Date.now();
  await open(page, '&tier=low');
  expect(Date.now() - started).toBeGreaterThan(15_000);
  await page.close();
});

/** Bytes (RGBA) at a grid of points over the middle of Nox's face texture, read straight from the GPU. */
function readFace(page: Page) {
  return page.evaluate(() => {
    const { renderer, scenes } = (window as unknown as Win).__seen;
    const gl = renderer.getContext();
    let texture: object | undefined;
    for (const scene of scenes)
      scene.traverse(o => {
        if (!o.isMesh) return;
        for (const m of [o.material].flat() as ({ uniforms?: Record<string, { value: unknown }> } | undefined)[]) {
          // The skin's face texture (another material's uFace is a number).
          const t = m?.uniforms?.uFace?.value as { isTexture?: boolean } | undefined;
          if (t?.isTexture) texture = t;
        }
      });
    if (!texture) throw new Error('no face texture in the scene');
    const handle = renderer.properties.get(texture).__webglTexture;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, handle ?? null, 0);
    const px = new Uint8Array(4);
    const out: number[] = [];
    for (let y = 256; y < 768; y += 32)
      for (let x = 256; x < 768; x += 32) {
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        out.push(...px);
      }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    return out;
  });
}

test('a still face is sent to the GPU again after the context is lost and restored', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ viewport: { width: 384, height: 256 }, deviceScaleFactor: 1 });
  // Frozen, the face never changes, so nothing but the restore can send it again.
  await open(page, '&tier=low&freeze');
  const before = await readFace(page);
  // The eyes, brows and mouth are drawn (opaque texels), the rest of the canvas is clear.
  expect(before.filter((_, i) => i % 4 === 3 && before[i] > 0).length).toBeGreaterThan(10);
  await page.evaluate(async () => {
    const ext = (window as unknown as Win).__seen.renderer.getContext().getExtension('WEBGL_lose_context')!;
    ext.loseContext();
    await new Promise(r => setTimeout(r, 300));
    ext.restoreContext();
    await new Promise(r => setTimeout(r, 1500));
  });
  await page.waitForTimeout(1500);
  expect(await readFace(page)).toEqual(before);
  await page.close();
});

/** Every opaque mesh in the stage's scene: its renderOrder, depth flags, and whether it is the water sky. */
function opaques(page: Page) {
  return page.evaluate(() => {
    const { scenes } = (window as unknown as Win).__seen;
    type Obj = { isMesh?: boolean; isPoints?: boolean; renderOrder?: number; material?: object | object[] };
    type Mat = { transparent?: boolean; depthWrite?: boolean; depthTest?: boolean; uniforms?: Record<string, unknown> };
    // The stage's scene is the one with the most children (the post passes have one each).
    const scene = (scenes as unknown as { children: unknown[]; traverse: (v: (o: Obj) => void) => void }[]).reduce((a, b) => (b.children.length > a.children.length ? b : a));
    const out: { order: number; depthWrite: boolean; depthTest: boolean; sky: boolean }[] = [];
    scene.traverse(o => {
      if (!o.isMesh && !o.isPoints) return;
      for (const m of [o.material].flat() as Mat[]) {
        if (m.transparent) continue;
        out.push({ order: o.renderOrder ?? 0, depthWrite: m.depthWrite !== false, depthTest: m.depthTest !== false, sky: !!m.uniforms && 'uZenith' in m.uniforms });
      }
    });
    return out;
  });
}

for (const [stage, query] of [['intro', '&tier=high'], ['overview', '&tier=high'], ['techFocus', '&tech=kali&tier=high'], ['intro', '&tier=low']] as const) {
  test(`the water sky is the only opaque that writes no depth, drawn after every other opaque (${stage}${query})`, async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await browser.newPage({ viewport: { width: 384, height: 256 }, deviceScaleFactor: 1 });
    await open(page, query, stage);
    const list = await opaques(page);
    // Drawn last among the opaques (world/drawOrder.ts), the sky is only correct because every
    // opaque before it writes depth: one that did not would be painted over by the sky.
    const noDepth = list.filter(o => !o.depthWrite);
    expect(noDepth).toEqual([{ order: WATER_SKY_ORDER, depthWrite: false, depthTest: true, sky: true }]);
    expect(list.filter(o => !o.sky).every(o => o.order < WATER_SKY_ORDER)).toBe(true);
    // Only the seabed goes after the rest, and before the sky.
    expect(list.filter(o => o.order === SEABED_ORDER)).toHaveLength(1);
    expect(list.filter(o => !o.sky && o.order > 0).every(o => o.order === SEABED_ORDER)).toBe(true);
    await page.close();
  });
}
