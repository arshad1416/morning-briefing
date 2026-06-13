// components/layout/BentoGrid.tsx — responsive grid engine
import React from 'react';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = '' }: BentoGridProps) {
  return (
    <div className={`bento-grid ${className}`}>
      {children}
    </div>
  );
}

export type SpanPreset = 'hero' | 'half' | 'third' | 'quarter';

interface BentoTileProps {
  children: React.ReactNode;
  span?: SpanPreset;
  className?: string;
}

export function BentoTile({ children, span = 'third', className = '' }: BentoTileProps) {
  return (
    <div className={`span-${span} ${className}`}>
      {children}
    </div>
  );
}
