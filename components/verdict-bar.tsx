"use client";

import { Surface } from "@/components/primitives/surface";
import { ConvictionGauge } from "@/components/primitives/conviction-gauge";
import { DataFreshness } from "@/components/primitives/data-freshness";
import { InfoTip } from "@/components/primitives/info-tip";
import { ProGate } from "@/components/pro-gate";
import { useVerdict } from "@/lib/queries";

export function VerdictBar() {
  const { data, isLoading } = useVerdict();

  return (
    <ProGate feature="The Verdict" tier="pro">
      <Surface variant="raised" as="section" aria-labelledby="verdict-h" className="overflow-hidden">
        <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:gap-8 md:p-8">
          <div className="flex flex-col items-center justify-center gap-1 md:border-r md:border-border md:pr-6">
            <div className="flex items-center gap-1.5">
              <span id="verdict-h" className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                Model Conviction
              </span>
              <InfoTip label="What is model conviction?">
                A 0–10 score from our LightGBM quantitative model. Higher means the model&apos;s
                signals agree more strongly on direction.
              </InfoTip>
            </div>
            <ConvictionGauge value={isLoading ? 0 : data?.conviction} />
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-base leading-relaxed text-fg">
              {isLoading ? <Shimmer lines={2} /> : data?.narrative ?? "No verdict available right now."}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <LevelList label="Support" tone="text-up" levels={data?.support} />
              <LevelList label="Resistance" tone="text-down" levels={data?.resistance} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TagList label="Top risks" glyph="▼" tone="text-down" items={data?.risks} />
              <TagList label="Catalysts" glyph="▲" tone="text-up" items={data?.catalysts} />
            </div>

            <DataFreshness asOf={data?.asOf} className="mt-1" />
          </div>
        </div>
      </Surface>
    </ProGate>
  );
}

function LevelList({ label, levels, tone }: { label: string; levels?: number[]; tone: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <div className="flex flex-wrap gap-2">
        {(levels ?? []).map((lv) => (
          <span key={lv} className={`nums rounded-md border border-border bg-surface-2 px-2 py-1 text-sm ${tone}`}>
            {lv.toLocaleString()}
          </span>
        ))}
        {(!levels || levels.length === 0) && <span className="text-sm text-fg-subtle">—</span>}
      </div>
    </div>
  );
}

function TagList({ label, items, glyph, tone }: { label: string; items?: string[]; glyph: string; tone: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <ul className="flex flex-col gap-1">
        {(items ?? []).map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-fg-muted">
            <span aria-hidden className={tone}>{glyph}</span>
            {t}
          </li>
        ))}
        {(!items || items.length === 0) && <li className="text-sm text-fg-subtle">—</li>}
      </ul>
    </div>
  );
}

function Shimmer({ lines = 1 }: { lines?: number }) {
  return (
    <span className="inline-flex w-full flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className="h-4 w-full rounded bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--elevated)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-shimmer"
        />
      ))}
    </span>
  );
}
