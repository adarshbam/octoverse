import type { Page } from '@playwright/test';

// Checks shared by the platform's static-page specs (profile, Explore, not found, the creator).

/**
 * Every visible element that reaches past the window's right edge (or starts left of its left edge), as `tag.class right`. The page
 * wrapper clips sideways overflow out of sight, so `scrollWidth` alone cannot tell content that is cut off from content that fits;
 * this measures each element against the window instead. Left out: anything inside a deliberately sideways-scrolling row
 * (`data-hscroll`), the screen-reader-only text and the skip link (both wait outside the page), a live preview's layer (the engine's own inert, aria-hidden picture, clipped to its box), anything `inert` (the engine's closed detail panel, parked off the window's right edge by design: nothing can be pressed or read there), index.html's boot veil (its own clipped, fixed layer under the page) and anything not drawn.
 */
export async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const width = window.innerWidth;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.closest('#boot-veil, [data-hscroll], .oct-sr-only, .oct-skip-link, .oct-live-layer, [hidden], [inert], script, style')) continue;
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

/**
 * What is DRAWN reaching past the window's left or right edge: the same elements and exemptions as `overflowingElements`, but a
 * layout shell is not drawn, so it is not measured. An element counts by what it paints: its own box when it has a background, a
 * border, a shadow or is an image, canvas or field; its text lines (a Range over its own text nodes) when it has text. The landing's
 * intro is one wide transparent block (the P2 rectangle) that follows the camera's drift with its text centred in it: the block can
 * pass the window's edge while every letter and button is well inside, and only the letters and buttons are seen.
 */
export async function overflowingPaint(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const width = window.innerWidth;
    const range = document.createRange();
    const paints = (style: CSSStyleDeclaration, el: Element) =>
      el.matches('img, canvas, svg, video, input, textarea, select') ||
      !/^(rgba\(\d+, \d+, \d+, 0\)|transparent)$/.test(style.backgroundColor) ||
      (style.backgroundImage !== 'none' && (style.webkitBackgroundClip || style.backgroundClip) !== 'text') ||
      (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none') ||
      (parseFloat(style.borderBottomWidth) > 0 && style.borderBottomStyle !== 'none') ||
      style.boxShadow !== 'none';
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.closest('#boot-veil, [data-hscroll], .oct-sr-only, .oct-skip-link, .oct-live-layer, [hidden], [inert], script, style')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const boxes: DOMRect[] = [];
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && paints(style, el)) boxes.push(r);
      for (const node of el.childNodes) {
        if (node.nodeType !== 3 || !(node.textContent ?? '').trim()) continue;
        range.selectNodeContents(node);
        for (const line of range.getClientRects()) if (line.width > 0 && line.height > 0) boxes.push(line);
      }
      for (const b of boxes) {
        if (b.right > width + 1 || b.left < -1) {
          out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} left ${Math.round(b.left)} right ${Math.round(b.right)} (window ${width})`);
          break;
        }
      }
    }
    return out.slice(0, 12);
  });
}
