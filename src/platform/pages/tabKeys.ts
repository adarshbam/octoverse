/**
 * The tab list by keyboard (the ARIA tabs pattern, automatic activation): the index the key moves to, or undefined for a key the
 * list leaves alone. Left and Right wrap around; Home and End go to the first and last.
 */
export function nextTab(key: string, index: number, count: number): number | undefined {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
}
