// components/brand/GammaMark.tsx — the MapleGamma monogram: Γ in maple orange on an off-black tile
'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Brand colors are intentionally hardcoded — the mark is a self-contained badge
// that must look identical in dark and light themes.
const TILE = '#0E0E11';
const TILE_EDGE = 'rgba(255,255,255,0.10)';
const GAMMA = '#FF7A1A';
const LEAF = '#FFB566';

export function GammaMark({ size = 32, glow = false }: { size?: number; glow?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {glow &&
        (reduce ? (
          <span
            aria-hidden="true"
            className="absolute inset-[-40%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,122,26,0.30) 0%, rgba(255,122,26,0) 70%)',
            }}
          />
        ) : (
          <motion.span
            aria-hidden="true"
            className="absolute inset-[-40%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,122,26,0.45) 0%, rgba(255,122,26,0) 70%)',
            }}
            animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="relative"
        role="img"
        aria-label="MapleGamma"
      >
        <rect x="2" y="2" width="96" height="96" rx="24" fill={TILE} stroke={TILE_EDGE} strokeWidth="2" />
        <path
          d="M66 34H38V72"
          fill="none"
          stroke={GAMMA}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* maple accent — a leaf-hint diamond at the arm terminal */}
        <path d="M72 27l7 7-7 7-7-7Z" fill={LEAF} />
      </svg>
    </span>
  );
}
