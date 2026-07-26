// components/feature/screener/ScoreBreakdown.tsx — the score, taken apart.
//
// The screener has always shown a 1-10 number and a row of chips naming the
// rules that fired. Neither said what a rule was WORTH, that there are six
// checks in total (so a stock can score well on four and badly on two), or
// where the number starts from. This shows the arithmetic end to end.
//
// Every point value comes from @/lib/screener/score, which reads them back out
// of the generator's own signals[] audit trail. Nothing here recomputes a
// score — see that module's header for why that matters.
'use client';

import React from 'react';
import { InfoTip } from '@/components/primitives';
import {
  NON_SCORING_FIELDS,
  SCORE_MAX,
  SCORE_MIN,
  buildScoreBreakdown,
} from '@/lib/screener/score';
import type { ScreenerTicker } from '@/lib/schemas/screener';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

const pointColor = (points: number) =>
  points > 0 ? 'var(--color-bull)' : points < 0 ? 'var(--color-bear)' : 'var(--color-text-tertiary)';

function PointChip({ points }: { points: number }) {
  const color = pointColor(points);
  return (
    <span
      className="inline-block min-w-8 rounded px-1.5 py-0.5 text-center text-[11px] font-bold"
      data-numeric
      style={{
        color,
        backgroundColor: points === 0 ? 'var(--color-bg-elevated)' : `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {points === 0 ? '0' : signed(points)}
    </span>
  );
}

export function ScoreBreakdown({ ticker }: { ticker: ScreenerTicker }) {
  const breakdown = buildScoreBreakdown(ticker);

  // `signals` is nullish in the schema, and a breakdown reconstructed from the
  // raw fields would be a second implementation of the scoring rules. Say so
  // instead of guessing.
  if (!breakdown) {
    return (
      <p className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        This row carries a score but not the list of rules behind it, so the breakdown
        can&apos;t be shown. That happens on older snapshots taken before the screener
        recorded which checks fired.
      </p>
    );
  }

  const { base, checks, subtotal, published, clamped, reconciles, unknownSignals } = breakdown;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
        Every stock starts at <strong className="text-[var(--color-text-primary)]">{base} out of 10</strong> — the
        neutral middle — and six checks move it up or down. The weights below are fixed for every stock in the scan;
        only which checks fire changes. A high score means more checks happened to line up, not that the stock is a
        good buy.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse text-sm">
          <caption className="sr-only">
            Score components for {ticker.ticker}: each check, the weight it can carry, what it measured and the points
            it contributed.
          </caption>
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              <th scope="col" className="py-1.5 pr-3 text-left font-medium">Check</th>
              <th scope="col" className="py-1.5 pr-3 text-left font-medium">What it can be worth</th>
              <th scope="col" className="py-1.5 pr-3 text-left font-medium">This stock</th>
              <th scope="col" className="py-1.5 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <td className="py-2 pr-3 font-semibold text-[var(--color-text-primary)]">Starting point</td>
              <td className="py-2 pr-3 text-xs text-[var(--color-text-tertiary)]">Same for every stock</td>
              <td className="py-2 pr-3 text-xs text-[var(--color-text-secondary)]">Neutral until a check fires</td>
              <td className="py-2 text-right" data-numeric>
                <span className="text-[11px] font-bold text-[var(--color-text-primary)]">{base}</span>
              </td>
            </tr>
            {checks.map((check) => (
              <tr key={check.key} className="border-t align-top" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <td className="py-2 pr-3">
                  <span className="font-semibold text-[var(--color-text-primary)]">{check.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-text-tertiary)]">
                    {check.question}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  {/* Every rule in the check, fired or not — the weights are
                      the part a reader cannot infer from the chips, and the
                      rules that did NOT fire are what make the number
                      interpretable ("it lost a point it could have had"). */}
                  <ul className="space-y-0.5">
                    {check.rules.map((rule) => {
                      const isFired = check.fired?.signal === rule.signal;
                      return (
                        <li
                          key={rule.signal}
                          className="flex items-baseline gap-1.5 text-[11px] leading-snug"
                          style={{
                            color: isFired ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            fontWeight: isFired ? 600 : 400,
                          }}
                        >
                          <span data-numeric style={{ color: pointColor(rule.points) }}>{signed(rule.points)}</span>
                          <span>{rule.label}</span>
                          {isFired && <span aria-label="this rule fired"> ←</span>}
                        </li>
                      );
                    })}
                  </ul>
                </td>
                <td className="py-2 pr-3 text-xs leading-snug text-[var(--color-text-secondary)]">{check.reason}</td>
                <td className="py-2 text-right"><PointChip points={check.points} /></td>
              </tr>
            ))}
            <tr className="border-t-2" style={{ borderColor: 'var(--color-border-default)' }}>
              <td className="py-2 pr-3 font-semibold text-[var(--color-text-primary)]" colSpan={3}>
                {base} to start, plus everything above
              </td>
              <td className="py-2 text-right font-bold text-[var(--color-text-primary)]" data-numeric>{subtotal}</td>
            </tr>
            {clamped && (
              <tr className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {/* Without this row the arithmetic visibly fails to add up:
                    the checks can total 11 or 0, and the published score
                    cannot. */}
                <td className="py-2 pr-3 text-xs leading-snug text-[var(--color-text-secondary)]" colSpan={3}>
                  The score is held to a {SCORE_MIN}–{SCORE_MAX} range, so the total above is capped
                  {subtotal > SCORE_MAX ? ' down' : ' up'} to the edge of the scale.
                </td>
                <td className="py-2 text-right text-xs text-[var(--color-text-tertiary)]">cap</td>
              </tr>
            )}
            <tr className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
              <td className="py-2 pr-3 font-semibold text-[var(--color-text-primary)]" colSpan={3}>
                Score shown in the table
              </td>
              <td className="py-2 text-right text-base font-bold text-[var(--color-text-primary)]" data-numeric>
                {published != null ? Math.round(published) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!reconciles && (
        // A breakdown that quietly disagrees with the number beside it is
        // worse than no breakdown, so the disagreement is surfaced instead of
        // being smoothed over.
        <p
          className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
          style={{ borderColor: 'var(--color-bear)', color: 'var(--color-bear)' }}
        >
          These checks add up to {subtotal}, but the score recorded for {ticker.ticker} is{' '}
          {published != null ? Math.round(published) : '—'}. The published score is the one shown in the table; the
          breakdown is out of step with it, which usually means the scoring rules changed and this page has not caught
          up. Treat the breakdown as unreliable for this row.
        </p>
      )}

      {unknownSignals.length > 0 && (
        <p className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
          This row also carries {unknownSignals.length === 1 ? 'a rule' : 'rules'} this page doesn&apos;t have a
          description for yet: {unknownSignals.join(', ')}.
        </p>
      )}

      <p className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        Not part of the score, even though you can filter on them: {NON_SCORING_FIELDS.join(', ').toLowerCase()}. And
        the score is a snapshot of six mechanical checks — it knows nothing about the company&apos;s business, its debt,
        its competition or anything that happened after the scan. See{' '}
        <InfoTip term="rsi">RSI</InfoTip> and <InfoTip term="p_e">P/E</InfoTip> for what those two readings mean.
      </p>
    </div>
  );
}
