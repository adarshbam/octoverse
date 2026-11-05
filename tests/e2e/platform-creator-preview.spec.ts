import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { overflowingElements } from './pageChecks';

// The creator's full draft preview, Publish unavailable and fixture isolation (platform Task 20; spec 7.8, 7.9, 7.13, 2.6), at /create and
// /create/preview. The preview is the draft's page instance: the template's FULL world (its kit) with an `exit` back to /create and no
// navigation bar. Edge, --workers=1, one browser at a time (the world is WebGL).
//   NOX_PORT=5197 npx playwright test -c playwright.nox3d.config.ts tests/e2e/platform-creator-preview.spec.ts --workers=1
//
// HAZARD: playwright.nox3d.config.ts has `reuseExistingServer: true`. A dev server (or another run) still listening on NOX_PORT is
// silently tested instead of a fresh one, and two runs on one port kill each other's server mid-run. Use a port nobody holds (a unique
// NOX_PORT per run) and make sure nothing listens on it afterwards.
//
// NETWORK. No creator action sends anything anywhere: every request goes to the app's own origin, `blob:` or `data:` (the browser's own
// stored images and inline assets). The document loads Poppins from Google Fonts at page load (third party, not triggered by the creator;
// K05 to self-host): those two hosts are told apart ("fonts"), recorded, and NOT asserted on (a font may arrive late); everything else
// (`other`) must be empty.

test.setTimeout(180_000);

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// A real 1 x 1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

interface Seen {
  own: string[];
  fonts: string[];
  other: string[];
  /** The requests made since `mark()`. */
  since: () => { own: string[]; fonts: string[]; other: string[] };
  mark: () => void;
}

/** Records every request of the page, sorted into the app's own, the two font hosts and anything else. */
function watchNetwork(page: Page, origin: string): Seen {
  const seen: Seen = { own: [], fonts: [], other: [], since: () => ({ own: [], fonts: [], other: [] }), mark: () => {} };
  let from = { own: 0, fonts: 0, other: 0 };
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(`${origin}/`) || url === origin || url.startsWith('blob:') || url.startsWith('data:')) seen.own.push(url);
    else if (FONT_HOSTS.some(host => new URL(url).host === host)) seen.fonts.push(url);
    else seen.other.push(url);
  });
  seen.mark = () => (from = { own: seen.own.length, fonts: seen.fonts.length, other: seen.other.length });
  seen.since = () => ({ own: seen.own.slice(from.own), fonts: seen.fonts.slice(from.fonts), other: seen.other.slice(from.other) });
  return seen;
}

/** Collects the page's uncaught errors and console errors (a world that fails to draw is one). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // A font that cannot be fetched (no network in this run) is not the creator's.
    if (/fonts\.(googleapis|gstatic)\.com|Failed to load resource/.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/** The session has seen these bundles' entrances (a creator bundle is `u-<handle>`), as platform-routes.spec.ts does for the showcase. */
async function seen(page: Page, ...ids: string[]) {
  await page.addInitScript(list => {
    try {
      for (const id of list) sessionStorage.setItem(`octoverse.${id}.entranceSeen`, '1');
    } catch {
      /* no storage: the entrance would play */
    }
  }, ['octoverse', 'u-your-octopus', 'u-preview', ...ids]);
}

const status = (page: Page) => page.locator('[data-draft-status]');
const settled = (page: Page) => expect(status(page)).toHaveAttribute('data-draft-status', 'saved', { timeout: 20_000 });
const panel = (page: Page) => page.locator('.oct-projects-panel');
const press = (page: Page, label: string) => panel(page).getByRole('button', { name: label, exact: true });
const seeLive = (page: Page) => page.getByRole('link', { name: /See live preview/ });
const exitLink = (page: Page) => page.locator('[data-preview="draft"] a.exit-link');
const overviewPanel = (page: Page, title: string) => page.getByRole('region', { name: `${title} overview` });
/** The world's own controls drift with the camera, so they are pressed by event, not at a point. */
const openOverview = (page: Page) => page.locator('button.nameplate-button').dispatchEvent('click');

async function openCreator(page: Page, width = 1536, height = 1024) {
  await page.setViewportSize({ width, height });
  await page.goto('/create');
  await page.waitForSelector('#oct-main');
  await settled(page);
}

/** The preview is up once its host has drawn (the ready flag) and its exit control is in. */
async function previewUp(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 120_000 });
  await expect(exitLink(page)).toBeVisible();
}

const pathNow = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search;

/** The creator's database, stores and key, read from storage.ts itself (a rename or a version bump there cannot leave this spec writing somewhere else). */
const STORAGE = (() => {
  const source = readFileSync(resolve(process.cwd(), 'src/platform/creator/storage.ts'), 'utf8');
  const of = (name: string) => new RegExp(`const ${name} = '([^']+)'`).exec(source)?.[1] ?? '';
  const names = { db: of('DB_NAME'), draft: of('DRAFT_STORE'), media: of('MEDIA_STORE'), key: of('DRAFT_KEY') };
  if (Object.values(names).some(value => value === '')) throw new Error(`storage.ts constants not found: ${JSON.stringify(names)}`);
  return names;
})();

/**
 * Puts a draft straight into the creator's IndexedDB (the same database and key the creator saves to), from a page of the app. The
 * database is opened WITHOUT a version (a fresh browser context has none: it is made at version 1 with the two stores, and the app's
 * own open, at its current version, upgrades it as it would any older database).
 */
async function storeDraft(page: Page, draft: unknown) {
  await page.goto('/explore');
  await page.evaluate(
    ({ value, names }) =>
      new Promise<void>((done, fail) => {
        const request = indexedDB.open(names.db);
        request.onupgradeneeded = () => {
          for (const name of [names.draft, names.media]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
        };
        request.onerror = () => fail(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(names.draft, 'readwrite');
          tx.objectStore(names.draft).put(value, names.key);
          tx.oncomplete = () => (db.close(), done());
          tx.onerror = () => fail(tx.error);
        };
      }),
    { value: draft, names: STORAGE },
  );
}

/** The names of the page's IndexedDB databases (Chromium). */
const databases = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));

const project = (id: string, title: string, technologies: string[] = ['react', 'typescript']) => ({ id, slug: id, title, tagline: `${title} tagline`, sections: [], links: {}, technologies, usage: {}, media: [] });
const draftOf = (over: Record<string, unknown> = {}, projects = [project('alpha', 'Alpha'), project('beta', 'Beta', ['rust', 'docker', 'redis'])]) => ({
  version: 1,
  octopus: { template: 'veyra', palette: 'teal', personality: 'calm', name: 'Mira' },
  profile: { handle: 'mira', tagline: 'Builds calm things', about: '' },
  projects,
  updatedAt: '2026-11-05T00:00:00.000Z',
  ...over,
});

const worldIs = (page: Page) => page.evaluate(() => (window as unknown as { __octoverse?: { world?: { kit?: boolean } } }).__octoverse?.world?.kit ?? null);

test.describe('See live preview', () => {
  test('opens /create/preview with the SELECTED project in the template\'s full world (kit loaded, no navigation bar); the exit goes back to the creator with focus on the button', async ({ page, baseURL }) => {
    await seen(page, 'u-mira');
    const errors = watchErrors(page);
    await storeDraft(page, draftOf());
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.goto('/create');
    await settled(page);
    // Select the second project, then open the preview.
    await panel(page).locator('[data-project-id="beta"]').click();
    await expect(seeLive(page)).toHaveAttribute('href', '/create/preview?project=beta');
    await seeLive(page).click();
    await expect(page).toHaveURL(/\/create\/preview\?project=beta$/);
    await previewUp(page);

    const shell = page.locator('[data-preview="draft"]');
    await expect(shell).toHaveAttribute('data-world', 'u-mira');
    await expect(shell).toHaveAttribute('data-project', 'beta');
    await expect(shell).toHaveAttribute('data-tech-count', '3');
    await expect(page).toHaveTitle('Mira · Beta');
    // The template's FULL world is the page instance: its kit loaded (not a backdrop), one canvas, no navigation bar, no creator, no live previews.
    await expect.poll(() => worldIs(page), { timeout: 120_000 }).toBe(true);
    await expect(page.locator('.oct-nav, [data-slot="preview"], .oct-creator, .oct-preview')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Beta' })).toBeVisible();
    // The project's technologies are the world's bubbles.
    await openOverview(page);
    await expect(overviewPanel(page, 'Beta')).toBeVisible();
    await expect(page).toHaveURL(/\/create\/preview\?project=beta&view=overview$/);
    // The tab title stays the draft's after a view change (the shell must not set its own over the host's).
    await expect(page).toHaveTitle('Mira · Beta');
    await expect(page.locator('.orb-button')).toHaveCount(3);
    // The engine's own Escape closes the overview and the address follows (the pop lands on the intro entry).
    await page.keyboard.press('Escape');
    await expect(overviewPanel(page, 'Beta')).toBeHidden();
    await expect(page).toHaveURL(/\/create\/preview\?project=beta$/);
    await expect(page).toHaveTitle('Mira · Beta');

    // Exit: the engine's own control, labelled; from the intro it is the same as Back (the creator is the entry before), so the creator is restored.
    await expect(exitLink(page)).toHaveText('Back to the creator');
    await exitLink(page).click();
    await expect(page).toHaveURL(/\/create$/);
    await settled(page);
    await expect(seeLive(page)).toBeFocused();
    expect(errors).toEqual([]);
    void baseURL;
  });

  test('the exit is the first focusable element, Enter on it returns to the creator, and browser Back from the intro does the same', async ({ page }) => {
    await seen(page, 'u-mira');
    await storeDraft(page, draftOf());
    await openCreator(page);
    await seeLive(page).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/create\/preview\?project=alpha$/);
    await previewUp(page);
    await page.keyboard.press('Tab');
    await expect(exitLink(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/create$/);
    await settled(page);
    await expect(seeLive(page)).toBeFocused();

    // Browser Back from the preview's intro: the same place, the same focus.
    await seeLive(page).click();
    await previewUp(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/create$/);
    await settled(page);
    await expect(seeLive(page)).toBeFocused();
  });

  test('Back from the overview walks the preview\'s own entries (overview, intro) and then the creator; the creator\'s scroll is restored', async ({ page }) => {
    await seen(page, 'u-mira');
    await storeDraft(page, draftOf());
    // A phone: the creator is a long page, scrolled to its buttons before the preview opens.
    await openCreator(page, 390, 844);
    await page.evaluate(() => document.querySelector('.oct-page')!.scrollTo(0, 100000));
    const top = await page.evaluate(() => document.querySelector<HTMLElement>('.oct-page')!.scrollTop);
    expect(top).toBeGreaterThan(100);
    await seeLive(page).click();
    await previewUp(page);
    await openOverview(page);
    await expect(overviewPanel(page, 'Alpha')).toBeVisible();
    await expect(page).toHaveTitle('Mira · Alpha');
    await page.goBack();
    await expect(page).toHaveURL(/\/create\/preview\?project=alpha$/);
    await expect(overviewPanel(page, 'Alpha')).toBeHidden();
    // Back landing on the intro leaves the draft's title (not the shell's).
    await expect(page).toHaveTitle('Mira · Alpha');
    await page.goBack();
    await expect(page).toHaveURL(/\/create$/);
    await settled(page);
    await expect(seeLive(page)).toBeFocused();
    const back = await page.evaluate(() => document.querySelector<HTMLElement>('.oct-page')!.scrollTop);
    expect(Math.abs(back - top)).toBeLessThan(40);
    // No horizontal scroll after returning (390 x 844).
    const widths = await page.evaluate(() => ({ scroll: Math.max(document.documentElement.scrollWidth, document.querySelector('.oct-page')!.scrollWidth), inner: window.innerWidth }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
    expect(await overflowingElements(page)).toEqual([]);
  });

  test('a deep link opens the preview: no draft is the sample draft\'s first project; a stale or unknown project falls back to the first; ?view=overview opens on the overview and Back goes to the creator', async ({ page }) => {
    await seen(page);
    const errors = watchErrors(page);
    await page.goto('/create/preview');
    await previewUp(page);
    // A visitor who never opened the creator keeps no creator database: the preview's read does not create one.
    expect(await databases(page)).not.toContain(STORAGE.db);
    await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-world', 'u-your-octopus');
    await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-project', 'sample-project');
    await expect(page).toHaveTitle('Your Octopus · Sample project');
    await expect(exitLink(page)).toHaveText('Back to the creator');
    await exitLink(page).click();
    await expect(page).toHaveURL(/\/create$/);

    await storeDraft(page, draftOf());
    await page.goto('/create/preview?project=gone');
    await previewUp(page);
    await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-project', 'alpha');

    await page.goto('/create/preview?project=beta&view=overview');
    await previewUp(page);
    await expect(overviewPanel(page, 'Beta')).toBeVisible();
    await expect(page.locator('.oct-nav')).toHaveCount(0);
    // The opener was inserted: one Back goes to the creator.
    await page.goBack();
    await expect(page).toHaveURL(/\/create$/);
    expect(errors).toEqual([]);
  });

  test('a stored draft that is malformed opens the creator\'s own empty draft: the intro, no error', async ({ page }) => {
    await seen(page, 'u-preview');
    const errors = watchErrors(page);
    await storeDraft(page, { version: 9, nonsense: true });
    await page.goto('/create/preview');
    await previewUp(page);
    await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-tech-count', '0');
    await expect(page.getByRole('heading', { level: 1, name: 'Untitled project' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('reduced motion: the preview opens on the intro (no entrance) and the exit works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await storeDraft(page, draftOf());
    const errors = watchErrors(page);
    await openCreator(page);
    await seeLive(page).click();
    await previewUp(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Alpha' })).toBeVisible();
    await exitLink(page).click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.locator('canvas')).toHaveCount(0); // reduced motion: the creator is its still, no live preview
    expect(errors).toEqual([]);
  });

  test('the entrance plays once per session: a first open shows it, leaving it records it, a second open goes straight to the intro', async ({ page }) => {
    await storeDraft(page, draftOf());
    await openCreator(page);
    await seeLive(page).click();
    await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 120_000 });
    // Any key skips the entrance (the engine's rule); then the session has seen it.
    await expect(exitLink(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('octoverse.u-mira.entranceSeen')), { timeout: 60_000 }).toBe('1');
    await exitLink(page).click();
    await settled(page);
    await seeLive(page).click();
    await previewUp(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Alpha' })).toBeVisible();
    // No entrance this time: the skip control the engine shows during one is absent.
    await expect(page.getByRole('button', { name: /skip/i })).toHaveCount(0);
  });
});

test.describe('the preview shows the draft as it is on screen', () => {
  test('an edit pressed straight into See live preview (the 800 ms autosave has not run) is in the preview', async ({ page }) => {
    await seen(page, 'u-mira');
    await storeDraft(page, draftOf());
    await openCreator(page);
    await page.getByLabel('Name', { exact: true }).fill('Kelp');
    // No wait: the status is still "saving" when the link is pressed.
    await expect(status(page)).toHaveAttribute('data-draft-status', 'saving');
    await seeLive(page).click();
    await previewUp(page);
    await expect(page).toHaveTitle('Kelp · Alpha');
    await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-world', 'u-mira');
    // What the creator saved on leaving is the same: back in the creator, after a reload, the name is Kelp.
    await exitLink(page).click();
    await settled(page);
    await page.reload();
    await settled(page);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Kelp');
  });

  test('a browser that cannot keep drafts (IndexedDB blocked) previews the draft in this tab, not the sample; a reload of the preview has only the sample', async ({ page }) => {
    await page.addInitScript(() => {
      IDBFactory.prototype.open = function () {
        throw new DOMException('denied', 'SecurityError');
      };
    });
    await seen(page, 'u-your-octopus');
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.goto('/create');
    await expect(status(page)).toHaveAttribute('data-draft-status', 'memory');
    await page.getByLabel('Name', { exact: true }).fill('Kelp');
    await press(page, 'Add project').click();
    await page.getByLabel('Title', { exact: true }).fill('Memory only');
    await page.locator('.oct-file input').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
    await expect(panel(page).locator('.oct-image img')).toHaveCount(1);
    await seeLive(page).click();
    await previewUp(page);
    await expect(page).toHaveTitle('Kelp · Memory only');
    await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-project', /.+/);
    // The hand-off lives in this page only: reloading the preview cannot bring the in-memory draft back.
    await page.reload();
    await previewUp(page);
    await expect(page).toHaveTitle('Your Octopus · Sample project');
  });
});

test.describe('a draft with nothing to show still previews', () => {
  test('a draft with ZERO projects opens the intro and an empty overview, without an error', async ({ page }) => {
    await seen(page, 'u-mira');
    const errors = watchErrors(page);
    await storeDraft(page, draftOf({}, []));
    await openCreator(page);
    await expect(panel(page)).toContainText('No projects yet');
    await seeLive(page).click();
    await expect(page).toHaveURL(/\/create\/preview$/);
    await previewUp(page);
    await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-tech-count', '0');
    await expect(page.getByRole('heading', { level: 1, name: 'Untitled project' })).toBeVisible();
    await openOverview(page);
    await expect(overviewPanel(page, 'Untitled project')).toBeVisible();
    await expect(page.locator('.orb-button')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(overviewPanel(page, 'Untitled project')).toBeHidden();
    await exitLink(page).click();
    await expect(page).toHaveURL(/\/create$/);
    expect(errors).toEqual([]);
  });

  test('a project with ZERO technologies (and no sections) opens the intro and an empty overview, without an error', async ({ page }) => {
    await seen(page, 'u-mira');
    const errors = watchErrors(page);
    await storeDraft(page, draftOf({}, [project('bare', 'Bare', [])]));
    await page.goto('/create/preview?project=bare');
    await previewUp(page);
    await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-tech-count', '0');
    await openOverview(page);
    await expect(overviewPanel(page, 'Bare')).toBeVisible();
    await expect(page.locator('.orb-button')).toHaveCount(0);
    // The detail of a project with no sections opens too.
    await page.locator('button.overview-view').dispatchEvent('click');
    await expect(page.getByRole('region', { name: 'Bare full project view' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('every template previews its own full world for a minimal draft (kit loaded)', async ({ page }) => {
    for (const template of ['veyra', 'flux', 'nox', 'aether']) {
      await seen(page, `u-${template}-fan`);
      await storeDraft(page, draftOf({ octopus: { template, palette: 'original', personality: 'calm', name: 'Fan' }, profile: { handle: `${template}-fan`, tagline: '', about: '' } }, [project('one', 'One')]));
      await page.goto('/create/preview');
      await previewUp(page);
      await expect(page.locator('[data-preview="draft"]')).toHaveAttribute('data-world', `u-${template}-fan`);
      await expect.poll(() => worldIs(page), { timeout: 120_000 }).toBe(true);
    }
  });
});

test.describe('Publish is unavailable', () => {
  test('the button is disabled with the exact text, does nothing, and the preview has no Publish', async ({ page }) => {
    await seen(page, 'u-mira');
    await storeDraft(page, draftOf());
    await openCreator(page);
    const publish = page.getByRole('button', { name: 'Publishing arrives with accounts', exact: true });
    await expect(publish).toBeVisible();
    await expect(publish).toBeDisabled();
    await expect(publish).toHaveText('Publishing arrives with accounts');
    // It cannot be focused by keyboard (a disabled button) and a forced press changes nothing.
    const before = pathNow(page);
    await publish.click({ force: true });
    expect(pathNow(page)).toBe(before);
    await expect(page.getByRole('button', { name: /^Publish\b/ })).toHaveCount(0);
    await seeLive(page).click();
    await previewUp(page);
    await expect(page.getByText(/Publish/i)).toHaveCount(0);
  });
});

test.describe('no network request leaves the page', () => {
  test('no creator action (name, template, palette, a project, an image, the preview, exit, discard) sends anything anywhere: every request goes to the app\'s own origin, blob: or data:', async ({ page, baseURL }, info) => {
    await seen(page, 'u-your-octopus');
    const net = watchNetwork(page, new URL(baseURL!).origin);
    const errors = watchErrors(page);
    await openCreator(page);
    await page.waitForTimeout(500);
    net.mark();

    await page.getByLabel('Name', { exact: true }).fill('Kelp');
    await page.locator('button[data-template="veyra"]').click();
    await page.getByRole('button', { name: 'Teal' }).click();
    await press(page, 'Add project').click();
    await page.getByLabel('Title', { exact: true }).fill('Reef atlas');
    await page.getByLabel('Search technologies', { exact: true }).fill('rust');
    await panel(page).locator('[data-picker-id="rust"]').click();
    await page.locator('.oct-file input').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
    await expect(panel(page).locator('.oct-image img')).toHaveCount(1);
    await page.getByLabel('Live link', { exact: true }).fill('https://example.com/demo');
    await settled(page);

    await seeLive(page).click();
    await expect(page).toHaveURL(/\/create\/preview\?project=/);
    await previewUp(page);
    await openOverview(page);
    await expect(overviewPanel(page, 'Reef atlas')).toBeVisible();
    await exitLink(page).click();
    await expect(page).toHaveURL(/\/create$/);
    await settled(page);

    await page.getByRole('button', { name: 'Discard draft' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Your Octopus');
    await page.waitForTimeout(500);

    const after = net.since();
    // The document's own Poppins stylesheet (Google Fonts) is a page-load request, not the creator's, and may arrive at any time: recorded, not asserted.
    info.annotations.push({ type: 'fonts (third party, at page load; K05 to self-host)', description: `${net.fonts.length} requests, ${after.fonts.length} after the creator opened` });
    expect(after.other, "requests since the creator opened that are not the app's own, blob: or data: (and not the document's font hosts)").toEqual([]);
    expect(net.other, 'the same, over the whole run').toEqual([]);
    // The project's link is shown in the world as a link, never fetched: the example.com address never appears as a request.
    expect([...net.own, ...net.fonts].some(url => url.includes('example.com'))).toBe(false);
    // Positive control: the watch does see requests (the app's own).
    expect(after.own.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});

test.describe('fixture isolation (spec 2.6)', () => {
  /** What a visitor sees of the showcase Veyra profile: its words, the file names of its pictures and the world's title. */
  async function veyraProfile(page: Page) {
    await page.goto('/@veyra');
    await expect(page.getByRole('tab', { name: /^Projects/ })).toBeVisible();
    await page.evaluate(() => Promise.all([...document.images].map(i => (i.complete ? null : new Promise(done => { i.onload = i.onerror = done; })))));
    return page.evaluate(() => ({
      text: (document.querySelector('.oct-page-main') as HTMLElement | null)?.innerText ?? document.body.innerText,
      images: [...document.querySelectorAll('img')].map(i => i.getAttribute('src') ?? ''),
      links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
      title: document.title,
    }));
  }

  test('editing a draft built from the Veyra template never changes /@veyra: its rendered still, its content and its world', async ({ page }) => {
    await seen(page, 'u-your-octopus');
    const errors = watchErrors(page);
    const before = await veyraProfile(page);
    expect(before.images.some(src => /veyra/i.test(src)), 'the hero still is Veyra\'s').toBe(true);

    await openCreator(page);
    await page.locator('button[data-template="veyra"]').click();
    await page.getByRole('button', { name: 'Rose' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Not Veyra');
    await page.getByRole('button', { name: 'Energetic' }).click();
    await press(page, 'Add project').click();
    await page.getByLabel('Title', { exact: true }).fill('Vault OS clone');
    await page.getByLabel('Search technologies', { exact: true }).fill('rust');
    await panel(page).locator('[data-picker-id="rust"]').click();
    await page.locator('.oct-file input').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
    await expect(panel(page).locator('.oct-image img')).toHaveCount(1);
    await settled(page);
    await seeLive(page).click();
    await previewUp(page);
    await openOverview(page);
    await expect(overviewPanel(page, 'Vault OS clone')).toBeVisible();
    await exitLink(page).click();
    await settled(page);

    const during = await veyraProfile(page);
    expect(during).toEqual(before);
    // The world itself is unchanged too: Veyra's own project, not the draft's.
    await page.goto('/@veyra/vault-os');
    await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 120_000 });
    await expect(page.locator('[data-world="veyra"] .exit-link')).toBeVisible();
    await expect(page.locator('[data-world="veyra"]')).toHaveAttribute('data-world', 'veyra');

    // Discarding the draft changes nothing of the fixtures either.
    await page.goto('/create');
    await settled(page);
    await page.getByRole('button', { name: 'Discard draft' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Your Octopus');
    expect(await veyraProfile(page)).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('the How It Works "Your Octopus" card shows the draft\'s still once a draft exists (its template, palette and name), and the sample before', async ({ page }) => {
    await seen(page);
    await page.goto('/how-it-works');
    await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 120_000 });
    const card = page.locator('.oct-yours-picture');
    await expect(card).toHaveAttribute('data-picture', 'sample');
    const sampleSrc = await card.locator('img').getAttribute('src');

    await storeDraft(page, draftOf({ octopus: { template: 'veyra', palette: 'teal', personality: 'calm', name: 'Mira' } }));
    await page.goto('/how-it-works');
    await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 120_000 });
    const mine = page.locator('.oct-yours-picture');
    await expect(mine).toHaveAttribute('data-picture', 'draft');
    await expect(mine.locator('.oct-still-tag')).toHaveText('Mira');
    const draftSrc = await mine.locator('img').getAttribute('src');
    expect(draftSrc).not.toBe(sampleSrc);
    expect(draftSrc).toMatch(/veyra/i);
  });
});
