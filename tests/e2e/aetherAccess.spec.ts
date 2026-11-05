import { type Page, expect, test } from '@playwright/test';
import sharp from 'sharp';

// Task 21 (spec 7.11, Review Focus 5): Aether's keyboard path through every stage, her 44 px targets on a phone,
// and reduced motion across the stages. Probes are the development build's (`window.__octoverse`).

const ORDER = ['OpenAI', 'Python', 'TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Vector DB'];
const DESKTOP = { width: 1536, height: 1024 };
const PHONE = { width: 390, height: 844 };

type Tip = { x: number; y: number };
type Probe = {
  ready?: boolean;
  camera?: { position: number[]; quaternion: number[]; fov: number; offsetY: number };
  attention?: { gazeX: number; tips: Tip[] };
  swell?: { open: boolean; moving: boolean; morph: number; effect: number; push: number };
  lift?: { techId: string; arm: string; releasing: boolean; tip: number }[];
  entrance?: { t: number };
};
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __octoverse?: Probe }).__octoverse?.ready === true, undefined, { timeout: 90_000 });
const open = async (page: Page, query: string) => {
  await page.goto(`/?world=aether&${query}`);
  await ready(page);
};

/** Explore by keyboard: with motion on her nameplate rides her float, so a pointer click never finds it still. */
const pressExplore = async (page: Page) => {
  await page.getByRole('button', { name: /Explore/ }).focus();
  await page.keyboard.press('Enter');
};

/** What the focus is on, as a name: the aria-label, else the text (null when the focus has left the page's controls for the browser). */
const focusName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    return el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 40) || el.tagName;
  });

/** Tabs through the page once, from the top: each distinct stop, in order, with its box. Stops when the focus leaves the page or comes round. */
async function tabStops(page: Page, max = 40) {
  const stops: { name: string; width: number; height: number }[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const r = el.getBoundingClientRect();
      return { name: el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 40) || el.tagName, width: r.width, height: r.height };
    });
    if (!stop || stops.some(s => s.name === stop.name)) break;
    stops.push(stop);
  }
  return stops;
}

test.describe('keyboard path', () => {
  test.setTimeout(150_000);

  test('intro, overview, detail: every stage, orb and link is reached by Tab, in order, and the stage buttons answer Enter', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, 'stage=intro&freeze');
    // Intro: the skip link, then Explore (the nameplate); no orb, no other stop.
    const intro = await tabStops(page);
    expect(intro.map(s => s.name)).toEqual(['Skip to project details', 'Aether, The Curious Mind, Explore AI Playground']);

    // Enter on Explore opens the overview.
    await page.getByRole('button', { name: /Explore/ }).focus();
    await page.keyboard.press('Enter');
    const overview = page.getByRole('region', { name: 'AI Playground overview' });
    await expect(overview).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.orb-button')).toHaveCount(10, { timeout: 30_000 });
    // Overview, on from Explore (the focus keeps its place): the panel's own buttons, then her ten orbs in slot order.
    // (Choosing an orb leaves the overview for the tech focus, whose panel is gone: the ten orbs' own order is the next test's.)
    const stops: string[] = [];
    for (let i = 0; i < 10 && !stops.includes('OpenAI'); i++) {
      await page.keyboard.press('Tab');
      stops.push((await focusName(page)) ?? '');
    }
    expect(stops).toEqual(['View Project', 'GitHub', 'OpenAI']);
    await page.keyboard.press('Escape');

    // View Project opens the project view by keyboard; the heading takes focus; Tab reaches its tabs and both links.
    await overview.getByRole('button', { name: /View Project/ }).focus();
    await page.keyboard.press('Enter');
    const detail = page.getByRole('region', { name: 'AI Playground full project view' });
    await expect(detail).toBeVisible({ timeout: 30_000 });
    await expect(detail.getByRole('heading', { level: 1, name: 'AI Playground' })).toBeFocused();
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const name = await focusName(page);
      if (name === null) break;
      if (!seen.includes(name)) seen.push(name);
    }
    for (const name of ['Close project view', 'Overview', 'Tech Stack', 'Live Demo', 'GitHub']) expect(seen, `the project view reaches ${name}`).toContain(name);
    expect(errors).toEqual([]);
  });

  test('the tech focus is a stop too: Tab to an orb, Enter or focus lifts it, Escape lets go, and the focus stays', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, 'stage=techFocus&tech=openai&freeze');
    // With a technology chosen the overview's panel is gone: the skip link, then the ten orbs in slot order.
    const stops = (await tabStops(page)).map(s => s.name);
    expect(stops[0]).toBe('Skip to project details');
    expect(stops.slice(1)).toEqual(ORDER);
    await page.getByRole('button', { name: 'Docker' }).focus();
    await expect(page.getByRole('tooltip')).toContainText('Docker', { timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Docker' })).toBeFocused();
  });
});

// Spec 7.11: 44 px targets at the phone viewport. Every control the keyboard reaches in a stage is measured where it is.
// Known short targets are listed by name: they are the engine's shared UI (the nameplate and the skip controls), not Aether's;
// each stays listed until the engine makes it 44 px (see the report's engine requests); any other short control fails.
const KNOWN_SHORT = ['Skip to project details', 'Aether, The Curious Mind, Explore AI Playground', 'Skip intro'];
const PHONE_STAGES = ['stage=intro&freeze', 'stage=entering', 'stage=overview&freeze', 'stage=techFocus&tech=openai&freeze', 'stage=detail&freeze'];

test.describe('phone targets', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });
  test.setTimeout(150_000);

  for (const query of PHONE_STAGES) {
    test(`${query}: every control the keyboard reaches is at least 44 x 44 (but the known short ones)`, async ({ page }) => {
      await open(page, query);
      const stops = await tabStops(page);
      test.info().annotations.push({ type: 'stops (w x h)', description: stops.map(s => `${s.name}: ${Math.round(s.width)}x${Math.round(s.height)}`).join('; ') });
      expect(stops.length).toBeGreaterThan(0);
      const short = stops.filter(s => s.width < 44 - 0.5 || s.height < 44 - 0.5).map(s => s.name);
      test.info().annotations.push({ type: 'short controls', description: JSON.stringify(stops.filter(s => short.includes(s.name)).map(s => [s.name, Math.round(s.width), Math.round(s.height)])) });
      for (const name of short) expect(KNOWN_SHORT, `${name} is under 44 px and is not a known engine control`).toContain(name);
      for (const s of stops) {
        // Inside the screen (the phone frame is 390 wide).
        expect(s.width, s.name).toBeLessThanOrEqual(PHONE.width);
      }
    });
  }
});


// Spec 7.11: reduced motion: no float, drift, swim, tilt or wander; the ring static; the flight a crossfade; the synapse a crossfade.
// The models are unit-tested on her own data (src/worlds/aether/reducedMotion.test.ts); these measure the page.
test.describe('reduced motion across the stages', () => {
  test.setTimeout(240_000);

  type Frame = { t: number; cam: string; tips: Tip[]; gaze: number; swell: Probe['swell'] | null; lift: Probe['lift']; buttons: { name: string; x: number; y: number }[] };
  /** Samples probes on every frame for `ms`: the camera (its place, turn and field of view: the lens shift follows the layout, not motion), the arm tips, the gaze, the swell, the lifts and the orb buttons' centres. */
  const record = (page: Page, ms: number): Promise<Frame[]> =>
    page.evaluate(async duration => {
      const w = window as unknown as { __octoverse?: Probe };
      const frames: Frame[] = [];
      const t0 = performance.now();
      await new Promise<void>(done => {
        const tick = () => {
          const o = w.__octoverse;
          frames.push({
            t: performance.now() - t0,
            cam: JSON.stringify(o?.camera ? [o.camera.position, o.camera.quaternion, o.camera.fov] : null),
            tips: (o?.attention?.tips ?? []).map(t => ({ x: t.x, y: t.y })),
            gaze: o?.attention?.gazeX ?? 0,
            swell: o?.swell ? { ...o.swell } : null,
            lift: (o?.lift ?? []).map(l => ({ ...l })),
            buttons: [...document.querySelectorAll<HTMLElement>('.orb-button')].map(el => {
              const r = el.getBoundingClientRect();
              return { name: el.getAttribute('aria-label') ?? '', x: r.x + r.width / 2, y: r.y + r.height / 2 };
            }),
          });
          if (performance.now() - t0 < duration) requestAnimationFrame(tick);
          else done();
        };
        tick();
      });
      return frames;
    }, ms);
  const tipTravel = (frames: Frame[]) => {
    const first = frames[0].tips;
    return Math.max(0, ...frames.flatMap(f => f.tips.map((t, i) => Math.hypot(t.x - first[i].x, t.y - first[i].y))));
  };
  /** The orbs' furthest travel from where they first stood, over the frames in which all ten are placed (a button not yet laid out stands at the page's corner). */
  const buttonTravel = (frames: Frame[]) => {
    const placed = frames.filter(f => f.buttons.length === 10 && f.buttons.every(b => b.x > 1 && b.y > 1));
    return { frames: placed.length, travel: Math.max(0, ...placed.flatMap(f => f.buttons.map((b, i) => Math.hypot(b.x - placed[0].buttons[i].x, b.y - placed[0].buttons[i].y)))) };
  };

  /** How many pixels of a region change between shots `gap` ms apart: the median of the pairs (a blink, a passing speck is one pair). */
  async function changedPixels(page: Page, region: { left: number; top: number; width: number; height: number }, n = 4, gap = 600) {
    const shots: Buffer[] = [];
    for (let i = 0; i < n; i++) {
      shots.push(await sharp(await page.screenshot({ clip: { x: region.left, y: region.top, width: region.width, height: region.height } })).removeAlpha().raw().toBuffer());
      await page.waitForTimeout(gap);
    }
    const counts = shots.slice(1).map((shot, k) => {
      let changed = 0;
      for (let p = 0; p < shot.length; p += 3) {
        if (Math.abs(shot[p] - shots[k][p]) + Math.abs(shot[p + 1] - shots[k][p + 1]) + Math.abs(shot[p + 2] - shots[k][p + 2]) > 24) changed++;
      }
      return changed;
    });
    return { counts, median: [...counts].sort((a, b) => a - b)[Math.floor(counts.length / 2)] };
  }
  // The 1536 x 1024 intro: the ring's bead on her right (x 940 to 1050, y 480 to 580, nothing else in it but water), a patch of the light shafts, her left arm.
  const BEAD = { left: 940, top: 480, width: 110, height: 100 };
  const SHAFTS = { left: 600, top: 0, width: 330, height: 300 };
  const ARM = { left: 380, top: 650, width: 250, height: 250 };

  test('intro: no entrance, and no float, sway, tilt, wander, ring or world drift; with motion on the same measures do move', async ({ browser }) => {
    const still = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const errors: string[] = [];
    still.on('pageerror', e => errors.push(e.message));
    await open(still, 'stage=intro');
    // No entrance plays under reduced motion: the intro at once, no skip control, nothing in the other worlds' session flags.
    await expect(still.getByRole('button', { name: /Explore/ })).toBeVisible({ timeout: 60_000 });
    await expect(still.getByRole('button', { name: 'Skip intro' })).toBeHidden();
    expect(await still.evaluate(() => ({ nox: sessionStorage.getItem('octoverse.nox.entranceSeen'), veyra: sessionStorage.getItem('octoverse.veyra.entranceSeen') }))).toEqual({ nox: null, veyra: null });
    await still.waitForTimeout(2000);
    const frames = await record(still, 3000);
    expect(frames.length).toBeGreaterThan(20);
    const cams = new Set(frames.map(f => f.cam));
    const gazes = new Set(frames.map(f => f.gaze.toFixed(4)));
    const tips = tipTravel(frames);
    const bead = await changedPixels(still, BEAD, 3, 2000);
    const shafts = await changedPixels(still, SHAFTS);
    const arm = await changedPixels(still, ARM);
    test.info().annotations.push({ type: 'reduced', description: JSON.stringify({ cameraStates: cams.size, gazeStates: gazes.size, tipTravel: tips, beadPx: bead.counts, shaftsPx: shafts.counts, armPx: arm.counts }) });
    expect(cams.size, 'the camera does not drift').toBe(1);
    expect(gazes.size, 'her gaze does not wander (no pointer)').toBe(1);
    expect(tips, 'no arm sways or curls').toBeLessThan(0.002);
    await still.close();

    // The control: with motion the same measures move (so the checks above can fail).
    const live = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    await live.addInitScript(() => sessionStorage.setItem('octoverse.aether.entranceSeen', '1'));
    await open(live, 'stage=intro');
    await live.waitForTimeout(2000);
    const moving = await record(live, 3000);
    const liveBead = await changedPixels(live, BEAD, 3, 2000);
    const liveShafts = await changedPixels(live, SHAFTS);
    const liveArm = await changedPixels(live, ARM);
    test.info().annotations.push({ type: 'with motion', description: JSON.stringify({ tipTravel: tipTravel(moving), beadPx: liveBead.counts, shaftsPx: liveShafts.counts, armPx: liveArm.counts }) });
    expect(tipTravel(moving), 'with motion the arms do move').toBeGreaterThan(0.01);
    // The ring's bead stands at its home (it sways +-12 degrees with motion): the region holds only water and the bead.
    expect(liveBead.median, 'with motion the bead sways').toBeGreaterThan(150);
    expect(bead.median, 'reduced: the ring is static').toBeLessThan(150);
    // The light shafts and the world's other drift are held.
    expect(liveShafts.median, 'with motion the shafts move').toBeGreaterThan(5000);
    expect(shafts.median, 'reduced: the world holds still').toBeLessThan(liveShafts.median / 10);
    // Her arm: a still apart from the skin's sparkle (known engine gap: the twinkle clock is not held, so a few specks still change).
    expect(liveArm.median, 'with motion her arm changes').toBeGreaterThan(5000);
    expect(arm.median, 'reduced: her arm is a still but for sparkle').toBeLessThan(liveArm.median / 5);
    expect(errors).toEqual([]);
    await live.close();
  });

  test('overview: the flight is a crossfade (the orbs are at their slots from their first frame) and the head opens at once, with the synapse only ever at an end', async ({ browser }) => {
    const page = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, 'stage=intro');
    await page.waitForTimeout(1500);
    const recording = record(page, 3000);
    await pressExplore(page);
    const frames = await recording;
    const orbs = buttonTravel(frames);
    // The head: opened at once, never moving, never part-way. The synapse with it: its progress is the swell's effect value, so it
    // too is only ever at an end (known engine gap: the crossfade form of the synapse is unreachable live, because a reduced swell
    // returns the resting value; it is only reachable in a `?freeze&swell=<s>` still).
    const swells = frames.map(f => f.swell).filter((s): s is NonNullable<typeof s> => s !== null);
    const mid = swells.filter(s => (s.morph > 0.02 && s.morph < 0.98) || (s.effect > 0.02 && s.effect < 0.98));
    const moving = swells.filter(s => s.moving);
    test.info().annotations.push({ type: 'reduced overview', description: JSON.stringify({ orbFrames: orbs.frames, orbTravelPx: orbs.travel, swellFramesMid: mid.length, swellFramesMoving: moving.length, last: swells[swells.length - 1] }) });
    expect(orbs.frames, 'her ten orbs appear').toBeGreaterThan(10);
    expect(moving, 'the head never plays the opening').toEqual([]);
    expect(mid, 'the head is never part-way (nor is the synapse)').toEqual([]);
    expect(swells[swells.length - 1]).toMatchObject({ open: true, morph: 1, effect: 1 });
    expect(orbs.travel, 'no orb flies: it is at its slot from its first frame').toBeLessThan(1);
    expect(errors).toEqual([]);
    await page.close();

    // The control: with motion the orbs do fly (the buttons follow them from the ring to the slots).
    const live = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    await live.addInitScript(() => sessionStorage.setItem('octoverse.aether.entranceSeen', '1'));
    await open(live, 'stage=intro');
    await live.waitForTimeout(1500);
    const flight = record(live, 3500);
    await pressExplore(live);
    const liveFrames = await flight;
    const liveOrbs = buttonTravel(liveFrames);
    const liveMid = liveFrames.map(f => f.swell).filter(s => s && s.effect > 0.02 && s.effect < 0.98).length;
    test.info().annotations.push({ type: 'with motion', description: JSON.stringify({ orbTravelPx: liveOrbs.travel, swellFramesMoving: liveFrames.filter(f => f.swell?.moving).length, framesWithSynapseMidway: liveMid }) });
    expect(liveFrames.filter(f => f.swell?.moving).length, 'with motion the head plays its opening').toBeGreaterThan(5);
    expect(liveMid, 'with motion the synapse is part-way for a while').toBeGreaterThan(5);
    expect(liveOrbs.travel, 'with motion the orbs fly').toBeGreaterThan(20);
    await live.close();
  });

  test('tech focus and detail: the lift is up at once, the orbs, arms and camera hold still, and the project view opens with no drift', async ({ browser }) => {
    const page = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, 'stage=overview');
    await expect(page.locator('.orb-button')).toHaveCount(10, { timeout: 60_000 });
    await page.waitForTimeout(800);
    const recording = record(page, 2500);
    await page.getByRole('button', { name: 'OpenAI' }).focus();
    const frames = await recording;
    const lifted = frames.filter(f => f.lift && f.lift.length > 0);
    expect(lifted.length, 'the arm lift is reported').toBeGreaterThan(5);
    expect(lifted[0].lift![0], 'the lift is on T1 and up at its first frame (no rise)').toMatchObject({ techId: 'openai', arm: 'T1', releasing: false });
    expect(lifted[0].lift![0].tip, 'the tip is at the top at its first frame').toBeGreaterThanOrEqual(0.999);
    // Once it has taken its place: no orb floats, bobs or swings, the arms and the camera hold.
    await page.waitForTimeout(800);
    const settled = await record(page, 2500);
    const orbs = buttonTravel(settled);
    const cameras = new Set(settled.map(f => f.cam));
    test.info().annotations.push({ type: 'reduced tech focus', description: JSON.stringify({ firstLiftTip: lifted[0].lift![0].tip, orbDriftPx: orbs.travel, cameraStates: cameras.size, tipTravel: tipTravel(settled) }) });
    expect(orbs.travel, 'no orb floats').toBeLessThan(1);
    expect(cameras.size, 'the camera holds').toBe(1);
    expect(tipTravel(settled), 'the arms hold').toBeLessThan(0.002);

    // The project view: Enter on View Project, at once, and the camera and arms hold after it lands.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /View Project/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'AI Playground full project view' })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    const detail = await record(page, 2000);
    expect(new Set(detail.map(f => f.cam)).size, 'the camera holds in the project view').toBe(1);
    expect(tipTravel(detail), 'the arms hold in the project view').toBeLessThan(0.002);
    expect(errors).toEqual([]);
    await page.close();
  });
});
