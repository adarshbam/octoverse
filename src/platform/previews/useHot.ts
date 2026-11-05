import { type FocusEvent, type PointerEvent, useCallback, useRef, useState } from 'react';

/**
 * Whether a card or tile is "hot" (spec 7.10): the pointer is over it, or it holds keyboard focus. A touch is not a hover (the
 * browser's own emulated mouse events follow a tap, and a tap opens the page), and a focus a click gave is not keyboard focus
 * (`:focus-visible` says which). `handlers` go on the element that contains the card's control: the events bubble.
 */
export function useHot() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const mouse = useRef(false);
  const onPointerEnter = useCallback((event: PointerEvent) => {
    mouse.current = event.pointerType !== 'touch';
    if (mouse.current) setHovered(true);
  }, []);
  const onPointerLeave = useCallback(() => {
    mouse.current = false;
    setHovered(false);
  }, []);
  const onFocus = useCallback((event: FocusEvent) => {
    const target = event.target as Element;
    if (target.matches(':focus-visible')) setFocused(true);
  }, []);
  const onBlur = useCallback((event: FocusEvent) => {
    // Focus moving between two controls inside the same card is not leaving it.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }, []);
  return { hot: hovered || focused, handlers: { onPointerEnter, onPointerLeave, onFocus, onBlur } };
}
