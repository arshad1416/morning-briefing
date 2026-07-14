// components/layout/DraggableBentoGrid.tsx — user-rearrangeable bento grid.
//
// Data-driven replacement for <BentoGrid><BentoTile>…</BentoTile></BentoGrid>:
// pass an ordered list of { id, span, node }. Order persists per page (zustand
// mg-layout, localStorage). "Edit layout" reveals drag handles; dnd-kit's
// rectSortingStrategy handles the variable-span 2D grid. Spans stay fixed
// (reorder-only). Reset reverts to the default order.
'use client';

import React, { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SpanPreset } from '@/components/layout/BentoGrid';
import { useLayout, reconcileOrder } from '@/stores/layout';

export interface GridItem {
  id: string;
  span: SpanPreset;
  node: React.ReactNode;
}

function SortableTile({ item, editing }: { item: GridItem; editing: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editing,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`span-${item.span} relative ${editing ? 'rounded-[var(--radius-tile)] ring-1 ring-dashed ring-[var(--color-border-default)]' : ''}`}
    >
      {editing && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="absolute right-2 top-2 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
          style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-tertiary)' }}
          {...attributes}
          {...listeners}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="7" cy="4" r="1.6" /><circle cx="13" cy="4" r="1.6" />
            <circle cx="7" cy="10" r="1.6" /><circle cx="13" cy="10" r="1.6" />
            <circle cx="7" cy="16" r="1.6" /><circle cx="13" cy="16" r="1.6" />
          </svg>
        </button>
      )}
      <div className={editing ? 'pointer-events-none select-none' : ''}>{item.node}</div>
    </div>
  );
}

export function DraggableBentoGrid({ pageId, items, className = '' }: { pageId: string; items: GridItem[]; className?: string }) {
  const savedOrder = useLayout((s) => s.order[pageId]);
  const editing = useLayout((s) => s.editing);
  const setOrder = useLayout((s) => s.setOrder);

  // Render defaults during SSR/first paint; apply the saved order after mount
  // so the static export and first client render match (no hydration mismatch).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const defaultIds = items.map((i) => i.id);
  const orderedIds = hydrated ? reconcileOrder(savedOrder, defaultIds) : defaultIds;
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as GridItem[];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(pageId, arrayMove(orderedIds, oldIndex, newIndex));
  }

  if (!editing) {
    // Non-edit render is a plain grid (no dnd overhead, no handles).
    return (
      <div className={`bento-grid ${className}`}>
        {ordered.map((it) => (
          <div key={it.id} className={`span-${it.span}`}>{it.node}</div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div className={`bento-grid ${className}`}>
          {ordered.map((it) => (
            <SortableTile key={it.id} item={it} editing={editing} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
