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

  // Smooth cursor gaze offset (clamped to max 12px)
  const gaze = useCursorGaze({
    mouseX,
    mouseY,
    anchorRef: eyesGroupRef,
    maxRadius: 12,
  });

  // Procedural blinking timer: blinks every 3.5 to 6 seconds (disabled while sleeping)
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
    <g
      ref={eyesGroupRef}
      id="octopus-eyes"
      onDoubleClick={onDoubleClickEyes}
      className="cursor-pointer"
    >
      {/* ----------------- LEFT EYE ----------------- */}
      <g transform="translate(-46, -25)">
        {/* Cute Arched Eyelashes from Girlfriend's Sketch */}
        <g stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" opacity={0.85}>
          <path d="M -16 -32 Q -22 -44 -26 -48" />
          <path d="M 0 -35 Q 0 -50 0 -54" />
          <path d="M 16 -32 Q 22 -44 26 -48" />
        </g>

        {leftEyeClosed ? (
          /* Peaceful Sleeping / Winking Closed Curve */
          <path
            d="M -22 -4 Q 0 10 22 -4"
            fill="none"
            stroke="#0f172a"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        ) : isHappy ? (
          /* Happy Squint Eye Shape (^ ^) when delighted/blushing */
          <path
            d="M -22 -4 Q 0 -34 22 -4"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        ) : (
          /* Normal Interactive Eye */
          <motion.g
            animate={{
              scaleY: isBlinking ? 0.08 : 1,
            }}
            transition={{ duration: 0.09, ease: 'easeInOut' }}
            style={{ transformOrigin: '0px -4px' }}
          >
            {/* Eye Sclera Outer Glow & Base */}
            <ellipse
              cx="0"
              cy="-4"
              rx="24"
              ry="30"
              fill="#f8fafc"
              stroke="#38bdf8"
              strokeWidth="2.5"
              className="drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]"
            />

            {/* Tracking Pupil + Iris Group */}
            <motion.g
              animate={{
                x: gaze.x,
                y: gaze.y,
              }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            >
              {/* Deep Dark Iris */}
              <ellipse cx="0" cy="-3" rx="16" ry="20" fill="#0f172a" />
              <ellipse cx="0" cy="-3" rx="14" ry="18" fill="#1e293b" />

              {/* Specular Gloss Bubbles (faithful to her sketch!) */}
              {/* Large upper-left shine */}
              <circle cx="-5" cy="-9" r="6" fill="#ffffff" opacity={0.95} />
              {/* Tiny lower-right shine */}
              <circle cx="5" cy="4" r="2.8" fill="#ffffff" opacity={0.85} />
            </motion.g>
          </motion.g>
        )}
      </g>

      {/* ----------------- RIGHT EYE ----------------- */}
      <g transform="translate(46, -25)">
        {/* Cute Arched Eyelashes from Girlfriend's Sketch */}
        <g stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" opacity={0.85}>
          <path d="M -16 -32 Q -22 -44 -26 -48" />
          <path d="M 0 -35 Q 0 -50 0 -54" />
          <path d="M 16 -32 Q 22 -44 26 -48" />
        </g>

        {rightEyeClosed ? (
          /* Peaceful Sleeping Closed Curve */
          <path
            d="M -22 -4 Q 0 10 22 -4"
            fill="none"
            stroke="#0f172a"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        ) : isHappy ? (
          /* Happy Squint Eye Shape (^ ^) when delighted/blushing */
          <path
            d="M -22 -4 Q 0 -34 22 -4"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        ) : (
          /* Normal Interactive Eye */
          <motion.g
            animate={{
              scaleY: isBlinking ? 0.08 : 1,
            }}
            transition={{ duration: 0.09, ease: 'easeInOut' }}
            style={{ transformOrigin: '0px -4px' }}
          >
            {/* Eye Sclera Outer Glow & Base */}
            <ellipse
              cx="0"
              cy="-4"
              rx="24"
              ry="30"
              fill="#f8fafc"
              stroke="#38bdf8"
              strokeWidth="2.5"
              className="drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]"
            />

            {/* Tracking Pupil + Iris Group */}
            <motion.g
              animate={{
                x: gaze.x,
                y: gaze.y,
              }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            >
              {/* Deep Dark Iris */}
              <ellipse cx="0" cy="-3" rx="16" ry="20" fill="#0f172a" />
              <ellipse cx="0" cy="-3" rx="14" ry="18" fill="#1e293b" />

              {/* Specular Gloss Bubbles */}
              {/* Large upper-left shine */}
              <circle cx="-5" cy="-9" r="6" fill="#ffffff" opacity={0.95} />
              {/* Tiny lower-right shine */}
              <circle cx="5" cy="4" r="2.8" fill="#ffffff" opacity={0.85} />
            </motion.g>
          </motion.g>
        )}
      </g>
    </g>
  );
};
