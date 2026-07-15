# Data Sourcing & Vendor Footprint Report
**Unusual Whales OpenAPI Audit & Near-$0 Alternative Data Pipelines for MapleGamma**

---

## 1. Executive Summary
This engineering report audits the Unusual Whales (UW) public OpenAPI specification and changelog to identify their raw data sources, vendors, and processing methodologies. Additionally, it outlines a highly actionable blueprint to construct near-$0 or ultra-low-cost alternative data pipelines for **MapleGamma**.

By bypassing expensive commercial repackagers and going directly to public sources, open APIs, and retail broker plans, MapleGamma can ingest institutional-grade options, equity, dark pool, short interest, and political data at an estimated cost of **$10 to $29 per month** (down from Unusual Whales' Startup API fee of **$750/mo to $3,000/mo**).

---

## 2. ToS & Compliance Constraints
*   **Terms of Service Compliance:** Under the Unusual Whales Terms of Service, their API and platform data are strictly for personal, internal engineering use.
*   **Scope of this Document:** This document serves as an offline engineering audit and design document. Do not distribute raw specification files, credentials, or proprietary UW trade signals to MapleGamma subscribers. All alternative pipelines proposed in this report utilize entirely independent, public, or legally accessible retail data channels.

---

## 3. Data Domain Deconstruction & Alternative Pipelines

### Domain A: Options Flow & Options Tape (OPRA SIP Feed)
*   **Unusual Whales Source:** Consumes the consolidated **OPRA (Options Price Reporting Authority)** real-time feed. They compute Greeks, implied volatility (IV), and exponentially-weighted moving average (EWMA) NBBO in-house. They run rule engines to aggregate transactions into "Sweeps" (cross-market sweeps at or above ask / at or below bid) and "Blocks" (large single-exchange prints).
*   **Underlying Exchanges:** Cboe (XCBO), MIAX (MPRL), Philadelphia (XPHL), BOX, NYSE Arca, etc.
*   **MapleGamma near-$0 Alternative Pipeline:**
    1.  **Tradier Developer API ($0/mo):**
        *   *Access Model:* Open a free retail brokerage account with Tradier (no minimum balance, no monthly fees). This provides a Developer Sandbox and Production API Token.
        *   *Capabilities:* Offers unlimited real-time and delayed options chains, option quotes, historical contract bars, and basic pre-calculated Greeks.
    2.  **Theta Data ($10 - $15/mo for standard personal tier):**
        *   *Access Model:* Subscription plans designed for developers.
        *   *Capabilities:* Extremely high-speed, direct access to historical and real-time OPRA trade and quote data. Their standard API tier is highly reliable and affordable.
    3.  **In-House Flow Engine Implementation ($0):**
        *   To replicate "Unusual Flow", MapleGamma can stream individual trade prints from Tradier/Theta Data and run a simple rule-matching algorithm:
            *   **Block Trade Filter:** Any trade where contract size $\ge 500$ or total premium $\ge \$50,000$.
            *   **Sweep Trade Filter:** Detect multiple individual prints on the same contract within the same millisecond timestamp across different exchange codes (e.g. XCBO, MPRL, XPHL) where the cumulative size is large.
            *   **Sentiment/Side Classification (Lee-Ready Algorithm):**
                *   If $\text{Trade Price} > \text{NBBO Midpoint}$, tag as **Ask Side / Buy** (Bullish for Calls, Bearish for Puts).
                *   If $\text{Trade Price} < \text{NBBO Midpoint}$, tag as **Bid Side / Sell** (Bearish for Calls, Bullish for Puts).
                *   If $\text{Trade Price} == \text{NBBO Midpoint}$, run a *Tick Test*: compare with the previous trade's price. If price increased, tag as Ask Side; if it decreased, tag as Bid Side.

---

### Domain B: Dark Pools & Off-Lit Trades
*   **Unusual Whales Source:** FINRA **TRFs (Trade Reporting Facilities)**. When trades occur off-exchange (in dark pools, crossing networks, or internalizers), broker-dealers must report them to a FINRA TRF within 10 seconds.
*   **MapleGamma near-$0 Alternative Pipeline:**
    1.  **Tiingo Stock Trade API ($10/mo):**
        *   *Capabilities:* Tiingo provides individual real-time trade prints from the consolidated tape, which includes all off-exchange (TRF/dark pool) trades with sub-second delay. This is an incredibly cost-effective way to get raw dark pool data.
    2.  **Polygon.io ($29/mo Starter Plan):**
        *   *Capabilities:* Ingests the full consolidated stock tape.
        *   *Dark Pool Filtering:* Identify TRF prints by checking the exchange identifier. In Polygon's API, the exchange code `"D"` (FINRA Alternative Display Facility / TRF) represents off-exchange/dark pool trades.
        *   *Block Print Identifier:* Filter exchange `"D"` trades where `size >= 10,000` shares or `value >= $200,000` to flag dark pool blocks.
    3.  **FINRA OTC Transparency Portal ($0/mo):**
        *   *Capabilities:* FINRA publishes daily and weekly aggregate OTC volume reports by ticker for free. If real-time monitoring is not required for daily newsletters, a Python script can auto-download these reports to track institutional dark pool concentrations.

---

### Domain C: GEX (Gamma Exposure) & Market Maker Greeks
*   **Unusual Whales Source:** Calculated entirely in-house using the standard Black-Scholes-Merton model applied to OPRA options chains and daily Open Interest (OI) files.
*   **MapleGamma near-$0 Alternative Pipeline:**
    *   **In-House Math Computations ($0/mo):**
        *   Do not buy pre-calculated GEX. You can calculate it directly using Python (`numpy`, `scipy`).
        *   *Step 1:* Ingest options chain (strike $K$, expiration $T$, bid, ask, open interest $OI$, spot price $S$) from Tradier or Theta Data.
        *   *Step 2:* Calculate the risk-free rate $r$ (using the 3-Month Treasury Yield, accessible for free from FRED) and dividend yield $q$ (scraped or from company profile).
        *   *Step 3:* Solve for Implied Volatility ($\sigma$) using a Newton-Raphson solver on the Black-Scholes equation until theoretical price matches the option midpoint.
        *   *Step 4:* Compute option Gamma ($\Gamma$):
            $$d_1 = \frac{\ln(S/K) + (r - q + \sigma^2 / 2) T}{\sigma \sqrt{T}}$$
            $$\Gamma = \frac{e^{-q T} \cdot \phi(d_1)}{S \cdot \sigma \sqrt{T}}$$
            *(where $\phi(x)$ is the standard normal probability density function)*.
        *   *Step 5:* Compute Dollar Gamma Exposure (GEX) assuming market makers are short calls and long puts:
            $$\text{GEX}_{\text{Call}} = \Gamma \times OI \times 100 \times S^2 \times 0.01$$
            $$\text{GEX}_{\text{Put}} = -\Gamma \times OI \times 100 \times S^2 \times 0.01$$
            $$\text{Total GEX per Strike} = \text{GEX}_{\text{Call}} + \text{GEX}_{\text{Put}}$$
        *   *Step 6:* Aggregate total GEX across all strikes to find:
            *   **Zero Gamma Level:** The underlying stock price where net gamma shifts from positive to negative (volatility trigger).
            *   **Call Wall:** Strike with the maximum positive GEX.
            *   **Put Wall:** Strike with the maximum negative GEX.

---

### Domain D: Short Interest, Daily Short Volume, & Failures to Deliver (FTD)
*   **Unusual Whales Source:** Pulls from FINRA's semi-monthly reporting schedule, SEC FOIA FTD files, and daily short sale files.
*   **MapleGamma near-$0 Alternative Pipeline:**
    1.  **SEC Failures to Deliver (FTD) Pipeline ($0/mo):**
        *   *Raw Source:* SEC publishes FTD data twice a month on a 15-day delay in flat text files.
        *   *Automation Script:*
            ```python
            import requests, zipfile, io
            # Fetch twice-monthly FTD zip file directly from SEC
            url = "https://www.sec.gov/files/data/frequently-requested-records/failures-to-deliver/cnsfails202606a.zip" # Example url pattern
            headers = {"User-Agent": "MapleGamma Research/1.0 (contact@maplegamma.com)"}
            r = requests.get(url, headers=headers)
            z = zipfile.ZipFile(io.BytesIO(r.content))
            z.extractall("/tmp/sec_ftd/")
            ```
    2.  **FINRA Daily Short Sale Volume ($0/mo):**
        *   *Raw Source:* FINRA publishes daily short sale transaction volumes across their ADF and TRF exchanges for free.
        *   *Pipeline:* Download text files daily from `https://www.finra.org/filing-reporting/regulatory-filing-systems/short-sale-volume-data` or via python requests.
    3.  **FINRA Official Short Interest ($0/mo):**
        *   *Raw Source:* FINRA publishes the official short interest tables twice a month (reported by broker-dealers) on their public regulatory site.

---

### Domain E: Congressional & Politician Trades (STOCK Act PTRs)
*   **Unusual Whales Source:** Crawls and OCR-parses the Senate Public Disclosure Portal and the House Clerk Financial Disclosure database.
*   **MapleGamma near-$0 Alternative Pipeline:**
    1.  **House & Senate Stock Watcher APIs ($0/mo):**
        *   These are community-led, open-source crawlers that automatically parse PDF and XML filings and expose them as clean JSON feeds.
        *   *Senate Feed:* `https://senatestockwatcher.com/api/`
        *   *House Feed:* `https://housestockwatcher.com/api/`
        *   *Implementation:* Poll these endpoints daily to extract politician trades (ticker, transaction date, range, and name) at zero cost.

---

### Domain F: Institutional Holdings (13F) & Insider Trading (Form 4)
*   **Unusual Whales Source:** Scrapes SEC EDGAR RSS feed for real-time Form 4 and Form 13F-HR filings.
*   **MapleGamma near-$0 Alternative Pipeline:**
    1.  **SEC EDGAR REST API & RSS Feeds ($0/mo):**
        *   The SEC provides a highly structured REST API for EDGAR.
        *   *Insider Trades (Form 4):* Monitor the real-time SEC RSS feed `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&XML=yes` to detect insider filings. Form 4 has been submitted as a structured XML since 2003, making it trivial to parse in Python:
            ```python
            import xml.etree.ElementTree as ET
            # Parse Form 4 XML to extract:
            # - rptOwnerName (Insider Name)
            # - signatureName (Relationship)
            # - transactionCode (S = Sell, P = Buy)
            # - transactionShares (Quantity)
            # - transactionPricePerShare (Price)
            ```
        *   *Institutional Holdings (Form 13F):* SEC 13F-HR reports are submitted quarterly in standardized XML format. You can extract holdings, share counts, and values directly from EDGAR submissions using CIK codes.

---

### Domain G: Crypto Whale Transactions
*   **Unusual Whales Source:** Monitoring public blockchain network transfers.
*   **MapleGamma near-$0 Alternative Pipeline:**
    1.  **Whale Alert API (Free Tier - $0/mo):**
        *   Offers a completely free tier for developers to monitor large transaction alerts (> $1M) across major chains (BTC, ETH, XRP, TRX).
    2.  **Public Blockchain RPCs + Web3.py ($0/mo):**
        *   Use free RPC endpoints from providers like **Infura**, **Alchemy**, or **Ankr**.
        *   Write a simple python script to listen for the `Transfer(address,address,uint256)` event on ERC-20 smart contracts for stablecoins (USDT: `0xdac17f958d2ee523a2206206994597c13d831ec7`, USDC: `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`):
            ```python
            # Python ERC-20 whale filter snippet
            transfer_event_filter = contract.events.Transfer.create_filter(fromBlock='latest')
            for event in transfer_event_filter.get_new_entries():
                amount = event['args']['value'] / (10**decimals)
                if amount >= 500000: # $500k USD threshold
                    print(f"Whale Transfer Detected: {amount} tokens!")
            ```

---

### Domain H: FDA Calendar (Clinical Trials & Biotech PDUFA Dates)
*   **Unusual Whales Source:** FDA advisory announcements, BioPharmCatalyst calendars, and NIH registries.
*   **MapleGamma near-$0 Alternative Pipeline:**
    1.  **ClinicalTrials.gov API ($0/mo):**
        *   The National Institutes of Health (NIH) provides a completely free, public REST API to query drug trials, completion dates, and study phases.
    2.  **FDA.gov Advisory Committee Calendar ($0/mo):**
        *   Scrape public announcements on the FDA advisory calendar page to retrieve upcoming drug review meeting schedules.
    3.  **BioPharmCatalyst Web Scraper ($0/mo):**
        *   Write a Python/Playwright script to parse the public BioPharmCatalyst free list to extract PDUFA and phase 3 clinical trial readout schedules.

---

## 4. Alternative Cost Matrix (Comparison)

| Data Domain | Unusual Whales API (Paid Tiers) | Proposed MapleGamma Alternative | Alternative Monthly Cost | Savings |
| :--- | :--- | :--- | :--- | :--- |
| **Options Flow / Chains** | Startup: $750/mo<br>Kafka: $3,000/mo | **Tradier Developer API** + In-house Rule Engine<br>or **Theta Data** | **$0 to $15/mo** | **98.0% - 100%** |
| **Dark Pools (Off-lit)** | Startup / Advanced API | **Tiingo Stock API** or **Polygon.io Starter** | **$10 to $29/mo** | **96.1% - 98.6%** |
| **GEX / Spot Exposure** | Advanced / Enterprise | In-house Black-Scholes Solver + Tradier OI Data | **$0/mo** | **100%** |
| **Short Interest / FTDs** | Short API Add-on | **SEC FTD zip files** + **FINRA Daily Short files** | **$0/mo** | **100%** |
| **Congressional Trades** | Unusual Trades Scope | **Senate & House Stock Watcher APIs** | **$0/mo** | **100%** |
| **Institutional & Insiders** | Advanced / Enterprise | **SEC EDGAR REST API & RSS Feeds** | **$0/mo** | **100%** |
| **Crypto Whale Trades** | Digital Currencies API | **Whale Alert API (Free)** or **Web3.py + Free RPC** | **$0/mo** | **100%** |
| **FDA Biotech Calendar** | Market Intel API | **ClinicalTrials.gov API** + FDA Calendars | **$0/mo** | **100%** |
| **Total Pipeline Cost** | **$750 to $3,000+/mo** | **Tradier + Tiingo Stock + Public Feeds** | **$10 to $29/mo** | **99.1% - 99.7%** |

---

## 5. Recommended MapleGamma Architecture
Below is the recommended low-overhead architecture for MapleGamma to ingest, process, and store these feeds using SQLite or ClickHouse as the datastore:

```
[ Tradier / Theta Data (OPRA) ] ──> [ Options Flow Parser (Sweeps & Blocks) ] ──┐
                                                                              │
[ Tiingo / Polygon (TRF Prints) ] ─> [ Dark Pool Block Filter (D-Exchange) ] ───┼─> [ SQLite / ClickHouse ]
                                                                              │
[ SEC EDGAR & RSS (Form 4 / 13F) ] ──> [ SEC XML Parser (Insiders & Inst) ] ───┤          │
                                                                              │          ▼
[ House/Senate Stock Watcher ] ──────> [ Congressional Trade Sync ] ───────────┘    [ MapleGamma ]
                                                                                   [ GEX Analytics ]
                                                                                   [ & Dashboards  ]
```

This decentralized ingestion architecture ensures that MapleGamma remains highly scalable, runs on zero-cost or extremely low-cost APIs, and operates in full compliance with data supplier guidelines.
