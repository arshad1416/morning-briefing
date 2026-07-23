// components/primitives/Sparkline.tsx — inline SVG sparkline
//
// The fallback accessible name avoids "Sparkline chart" (data-viz jargon that
// names the chart type, not what it shows) and equally avoids "trend line",
// which on a markets site means a specific technical-analysis object — a line
// fitted through successive highs or lows. This component plots the raw series
// as-is, so it says that plainly instead. Callers should still pass a real
// `title` describing the series and the period it covers.
'use client';

import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  className?: string;
  title?: string;
}

export function Sparkline({ data, width = 120, height = 32, color = 'var(--color-accent)', fill, className = '', title }: SparklineProps) {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const coords = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return { x, y };
  });
  const points = coords.map(({ x, y }) => `${x},${y}`).join(' ');
  const areaPoints = `${points} ${coords[coords.length - 1].x},${height - padding} ${coords[0].x},${height - padding}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={title || 'Line chart of recent values'}
    >
      {title && <title>{title}</title>}
      {fill && <polygon points={areaPoints} fill={color} opacity={0.08} />}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
