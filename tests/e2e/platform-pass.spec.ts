import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { overflowingElements, overflowingPaint } from './pageChecks';
import { ROUTES, SIZES, openRoute, smallTargets } from './passRoutes';

// The responsive set of the final pass (platform Task 21a; spec 2.5, 7.15): EVERY route of the platform at 360, 390, 768, 1024 and
// 1536 px wide (windows 360 x 740, 390 x 844, 768 x 1024, 1024 x 768, 1536 x 1024):
//   - the page never scrolls sideways, and no element reaches past the window (pageChecks.overflowingElements);
//   - every `button, a, [role=tab], input, summary` is at least 44 px square;
//   - on the landing's two routes no text, button or card meets the host's eyes or mouth (window.__platform.faceRect, development build);
//   - a still of the route is saved to docs/superpowers/evidence/platform/pass/<route>-<w>x<h>.png.
//   - on the landing's two routes the camera's drift moves the text and the cards (the host's hover drift is about 80 px either way
//     at 768 px), so the window overflow is measured again over the next seven seconds.
// The routes: /, /how-it-works, /explore, /@veyra, /@flux, /@nox, /@aether, the world visit /@veyra/vault-os, /create, /create/preview and
// a path that is nothing (the not-found page).
//
// EXEMPTIONS from the 44 px rule (each has its reason; tests/e2e/passRoutes.ts `smallTargets` is the one place they are written):
//   skip      `.oct-skip-link` while it waits above the page: not on screen, 48 px high with focus.
//   sr-only   `.oct-sr-only`: text for a screen reader only, not drawn.
//   inert     inside `[inert]` or `[hidden]`, or not drawn: it cannot be pressed (the intro's controls while How It Works is open).
//   live      `.oct-live-layer`: a card's live preview, the engine's own inert aria-hidden picture.
//   engine    on /@veyra/vault-os and /create/preview the engine's own DOM (the nameplate, the exit link, the overview and detail panels):
//             engine-owned UI (contract 19) that this pass lists (console, "engine controls under 44 px") and does not assert; the platform
//             may not patch the engine. The same for the engine's DOM under the landing's layer (the canvas).
//   file input the creator's hidden file input (1 px wide, behind its labelled button, which is measured).
// Nothing is hidden to pass: overflow is measured on every element, and the page wrapper's own clipping is not trusted.
// Dev server, --workers=1 (every host page is WebGL; four sessions share one GPU).

test.setTimeout(150_000);

const OUT = join(process.cwd(), 'docs/superpowers/evidence/platform/pass');
mkdirSync(OUT, { recursive: true });

type Rect = { left: number; top: number; right: number; bottom: number };
const meets = (a: Rect, b: Rect) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

for (const route of ROUTES) {
  for (const size of SIZES) {
    test(`${route.name} at ${size.width} x ${size.height}: no sideways scroll, targets at least 44 px${route.face ? ', nothing on the host face' : ''}`, async ({ page }) => {
      await openRoute(page, route, size);
      const root = await page.evaluate(() => ({
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.querySelector('.oct-page')?.scrollWidth ?? 0),
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(root.scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(root.innerWidth);
      expect(root.bodyScrollWidth).toBeLessThanOrEqual(root.innerWidth);
      // The landing's intro and the engine's own intro block (a world visit, the preview) are wide transparent blocks that follow the camera's drift: there what is drawn (letters, buttons, glass) is measured.
      const overflow = route.face || route.engineOwned ? overflowingPaint : overflowingElements;
      expect(await overflow(page)).toEqual([]);
      // The host's camera drifts (about 80 px either way on a tablet) and the landing's text and cards follow it: look again as it moves.
      if (route.face) {
        for (let i = 0; i < 4; i++) {
          await page.waitForTimeout(1800);
          expect(await overflow(page), `still inside the window ${i + 1} samples in (the camera drifts)`).toEqual([]);
        }
      }

      const { small, engine } = await smallTargets(page, route.engineOwned);
      if (engine.length) console.log(`${route.name} ${size.width}: engine controls under 44 px (engine-owned, not asserted): ${engine.join('; ')}`);
      expect(small).toEqual([]);

      if (route.face) {
        const { rects, face } = await page.evaluate(() => {
          const rects: { what: string; left: number; top: number; right: number; bottom: number }[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('.oct-layer button, .oct-layer a, .oct-layer h1, .oct-layer h2, .oct-layer p, .oct-layer li')) {
            const style = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            if (style.visibility === 'hidden' || Number(style.opacity) === 0 || r.width === 0 || r.height === 0 || el.closest('[inert]')) continue;
            rects.push({ what: `${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}]`, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
          }
          return { rects, face: (window as unknown as { __platform?: { faceRect?: { eyes: Rect[]; mouth: Rect } } }).__platform?.faceRect ?? null };
        });
        expect(face, 'the development build writes window.__platform.faceRect').not.toBeNull();
        expect(rects.length).toBeGreaterThan(3);
        const parts: [string, Rect][] = [['left eye', face!.eyes[0]], ['right eye', face!.eyes[1]], ['mouth', face!.mouth]];
        for (const r of rects) for (const [name, part] of parts) expect(meets(r, part), `${r.what} meets the ${name}`).toBe(false);
      }


      await page.screenshot({ path: join(OUT, `${route.name}-${size.width}x${size.height}.png`) });
    });
  }
}
