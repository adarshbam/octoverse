import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCursorGaze } from './useCursorGaze';

interface OctopusEyesProps {
  mouseX: number;
  mouseY: number;
  isHappy?: boolean;
  isSleeping?: boolean;
  isWinking?: boolean;
  onDoubleClickEyes?: () => void;
}

export const OctopusEyes: React.FC<OctopusEyesProps> = ({
  mouseX,
  mouseY,
  isHappy = false,
  isSleeping = false,
  isWinking = false,
  onDoubleClickEyes,
}) => {
  const eyesGroupRef = useRef<SVGGElement | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);

  const gaze = useCursorGaze({
    mouseX,
    mouseY,
    anchorRef: eyesGroupRef,
    maxRadius: 10,
  });

  useEffect(() => {
    if (isSleeping) return;
    let timeoutId: number;
    const scheduleNextBlink = () => {
      const delay = Math.random() * 2500 + 3500;
      timeoutId = window.setTimeout(() => {
        setIsBlinking(true);
        window.setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 140);
      }, delay);
    };
    scheduleNextBlink();
    return () => clearTimeout(timeoutId);
  }, [isSleeping]);

  const leftEyeClosed = isSleeping || isWinking;
  const rightEyeClosed = isSleeping;

  return (
    <motion.g
      ref={eyesGroupRef}
      id="octopus-eyes"
      onDoubleClick={onDoubleClickEyes}
      className="cursor-pointer select-none"
    >
      <defs>
        <radialGradient id="eye-sclera-gradient" cx="42%" cy="38%" r="68%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="75%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </radialGradient>
        <radialGradient id="eye-pupil-gradient" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#1a202c" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
      </defs>

      {/* LEFT EYE */}
      <g transform="translate(-60, -5) rotate(-2)">
        {leftEyeClosed ? (
          <g>
            <g stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <path d="M -22 5 C -30 10, -35 15, -40 18" />
              <path d="M -8 10 C -12 18, -15 25, -18 30" />
              <path d="M 12 5 C 15 12, 18 18, 20 22" />
            </g>
            <path d="M -30 -2 Q 0 18 30 -2" fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
          </g>
        ) : isHappy ? (
          <g>
            <g stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <path d="M -22 -18 C -30 -28, -35 -35, -40 -40" />
              <path d="M -8 -30 C -12 -42, -15 -50, -18 -55" />
              <path d="M 12 -25 C 15 -38, 18 -45, 20 -50" />
            </g>
            <path d="M -30 -2 Q 0 -38 30 -2" fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <g stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" fill="none">
              <path d="M -25 -32 C -35 -42, -42 -48, -50 -52" />
              <path d="M -10 -42 C -15 -55, -18 -65, -20 -72" />
              <path d="M 12 -40 C 18 -52, 22 -60, 25 -65" />
            </g>

            <motion.g animate={{ scaleY: isBlinking ? 0.08 : 1 }} transition={{ duration: 0.1, ease: 'easeInOut' }} style={{ transformOrigin: '0px 15px' }}>
              <ellipse cx="0" cy="0" rx="36" ry="46" fill="url(#eye-sclera-gradient)" stroke="#0f172a" strokeWidth="2.5" />
              <motion.g animate={{ x: gaze.x, y: gaze.y }} transition={{ type: 'spring', damping: 25, stiffness: 250 }}>
                <ellipse cx="0" cy="0" rx="28" ry="38" fill="url(#eye-pupil-gradient)" />
                {/* Large Specular */}
                <ellipse cx="-10" cy="-15" rx="10" ry="14" fill="#ffffff" opacity="0.95" />
                {/* Secondary Specular */}
                <ellipse cx="10" cy="12" rx="4" ry="6" fill="#ffffff" opacity="0.85" />
              </motion.g>
              <path d="M -36 0 C -36 -25, -20 -46, 0 -46 C 20 -46, 36 -25, 36 0" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
            </motion.g>
          </g>
        )}
      </g>

      {/* RIGHT EYE */}
      <g transform="translate(60, -5) rotate(2)">
        {rightEyeClosed ? (
          <g>
            <g stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <path d="M -12 5 C -15 12, -18 18, -20 22" />
              <path d="M 8 10 C 12 18, 15 25, 18 30" />
              <path d="M 22 5 C 30 10, 35 15, 40 18" />
            </g>
            <path d="M -30 -2 Q 0 18 30 -2" fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
          </g>
        ) : isHappy ? (
          <g>
            <g stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <path d="M -12 -25 C -15 -38, -18 -45, -20 -50" />
              <path d="M 8 -30 C 12 -42, 15 -50, 18 -55" />
              <path d="M 22 -18 C 30 -28, 35 -35, 40 -40" />
            </g>
            <path d="M -30 -2 Q 0 -38 30 -2" fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <g stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" fill="none">
              <path d="M -12 -40 C -18 -52, -22 -60, -25 -65" />
              <path d="M 10 -42 C 15 -55, 18 -65, 20 -72" />
              <path d="M 25 -32 C 35 -42, 42 -48, 50 -52" />
            </g>
            <motion.g animate={{ scaleY: isBlinking ? 0.08 : 1 }} transition={{ duration: 0.1, ease: 'easeInOut' }} style={{ transformOrigin: '0px 15px' }}>
              <ellipse cx="0" cy="0" rx="36" ry="46" fill="url(#eye-sclera-gradient)" stroke="#0f172a" strokeWidth="2.5" />
              <motion.g animate={{ x: gaze.x, y: gaze.y }} transition={{ type: 'spring', damping: 25, stiffness: 250 }}>
                <ellipse cx="0" cy="0" rx="28" ry="38" fill="url(#eye-pupil-gradient)" />
                {/* Large Specular */}
                <ellipse cx="-10" cy="-15" rx="10" ry="14" fill="#ffffff" opacity="0.95" />
                {/* Secondary Specular */}
                <ellipse cx="10" cy="12" rx="4" ry="6" fill="#ffffff" opacity="0.85" />
              </motion.g>
              <path d="M -36 0 C -36 -25, -20 -46, 0 -46 C 20 -46, 36 -25, 36 0" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
            </motion.g>
          </g>
        )}
      </g>
    </motion.g>
  );
};
