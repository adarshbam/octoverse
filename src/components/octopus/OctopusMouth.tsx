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
    <g id="octopus-mouth" transform="translate(0, 30)">
      {isSleeping ? (
        /* Sleepy relaxed little mouth curve */
        <path
          d="M -8 2 Q 0 5 8 2"
          fill="none"
          stroke="#0f172a"
          strokeWidth="2.8"
          strokeLinecap="round"
          opacity={0.8}
        />
      ) : isOpen || isHappy ? (
        /* Kawaii Delighted */
        <motion.g
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 320 }}
        >
          {/* Mouth Cavity */}
          <path
            d="M -10 0 Q 0 15 10 0 Q 0 -5 -10 0"
            fill="#881337"
            stroke="#0f172a"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Cute Rosy Tongue inside */}
          <path
            d="M -6 6 Q 0 3 6 6 Q 0 12 -6 6"
            fill="#f43f5e"
            opacity={0.95}
          />
        </motion.g>
      ) : (
        /* Sweet Kawaii U-shaped Resting Smile */
        <g>
          {/* Main Gentle Smile Curve */ }
          <path
            d="M -10 -1 Q 0 12 10 -1"
            fill="none"
            stroke="#0f172a"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
};
