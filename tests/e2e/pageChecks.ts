import type { Page } from '@playwright/test';

// Checks shared by the platform's static-page specs (profile, Explore, not found, the creator).

/**
 * Every visible element that reaches past the window's right edge (or starts left of its left edge), as `tag.class right`. The page
 * wrapper clips sideways overflow out of sight, so `scrollWidth` alone cannot tell content that is cut off from content that fits;
 * this measures each element against the window instead. Left out: anything inside a deliberately sideways-scrolling row
 * (`data-hscroll`), the screen-reader-only text and the skip link (both wait outside the page), a live preview's layer (the engine's own inert, aria-hidden picture, clipped to its box), index.html's boot veil (its own clipped, fixed layer under the page) and anything not drawn.
 */
export async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const width = window.innerWidth;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.closest('#boot-veil, [data-hscroll], .oct-sr-only, .oct-skip-link, .oct-live-layer, [hidden], script, style')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > width + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} left ${Math.round(r.left)} right ${Math.round(r.right)} (window ${width})`);
    }
    return out.slice(0, 12);
  });
}

/**
 * Scrolls the page's scroller (`.oct-page`, the platform's static pages are their own scrollers: index.html fixes html, body and #root
 * at the window's height) to its bottom and reports how far it went and whether its last element is then on screen.
 */
export async function scrollToBottom(page: Page) {
  return page.evaluate(async () => {
    const scroller = document.querySelector<HTMLElement>('.oct-page')!;
    const before = scroller.scrollTop;
    const tall = scroller.scrollHeight > scroller.clientHeight + 1;
    scroller.scrollTo(0, scroller.scrollHeight);
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const last = (scroller.querySelector('.oct-page-footer') ?? scroller.querySelector('.oct-page-main')!.lastElementChild) as HTMLElement;
    const r = last.getBoundingClientRect();
    return { tall, before, after: scroller.scrollTop, lastVisible: r.bottom <= window.innerHeight + 1 && r.top < window.innerHeight, windowScrollY: window.scrollY };
  });
}
