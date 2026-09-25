import React from 'react';
import { motion } from 'framer-motion';

interface OctopusMouthProps {
  isOpen?: boolean;
  isHappy?: boolean;
  isSleeping?: boolean;
}

export const OctopusMouth: React.FC<OctopusMouthProps> = ({
  isOpen = false,
  isHappy = false,
  isSleeping = false,
}) => {
  return (
    <g id="octopus-mouth" transform="translate(0, 38)">
      {isSleeping ? (
        /* Sleepy relaxed little mouth */
        <ellipse cx="0" cy="2" rx="4" ry="3.5" fill="#0f172a" opacity={0.75} />
      ) : isOpen || isHappy ? (
        /* Delighted / "Oh!" Open Mouth with Tongue */
        <motion.g
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
        >
          {/* Mouth Cavity */}
          <path
            d="M -16 -4 Q 0 20 16 -4 Q 0 -12 -16 -4"
            fill="#881337"
            stroke="#fb7185"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Cute Rosy Tongue inside */}
          <path
            d="M -10 6 Q 0 2 10 6 Q 0 16 -10 6"
            fill="#f43f5e"
            opacity={0.9}
          />
        </motion.g>
      ) : (
        /* Sweet Resting Smile with Cheek Dimple Tips (matching sketch) */
        <g>
          {/* Main Smile Curve */}
          <path
            d="M -26 -2 Q 0 16 26 -2"
            fill="none"
            stroke="#0f172a"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Left Dimple Accent */}
          <path
            d="M -28 -7 Q -26 -2 -22 -1"
            fill="none"
            stroke="#0f172a"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Right Dimple Accent */}
          <path
            d="M 28 -7 Q 26 -2 22 -1"
            fill="none"
            stroke="#0f172a"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
};
