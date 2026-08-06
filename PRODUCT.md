# Product

## Register

product

MapleGamma is 14 routes of signed-in market tooling behind one marketing homepage.
The app is the default register; the landing page (`src/components/landing/LandingPage.tsx`)
and the legal/marketing surfaces are **brand** and should be worked with `reference/brand.md`.

## Users

Self-directed retail investors and options traders, mostly Canadian, from first-year to
fifteenth-year. They arrive pre-market or during the session, usually on a phone first and a
desktop when they're actually working. They are numerate but not institutional: they know
what a call option is, they do not know what dealer gamma exposure implies for today's range.

The job: *"tell me how today is leaning, show me the levels that matter, and prove you've
been right before."* They are choosing between free Discord noise and $200/mo institutional
terminals, and they are sceptical of both.

## Product Purpose

Translate institutional options-market math — gamma/delta/vega exposure by strike, the
zero-gamma flip level, max pain, options flow — into one plain-English daily call, and then
publicly grade that call against what the market actually did. A five-model AI council runs
every weekday morning; every verdict is scored nightly and the accuracy is published.

Success: a user who can't define "GEX" still makes a better-informed decision, understands
*why* the number moved, and trusts the platform because the scorecard is visible rather than
claimed. All results are simulated (paper-trading); the honesty of that framing is the moat,
not a compliance tax.

## Brand Personality

**Plain-spoken · accountable · rigorous.**

The voice is a good analyst explaining their screen to a smart friend: no jargon without an
immediate translation, no claim without a number behind it, no bravado. Confidence comes
from showing the track record, including the misses. Canadian understatement, not Canadian
kitsch — the maple is a mark, not a theme.

Emotional goal: *steadied*. The user should feel the day has been read carefully on their
behalf. Never hyped, never gamified, never made to feel late.

## Anti-references

Confirmed by the owner:

- **Retail trading app (Robinhood-ish).** Playful, gamified, confetti-and-green. Directly
  undermines the accountability positioning.
- **Bloomberg-terminal cosplay.** Amber-on-black monospace everything, hostile density worn
  as a costume. The product's whole premise is that this stuff can be explained.
- **Crypto / hype aesthetic.** Neon glow, glassmorphism, animated gradients, moon energy.

Standing additions from the surface itself:

- **The current landing page is an anti-reference to its own redesign.** Centred hero over
  radial glow blobs, pill badge above the h1, four identical icon-cards, three-column stat
  bar, three pricing cards. It is the modal AI/SaaS template. Departure from it is
  authorised; departure from the *palette and type system* is not (see below).
- Ambient blurred radial gradients used as decoration.

## Design Principles

1. **Plain English is the product.** Every piece of jargon earns an immediate translation.
   All wording lives in `src/lib/glossary/index.ts` and reaches the page through `InfoTip` /
   `PlainLabel` — never inline explanatory prose into a component.
2. **Show the receipts.** Accuracy, sample size, and the misses are first-class content, not
   a footnote. When a number is claimed, the thing that grades it sits next to it.
3. **Hedges are load-bearing.** "Simulated", "estimate", "delayed", "paper-trading" survive
   every rewrite. A label must describe the value it actually renders — this codebase has
   shipped labels that lied before.
4. **Density serves comprehension, not theatre.** Information-dense because the reader needs
   it, never dense to look professional.
5. **Earn the screen, then get out of the way.** The landing page may be loud; the app must
   let the data be the loudest thing on it.

## Accessibility & Inclusion

- WCAG 2.1 AA. Body text ≥4.5:1, large text ≥3:1, verified — not assumed.
- Dark is the flagship theme; light (`:root[data-theme='light']`) is a full peer and every
  change must hold in both.
- Direction is never encoded in colour alone. Bull/bear must also carry sign, arrow, or
  wording — red/green is the single most common colour-blind failure in market UI.
- All motion is paired with a `useReducedMotion` guard or a `prefers-reduced-motion`
  alternative. Reveals enhance already-visible content; content is never gated behind a
  transition that may never fire.
- Touch targets ≥44px. Tested at 320px, tablet, and desktop across chromium and webkit
  (`e2e/tests/responsive-layout.spec.js`).
- Quebec residents are explicitly out of scope in the compliance copy; the French notice is
  required and `lang="fr"` must stay on it.
