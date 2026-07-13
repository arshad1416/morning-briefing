// components/layout/BentoGrid.tsx — responsive grid engine with staggered entrances
'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = '' }: BentoGridProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={`bento-grid ${className}`}
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export type SpanPreset = 'hero' | 'half' | 'third' | 'quarter';

interface BentoTileProps {
  children: React.ReactNode;
  span?: SpanPreset;
  className?: string;
}

export function BentoTile({ children, span = 'third', className = '' }: BentoTileProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={`span-${span} ${className}`}
      variants={
        reduce
          ? undefined
          : {
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
            }
      }
    >
      {children}
    </motion.div>
  );
}
