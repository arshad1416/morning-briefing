// app/grading-rule/page.tsx — how a daily call is scored. Prose only: no
// gated fetch, no FeatureGate, no tile, so there is nothing here for rule 7
// to bite. The thresholds below are the ones the scorer actually applies
// (hermes-scripts trade_outcome_logger.py fetch_market_outcome /
// compute_correlations, mirrored in backfill_council_outcomes.py) — if that
// code changes, this page is wrong until it is versioned again.
//
// The graded artifact is maplegamma_analysis.json -> market_pulse.regime (plus
// any trade directions in the same file), read by trade_outcome_logger.py:107.
// That file is subscriber data (data_gate.js BASIC_FILES); public verdict.json,
// which backs the dashboard conviction gauge, is scored by nothing. Do not let
// "our market call" drift back into this page — naming the wrong artifact is
// what made v0 unfalsifiable.
//
// The "what is not scored" claims below describe the scorer only once
// patches/hermes-scripts/trade_outcome_logger.py.patch is applied on the Pi:
// unpatched, it books a missing call as "neutral" and falls back to the
// paper-portfolio direction when ^GSPC has no close.
import { InfoTip } from '@/components/primitives';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Grading Rule v1.0 — How We Score a Call',
  description:
    'The exact rule MapleGamma scores the AI council’s daily market call against: the S&P 500, same day, close versus the previous trading day, with a ±0.1% scratch band. Published before the track record it grades.',
  path: '/grading-rule/',
});

export default function GradingRulePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-1 py-2 text-[var(--color-text-secondary)]">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Version 1.0 · Published 14 August 2026
        </p>
        <h1 className="font-display text-3xl tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          How we score a call
        </h1>
        <p className="text-pretty leading-relaxed">
          This is the rule the daily market call named below is marked against. It is written down
          here <em>before</em> the track record it grades, so the standard cannot be moved
          after the fact. If the rule changes, the version number and date change with it.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          What gets graded
        </h2>
        <p className="leading-relaxed">
          One kind of thing only: the direction a call names for that day — bullish,
          bearish or neutral. A call to go long counts as bullish; a call to go short
          counts as bearish. Nothing else on the site is covered by this rule.
        </p>
        <p className="leading-relaxed">
          The call is the AI council&apos;s. Precisely: the{' '}
          <span className="font-mono">market_pulse.regime</span> line of the council&apos;s
          output file, <span className="font-mono">maplegamma_analysis.json</span>, together
          with the direction of up to five trade ideas published in the same file that
          morning.
          That is the file the scorer reads, and it is subscriber data.
        </p>
        <p className="leading-relaxed">
          It is <em>not</em> the number on the public dashboard. The 0–10{' '}
          <InfoTip term="conviction">conviction score</InfoTip> there, and the direction word
          beside it, come from a different file built by a separate model — nothing scores
          them, and this rule does not cover them. If you are holding us to this rule, the
          call being graded is the council&apos;s, not that gauge.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Against what, and over how long
        </h2>
        <p className="leading-relaxed">
          The benchmark is the S&amp;P 500 index (^GSPC). The window is the same day: the
          index close on the day of the call, measured against the previous trading day&apos;s
          close. There is no multi-day horizon and no second chance — a call is settled by
          that one close.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          What counts as a hit
        </h2>
        <p className="leading-relaxed">The day&apos;s move sets the outcome:</p>
        <ul className="space-y-2 border-l-2 border-[var(--color-border-subtle)] pl-4 leading-relaxed">
          <li>
            Up more than <span data-numeric>0.1%</span> — the day was bullish.
          </li>
          <li>
            Down more than <span data-numeric>0.1%</span> — the day was bearish.
          </li>
          <li>
            Anything in between — the day was neutral. That is the{' '}
            <InfoTip term="scratch_band">scratch band</InfoTip>.
          </li>
        </ul>
        <p className="leading-relaxed">
          The call is correct only if it named the same one of those three. A bullish call
          on a day that finished inside the scratch band is wrong, not excused — the band
          is part of the test, not a let-off.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          What the score means
        </h2>
        <p className="leading-relaxed">
          The score is simply the share of scored calls that were correct. Every scored
          call counts once, whatever confidence was attached to it — a high-conviction call
          and a marginal one are worth exactly the same to the score.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          What is not scored
        </h2>
        <p className="leading-relaxed">
          A call is scored only where the benchmark has a close to settle it. Days the
          market did not trade — weekends and holidays — settle nothing, and neither does a
          day whose benchmark close is unavailable. Under this rule those days are left out
          of the score entirely, never settled against a substitute measure.
        </p>
        <p className="leading-relaxed">
          A day the council produced no call is left out for the same reason: there is
          nothing to grade. Nothing is filled in for it — a missing call is not recorded as
          a neutral one, and it counts as neither a hit nor a miss.
        </p>
      </section>

      <section className="space-y-3 border-t border-[var(--color-border-subtle)] pt-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          No track record is published yet
        </h2>
        <p className="leading-relaxed">
          We are publishing the rule first. There is no scored history on this site to read
          yet, and no accuracy figure here is being claimed — this page is the commitment,
          not the result. When a record is published it will be scored by exactly the rule
          above, misses included.
        </p>
      </section>
    </div>
  );
}
