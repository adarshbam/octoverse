import { expect, test } from '@playwright/test';
import * as THREE from 'three';

// The camera drifts on its own in the intro. A pointer resting on a technology bubble, choosing it
// and the suction hold that follows must not move it at all: it goes on drifting exactly as it
// would have, with no settling, no second drift back in, no zoom and no lens shift.

type Camera = { position: number[]; quaternion: number[]; fov: number; offsetY: number; drift: number; t: number };
type Win = { __noxCamera?: Camera; __noxHold?: { pull: number }[]; __noxReady?: boolean; __cameraLog?: (Camera & { phase: string })[]; __cameraPhase?: string };

const CAMERA_Z = 12;

test('a bubble hover, its choice and the suction hold leave the camera drifting as it was', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?stage=intro');
  await page.waitForFunction(() => (window as unknown as Win).__noxReady === true, undefined, { timeout: 90_000 });
  // Every frame's camera, tagged with the phase the test is in.
  await page.evaluate(() => {
    const w = window as unknown as Win;
    w.__cameraLog = [];
    w.__cameraPhase = 'idle';
    const sample = () => {
      if (w.__noxCamera) w.__cameraLog!.push({ ...w.__noxCamera, phase: w.__cameraPhase! });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const phase = (name: string) => page.evaluate(n => { (window as unknown as Win).__cameraPhase = n; }, name);
  const kali = page.getByRole('button', { name: 'Kali Linux', exact: true });
  // The bubbles are blown in first; their buttons take the pointer once they are there.
  await expect.poll(() => kali.evaluate(el => getComputedStyle(el).pointerEvents), { timeout: 60_000 }).not.toBe('none');
  const onBubble = async () => {
    const box = await kali.boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  };
  const held = () => page.evaluate(() => (window as unknown as Win).__noxHold?.some(h => h.pull >= 1) ?? false);

  await page.mouse.move(10, 10);
  await page.waitForTimeout(1500);
  await phase('hover');
  const box = (await kali.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  // The pointer rests on the bubble (following it as it eases to a stop) until it is chosen and held.
  for (let i = 0; i < 80 && !(await held()); i++) {
    await onBubble();
    await page.waitForTimeout(100);
  }
  expect(await held(), 'the bubble was chosen and held').toBe(true);
  await phase('hold');
  for (let i = 0; i < 25; i++) {
    await onBubble();
    await page.waitForTimeout(100);
  }
  await phase('away');
  await page.mouse.move(10, 10, { steps: 6 });
  await page.waitForTimeout(1500);

  const log = (await page.evaluate(() => (window as unknown as Win).__cameraLog))!;
  expect(new Set(log.map(s => s.phase))).toEqual(new Set(['idle', 'hover', 'hold', 'away']));
  const first = log[0];
  // The intro's drift at full amount (src/nox3d/world/cameraHover.ts): where the camera stands, and
  // the way it faces when it looks at the drift's point. The world's lean (a pitch about the
  // camera's own sideways axis) comes on top of that look, the same at every moment.
  const drift = (t: number) => {
    const offset = [0.9 * Math.sin(0.23 * t), 0.3 * Math.sin(0.17 * t + 1), 1.2 * Math.sin(0.11 * t)];
    const position = [offset[0], offset[1], CAMERA_Z + offset[2]] as const;
    const aim = new THREE.PerspectiveCamera();
    aim.position.set(...position);
    aim.lookAt(offset[0] + 0.3 * Math.sin(0.23 * t), offset[1] - 0.05, CAMERA_Z - 24);
    return { position, aim: aim.quaternion };
  };
  /** The camera's turn beyond the drift's look: its (x, y, z) with w >= 0. A pure pitch has y = z = 0. */
  const lean = (s: Camera) => {
    const rel = drift(s.t).aim.clone().invert().multiply(new THREE.Quaternion(...(s.quaternion as [number, number, number, number])));
    return rel.w < 0 ? [-rel.x, -rel.y, -rel.z] : [rel.x, rel.y, rel.z];
  };
  const pitch = lean(first)[0];
  for (const s of log) {
    const { position } = drift(s.t);
    expect(s.drift, `${s.phase}: drift amount`).toBe(1);
    s.position.forEach((v, axis) => expect(Math.abs(v - position[axis]), `${s.phase}: position axis ${axis}`).toBeLessThan(1e-9));
    expect(s.fov, `${s.phase}: fov`).toBe(first.fov);
    expect(s.offsetY, `${s.phase}: lens shift`).toBe(first.offsetY);
    const [x, y, z] = lean(s);
    expect(Math.abs(y), `${s.phase}: look yaw`).toBeLessThan(1e-9);
    expect(Math.abs(z), `${s.phase}: look roll`).toBeLessThan(1e-9);
    expect(Math.abs(x - pitch), `${s.phase}: look pitch`).toBeLessThan(1e-9);
  }
});
