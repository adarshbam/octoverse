import { expect, test, type Page } from '@playwright/test';
import { overflowingElements } from './pageChecks';

// The creator's editor (platform Task 19a; spec 7.13, 7.15), at /create: projects (add, edit, reorder, delete with a five second undo),
// the technology picker over the catalog, links (a bad one is kept, flagged and not linked), local images, the inline validation,
// the visible save status, the Discard draft flow (ask, clear, and a clear that FAILS keeps the draft and says so) and keyboard order.
// Stills only (no WebGL); run with --workers=1 (one browser at a time).

// A real 1 x 1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

type Flagged = { __failClear: boolean };

const status = (page: Page) => page.locator('[data-draft-status]');
const panel = (page: Page) => page.locator('.oct-projects-panel');
const rows = (page: Page) => panel(page).locator('.oct-project-row-title');
const title = (page: Page) => page.getByLabel('Title', { exact: true });
const name = (page: Page) => page.getByLabel('Name', { exact: true });
const press = (page: Page, label: string) => panel(page).getByRole('button', { name: label, exact: true });

async function open(page: Page, width = 1536, height = 1024) {
  await page.setViewportSize({ width, height });
  await page.goto('/create');
  await page.waitForSelector('#oct-main');
  await expect(status(page)).toHaveAttribute('data-draft-status', 'saved');
  if (width < 768) await page.getByRole('tab', { name: 'Projects' }).click();
}

const savedWords = (page: Page) => expect(status(page)).toHaveText('Saved in this browser');
const settled = (page: Page) => expect(status(page)).toHaveAttribute('data-draft-status', 'saved');

/** Reads the draft object the app saved, straight from IndexedDB (null if none). */
const storedDraft = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>(resolve => {
        const request = indexedDB.open('octoverse-creator');
        request.onerror = () => resolve('error');
        request.onsuccess = () => {
          const db = request.result;
          try {
            const get = db.transaction('draft').objectStore('draft').get('current');
            get.onsuccess = () => (db.close(), resolve(get.result ?? null));
            get.onerror = () => (db.close(), resolve('error'));
          } catch {
            db.close();
            resolve('error');
          }
        };
      }),
  );

test('add a project, edit it, add another: untitled ones read "Untitled project", titled ones their title', async ({ page }) => {
  await open(page);
  await expect(rows(page)).toHaveText(['Sample project']);
  await press(page, 'Add project').click();
  await expect(rows(page)).toHaveText(['Sample project', 'Untitled project']);
  // The new project is selected and its title takes focus.
  await expect(title(page)).toBeFocused();
  await expect(title(page)).toHaveValue('');
  await expect(panel(page)).toContainText('It shows as "Untitled project"');
  await page.keyboard.type('Beta');
  await page.getByLabel('Tagline', { exact: true }).first().fill('Second one');
  await page.getByLabel('Description').fill('What it is.');
  await expect(rows(page)).toHaveText(['Sample project', 'Beta']);
  await expect(panel(page)).not.toContainText('It shows as "Untitled project"');
  await press(page, 'Add project').click();
  await expect(rows(page)).toHaveText(['Sample project', 'Beta', 'Untitled project']);
  // Back to the first: its own values are in the fields.
  await panel(page).locator('[data-project-id="sample-project"]').click();
  await expect(title(page)).toHaveValue('Sample project');
  await panel(page).locator('.oct-project-row', { hasText: 'Beta' }).click();
  await expect(page.getByLabel('Tagline', { exact: true }).first()).toHaveValue('Second one');
  await expect(page.getByLabel('Description')).toHaveValue('What it is.');
});

test('at eight projects Add is disabled', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 7; i++) await press(page, 'Add project').click();
  await expect(rows(page)).toHaveCount(8);
  await expect(press(page, 'Add project')).toBeDisabled();
});

test('reorder with the buttons and by keyboard: focus stays on the button, the ends are aria-disabled', async ({ page }) => {
  await open(page);
  await press(page, 'Add project').click();
  await title(page).fill('Beta');
  await press(page, 'Add project').click();
  await title(page).fill('Gamma');
  await expect(rows(page)).toHaveText(['Sample project', 'Beta', 'Gamma']);
  await expect(press(page, 'Move project down')).toHaveAttribute('aria-disabled', 'true');
  await press(page, 'Move project up').click();
  await expect(rows(page)).toHaveText(['Sample project', 'Gamma', 'Beta']);
  // The selected project (Gamma) is second, so both directions work. By keyboard:
  await press(page, 'Move project up').focus();
  await page.keyboard.press('Enter');
  await expect(rows(page)).toHaveText(['Gamma', 'Sample project', 'Beta']);
  await expect(press(page, 'Move project up')).toBeFocused();
  await expect(press(page, 'Move project up')).toHaveAttribute('aria-disabled', 'true');
  // Pressing it at the top changes nothing and keeps focus.
  await page.keyboard.press('Enter');
  await expect(rows(page)).toHaveText(['Gamma', 'Sample project', 'Beta']);
  await expect(press(page, 'Move project up')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(rows(page)).toHaveText(['Gamma', 'Sample project', 'Beta']);
  await press(page, 'Move project down').focus();
  await page.keyboard.press('Space');
  await expect(rows(page)).toHaveText(['Sample project', 'Gamma', 'Beta']);
});

test('delete shows a five second Undo toast: undo restores the project at its place, and after five seconds there is no undo', async ({ page }) => {
  await open(page);
  await press(page, 'Add project').click();
  await title(page).fill('Beta');
  await press(page, 'Add project').click();
  await title(page).fill('Gamma');
  await panel(page).locator('.oct-project-row', { hasText: 'Beta' }).click();
  const toast = page.locator('[data-undo-toast]');

  await press(page, 'Delete project').click();
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Deleted Beta.');
  // The toast is announced by the panel's one polite line, which is on the page from the start.
  await expect(page.locator('[data-panel-live]')).toContainText('Deleted Beta. Undo is available for 5 seconds.');
  await expect(rows(page)).toHaveText(['Sample project', 'Gamma']);
  // Undo inside the window: back at index 1, selected.
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(rows(page)).toHaveText(['Sample project', 'Beta', 'Gamma']);
  await expect(toast).toHaveCount(0);
  await expect(title(page)).toHaveValue('Beta');

  // Undo late in the window (about 4 s) still works.
  await press(page, 'Delete project').click();
  await expect(toast).toBeVisible();
  await page.waitForTimeout(4000);
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(rows(page)).toHaveText(['Sample project', 'Beta', 'Gamma']);

  // After five seconds the toast is gone and the project with it.
  await press(page, 'Delete project').click();
  const started = Date.now();
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 8000 });
  const lasted = Date.now() - started;
  expect(lasted).toBeGreaterThan(4500);
  expect(lasted).toBeLessThan(7000);
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await expect(rows(page)).toHaveText(['Sample project', 'Gamma']);
});

test('deleting every project leaves the Add button focused and a calm empty state; the caption still names the octopus', async ({ page }) => {
  await open(page);
  await press(page, 'Delete project').click();
  await expect(rows(page)).toHaveCount(0);
  await expect(panel(page)).toContainText('No projects yet');
  await expect(press(page, 'Add project')).toBeFocused();
  await expect(page.locator('.oct-creator-caption b')).toHaveText('Your Octopus');
});

test('the technology picker searches the catalog by name; picks become removable chips in order, with a usage note', async ({ page }) => {
  await open(page);
  await press(page, 'Add project').click();
  const search = page.getByLabel('Search technologies', { exact: true });
  const items = panel(page).locator('.oct-picker-item');
  const item = (id: string) => panel(page).locator(`[data-picker-id="${id}"]`);
  await search.fill('type');
  await expect(item('typescript')).toBeVisible();
  await expect(item('typescript')).toContainText('TypeScript');
  await search.fill('three');
  await expect(items).toHaveText([/Three\.js/]);
  await search.fill('zzzzqqq');
  await expect(items).toHaveCount(0);
  await expect(panel(page)).toContainText('No technology matches "zzzzqqq".');
  // Case does not matter; a common-set technology (in no world) is there too.
  await search.fill('RUST');
  await item('rust').click();
  await search.fill('three');
  await item('threejs').click();
  await search.fill('go');
  await item('go').click();
  const chips = panel(page).locator('.oct-selected-tech');
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toContainText('Rust');
  await expect(chips.nth(1)).toContainText('Three.js');
  await expect(chips.nth(2)).toContainText('Go');
  await expect(item('go')).toHaveAttribute('aria-pressed', 'true');
  // A usage note.
  await page.getByLabel('Usage note for Rust (optional)').fill('The renderer');
  // Removing a chip by its button; focus moves to a neighbouring remove button.
  await panel(page).getByRole('button', { name: 'Remove Three.js' }).click();
  await expect(chips).toHaveCount(2);
  await expect(panel(page).getByRole('button', { name: 'Remove Go' })).toBeFocused();
  // Reload keeps the order and the note.
  await settled(page);
  await page.reload();
  await settled(page);
  await panel(page).locator('.oct-project-row', { hasText: 'Untitled project' }).click();
  await expect(chips).toHaveCount(2);
  await expect(chips.first()).toContainText('Rust');
  await expect(page.getByLabel('Usage note for Rust (optional)')).toHaveValue('The renderer');
});

test('a free-text technology cannot be added: Enter in the filter adds nothing', async ({ page }) => {
  await open(page);
  await press(page, 'Add project').click();
  const search = page.getByLabel('Search technologies', { exact: true });
  await search.fill('my own tool');
  await search.press('Enter');
  await expect(panel(page).locator('.oct-selected-tech')).toHaveCount(0);
  await expect(panel(page)).toContainText('None yet');
});

test('a bad link is KEPT, flagged and not linked; fixing it links it; javascript: is never an anchor', async ({ page }) => {
  await open(page);
  const live = page.getByLabel('Live link', { exact: true });
  await live.fill('example.com/demo');
  await expect(panel(page)).toContainText('This link must start with https://');
  await expect(live).toHaveAttribute('aria-invalid', 'true');
  await expect(panel(page).locator('[data-link-plain]')).toHaveText('example.com/demo');
  await expect(panel(page).locator('a[href]')).toHaveCount(0);
  // It is kept: saved and still there after a reload.
  await settled(page);
  await page.reload();
  await settled(page);
  await expect(live).toHaveValue('example.com/demo');
  await expect(panel(page).locator('a[href]')).toHaveCount(0);
  await live.fill('javascript:alert(1)');
  await expect(panel(page).locator('a[href]')).toHaveCount(0);
  await expect(panel(page).locator('[data-link-plain]')).toHaveText('javascript:alert(1)');
  await live.fill('https://example.com/demo');
  await expect(panel(page).locator('[data-issue]')).toHaveCount(0);
  const anchor = panel(page).locator('a.oct-link-shown');
  await expect(anchor).toHaveAttribute('href', 'https://example.com/demo');
  await expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(anchor).toHaveAttribute('target', '_blank');
  // Saving is never blocked by a flag: a bad repository link still reaches "Saved".
  await page.getByLabel('Repository', { exact: true }).fill('github.com/me/app');
  await settled(page);
  const stored = (await storedDraft(page)) as { projects: { links: { live?: string; repo?: string } }[] };
  expect(stored.projects[0].links).toEqual({ live: 'https://example.com/demo', repo: 'github.com/me/app' });
});

test('validation is inline and never blocks: an empty name shows "Your Octopus", a bad handle and link are flagged in the Profile section', async ({ page }) => {
  await open(page);
  await name(page).fill('');
  await expect(page.locator('.oct-octopus-panel [data-issue]')).toContainText('Name needs 1 to 24');
  await expect(page.locator('.oct-creator-caption b')).toHaveText('Your Octopus');
  await name(page).fill('Kelp');
  await expect(page.locator('.oct-octopus-panel [data-issue]')).toHaveCount(0);
  await expect(page.locator('.oct-creator-caption b')).toHaveText('Kelp');
  // The profile section is collapsed: its summary says when something needs a look.
  await page.locator('summary', { hasText: 'Profile' }).click();
  await page.getByLabel('Handle', { exact: true }).fill('Bad Handle');
  await expect(panel(page).locator('.oct-profile-fields [data-issue]')).toContainText('Handle needs 2 to 24');
  await expect(page.locator('summary', { hasText: 'Profile' })).toContainText('needs a look');
  await page.getByLabel('Link', { exact: true }).fill('http://nope.example');
  await expect(panel(page).locator('.oct-profile-fields [data-issue]')).toHaveCount(2);
  await page.getByLabel('Handle', { exact: true }).fill('kelp-tank');
  await page.getByLabel('Link', { exact: true }).fill('https://kelp.example');
  await expect(panel(page).locator('.oct-profile-fields [data-issue]')).toHaveCount(0);
  await expect(page.locator('summary', { hasText: 'Profile' })).not.toContainText('needs a look');
  // Not blocked: it saved the whole time.
  await settled(page);
});

test('the status line: Saving… right after an edit, Saved in this browser about 800 ms later; the screen reader line does not chatter', async ({ page }) => {
  await open(page);
  await savedWords(page);
  const live = page.locator('[data-save-status]');
  await expect(live).toHaveText('Saved in this browser');
  const edited = Date.now();
  await name(page).fill('Kelp');
  await expect(status(page)).toHaveAttribute('data-draft-status', 'saving');
  await expect(status(page)).toHaveText('Saving…');
  // Mid-save the polite line still says saved (it speaks on a change between saved, cannot save and loading, not on every save).
  await expect(live).toHaveText('Saved in this browser');
  await settled(page);
  expect(Date.now() - edited).toBeGreaterThan(700);
  await savedWords(page);
  // The visible status is text on the screen, not only for a screen reader.
  await expect(status(page)).toBeVisible();
});

test('reload keeps the whole draft: octopus, project, technologies', async ({ page }) => {
  await open(page);
  await name(page).fill('Kelp');
  await page.getByRole('button', { name: 'Teal' }).click();
  await press(page, 'Add project').click();
  await title(page).fill('Keeper');
  await settled(page);
  await page.reload();
  await settled(page);
  await expect(name(page)).toHaveValue('Kelp');
  await expect(page.getByRole('button', { name: 'Teal' })).toHaveAttribute('aria-pressed', 'true');
  await expect(rows(page)).toHaveText(['Sample project', 'Keeper']);
});

test.describe('IndexedDB blocked (a private window)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      IDBFactory.prototype.open = function () {
        throw new DOMException('denied', 'SecurityError');
      };
    });
  });

  test("the creator still works in memory and says \"Can't save in this browser\"", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.goto('/create');
    await expect(status(page)).toHaveAttribute('data-draft-status', 'memory');
    await expect(status(page)).toHaveText("Can't save in this browser");
    await expect(page.locator('[data-save-status]')).toContainText('Cannot save in this browser');
    // Edits work and the status does not claim a save.
    await name(page).fill('Kelp');
    await expect(page.locator('.oct-creator-caption b')).toHaveText('Kelp');
    await press(page, 'Add project').click();
    await title(page).fill('Memory only');
    await expect(rows(page)).toHaveText(['Sample project', 'Memory only']);
    await page.waitForTimeout(1200);
    await expect(status(page)).toHaveText("Can't save in this browser");
    // Images can be added (kept in this tab), and Discard still works (nothing in the browser to clear).
    await page.locator('.oct-file input').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
    await expect(panel(page).locator('.oct-image img')).toHaveCount(1);
    await page.getByRole('button', { name: 'Discard draft' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(rows(page)).toHaveText(['Sample project']);
    await expect(name(page)).toHaveValue('Your Octopus');
  });
});

test('Discard draft asks first: Cancel and Escape keep everything, Confirm clears, a reload shows the sample', async ({ page }) => {
  await open(page);
  await name(page).fill('Kelp');
  await press(page, 'Add project').click();
  await title(page).fill('Doomed');
  await settled(page);
  const discard = page.getByRole('button', { name: 'Discard draft' });
  const ask = page.getByRole('group', { name: 'Discard this draft? This clears it from this browser.' });

  await discard.click();
  await expect(ask).toBeVisible();
  await expect(ask).toBeFocused(); // focus moves to the question
  await expect(ask.getByRole('button')).toHaveText(['Confirm', 'Cancel']);
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask).toHaveCount(0);
  await expect(discard).toBeFocused();
  await expect(rows(page)).toHaveText(['Sample project', 'Doomed']);

  await discard.click();
  await expect(ask).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ask).toHaveCount(0);
  await expect(discard).toBeFocused();
  await expect(name(page)).toHaveValue('Kelp');

  // The bar is outside the inert editing part.
  expect(await page.evaluate(() => !!document.querySelector('[data-draft-bar]')!.closest('[inert]'))).toBe(false);

  await discard.click();
  await ask.getByRole('button', { name: 'Confirm' }).click();
  await expect(rows(page)).toHaveText(['Sample project']);
  await expect(name(page)).toHaveValue('Your Octopus');
  await settled(page);
  await expect(discard).toBeFocused();
  await expect(page.locator('[data-discard-error]')).toHaveCount(0);
  // Cleared in the browser too: a reload shows the sample (nothing stored).
  await page.reload();
  await settled(page);
  await expect(rows(page)).toHaveText(['Sample project']);
  await expect(name(page)).toHaveValue('Your Octopus');
  expect(await storedDraft(page)).toBeNull();
});

test('a clear that FAILS keeps the draft on screen, says so in plain words, and Retry works once the browser allows it', async ({ page }) => {
  await page.addInitScript(() => {
    // While the flag is set the browser refuses to clear: the transaction over both stores throws and so does deleteDatabase.
    (window as unknown as Flagged).__failClear = false;
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, names: string | string[], mode?: IDBTransactionMode) {
      if ((window as unknown as Flagged).__failClear && Array.isArray(names) && names.length === 2) throw new DOMException('refused', 'InvalidStateError');
      return transaction.call(this, names, mode);
    } as typeof IDBDatabase.prototype.transaction;
    const remove = IDBFactory.prototype.deleteDatabase;
    IDBFactory.prototype.deleteDatabase = function (this: IDBFactory, databaseName: string) {
      if ((window as unknown as Flagged).__failClear) throw new DOMException('refused', 'InvalidStateError');
      return remove.call(this, databaseName);
    };
  });
  const failing = (value: boolean) => page.evaluate(v => ((window as unknown as Flagged).__failClear = v), value);
  await open(page);
  await name(page).fill('Kelp');
  await press(page, 'Add project').click();
  await title(page).fill('Precious');
  await settled(page);
  await failing(true);

  await page.getByRole('button', { name: 'Discard draft' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  const error = page.locator('[data-discard-error]');
  await expect(error).toHaveText("Could not clear this browser's copy. Your draft is still here. Try again.");
  // The draft stays: nothing on screen changed.
  await expect(rows(page)).toHaveText(['Sample project', 'Precious']);
  await expect(name(page)).toHaveValue('Kelp');
  await expect(page.locator('[data-save-status]')).toHaveText("Could not clear this browser's copy. Your draft is still here. Try again.");
  // The editing part is usable again (not stuck inert), and Retry is offered and focused.
  expect(await page.evaluate(() => document.querySelector('.oct-creator-grid')!.hasAttribute('inert'))).toBe(false);
  const retry = page.getByRole('button', { name: 'Retry' });
  await expect(retry).toBeFocused();
  // Still failing: Retry says the same thing and keeps the draft.
  await retry.click();
  await expect(error).toBeVisible();
  await expect(rows(page)).toHaveText(['Sample project', 'Precious']);
  // The browser really still holds the draft: it survives a reload (the flag is per page load, so it resets).
  await page.reload();
  await settled(page);
  await expect(name(page)).toHaveValue('Kelp');
  await expect(rows(page)).toHaveText(['Sample project', 'Precious']);
  // Fail once more, then the browser allows it: Retry clears, without a second question.
  await failing(true);
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(error).toBeVisible();
  await failing(false);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(error).toHaveCount(0);
  await expect(rows(page)).toHaveText(['Sample project']);
  await expect(name(page)).toHaveValue('Your Octopus');
  await expect(page.getByRole('button', { name: 'Discard draft' })).toBeFocused();
  expect(await storedDraft(page)).toBeNull();
});

test("editing after a failed clear removes the message (the draft is the visitor's again)", async ({ page }) => {
  await page.addInitScript(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, names: string | string[], mode?: IDBTransactionMode) {
      if (Array.isArray(names) && names.length === 2) throw new DOMException('refused', 'InvalidStateError');
      return transaction.call(this, names, mode);
    } as typeof IDBDatabase.prototype.transaction;
    IDBFactory.prototype.deleteDatabase = function () {
      throw new DOMException('refused', 'InvalidStateError');
    };
  });
  await open(page);
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('[data-discard-error]')).toBeVisible();
  await name(page).fill('Still mine');
  await expect(page.locator('[data-discard-error]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
});

test('images: up to four (PNG, JPEG, WebP, at most 2 MB), previewed, "Saved in this browser only", removable, kept across a reload; every object url is revoked', async ({ page }) => {
  // The images are the editor's: no live preview here (the engine makes object urls of its own, which are not the editor's to revoke).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const created: string[] = [];
    const revoked: string[] = [];
    const make = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      const url = make(blob);
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
      revoke(url);
    };
    (window as unknown as { __urls: unknown }).__urls = { created, revoked };
  });
  await open(page);
  const urls = () => page.evaluate(() => (window as unknown as { __urls: { created: string[]; revoked: string[] } }).__urls);
  const input = page.locator('.oct-file input');
  await expect(panel(page)).toContainText('Images are saved in this browser only.');
  await expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
  await expect(panel(page).locator('.oct-images-empty')).toHaveText('No images yet');

  // Refused: not an image (by its bytes, whatever its name), and over 2 MB.
  await input.setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('this is not a png at all') });
  await expect(page.locator('[data-image-error]')).toHaveText('Images must be PNG, JPEG or WebP.');
  await input.setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 1)]) });
  await expect(page.locator('[data-image-error]')).toHaveText('That image is over 2 MB. Pick a smaller one.');
  await expect(panel(page).locator('.oct-image')).toHaveCount(0);

  // Accepted, with a real preview.
  await input.setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: PNG });
  const first = panel(page).locator('.oct-image img').first();
  await expect(first).toBeVisible();
  await expect(page.locator('[data-image-error]')).toHaveCount(0);
  await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(first).toHaveAttribute('alt', 'one.png');
  await expect(first).toHaveAttribute('src', /^blob:/);

  // Remove: its url is revoked.
  const firstSrc = await first.getAttribute('src');
  expect((await urls()).created).toContain(firstSrc);
  await panel(page).getByRole('button', { name: 'Remove image one.png' }).click();
  await expect(panel(page).locator('.oct-image')).toHaveCount(0);
  await expect.poll(async () => (await urls()).revoked).toContain(firstSrc);

  // Up to four; then the control is disabled and says so.
  await input.setInputFiles([1, 2, 3, 4, 5].map(n => ({ name: `shot-${n}.png`, mimeType: 'image/png', buffer: PNG })));
  await expect(panel(page).locator('.oct-image')).toHaveCount(4);
  await expect(page.locator('[data-image-error]')).toHaveText('A project has at most 4 images.');
  await expect(input).toBeDisabled();
  await expect(panel(page)).toContainText('at most 4 images');
  await settled(page);

  // A reload reads them from the browser's media store.
  await page.reload();
  await settled(page);
  await expect(panel(page).locator('.oct-image img')).toHaveCount(4);
  await expect.poll(() => panel(page).locator('.oct-image img').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Switching project revokes the previous project's urls; leaving the page revokes the rest.
  await press(page, 'Add project').click();
  await expect(panel(page).locator('.oct-image')).toHaveCount(0);
  const before = (await urls()).created;
  await page.getByRole('link', { name: 'Explore' }).first().click();
  await page.waitForURL('**/explore');
  const after = await urls();
  expect(before.filter(url => !after.revoked.includes(url))).toEqual([]);
});

test('Discard clears the images too: the media store is empty afterwards', async ({ page }) => {
  await open(page);
  await page.locator('.oct-file input').setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: PNG });
  await expect(panel(page).locator('.oct-image img')).toHaveCount(1);
  await settled(page);
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(panel(page).locator('.oct-image')).toHaveCount(0);
  await settled(page);
  const count = await page.evaluate(
    () =>
      new Promise<number>(resolve => {
        const request = indexedDB.open('octoverse-creator');
        request.onerror = () => resolve(-1);
        request.onsuccess = () => {
          const db = request.result;
          try {
            const counted = db.transaction('media').objectStore('media').count();
            counted.onsuccess = () => (db.close(), resolve(counted.result));
          } catch {
            db.close();
            resolve(-1);
          }
        };
      }),
  );
  expect(count).toBe(0);
});

for (const width of [360, 390, 768, 1536] as const) {
  test(`the full editor at ${width}: no horizontal scroll, every control at least 44 px`, async ({ page }) => {
    await open(page, width, width === 390 ? 844 : width < 768 ? 800 : 1024);
    await press(page, 'Add project').click();
    await title(page).fill('A project with a rather long title that has to wrap somewhere inside the panel');
    await page.getByLabel('Live link', { exact: true }).fill('not-a-link-' + 'x'.repeat(120));
    await page.getByLabel('Search technologies', { exact: true }).fill('r');
    await panel(page).locator('.oct-picker-item').first().click();
    await panel(page).locator('.oct-picker-item').nth(1).click();
    await panel(page).locator('.oct-file input').setInputFiles({ name: 'a-rather-long-file-name-for-a-screenshot-of-the-project.png', mimeType: 'image/png', buffer: PNG });
    await expect(panel(page).locator('.oct-image img')).toHaveCount(1);
    await page.locator('summary', { hasText: 'Profile' }).click();
    await page.getByLabel('Handle', { exact: true }).fill('Bad Handle With Spaces And A Very Long Tail That Overflows');
    // The deleted project's toast and the open question are on screen for the measure.
    await panel(page).getByRole('button', { name: 'Delete project' }).click();
    await page.getByRole('button', { name: 'Discard draft' }).click();
    await expect(page.getByRole('group', { name: /Discard this draft/ })).toBeVisible();
    const measured = await page.evaluate(() => {
      const small: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('a, button, summary, input, textarea, [role="tab"]')) {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
        if (r.bottom <= 0) continue;
        if (r.width < 44 || r.height < 44) small.push(`${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}] ${Math.round(r.width)} x ${Math.round(r.height)}`);
      }
      return { small, scrollWidth: Math.max(document.documentElement.scrollWidth, document.querySelector('.oct-page')!.scrollWidth), innerWidth: window.innerWidth };
    });
    expect(measured.scrollWidth).toBeLessThanOrEqual(measured.innerWidth);
    expect(measured.small).toEqual([]);
    expect(await overflowingElements(page)).toEqual([]);
  });
}

test('on a phone the status and Discard draft stay in view at the bottom while the Projects tab is open', async ({ page }) => {
  await open(page, 390, 844);
  const bar = page.locator('[data-draft-bar]');
  await expect(bar).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => document.querySelector('.oct-page')!.scrollTo(0, 300));
  await expect(bar).toBeInViewport({ ratio: 1 });
  const box = (await bar.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(844 + 1);
  await expect(page.getByRole('button', { name: 'Discard draft' })).toBeVisible();
});

test('keyboard: every part of the editor is reached in reading order', async ({ page }) => {
  await open(page);
  // Open the Profile section without moving focus into it, then start from the top of the document.
  await page.locator('details.oct-profile-fold').evaluate((el: HTMLDetailsElement) => (el.open = true));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen: string[] = [];
  for (let i = 0; i < 140; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return '';
      const field = (el as HTMLInputElement).labels?.[0]?.textContent?.trim();
      return el.getAttribute('aria-label') ?? field ?? (el.textContent ?? '').trim().slice(0, 40);
    });
    seen.push(label);
  }
  const at = (label: string) => seen.indexOf(label);
  const wanted = ['Name', 'Add project', 'Move project up', 'Move project down', 'Delete project', 'Title', 'Tagline', 'Description', 'Live link', 'Repository', 'Remove React', 'Search technologies', 'Add image', 'Profile', 'Handle', 'See live preview →', 'Discard draft'];
  for (const label of wanted) expect(at(label), label).toBeGreaterThanOrEqual(0);
  const order = wanted.map(at);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  // The disabled Publish button is not a tab stop.
  expect(seen).not.toContain('Publishing arrives with accounts');
});

// ---- Fix round 1 (Task 19a review): added, NOT YET RUN (the browser slot was taken by 19b) ----------------------------------------

test('FIX C1: only an exact https://host address is a link; credentials, https:x.com and // are flagged and plain text; HTTPS://X.COM links normalised', async ({ page }) => {
  await open(page);
  const live = page.getByLabel('Live link', { exact: true });
  for (const bad of ['https://user:pass@host.com', 'https:x.com', '//x.com', 'https:///x', 'https://', 'http://x.com']) {
    await live.fill(bad);
    await expect(panel(page).locator('[data-issue]'), bad).toHaveCount(1);
    await expect(panel(page).locator('a[href]'), bad).toHaveCount(0);
    await expect(live, bad).toHaveAttribute('aria-invalid', 'true');
  }
  await live.fill('HTTPS://X.COM');
  await expect(panel(page).locator('[data-issue]')).toHaveCount(0);
  const anchor = panel(page).locator('a.oct-link-shown');
  await expect(anchor).toHaveAttribute('href', 'https://x.com/');
  // The link under the field is a 44 px target.
  expect((await anchor.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // A saved bad link is still kept as typed. (Leading and trailing spaces cannot be typed into a type=url input, which trims them:
  // those cases are the unit tests' in draft.test.ts.)
  await live.fill('https://user:pass@host.com');
  await settled(page);
  const stored = (await storedDraft(page)) as { projects: { links: { live?: string } }[] };
  expect(stored.projects[0].links.live).toBe('https://user:pass@host.com');
});

test('FIX I2: three deleted projects can be brought back, newest first; adding never takes a freed id; the same note twice changes the live text', async ({ page }) => {
  await open(page);
  for (const t of ['Beta', 'Gamma', 'Delta']) {
    await press(page, 'Add project').click();
    await title(page).fill(t);
  }
  await expect(rows(page)).toHaveText(['Sample project', 'Beta', 'Gamma', 'Delta']);
  const toast = page.locator('[data-undo-toast]');
  await press(page, 'Delete project').click(); // Delta (selected)
  await expect(toast).toContainText('Deleted Delta.');
  await panel(page).locator('.oct-project-row', { hasText: 'Gamma' }).click();
  await press(page, 'Delete project').click();
  await expect(toast).toContainText('Deleted Gamma.');
  await expect(toast).toContainText('2 deleted projects can be brought back, newest first.');
  // A new project must not take the id of one that can still come back.
  await press(page, 'Add project').click();
  await title(page).fill('Fresh');
  await toast.getByRole('button', { name: 'Undo' }).click(); // Gamma, back at its place
  await expect(rows(page)).toHaveText(['Sample project', 'Beta', 'Gamma', 'Fresh']);
  await expect(toast).toContainText('Deleted Delta.'); // Delta is still there to bring back
  // The same note twice is announced twice: the live line's text differs between the two.
  const live = page.locator('[data-panel-live]');
  await press(page, 'Add project').click();
  const first = await live.evaluate(el => el.textContent);
  await press(page, 'Add project').click();
  const second = await live.evaluate(el => el.textContent);
  expect(first?.replace(/ /g, '')).toBe('Project added.');
  expect(second?.replace(/ /g, '')).toBe('Project added.');
  expect(first).not.toBe(second);
});

test('FIX I3: after Delete, Undo and a toast that runs out, focus is on a control and never on the page', async ({ page }) => {
  await open(page);
  await press(page, 'Add project').click();
  await title(page).fill('Beta');
  await press(page, 'Add project').click();
  await title(page).fill('Gamma');
  await panel(page).locator('.oct-project-row', { hasText: 'Beta' }).click();
  const toast = page.locator('[data-undo-toast]');
  const activeText = () => page.evaluate(() => document.activeElement?.textContent ?? '');
  // Delete: focus goes to the project that now has its place (Gamma's list button).
  await press(page, 'Delete project').click();
  await expect.poll(activeText).toContain('Gamma');
  // Undo: focus goes to the restored project's list button.
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(rows(page)).toHaveText(['Sample project', 'Beta', 'Gamma']);
  await expect.poll(activeText).toContain('Beta');
  // Expiry with focus on Undo: focus goes to a project in the list, not to the page.
  await press(page, 'Delete project').click();
  await toast.getByRole('button', { name: 'Undo' }).focus();
  await expect(toast).toBeHidden({ timeout: 8000 });
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).hasAttribute('data-project-id'))).toBe(true);
  // Delete every project: the last Delete moves focus to Add.
  while ((await rows(page).count()) > 0) await press(page, 'Delete project').click();
  await expect(press(page, 'Add project')).toBeFocused();
});

test('FIX I4: long titles and searches are clipped in the live text; a title field stops at 80 characters', async ({ page }) => {
  await open(page);
  await press(page, 'Add project').click();
  await expect(title(page)).toHaveAttribute('maxlength', '80');
  await title(page).fill('T'.repeat(200));
  await expect(title(page)).toHaveValue('T'.repeat(80));
  await press(page, 'Delete project').click();
  await expect(page.locator('[data-undo-toast]')).toContainText(`Deleted ${'T'.repeat(40)}…`);
  expect(await page.locator('[data-panel-live]').textContent()).not.toContain('T'.repeat(41));
  await press(page, 'Add project').click();
  await page.getByLabel('Search technologies', { exact: true }).fill('q'.repeat(300));
  await expect(panel(page).locator('[data-picker-count]')).toHaveText(`No technology matches "${'q'.repeat(40)}…".`);
});

test('FIX I5: a removed image and the images of a project deleted for good leave the browser; a project that came back keeps its image', async ({ page }) => {
  await open(page);
  const mediaCount = () =>
    page.evaluate(
      () =>
        new Promise<number>(resolve => {
          const request = indexedDB.open('octoverse-creator');
          request.onsuccess = () => {
            const db = request.result;
            const counted = db.transaction('media').objectStore('media').count();
            counted.onsuccess = () => (db.close(), resolve(counted.result));
          };
          request.onerror = () => resolve(-1);
        }),
    );
  const input = page.locator('.oct-file input');
  await input.setInputFiles([1, 2].map(n => ({ name: `a${n}.png`, mimeType: 'image/png', buffer: PNG })));
  await expect(panel(page).locator('.oct-image')).toHaveCount(2);
  await settled(page);
  expect(await mediaCount()).toBe(2);
  // Removing one: it is gone from the store after the grace period (8 s), the other stays.
  await panel(page).getByRole('button', { name: 'Remove image a1.png' }).click();
  await expect.poll(mediaCount, { timeout: 15000, intervals: [1000] }).toBe(1);
  // A project deleted and brought back inside the window keeps its image past the grace period.
  await press(page, 'Delete project').click();
  await page.locator('[data-undo-toast]').getByRole('button', { name: 'Undo' }).click();
  await page.waitForTimeout(10000);
  expect(await mediaCount()).toBe(1);
  await expect(panel(page).locator('.oct-image img')).toHaveCount(1);
  // Deleted for good: the image is removed once the undo window and the grace period have passed.
  await press(page, 'Delete project').click();
  await expect.poll(mediaCount, { timeout: 20000, intervals: [1000] }).toBe(0);
});

test('FIX M4: on a phone no focused field is hidden behind the sticky bar, whatever its place (scroll-margin on the controls)', async ({ page }) => {
  await open(page, 390, 844);
  const count = await panel(page).locator('input, textarea, button, summary, a[href]').count();
  expect(count).toBeGreaterThan(10);
  let scrolled = 0;
  const covered: string[] = [];
  for (let i = 0; i < count; i++) {
    const result = await page.evaluate(index => {
      const el = document.querySelector('.oct-projects-panel')?.querySelectorAll<HTMLElement>('input, textarea, button, summary, a[href]')[index];
      const bar = document.querySelector('[data-draft-bar]')?.getBoundingClientRect();
      if (!el || !bar) return { skip: true as const };
      // Start from the top, so a field near the bottom has to be scrolled to.
      window.scrollTo(0, 0);
      for (let node: HTMLElement | null = el; node; node = node.parentElement) node.scrollTop = 0;
      const before = el.getBoundingClientRect().top;
      el.focus();
      const r = el.getBoundingClientRect();
      const visible = r.height > 0 && r.width > 0;
      return {
        skip: !visible || document.activeElement !== el,
        scrolled: Math.abs(r.top - before) > 1,
        covered: visible && r.bottom > bar.top + 1 && r.top < bar.bottom,
        label: (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 40),
      };
    }, i);
    if ('skip' in result && result.skip === true) continue;
    if ('scrolled' in result && result.scrolled) scrolled += 1;
    if ('covered' in result && result.covered) covered.push((result as { label: string }).label);
  }
  // The check is real only if some fields had to be scrolled to, and none of them ended behind the bar.
  expect(scrolled).toBeGreaterThan(0);
  expect(covered).toEqual([]);
  // The old check as well: tabbing through the panel never lands behind the bar.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const hidden = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const barBox = document.querySelector('[data-draft-bar]')?.getBoundingClientRect();
      if (!el || !barBox || !el.closest('.oct-projects-panel')) return false;
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.bottom > barBox.top + 1 && r.top < barBox.bottom;
    });
    expect(hidden).toBe(false);
  }
});
