# MapleGamma v1 — UX/UI Design Specification

## Brand Identity
- **Name:** MapleGamma — gamma (Γ) × Canadian maple identity
- **Tagline:** *Gamma Intelligence for the Canadian Trader*
- **Logo concept:** Stylized gamma "Γ" with a maple leaf cutout, amber/gold on dark
- **Colours:** Dark theme (matching existing briefing.arshadkazi.ca), amber accent (#e2a84a), with a distinctive warm maple-gold palette
- **Positioning:** The options analytics layer *between* retail traders and institutional-grade GEX data. $125/mo US | +$29 Canada
- **Mascot:** Anthropomorphized gamma symbol — the "Gamma Goose" (Canadian goose) that tells you where the floor & ceiling are

---

## 1. Competitor Analysis

### Vol.land — What They Do Well
- **Customizable workspace** — drag-and-drop widgets, users pick what they see
- **GEX/Vanna/Notional as core metrics** — 3-column metric bar at top, clear hierarchy
- **Chart first** — gamma profile chart dominates the viewport above the fold
- **Color-coded gamma bars** — green (support) / red (resistance) intuitively maps to bullish/bearish
- **Expiration selector** — clean pill-shaped toggle for monthly vs weekly vs all expirations
- **Dark theme done right** — pure black background, neon data, high contrast

### Vol.land — What They Do Poorly
- **No beginner mode** — drops you into the deep end with raw gamma notional values; no floor/ceiling zone translation
- **No Canadian market data** — SPX/SPY only, zero TSX coverage
- **Overwhelming data density** — every cell in the gamma table has 4+ numbers, needs tooltips or collapsible rows
- **No narrative context** — pure numbers, no explanation of *what the gamma profile means for today*
- **Mobile-unfriendly** — the workspace is clearly desktop-only

### Unusual Whales — What They Do Well
- **Tiered navigation** — logical page hierarchy (Flow > Tickers > Market > Periscope > Workspace)
- **Options Flow as hero feature** — real-time unusual options flow is their headline
- **Predictions tab** — gamified prediction market integration drives daily engagement
- **Mr. Whale AI** — LLM chat that explains complex options data in plain language
- **Pricing page** — clear feature comparison table across 3 tiers

### Unusual Whales — What They Do Poorly
- **No GEX/DEX/VEX** — surprisingly absent given their options focus
- **No gamma visualization** — zero gamma profile charts, no floor/ceiling visualization
- **Cluttered nav** — too many dropdowns with too many sub-items; cognitive load is high
- **No Canadian tickers** — US-only
- **Pricing is confusing** — "Retail Basic" vs "Retail Pro" vs "Professional" has unclear differentiation

### Our Differentiators
1. **GEX + DEX + VEX in one view** — not just gamma, but delta and vega exposure too
2. **Canadian-first** — TSX, TSX-V, TSX 60 gamma profiles plus US
3. **Beginner + Advanced in one page** — floor/ceiling zones on top, full gamma table below
4. **Narrative overlay** — "What does this mean?" text summaries alongside every data widget
5. **One price, no tiers** — $125/mo, everything included. Clarity is a feature.

---

## 2. Navigation Structure

```
[MapleGamma Γ]  Dashboard  |  GEX/DEX/VEX  |  Options Flow  |  Unusual Flow  |  Portfolio  |  Education  |  [Sign In] [Subscribe]
```

| Tab | Description | Auth Required |
|-----|-------------|---------------|
| **Dashboard** | Market overview — indices, VIX, top-level GEX/DEX/VEX gauge | No (limited) / Yes (full) |
| **GEX/DEX/VEX** | The core page — gamma profile chart, floor/ceiling zones, full gamma table | Yes |
| **Options Flow** | Real-time unusual options activity — whale trades, sweepers, large blocks | Yes |
| **Unusual Flow** | High-conviction flow picks (AI-filtered) | Yes |
| **Portfolio** | Track your positions + their gamma exposure | Yes |
| **Education** | What is GEX? What is gamma? Beginner guides | No (public) |

---

## 3. Landing Page (Public, for Conversion)

### Top-to-Bottom Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  NAV: [Γ MapleGamma]  Dashboard  GEX/DEX/VEX  Flow  Education  │
│                                         [Sign In] [Subscribe ✓] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  HERO SECTION                                             │  │
│  │                                                           │  │
│  │  "Gamma Intelligence" (large serif)                       │  │
│  │  "for the Canadian Trader"                                │  │
│  │                                                           │  │
│  │  Subtitle: "See where the smart money is positioned.      │  │
│  │  Spot gamma floors and ceilings before the market moves." │  │
│  │                                                           │  │
│  │  [Try Dashboard Free →]  [View Pricing ↓]                 │  │
│  │                                                           │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐                               │  │
│  │  │ SPX  │ │ TSX  │ │ VIX  │    (Live preview of top       │  │
│  │  │ 7609 │ │ 35083│ │15.76│     indices with gamma level    │  │
│  │  │Γ: +1.2│ │Γ: +0.8│ │     │    indicator)                 │  │
│  │  └──────┘ └──────┘ └──────┘                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  "WHAT IS GAMMA?" — Simple explainer section              │  │
│  │                                                           │  │
│  │  [Floor Zone Illustration]  [Ceiling Zone Illustration]    │  │
│  │  "Gamma walls are where big options positions create      │  │
│  │   support or resistance. Our engine finds them for you."   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  FEATURES GRID (3-column)                                 │  │
│  │                                                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │  │
│  │  │ GEX/DEX/VEX  │ │ Floor/Ceiling│ │ Options Flow │       │  │
│  │  │ Triple-greek  │ │ Zone Alerts  │ │ Whale Trades │       │  │
│  │  │ exposure view │ │ Push notifs  │ │ Real-time    │       │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │  │
│  │  │ Canadian/US │ │ Gamma Table  │ │ AI Narrative │       │  │
│  │  │ Dual market  │ │ Full chain   │ │ "What this   │       │  │
│  │  │ coverage     │ │ exportable   │ │ means today" │       │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  LIVE DEMO — Animated mockup of the GEX/DEX/VEX dashboard  │  │
│  │  Shows: gamma profile chart with floor/ceiling zones       │  │
│  │  Rotating between SPX, TSX, QQQ examples                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PRICING CARD                                              │  │
│  │                                                           │  │
│  │  ┌───────────────────────────────────────────────────┐   │  │
│  │  │  MapleGamma Pro                                   │   │  │
│  │  │  $125 / month                                     │   │  │
│  │  │  +$29/mo for Canadian data add-on                  │   │  │
│  │  │                                                   │   │  │
│  │  │  ✓ Real-time GEX/DEX/VEX for SPX & TSX            │   │  │
│  │  │  ✓ Gamma profile charts with floor/ceiling zones  │   │  │
│  │  │  ✓ Full gamma table exportable to CSV              │   │  │
│  │  │  ✓ Unusual options flow + whale alerts             │   │  │
│  │  │  ✓ AI market narrative + gamma interpretation     │   │  │
│  │  │  ✓ Portfolio gamma tracking                        │   │  │
│  │  │  ✓ Discord community access                        │   │  │
│  │  │                                                   │   │  │
│  │  │  [Subscribe Now →]                                 │   │  │
│  │  │  14-day money-back guarantee                       │   │  │
│  │  └───────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  TESTIMONIALS / SOCIAL PROOF                              │  │
│  │  "Finally, Canadian gamma data. Game changer." — @trader │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  FOOTER — Links, disclaimer, copyright                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Logged-In Dashboard: GEX/DEX/VEX Page

### The Core Philosophy
**One page serves both beginners and pros.** The top half shows zone-based gamma visualization (floor/ceiling). The bottom half reveals the full gamma table for power users. An inline mode toggle switches between "Simple" and "Advanced" without navigating away.

### Top-to-Bottom Widget Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  NAV: [Γ MapleGamma]  Dashboard  |  GEX/DEX/VEX  |  Flow  │ ... │
│                         ┌─────────────────────────┐             │
│                         │ 🔔 3 new gamma alerts    │             │
│                         └─────────────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  WIDGET 1: KEY METRICS BAR (Fixed, always visible)              │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  SPX  │ │  Total   │ │  Total   │ │  Total   │ │  Gamma   │  │
│  │ 7609  │ │GEX(SPX)  │ │DEX(SPX)  │ │VEX(SPX)  │ │  Regime  │  │
│  │+0.12% │ │ +1.52B   │ │ -0.89B   │ │ 0.34B    │ │ 🟢 Bull  │  │
│  │       │ │ per $1%   │ │ per $1%   │ │ per 1%IV │ │          │  │
│  └──────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                                  │
│  Ticker selector + expiry pill toggle:                          │
│  [SPX ▼] [TSX ▼] [QQQ ▼] [+Add]     [All exp] [Weekly] [Monthly]│
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  WIDGET 2: GAMMA PROFILE CHART (Primary visualization)          │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │    Gamma Exposure Profile — SPX                           │  │
│  │    ┌──────────────────────────────────┐                   │  │
│  │    │  ◀── CEILING ZONE ──▶            │                   │  │
│  │    │  5,700        5,800     5,900    │                   │  │
│  │    │  [red bars above = resistance]   │                   │  │
│  │    │         ░░░░░░░░░░░░             │                   │  │
│  │    │  Current Price: █ 5,830          │                   │  │
│  │    │         ░░░░░░░░░░░░             │                   │  │
│  │    │  ◀── FLOOR ZONE ──▶             │                   │  │
│  │    │  5,600        5,500     5,400    │                   │  │
│  │    │  [green bars below = support]    │                   │  │
│  │    └──────────────────────────────────┘                   │  │
│  │                                                           │  │
│  │  [DEX Profile] [VEX Profile] [All Three]  ← overlay      │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Narrative chip below chart:                                    │
│  "▶ SPX is sitting between a gamma ceiling at 5,850 and         │
│    a gamma floor at 5,700. The next big gamma wall is at        │
│    5,400 (put wall). A break above 5,850 could trigger          │
│    rapid gamma-driven acceleration."                            │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  WIDGET 3: BEGINNER FLOOR/CEILING ZONE CARDS                    │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ┌──────────────────────┐ ┌──────────────────────┐              │
│  │  🛡️ GAMMA FLOOR      │ │  🚧 GAMMA CEILING    │              │
│  │                      │ │                      │              │
│  │  Support Zone        │ │  Resistance Zone     │              │
│  │  5,400 — 5,700       │ │  5,850 — 5,950       │              │
│  │                      │ │                      │              │
│  │  Strength: STRONG    │ │  Strength: MODERATE  │              │
│  │  Total GEX: +$1.8B   │ │  Total GEX: -$0.9B   │              │
│  │                      │ │                      │              │
│  │  "This floor held on  │ │  "Call wall building  │              │
│  │   3 of the last 5     │ │   at 5,850. Watch    │              │
│  │   touches. Strong     │ │   for max pain."     │              │
│  │   put support."       │ │                      │              │
│  └──────────────────────┘ └──────────────────────┘              │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  WIDGET 4: MODE TOGGLE + FULL GAMMA TABLE (Advanced)            │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  [Beginner: Zones] [● Advanced: Full Table]                      │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Gamma Exposure Table — SPX — All Expirations             │  │
│  │                                                           │  │
│  │  Strike  │  Calls GEX  │  Puts GEX  │ Net GEX │  DEX  │  │
│  │  ───────┼─────────────┼────────────┼─────────┼───────│  │
│  │  5,400  │  +120M      │  -180M     │  -60M   │ -0.15 │  │
│  │  5,450  │  +80M       │  -240M     │  -160M  │ -0.28 │  │
│  │  5,500  │  +200M      │  -450M     │  -250M  │ -0.42 │  │
│  │  ...    │  ...        │  ...       │  ...    │  ...  │  │
│  │                                                           │  │
│  │  [Export CSV] [Copy] [Zoom to Current Price]              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  WIDGET 5: NET GEX BY EXPIRATION                                 │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Net Gamma by Expiration — SPX                            │  │
│  │                                                           │  │
│  │  This Week  │  Next Week  │  Month End  │  Front Month  │  │
│  │  +0.8B      │  +0.3B      │  -0.5B      │  +1.2B        │  │
│  │  🟢          │  🟢          │  🔴          │  🟢            │  │
│  │                                                           │  │
│  │  "Most gamma concentration is in the front month —        │  │
│  │   this week's OPEX could see increased volatility."       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  WIDGET 6: OPEN INTEREST HEATMAP                                 │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Open Interest by Strike × Expiration (SPX)               │  │
│  │                                                           │  │
│  │        W1    W2    W3    W4                               │  │
│  │  5400  ██    ░░    ░░    ░░                               │  │
│  │  5450  ████  ██    ░░    ░░                               │  │
│  │  5500  ████  ████  ██    ░░                               │  │
│  │  ...                                                      │  │
│  │  (Color intensity = OI concentration)                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  WIDGET 7: RECENT UNUSUAL OPTIONS FLOW                          │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🐋 Unusual Options Flow                                  │  │
│  │                                                           │  │
│  │  Ticker │ Action   │ Strike │ Exp  │ Premium │  Sentiment│  │
│  │  ───────┼──────────┼────────┼──────┼─────────┼──────────│  │
│  │  SPX    │ Buy Call │  5850  │ 6/12 │  +$2.4M │ 🟢 Bull   │  │
│  │  TSLA   │ Sell Put │  175   │ 6/26 │  -$1.1M │ 🔴 Bear   │  │
│  │  AAPL   │ Buy Put  │  190   │ 7/17 │  +$0.8M │ 🔴 Bear   │  │
│  │                                                           │  │
│  │  [View All Flow →]                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Widget Detail Specifications

### Widget 1: Key Metrics Bar
- **Position:** Below nav, full width
- **Height:** ~80px
- **Contents:** 5 metric cards in a row
  1. **SPX** — current price + change, clicking opens ticker dropdown
  2. **Total GEX** — aggregate gamma exposure for selected ticker, per $1% move
  3. **Total DEX** — delta exposure, positive = bullish delta positioning
  4. **Total VEX** — vega exposure, high = big IV sensitivity
  5. **Gamma Regime** — computed bull/bear/neutral badge based on net GEX sign + magnitude
- **Color coding:** Green for positive GEX (market-making sells vol → calmer), red for negative GEX (market-making buys vol → choppier)
- **Data refresh:** Polls every 60 seconds, shows "LIVE" indicator

### Widget 2: Gamma Profile Chart
- **Position:** Below metrics bar, full width
- **Height:** ~400px
- **Contents:**
  - Vertical bar chart: x-axis = strikes, y-axis = net GEX
  - Bars colored green (positive GEX, support) / red (negative GEX, resistance)
  - Current price vertical dashed line
  - Annotated floor zone (green shaded area below price with text label)
  - Annotated ceiling zone (red shaded area above price with text label)
  - Toggle to overlay DEX and VEX profiles
- **Canvas implementation:** Pure Canvas 2D API (no libraries)
- **Responsiveness:** Resizes to container width, min 600px

### Widget 3: Floor/Ceiling Zone Cards (Beginner Mode)
- **Position:** Below chart, side by side (2-column grid)
- **Contents per card:**
  - Icon (shield for floor, barrier for ceiling)
  - Zone price range
  - Strength indicator (STRONG / MODERATE / WEAK) with color
  - Total GEX in zone
  - Human-readable one-liner explanation
- **Progressive disclosure:** Clicking a card expands to show the strikes in that zone

### Widget 4: Full Gamma Table (Advanced Mode)
- **Position:** Below zone cards (or replaces them in Advanced mode)
- **Collapsible:** "Advanced" section can be collapsed by default for beginners
- **Columns:** Strike, Calls GEX, Puts GEX, Net GEX, DEX, VEX, OI
- **Row highlighting:** Current price row highlighted, closest strikes bold
- **Sorting:** Click column header to sort
- **Export:** CSV download button

### Widget 5: Net GEX by Expiration
- **Position:** Below table or alongside it
- **Display:** Horizontal bar chart or pill cards showing net GEX per expiration bucket
- **Each bucket shows:** Net GEX in $, color indicator, plus a narrative chip

### Widget 6: Open Interest Heatmap
- **Position:** Below GEX by expiration
- **Display:** Grid heatmap with strikes on y-axis, expiration weeks on x-axis
- **Color intensity:** Proportional to OI concentration

### Widget 7: Unusual Options Flow
- **Position:** Bottom of page or right sidebar on wider screens
- **Display:** Compact table with key flow data
- **Sort by:** Premium (default), recency, sentiment

---

## 6. Viewport Responsiveness

| Breakpoint | Layout |
|------------|--------|
| ≥1280px | Full desktop — 5-column metrics bar, side-by-side zone cards, full-width chart |
| 1024–1279px | Desktop — chart full width, zone cards stack to single column at 50% |
| 768–1023px | Tablet — metrics bar wraps 3+2, chart still full width, gamma table horizontal scroll |
| <768px | Mobile — metrics stack vertically, zone cards full width, chart at 100% with smaller annotations, table scrolls |

---

## 7. Stale / Error / Loading States

| State | What Shows |
|-------|------------|
| **Loading** | Skeleton cards with animated shimmer for each widget position |
| **Stale data** | Amber banner: "Data from 3:15 PM — getting fresh data" + timestamp |
| **API error** | Red card: "Gamma data temporarily unavailable" with retry button |
| **No data for ticker** | Empty state: "No gamma data for this ticker yet" with suggestion to try SPX |
| **Auth expired** | Overlay: "Your session expired" with sign-in button (redirects to landing) |

---

## 8. Technical Architecture (Vanilla JS)

```
assets/
├── css/
│   ├── style.css              ← existing
│   └── maplegamma.css         ← NEW: all MapleGamma styles
├── js/
│   ├── app.js                 ← existing (register new routes)
│   ├── state.js               ← existing
│   ├── utils.js               ← existing
│   ├── router.js              ← existing
│   └── maplegamma.js          ← NEW: all MapleGamma logic
└── data/
    ├── latest.json            ← existing
    └── maplegamma-data.json   ← NEW: sample GEX/DEX/VEX data
```

---

## 9. Implementation Roadmap

### Phase 1 (This PR)
- Landing page as `#/maplegamma` route
- GEX/DEX/VEX dashboard as `#/mg` route
- All 7 widgets rendered with sample data
- Canvas gamma profile chart
- Beginner/Advanced mode toggle
- Responsive layout
- Dark/light theme support

### Phase 2 (Future)
- Real-time WebSocket data connection
- Drag-and-drop workspace customization
- Push alerts for gamma floor/ceiling breaks
- Portfolio gamma tracking
- Social sharing of gamma profiles
