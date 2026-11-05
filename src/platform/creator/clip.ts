/** The most characters of a title or a search text that a toast, a note or a count line repeats (a long one must not fill a live region). */
export const CLIP_AT = 40;

/** `text` cut to `max` characters (by whole characters, never half of a pair) with an ellipsis when it was longer. */
export function clip(text: string, max = CLIP_AT): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}
