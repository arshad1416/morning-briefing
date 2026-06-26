// components/primitives/Surface.tsx — bento tile container
'use client';

import React from 'react';

interface SurfaceProps {
  children: React.ReactNode;
  className?: string;
  span?: 'hero' | 'half' | 'third' | 'quarter';
  glow?: boolean;
  as?: React.ElementType;
}

export function Surface({ children, className = '', span = 'third', glow, as: Tag = 'section' }: SurfaceProps) {
  return (
    <Tag
      className={`bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden span-${span} ${glow ? 'shadow-[var(--shadow-accent)]' : ''} ${className}`}
      style={{ minHeight: 44 }}
    >
      {children}
    </Tag>
  );
}

interface SurfaceHeaderProps {
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function SurfaceHeader({ title, right, className = '' }: SurfaceHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] ${className}`}>
      <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">{title}</h3>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
