"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { GammaMark } from "@/components/brand/GammaMark";
import { useMe } from "@/lib/auth/useMe";
import { useUI } from "@/stores/ui";

// Legacy hash-router routes (old bookmarks, briefing-email deep links, and
// the Worker's OAuth redirects, e.g. /#/login?error=use_password) → their
// new locations. #/ticker/NVDA-style prefix links are handled in the shim.
const LEGACY_ROUTES: Record<string, string> = {
  "": "/dashboard/",
  today: "/dashboard/",
  login: "/login/",
  signup: "/signup/",
  account: "/account/",
  pricing: "/#pricing",
  positions: "/positions/",
  options: "/options/",
  models: "/models/",
  charts: "/charts/",
  screener: "/screener/",
  research: "/research/",
  maplegamma: "/options/",
};

/* ------------------------------------------------------------------ */
/*  Theme toggle (same mg-ui store the app shell uses)                */
/* ------------------------------------------------------------------ */

function LandingThemeToggle() {
  const { theme, setTheme } = useUI();
  // Render only after mount — the persisted theme isn't known at build time,
  // so the prerendered HTML must not commit to an icon.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <span className="min-w-11 min-h-11" aria-hidden="true" />;

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <svg {...iconProps} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
        </svg>
      ) : (
        <svg {...iconProps} aria-hidden="true">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
      )}
    </button>
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
        <div
          className="relative h-3 w-full rounded-full"
          style={{ background: "var(--gradient-conviction)" }}
        >
          <motion.span
            className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
            style={{ borderColor: "var(--color-bg-base)" }}
            initial={{ left: reduce ? `${score}%` : "50%" }}
            whileInView={{ left: `${score}%` }}
            viewport={viewport}
            transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="mt-3 flex justify-between text-xs font-medium uppercase tracking-wider">
          <span style={{ color: "var(--color-bear)" }}>Bearish</span>
          <span style={{ color: "var(--color-caution)" }}>Neutral</span>
          <span style={{ color: "var(--color-bull)" }}>Bullish</span>
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
    stroke="var(--color-bull)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mt-0.5 shrink-0"
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
  href,
  featured = false,
  ctaPrimary = featured,
}: {
  name: string;
  price: string;
  period?: string;
  blurb: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
  ctaPrimary?: boolean;
}) {
  return (
    <div
      className="relative flex h-full flex-col rounded-2xl border p-6 sm:p-8"
      style={
        featured
          ? {
              borderColor: "rgba(255,122,26,0.35)",
              background:
                "linear-gradient(180deg, rgba(255,122,26,0.08) 0%, transparent 55%) var(--color-bg-surface)",
            }
          : {
              borderColor: "var(--color-border-subtle)",
              backgroundColor: "var(--color-bg-surface)",
            }
      }
    >
      {featured && (
        <span
          className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: "var(--color-accent)", color: "var(--color-on-accent)" }}
        >
          Most popular
        </span>
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        {name}
      </h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-[var(--color-text-primary)]" data-numeric>
          {price}
        </span>
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
        href={href}
        className={[
          "mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]",
          ctaPrimary
            ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-fg)]"
            : "border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]",
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
  const { data: me } = useMe();
  const [annual, setAnnual] = useState(false);

  // Redirect legacy hash routes to their new homes.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#/")) return;
    const [seg, query] = hash.slice(2).split("?");
    const cleaned = seg.replace(/\/+$/, "");
    let target = LEGACY_ROUTES[cleaned];
    if (!target) {
      // Prefix routes: #/ticker/NVDA → /ticker/?symbol=NVDA
      const [head, ...rest] = cleaned.split("/");
      if (head === "ticker" && rest[0]) {
        target = `/ticker/?symbol=${encodeURIComponent(rest[0].toUpperCase())}`;
      }
    }
    if (target) {
      const sep = target.includes("?") ? "&" : "?";
      window.location.replace(target + (query ? `${sep}${query}` : ""));
    }
  }, []);

  const stats = [
    { value: "162K", label: "trades analyzed" },
    { value: "59", label: "tickers covered" },
    { value: "26", label: "years of data" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] antialiased selection:bg-[rgba(255,122,26,0.30)]">
      {/* Ambient background glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,26,0.12), rgba(255,122,26,0) 70%)",
          }}
        />
        <div
          className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.08), rgba(16,185,129,0) 70%)",
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
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
        >
          <GammaMark size={36} />
          <span className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
            Maple<span style={{ color: "var(--color-accent)" }}>Gamma</span>
          </span>
        </motion.a>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {/* Single app entry — the section pages are all reachable from the
              Dashboard's own nav once inside. */}
          <a
            href="/dashboard/"
            className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            Dashboard
          </a>
          <a
            href="#features"
            className="hidden rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:inline-block"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="hidden rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:inline-block"
          >
            Pricing
          </a>
          <LandingThemeToggle />
          {!me && (
            <a
              href="/login/"
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              Sign in
            </a>
          )}
          <a
            href={me ? "/account/" : "/signup/"}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition hover:bg-[var(--color-accent-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
          >
            {me ? "Account" : "Get started"}
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
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "var(--color-accent)" }}
              />
              Institutional-grade options intelligence
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="font-display mt-6 text-balance text-5xl leading-[1.04] tracking-tight text-[var(--color-text-primary)] sm:text-7xl"
            >
              Trade with the math the{" "}
              <em className="italic" style={{ color: "var(--color-accent)" }}>
                desks
              </em>{" "}
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
                href="/signup/"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[var(--color-on-accent)] transition hover:bg-[var(--color-accent-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
              >
                Start free
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border-default)] px-6 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
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
          <div className="grid grid-cols-3 divide-x divide-[var(--color-border-subtle)] rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] py-6">
            {stats.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className="px-2 text-center"
              >
                <div
                  className="text-2xl font-semibold text-[var(--color-text-primary)] sm:text-3xl"
                  data-numeric
                >
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
            <h2 className="font-display text-4xl tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
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
                whileHover={{ y: -2 }}
                className="group rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 transition hover:border-[var(--color-border-strong)] hover:bg-[rgba(255,255,255,0.03)]"
              >
                <div
                  className="inline-flex rounded-xl border p-2.5"
                  style={{
                    backgroundColor: "var(--color-accent-dim)",
                    borderColor: "rgba(255,122,26,0.20)",
                    color: "var(--color-accent)",
                  }}
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
            <h2 className="font-display text-4xl tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
              Start free. Upgrade when it pays for itself.
            </h2>
            <p className="mt-4 text-[var(--color-text-tertiary)]">
              The daily dashboard is always free. Unlock the rest with a 7-day trial — no card
              required.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mt-10 flex justify-center"
          >
            <div
              role="tablist"
              aria-label="Billing interval"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!annual}
                onClick={() => setAnnual(false)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                  !annual
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                ].join(" ")}
              >
                Monthly
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={annual}
                onClick={() => setAnnual(true)}
                className={[
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                  annual
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                ].join(" ")}
              >
                Annual
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={
                    annual
                      ? {
                          backgroundColor: "rgba(0,0,0,0.18)",
                          color: "var(--color-on-accent)",
                        }
                      : {
                          backgroundColor: "var(--color-accent-dim)",
                          color: "var(--color-accent)",
                        }
                  }
                >
                  2 months free
                </span>
              </button>
            </div>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mt-8 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            <motion.div variants={fadeUp} className="h-full">
              <PricingCard
                name="Free"
                price="$0"
                period="forever"
                blurb="The daily dashboard, always free."
                cta="Create account"
                href="/signup/"
                features={[
                  "Market regime & indices",
                  "Headlines & Reddit pulse",
                  "GEX/DEX snapshot",
                ]}
              />
            </motion.div>

            <motion.div variants={fadeUp} className="h-full">
              <PricingCard
                name="Basic"
                price={annual ? "$490" : "$49"}
                period={annual ? "/ year CAD" : "/ month CAD"}
                blurb="Everything in Free, plus the full research desk."
                cta="Start 7-day free trial"
                ctaPrimary
                href={`/signup/?plan=basic${annual ? "&interval=annual" : ""}`}
                features={[
                  "Full Screener — all tickers, scored",
                  "Research: analysis, news, earnings, SEC",
                  "Reddit + prediction-market sentiment",
                ]}
              />
            </motion.div>

            <motion.div variants={fadeUp} className="h-full">
              <PricingCard
                name="Pro"
                price={annual ? "$990" : "$99"}
                period={annual ? "/ year CAD" : "/ month CAD"}
                blurb="Everything in Basic, plus charts, models & the AI council."
                cta="Start 7-day free trial"
                href={`/signup/?plan=pro${annual ? "&interval=annual" : ""}`}
                featured
                features={[
                  "Interactive charts — candles, RSI, ATR",
                  "Model accuracy & walk-forward backtests",
                  "Prediction engine + council history",
                ]}
              />
            </motion.div>
          </motion.div>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mt-8 text-center text-sm text-[var(--color-text-tertiary)]"
          >
            Cancel anytime. General information only, not investment advice.
          </motion.p>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--color-border-subtle)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <GammaMark size={28} />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Maple<span style={{ color: "var(--color-accent)" }}>Gamma</span>
            </span>
          </div>
          <p className="text-center text-xs text-[var(--color-text-tertiary)] sm:text-right">
            For informational purposes only. Not investment advice. ·{" "}
            <span className="whitespace-nowrap">
              © {new Date().getFullYear()} MapleGamma
            </span>
          </p>
        </div>

        {/* Compliance — general disclaimer, position-disclosure policy, Quebec notice */}
        <div className="mx-auto max-w-6xl px-5 pb-8 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
          <p className="mb-2">
            MapleGamma provides general market information and simulated (paper-trading) results for
            educational purposes only. Nothing on this site is investment advice or a recommendation,
            and nothing is tailored to any person&apos;s circumstances. The site operator may hold positions
            in securities discussed; current Interactive Brokers holdings are disclosed on pages where
            those securities appear. Past performance — real or simulated — does not guarantee future results.
          </p>
          <p>
            <strong>Quebec notice:</strong> this service is not directed at, or intended for use by, residents
            of Quebec. <span lang="fr">Avis&nbsp;: ce service ne s&apos;adresse pas aux résidents du Québec.
            L&apos;information fournie est de nature générale et ne constitue pas un conseil en placement ni
            une recommandation.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
