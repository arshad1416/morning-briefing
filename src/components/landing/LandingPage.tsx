"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Animated gamma-symbol logo with gamma-ray pulse                    */
/* ------------------------------------------------------------------ */

function MapleGammaMark({ size = 40 }: { size?: number }) {
  const reduce = useReducedMotion();

  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Soft pulsing glow behind the leaf */}
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full blur-md"
        style={{
          background:
            "radial-gradient(circle, rgba(244,63,94,0.55), rgba(244,63,94,0) 70%)",
        }}
        animate={
          reduce ? undefined : { opacity: [0.4, 0.85, 0.4], scale: [0.9, 1.15, 0.9] }
        }
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg viewBox="0 0 100 100" width={size} height={size} className="relative">
        <defs>
          <linearGradient id="mg-leaf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="55%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Gamma-ray pulse: rings emanating from the core */}
        {[0, 1, 2].map((i) =>
          reduce ? (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={26 + i * 8}
              fill="none"
              stroke="#34d399"
              strokeWidth="1.25"
              opacity={0.16}
            />
          ) : (
            <motion.circle
              key={i}
              cx="50"
              cy="50"
              fill="none"
              stroke="#34d399"
              strokeWidth="1.5"
              initial={{ r: 18, opacity: 0 }}
              animate={{ r: [18, 50], opacity: [0.55, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeOut",
                delay: i * 1,
              }}
            />
          )
        )}

        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="64"
          fontWeight="700"
          fill="url(#mg-leaf)"
          style={{ fontFamily: "'IBM Plex Mono', 'Geist Mono', monospace" }}
        >
          Γ
        </text>
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Motion variants (reduced-motion aware)                            */
/* ------------------------------------------------------------------ */

const useMotionKit = () => {
  const reduce = useReducedMotion();

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };

  const stagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };

  const viewport = { once: true, amount: 0.25 } as const;

  return { reduce, fadeUp, stagger, viewport };
};

/* ------------------------------------------------------------------ */
/*  Feature data                                                      */
/* ------------------------------------------------------------------ */

type Feature = {
  title: string;
  body: string;
  accent: string;
  icon: React.ReactNode;
};

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FEATURES: Feature[] = [
  {
    title: "GEX / DEX Mapping",
    body: "See exactly where dealers are pinned. Live gamma & delta exposure by strike reveals the walls that move price.",
    accent: "text-emerald-400",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M3 21h18" />
        <rect x="5" y="11" width="3" height="7" rx="1" />
        <rect x="10.5" y="6" width="3" height="12" rx="1" />
        <rect x="16" y="13" width="3" height="5" rx="1" />
      </svg>
    ),
  },
  {
    title: "AI Predictions",
    body: "Probabilistic next-day and next-week ranges modeled on 26 years of regime-tagged market behavior.",
    accent: "text-sky-400",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M3 17l5-6 4 4 6-8" />
        <path d="M14 7h4v4" />
      </svg>
    ),
  },
  {
    title: "Real-Time News",
    body: "Filings, headlines and catalysts streamed and ranked by impact — the noise stripped out, the signal surfaced.",
    accent: "text-amber-400",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5z" />
        <path d="M17 8h3v9a2 2 0 0 1-2 2" />
        <path d="M7 9h7M7 12.5h7M7 16h4" />
      </svg>
    ),
  },
  {
    title: "Market Sentiment",
    body: "Crowd positioning, options skew and social momentum fused into a single, readable bull-vs-bear pulse.",
    accent: "text-fuchsia-400",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M3 12a9 9 0 0 1 18 0" />
        <path d="M12 12l4-2.5" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Verdict bar                                                       */
/* ------------------------------------------------------------------ */

function VerdictBar() {
  const { reduce, fadeUp, viewport } = useMotionKit();
  const score = 72; // 0 = max bearish, 100 = max bullish

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={viewport}
      className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">The Verdict</h3>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          One synthesized call per ticker — updated every minute.
        </p>
      </div>

      <div
        className="mt-6"
        role="img"
        aria-label={`Verdict reading: ${score} out of 100, leaning bullish`}
      >
        <div className="relative h-3 w-full rounded-full bg-linear-to-r from-rose-500 via-amber-400 to-emerald-500">
          <motion.span
            className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#070708] bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
            initial={{ left: reduce ? `${score}%` : "50%" }}
            whileInView={{ left: `${score}%` }}
            viewport={viewport}
            transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="mt-3 flex justify-between text-xs font-medium uppercase tracking-wider">
          <span className="text-rose-400">Bearish</span>
          <span className="text-amber-300">Neutral</span>
          <span className="text-emerald-400">Bullish</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                           */
/* ------------------------------------------------------------------ */

const Check = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mt-0.5 shrink-0 text-emerald-400"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function PricingCard({
  name,
  price,
  period,
  blurb,
  features,
  cta,
  featured = false,
}: {
  name: string;
  price: string;
  period?: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
}) {
  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border p-6 sm:p-8",
        featured
          ? "border-emerald-400/40 bg-linear-to-b from-emerald-400/[0.08] to-transparent"
          : "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]",
      ].join(" ")}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-950">
          Most popular
        </span>
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        {name}
      </h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-[var(--color-text-primary)]">{price}</span>
        {period && <span className="text-[var(--color-text-tertiary)]">{period}</span>}
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">{blurb}</p>

      <ul className="mt-6 flex-1 space-y-3 text-sm text-[var(--color-text-secondary)]">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href="#"
        className={[
          "mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]",
          featured
            ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-300 focus-visible:ring-emerald-400"
            : "border border-white/15 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] focus-visible:ring-white/60",
        ].join(" ")}
      >
        {cta}
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing page                                                      */
/* ------------------------------------------------------------------ */

export default function MapleGammaLanding() {
  const { fadeUp, stagger, viewport } = useMotionKit();

  const stats = [
    { value: "162K", label: "trades analyzed" },
    { value: "59", label: "tickers covered" },
    { value: "26", label: "years of data" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] antialiased selection:bg-emerald-400/30">
      {/* Ambient background glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(244,63,94,0.18), rgba(244,63,94,0) 70%)",
          }}
        />
        <div
          className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.14), rgba(52,211,153,0) 70%)",
          }}
        />
      </div>

      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <motion.a
          variants={fadeUp}
          href="#"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
        >
          <MapleGammaMark size={36} />
          <span className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
            Maple<span className="bg-linear-to-r from-rose-400 via-red-400 to-amber-300 bg-clip-text text-transparent">Gamma</span>
          </span>
        </motion.a>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <a
            href="#features"
            className="hidden rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:inline-block"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="hidden rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:inline-block"
          >
            Pricing
          </a>
          <a
            href="#pricing"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
          >
            Get started
          </a>
        </nav>
      </header>

      <main id="main" className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-5 pb-16 pt-16 text-center sm:pt-24">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center"
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Institutional-grade options intelligence
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[var(--color-text-primary)] sm:text-6xl"
            >
              Trade with the math the{" "}
              <span className="bg-linear-to-r from-rose-400 via-red-400 to-amber-300 bg-clip-text text-transparent">
                desks
              </span>{" "}
              already use.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-[var(--color-text-tertiary)]"
            >
              MapleGamma turns dealer gamma, delta exposure, live news and
              sentiment into one clear verdict — so retail investors can read the
              market the way the pros do.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <a
                href="#pricing"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
              >
                Start free
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
              >
                See how it works
              </a>
            </motion.div>
          </motion.div>
        </section>

        {/* Trust bar */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          aria-label="Platform coverage"
          className="mx-auto max-w-4xl px-5"
        >
          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] py-6">
            {stats.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className="px-2 text-center"
              >
                <div className="text-2xl font-bold text-[var(--color-text-primary)] sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-tertiary)] sm:text-sm">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
              Every edge, on one screen
            </h2>
            <p className="mt-4 text-[var(--color-text-tertiary)]">
              Five signals, continuously fused into a decision you can actually
              act on.
            </p>
          </motion.div>

          <motion.ul
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {FEATURES.map((f) => (
              <motion.li
                key={f.title}
                variants={fadeUp}
                className="group rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div
                  className={`inline-flex rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-2.5 ${f.accent}`}
                >
                  {f.icon}
                </div>
                <h3 className="mt-4 font-semibold text-[var(--color-text-primary)]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
                  {f.body}
                </p>
              </motion.li>
            ))}
          </motion.ul>

          <div className="mt-5">
            <VerdictBar />
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-5xl px-5 pb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
              Start free. Upgrade when it pays for itself.
            </h2>
            <p className="mt-4 text-[var(--color-text-tertiary)]">
              No card required to explore the daily verdict.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mt-12 grid items-stretch gap-6 sm:grid-cols-2"
          >
            <motion.div variants={fadeUp}>
              <PricingCard
                name="Free"
                price="$0"
                period="forever"
                blurb="A daily read on the market's mood."
                cta="Create account"
                features={[
                  "Daily verdict on 5 core tickers",
                  "Basic GEX snapshot",
                  "Delayed news feed",
                  "Community watchlist",
                ]}
              />
            </motion.div>

            <motion.div variants={fadeUp}>
              <PricingCard
                name="Pro"
                price="$29"
                period="/ month"
                blurb="The full intelligence stack, real time."
                cta="Go Pro"
                featured
                features={[
                  "All 59 tickers, live GEX & DEX",
                  "AI price predictions & ranges",
                  "Real-time news + sentiment",
                  "The Verdict bar on every symbol",
                  "26-year backtested regimes",
                ]}
              />
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--color-border-subtle)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <MapleGammaMark size={28} />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Maple<span className="text-emerald-400">Gamma</span>
            </span>
          </div>
          <p className="text-center text-xs text-slate-500 sm:text-right">
            For informational purposes only. Not investment advice. ·{" "}
            <span className="whitespace-nowrap">
              © {new Date().getFullYear()} MapleGamma
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
