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
    <g id="octopus-head" onClick={onClickHead} className="cursor-pointer">
      <defs>
        {/* Soft Bioluminescent Mantle Gradient */}
        <radialGradient
          id="octopus-mantle-gradient"
          cx="45%"
          cy="35%"
          r="65%"
          fx="40%"
          fy="30%"
        >
          <stop offset="0%" stopColor="#7dd3fc" />     {/* Radiant highlights */}
          <stop offset="45%" stopColor="#38bdf8" />    {/* Bioluminescent cyan */}
          <stop offset="78%" stopColor="#0284c7" />    {/* Ocean blue depth */}
          <stop offset="100%" stopColor="#0369a1" />   {/* Deep trench contour */}
        </radialGradient>

        {/* Soft Cheek Blush Radial Gradient */}
        <radialGradient id="cheek-blush-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#fb7185" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
        </radialGradient>

        {/* Subtle Specular Highlight on Top-Left of Head */}
        <linearGradient id="head-specular" x1="0%" y1="0%" x2="50%" y2="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Main Head / Mantle Geometry matching girlfriend's sketch */}
      {/* Width ~280, Height ~250 with smooth rounded curves */}
      <path
        d="M -130 50
           C -140 -50, -110 -150, 0 -150
           C 110 -150, 140 -50, 130 50
           C 125 110, 80 135, 0 135
           C -80 135, -125 110, -130 50 Z"
        fill="url(#octopus-mantle-gradient)"
        stroke="#38bdf8"
        strokeWidth="3"
        strokeLinejoin="round"
        className="drop-shadow-[0_0_30px_rgba(56,189,248,0.35)]"
      />

      {/* Gentle Specular Sheen (gives it that Pixar/Studio Ghibli polish) */}
      <path
        d="M -80 -125
           C -40 -145, 10 -145, 50 -130
           C 0 -138, -50 -132, -80 -125 Z"
        fill="url(#head-specular)"
      />

      {/* Rosy Cheek Blush Circles (faithful to sketch, intensifies on click) */}
      {/* Left Cheek Blush */}
      <motion.ellipse
        cx="-72"
        cy="26"
        rx="22"
        ry="14"
        fill="url(#cheek-blush-gradient)"
        animate={{
          opacity: isBlushing ? 0.95 : 0.35,
          scale: isBlushing ? 1.25 : 1,
        }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />

      {/* Right Cheek Blush */}
      <motion.ellipse
        cx="72"
        cy="26"
        rx="22"
        ry="14"
        fill="url(#cheek-blush-gradient)"
        animate={{
          opacity: isBlushing ? 0.95 : 0.35,
          scale: isBlushing ? 1.25 : 1,
        }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </g>
  );
};
