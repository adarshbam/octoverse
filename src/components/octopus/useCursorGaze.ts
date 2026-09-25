import { useState, useEffect } from 'react';
import type { EyeGazeOffset } from './types';

interface UseCursorGazeProps {
  mouseX: number;
  mouseY: number;
  anchorRef: React.RefObject<SVGGElement | null>;
  maxRadius?: number;
}

export function useCursorGaze({
  mouseX,
  mouseY,
  anchorRef,
  maxRadius = 14,
}: UseCursorGazeProps): EyeGazeOffset {
  const [offset, setOffset] = useState<EyeGazeOffset>({ x: 0, y: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    // Clamping to a subtle natural gaze (15-20% displacement, capped at maxRadius)
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(distance * 0.06, maxRadius);

    setOffset({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    });
  }, [mouseX, mouseY, anchorRef, maxRadius]);

  return offset;
}
