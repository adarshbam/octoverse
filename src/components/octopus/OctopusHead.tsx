import React from 'react';
import { motion } from 'framer-motion';

interface OctopusHeadProps {
  isBlushing?: boolean;
  onClickHead?: () => void;
}

export const OctopusHead: React.FC<OctopusHeadProps> = ({
  isBlushing = false,
  onClickHead,
}) => {
  return (
    <motion.g
      id="octopus-mantle"
      onClick={onClickHead}
      className="cursor-pointer select-none"
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <defs>
        {/* Veyra bioluminescent mantle gradient (cyan/teal/emerald) */}
        <radialGradient
          id="octopus-mantle-gradient"
          cx="40%"
          cy="28%"
          r="75%"
          fx="35%"
          fy="25%"
        >
          <stop offset="0%" stopColor="#81e6d9" stopOpacity="0.95" /> {/* Light teal */}
          <stop offset="25%" stopColor="#319795" stopOpacity="0.95" /> {/* Mid teal */}
          <stop offset="60%" stopColor="#285e61" stopOpacity="0.98" /> {/* Dark teal */}
          <stop offset="85%" stopColor="#234e52" />
          <stop offset="100%" stopColor="#1d4044" />
        </radialGradient>

        {/* Soft diffuse ambient surface highlight */}
        <radialGradient
          id="mantle-ambient-sheen"
          cx="45%"
          cy="30%"
          r="60%"
        >
          <stop offset="0%" stopColor="#e6fffa" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#b2f5ea" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#319795" stopOpacity="0" />
        </radialGradient>

        {/* Soft natural cheek blush gradient */}
        <radialGradient id="cheek-blush-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f687b3" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#f687b3" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f687b3" stopOpacity="0" />
        </radialGradient>

        {/* Soft cyan aura filter */}
        <filter id="mantle-soft-aura" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="5"
            stdDeviation="20"
            floodColor="#38b2ac"
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      {/* Main Organic Mantle / Head Geometry for Veyra */}
      {/* Bulbous, soft, cute, 40% of height */}
      <path
        id="mantle-contour"
        d="M 0 -180
           C -100 -180, -160 -120, -165 -40
           C -170 30, -150 70, -120 95
           C -95 120, -65 140, 0 145
           C 65 140, 95 120, 120 95
           C 150 70, 170 30, 165 -40
           C 160 -120, 100 -180, 0 -180 Z"
        fill="url(#octopus-mantle-gradient)"
        stroke="rgba(178, 245, 234, 0.5)"
        strokeWidth="2"
        strokeLinejoin="round"
        filter="url(#mantle-soft-aura)"
      />

      {/* Soft Volumetric Forehead Sheen */}
      <ellipse
        cx="-35"
        cy="-100"
        rx="80"
        ry="45"
        transform="rotate(-15 -35 -100)"
        fill="url(#mantle-ambient-sheen)"
        className="pointer-events-none"
      />

      {/* Subtle hand-drawn chin contour line */}
      <path
        d="M -35 85 Q 0 95 35 85"
        fill="none"
        stroke="rgba(49, 151, 149, 0.3)"
        strokeWidth="2"
        strokeLinecap="round"
        className="pointer-events-none"
      />

      {/* Left Cheek Blush */}
      <motion.ellipse
        cx="-75"
        cy="35"
        rx="28"
        ry="18"
        fill="url(#cheek-blush-gradient)"
        animate={{
          opacity: isBlushing ? 0.95 : 0.4,
          scale: isBlushing ? 1.25 : 1,
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="pointer-events-none"
      />

      {/* Right Cheek Blush */}
      <motion.ellipse
        cx="75"
        cy="35"
        rx="28"
        ry="18"
        fill="url(#cheek-blush-gradient)"
        animate={{
          opacity: isBlushing ? 0.95 : 0.4,
          scale: isBlushing ? 1.25 : 1,
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="pointer-events-none"
      />
    </motion.g>
  );
};
