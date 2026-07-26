#!/usr/bin/env python3
"""
generate-screener-data.py — Stock screener data generator.

Fetches 100 tickers via yfinance, computes technical metrics (RSI, SMA),
applies multi-factor scoring (1-10), and writes data/screener-data.json.

Runs daily via cron (~6:30 AM ET). Depends on: yfinance, pandas, numpy.
"""

import json
import numpy as np
import pandas as pd
import yfinance as yf
import time
import os
import sys
import fcntl
from datetime import datetime, timezone

# pipeline_runtime lives alongside this script on the Pi.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline_runtime import atomic_write_json

# ── Ticker Universe (500+ tickers) ──────────────────────────────
# CURATED_UNIVERSES are the hand-maintained watchlists this scan has always
# covered. They are NOT index membership — the "S&P 500" entries below are a
# partial, manually-typed sample, which is exactly why the broad indices are
# loaded from universe_constituents.json instead (fetched from a named source
# and dated). Leaving these in place keeps the default scan byte-identical to
# what the Pi cron produced before multi-index support was added.
CURATED_UNIVERSES = {
    "S&P 500": [
        "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRK-B","JPM","V",
        "JNJ","WMT","MA","PG","UNH","HD","DIS","NFLX","ADBE","CRM",
        "AMD","INTC","BAC","PFE","KO","MCD","NKE","BA","CAT","GE",
        "IBM","ORCL","CSCO","QCOM","TXN","AMGN","GILD","SBUX","LOW","TGT",
        "CMG","LULU","MDLZ","COST","ABNB","UBER","NOW","ISRG","BKNG","BLK",
        "AXP","GS","MS","SCHW","C","CB","MMC","AIG","MET","PRU",
        "TMO","DHR","ABT","MDT","SYK","BSX","EW","ILMN","VRTX","REGN",
        "HON","UPS","RTX","LMT","GD","NOC","WM","RSG","COP","EOG",
        "SLB","HAL","CVX","XOM","OXY","MPC","PSX","VLO","DUK","SO",
        "NEE","AEP","EXC","SRE","PEG","D","CCI","AMT","PLD","EQIX",
        "SPG","WELL","O","DLR","AVB","MAA","EQR","ESS","UDR","INVH",
        "SBAC","CSGP","CBRE","IRM","HST","DOC","VTR","PEAK","OHI","MPW",
    ],
    "S&P 500 (continued)": [
        "ADP","PAYX","CTAS","ROP","ECL","WAT","MKC","SJM","CPB","GIS",
        "K","KHC","CAG","HRL","TSN","MO","PM","BTI","STZ","DEO",
        "BF-B","CL","CHD","PG","KVUE","EL","NCLH","CCL","RCL","DAL",
        "AAL","UAL","LUV","SAVE","ALK","JBLU","CPRT","GPC","AZO","ORLY",
        "TSCO","ROST","DG","DLTR","WBA","CVS","CI","HUM","CNC","MOH",
        "ELV","ANTM","UNM","AFL","PFG","SLM","NAVI","OMF","SYF","COF",
        "DFS","ALLY","WFC","USB","PNC","TFC","KEY","RF",
        "HBAN","FITB","STT","NTRS","CBOE","CME","ICE","MCO","MSCI",
        "NDAQ","FDS","AJG","BRO","WTW","AON","MKL","TRV","ALL",
        "PGR","L","THG","AFG","ERIE","KNSL","RLI","AGO","RGA",
    ],
    "S&P 500 (continued 2)": [
        "A","AEE","AES","AFL","ALB","ALGN","ALK","ALL","ALLE","AMAT",
        "AMCR","AME","ANET","ANSS","AOS","APA","APD","APH","ARE","ATO",
        "AVY","AWK","AXON","AZO","BALL","BAX","BBY","BEN","BF-B","BIIB",
        "BIO","BK","BKNG","BKR","BLDR","BR","BRO","BWA","BX","BXP",
        "CAG","CAH","CARR","CBOE","CBRE","CCI","CCL","CDNS","CDW","CE",
        "CF","CFG","CHD","CHRW","CHTR","CINF","CL","CLX","CMA","CMG",
        "CMI","CMS","CNC","CNP","COF","COO","CPB","CPRT","CPT","CRL",
        "CSGP","CSL","CSX","CTAS","CTLT","CTSH","CTVA","CUBE","CVS","D",
        "DAL","DAY","DD","DE","DFS","DG","DGX","DHI","DHR","DIS",
        "DLR","DLTR","DOC","DOV","DOW","DRE","DRI","DTE","DUK","DVA",
        "DVN","DXC","EA","EBAY","ECL","ED","EFX","EG","EIX","EL",
        "EMN","EMR","ENPH","EOG","EPAM","EQT","ERIE","ES","ESS","ETN",
        "ETR","EVRG","EW","EXC","EXPD","EXPE","EXR","F","FANG","FAST",
        "FCX","FDS","FFIV","FIS","FITB","FMC","FNF","FOX","FOXA","FRT",
        "FSLR","FTNT","FTV","GD","GE","GEHC","GEN","GILD","GIS","GL",
        "GLW","GM","GNRC","GOOG","GOOGL","GPC","GPN","GRMN","GS","GWW",
        "HAL","HAS","HBAN","HCA","HD","HES","HIG","HII","HLT","HOLX",
        "HON","HPE","HRL","HSIC","HST","HSY","HUBB","HUM","IBM","ICE",
        "IDXX","IEX","IFF","INCY","IP","IPG","IQV","IR","IRM","ISRG",
        "IT","ITW","IVZ","J","JBHT","JKHY","JNPR","JPM","K","KDP",
        "KEY","KEYS","KHC","KIM","KKR","KLAC","KMB","KMI","KMX","KO",
        "KR","KVUE","L","LDOS","LEN","LH","LHX","LII","LIN","LKQ",
        "LLY","LMT","LNT","LOW","LUV","LVS","LW","LYB","LYV","MA",
        "MAA","MAR","MAS","MCD","MCHP","MCK","MCO","MKC","MKTX","MLM",
        "MMC","MMM","MNST","MO","MOH","MOS","MPC","MPWR","MRK","MRNA",
        "MS","MSCI","MSI","MTB","MTCH","MTD","MU","NCLH","NDAQ","NDSN",
        "NEE","NEM","NFLX","NI","NKE","NOC","NOV","NRG","NSC","NTAP",
        "NTRS","NUE","NVDA","NVR","NXPI","O","ODFL","OGE","OKE","OMC",
        "ON","ORCL","ORLY","OTIS","OXY","PARA","PAYC","PAYX","PCAR","PCG",
        "PEG","PEP","PFE","PFG","PG","PGR","PH","PHM","PKG","PLD",
        "PLTR","PM","PNC","PNR","PNW","PODD","POOL","PPG","PPL","PRU",
        "PSA","PSX","PTC","PVH","QRVO","RCL","REG","REGN","RF","RJF",
        "RL","RMD","ROK","ROL","ROP","ROST","RS","RSG","RTX","RVTY",
        "SJM","SNA","SBAC","SBUX","SCHW","SHW","SJM","SLB","SLG","SNA",
        "SNAP","SO","SPG","SPGI","SRE","STLD","STT","STX","STZ","SWK",
        "SWKS","SYF","SYK","SYY","T","TAP","TECH","TEL","TER","TFC",
        "TFX","TGT","TJX","TMO","TMUS","TPR","TRGP","TROW","TRV","TSCO",
        "TSLA","TSN","TTC","TTWO","TXN","TXT","TYL","UA","UAA","UAL",
        "UBER","UDR","UHS","ULTA","UNH","UNP","UPS","URI","USB","V",
        "VFC","VICI","VLO","VLTO","VMC","VRSK","VRSN","VRTX","VST","VTR",
        "VZ","WAB","WAT","WBA","WBD","WDC","WEC","WELL","WFC","WHR",
        "WM","WMB","WMT","WRB","WST","WTW","WU","WY","WYNN","XEL",
        "XOM","XYL","YUM","ZBRA","ZION","ZTS",
    ],
    "TSX 60": [
        "XIU.TO","TD.TO","RY.TO","BNS.TO","BMO.TO","CM.TO","NA.TO","SLF.TO","MFC.TO","GWO.TO",
        "SHOP.TO","ENB.TO","TRP.TO","PPL.TO","KEY.TO","IPL.TO","GEI.TO","FTS.TO","H.TO","EMA.TO",
        "CNQ.TO","SU.TO","CVE.TO","IMO.TO","TOU.TO","ARX.TO","VRN.TO","CPG.TO","CNR.TO","CP.TO",
        "TFII.TO","WCN.TO","RCI-B.TO","T.TO","BCE.TO","QBR-B.TO","TRI.TO","GIB-A.TO","L.TO","ATD-B.TO",
        "DOL.TO","WN.TO","MRU.TO","LNF.TO","CTC-A.TO","SAP.TO","CSU.TO","KXS.TO","OTEX.TO","DSG.TO",
        "AQN.TO","BEPC.TO","BLX.TO","HBM.TO","IVN.TO","AGI.TO","WPM.TO","FNV.TO","CCO.TO","TECK-B.TO",
    ],
    "Tech & Growth": [
        "PLTR","MSTR","SNOW","DDOG","CRWD","PANW","ZS","NET","OKTA","ESTC",
        "MDB","MRNA","SQ","AFRM","HOOD","COIN","RIVN","LCID","CHWY","DASH",
        "RDDT","CVNA","DKNG","TTD","WDAY","HUBS","ZM","PINS","SNAP","U",
        "PATH","CFLT","GTLB","FROG","SMAR","DOMO","BILL","TOST","FOUR","PYPL",
        "RBLX","SE","MELI","CPNG","WISE","STNE","NU","SOFI","UPST","LC",
        "RKLB","ASTS","GSAT","IRDM","SPCE","ASTS","IONQ","RGTI","QUBT","QBTS",
        "MARA","CLSK","RIOT","WULF","CIFR","HUT","IREN","BTBT","CAN","HIVE",
    ],
    "High Dividend": [
        "T","VZ","PFE","ABBV","MRK","CVX","XOM","KO","PEP","JNJ",
        "O","MAIN","AGNC","STAG","WPC","ADC","BRX","FRT","KIM","REG",
        "EPR","LAMR","GLPI","VICI","WY","IRM","SBRA","DOC","PEAK","OHI",
        "MPW","HR","WELL","VTR","EXR","PSA","CUBE","NSA","UDR","EQR",
        "AVA","BKH","ALE","PNW","POR","SJW","CWT","AWR","MSEX","YORW",
        "ENB","TRP","PPL","FTS","EMA","H","KEY","GEI","IPL","ACO-X",
        "PD","BIP-UN","GRT-UN","REI-UN","SRU-UN","CAR-UN","AP-UN","HR-UN","SOT-UN","DIR-UN",
    ],
    "Fixed Income & Commodities": [
        "TLT","IEF","SHY","AGG","BND","BIV","BSV","VCIT","VCSH","MUB",
        "LQD","HYG","JNK","EMB","PCY","BWX","WIP","TIP","VTIP","STIP",
        "GLD","SLV","IAU","SGOL","PHYS","PSLV","USO","UNG","DBC","GSG",
        "DBA","CORN","WEAT","SOYB","LIT","REMX","URA","NLR","PICK","XME",
        "KRE","KBE","XBI","IBB","IYR","XLRE","VNQ","ICF","SCHH","REET",
        "IBIT","FBTC","BITB","GBTC","ARKB","BITO","BTF","MAXI","SATO","WGMI",
    ],
}

# ── Index membership ───────────────────────────────────────────
# Broad-index constituents come from pi-scripts/universe_constituents.json,
# refreshed by fetch_universe_constituents.py from Wikipedia / Nasdaq /
# Vanguard. They are deliberately NOT typed into this file: membership changes
# several times a year, and a stale hand-written list turns into delisted
# symbols (counted as failed_count) or symbols reassigned to another company.
#
# Absence of the cache is not an error — the scan falls back to the curated
# lists alone, which is what it did before this existed.

CONSTITUENTS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "universe_constituents.json")


def load_index_constituents(path=CONSTITUENTS_PATH):
    """Return ({index label: [symbol, ...]}, {index label: source metadata})."""
    try:
        with open(path, encoding="utf-8") as handle:
            cache = json.load(handle)
    except (OSError, ValueError) as exc:
        print(f"No index constituent cache ({type(exc).__name__}) — curated lists only.",
              file=sys.stderr)
        return {}, {}

    members, sources = {}, {}
    for label, entry in (cache.get("indices") or {}).items():
        symbols = []
        for member in entry.get("members") or []:
            symbol = str(member.get("symbol") or "").strip().upper()
            if symbol:
                symbols.append(symbol)
        if not symbols:
            continue
        members[label] = symbols
        sources[label] = {
            "source_url": entry.get("source_url"),
            "source_note": entry.get("source_note"),
            "as_of": entry.get("as_of"),
            "fetched_at": entry.get("fetched_at"),
            "member_count": len(symbols),
        }
    return members, sources


def canonical_universe(label):
    """Collapse the "(continued)" splits — they are one index, not three.

    CURATED_UNIVERSES chunks the S&P 500 sample across three keys purely
    because of how the lists were pasted in. The site's universe filter has
    always had to paper over that with a startsWith("S&P 500") special case;
    the multi-membership array below carries the collapsed name so a future
    consumer does not have to.
    """
    return "S&P 500" if str(label).startswith("S&P 500") else label


INDEX_UNIVERSES, INDEX_SOURCES = load_index_constituents()

# Multi-membership. A ticker is routinely in more than one universe — every
# Nasdaq-100 name is also in the S&P 500, and the S&P 600 overlaps the Russell
# 2000 heavily — so a single-valued field cannot express membership without
# making one of the two filters return near-zero rows.
#
# Where a fetched index list exists it is AUTHORITATIVE for that index, and the
# curated sample of the same name contributes nothing to it. The curated "S&P
# 500" lists were typed by hand and have rotted: 74 of their 490 symbols are no
# longer in the index (ZION was removed in 2024, CAG in 2026, others renamed or
# delisted). Letting them keep tagging themselves "S&P 500" would put 74 wrong
# answers behind a filter whose whole purpose is to say what is in the index.
# They stay in the scan and remain visible under "All Universes"; they just no
# longer claim a membership they do not have.
_AUTHORITATIVE = set(INDEX_UNIVERSES)

# The source is tracked explicitly rather than inferred from the label: the
# curated dict's first chunk is keyed "S&P 500", the same string the fetched
# index uses, so `label in INDEX_UNIVERSES` cannot tell the two apart and the
# curated chunk would sail through the guard below.
TICKER_UNIVERSES = {}
for _from_index, _source in ((False, CURATED_UNIVERSES), (True, INDEX_UNIVERSES)):
    for _label, _tickers in _source.items():
        _canonical = canonical_universe(_label)
        if not _from_index and _canonical in _AUTHORITATIVE:
            continue  # curated sample of an index we have a real list for
        for _t in _tickers:
            TICKER_UNIVERSES.setdefault(_t, set()).add(_canonical)

# Singular `universe` is kept for backward compatibility with consumers written
# against the old shape (the site falls back to it when `universes` is absent).
# First-wins over the curated lists, exactly as before.
TICKER_UNIVERSE = {}
for _universe, _tickers in CURATED_UNIVERSES.items():
    for _t in _tickers:
        TICKER_UNIVERSE.setdefault(_t, _universe)


def resolve_scan_set(selected=None, added=None):
    """Return (ordered tickers, canonical universe labels) for this run.

    `selected` is None for the default scan — the curated watchlists only,
    which is what the unattended Pi cron has always run. Naming universes
    explicitly (--universes) is opt-in because the broad indices are large:
    Russell 2000 alone adds ~2,000 symbols to a serial, rate-limited fetch
    loop that already takes 5-10 minutes for ~660.

    `added` (--add-universes) unions the named universes onto the default set
    instead of replacing it. That distinction matters operationally: the output
    file is the WHOLE screener, not a per-universe shard, so a --universes run
    naming only the new indices would drop every name it did not name — 563 of
    the 716 currently scanned. Adding an index to the site is a union, not a
    substitution, and this is the flag that says so.
    """
    if added:
        base, base_labels = resolve_scan_set(None)
        extra, extra_labels = resolve_scan_set(added)
        tickers = list(dict.fromkeys(base + extra))
        labels = list(dict.fromkeys(base_labels + extra_labels))
        return tickers, labels

    if selected is None:
        chosen = list(CURATED_UNIVERSES.items())
    else:
        chosen = []
        for name in selected:
            canonical = canonical_universe(name)
            # A fetched index list wins outright — asking to scan "the S&P 500"
            # must mean the index, not the 490-name hand-typed sample of it
            # (which is 74 names out of date). Only when no fetched list exists
            # do the curated chunks answer, and then ALL chunks sharing the
            # canonical name do, since the sample is split across three keys.
            if canonical in INDEX_UNIVERSES:
                matched = [(canonical, INDEX_UNIVERSES[canonical])]
            else:
                matched = [(key, members) for key, members in CURATED_UNIVERSES.items()
                           if canonical_universe(key) == canonical]
            if not matched:
                known = sorted(set(map(canonical_universe, CURATED_UNIVERSES)) | set(INDEX_UNIVERSES))
                raise SystemExit(f"Unknown universe {name!r}. Known: {known}")
            chosen.extend(matched)

    tickers, labels, seen = [], [], set()
    for label, members in chosen:
        canonical = canonical_universe(label)
        if canonical not in labels:
            labels.append(canonical)
        for ticker in members:
            if ticker not in seen:
                tickers.append(ticker)
                seen.add(ticker)
    return tickers, labels


# ── Metrics Computation ────────────────────────────────────────


# ── Rate limiting ──────────────────────────────────────────────
# yfinance publishes no quota, and the practical limit is well inside what a
# multi-index scan needs. Measured 2026-07-26 on a 1,727-ticker run: the first
# 1,272 tickers succeeded at 0.1s spacing (~2,500 HTTP calls), then Yahoo began
# refusing with YFRateLimitError and refused EVERY ONE of the remaining 455. A
# probe 20 minutes later was still refused.
#
# The old loop treated a refusal like any other error — print, count as failed,
# move on — so one trip silently turned into 455 "failures" and an output file
# that claimed to have scanned indices it had barely touched. Sleeping longer
# alone does not fix that; the scan has to NOTICE it is being throttled, wait,
# and stop rather than burn through the rest.

class RateLimited(RuntimeError):
    """Yahoo refused the request because we are over its quota."""


# The exception type lives in yfinance's internals and has moved between
# releases, so match on the name and message rather than importing it.
def _is_rate_limited(exc):
    return (
        'ratelimit' in type(exc).__name__.lower()
        or 'too many requests' in str(exc).lower()
        or 'rate limited' in str(exc).lower()
    )


# Yahoo's cool-off is minutes, not seconds. Escalating waits give it room to
# clear without the scan giving up on the first refusal.
RATE_LIMIT_BACKOFF = (60, 180, 420)


def _finite(v):
    """yfinance sometimes returns Infinity/NaN — JSON-encode those as null."""
    try:
        f = float(v)
        import math
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None

def fetch_ticker_data(ticker):
    """Fetch data for one ticker, compute metrics."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
    except Exception as e:
        if _is_rate_limited(e):
            raise RateLimited(str(e)) from e
        print(f"Error getting info for {ticker}: {type(e).__name__}: {e}", file=sys.stderr)
        return None

    try:
        ticker_name = info.get('shortName') or info.get('longName') or ticker

        # Get 1 year of daily data for technicals
        hist = t.history(period="1y")
        if hist.empty:
            return None
        # Flatten MultiIndex columns if present
        if isinstance(hist.columns, pd.MultiIndex):
            hist.columns = hist.columns.get_level_values(0)

        price = hist['Close'].iloc[-1]

        # RSI (14-day), Wilder's smoothing.
        # BUG FIX: this used to average gains/losses with a plain 14-bar
        # rolling mean, which is not the RSI Wilder defined and not what
        # TradingView/yfinance/any charting platform compute, so the number
        # shown here disagreed with RSI shown anywhere else. Wilder's method
        # is an exponential average with alpha = 1/period; with a full year
        # of history the ewm warm-up difference from the textbook recursive
        # form is negligible.
        delta = hist['Close'].diff()
        gain = delta.where(delta > 0, 0).ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
        loss = (-delta.where(delta < 0, 0)).ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
        rs = gain / loss
        last_rs = rs.iloc[-1]
        # BUG FIX: an RS of exactly 0 (no gains at all in the window — a
        # real, maximally-oversold RSI of 0) used to be excluded by
        # `last_rs != 0` and silently replaced by the same neutral fallback
        # used for missing data, so a displayed "50.0" could mean neutral,
        # unknown, or maximally oversold with no way to tell which. Now only
        # genuine missing data (NaN, i.e. not enough price history yet)
        # falls back, and it falls back to None/unknown rather than a fake
        # neutral reading; 0 and infinite RS both compute correctly through
        # the formula below (RSI 0 and RSI 100 respectively).
        if last_rs is not None and not np.isnan(last_rs):
            rsi = round(100 - (100 / (1 + last_rs)), 1)
        else:
            rsi = None

        # SMAs
        sma20 = round(hist['Close'].rolling(20).mean().iloc[-1], 2)
        sma50 = round(hist['Close'].rolling(50).mean().iloc[-1], 2)

        # Volume
        volume = int(hist['Volume'].iloc[-1])
        avg_vol = int(hist['Volume'].rolling(50).mean().iloc[-1])

        # 52-week high/low
        high_52w = round(hist['High'].rolling(252).max().iloc[-1], 2)
        low_52w = round(hist['Low'].rolling(252).min().iloc[-1], 2)

        # Change percent (last close vs previous close)
        change_pct = 0.0
        if len(hist) > 1:
            change_pct = round((hist['Close'].iloc[-1] / hist['Close'].iloc[-2] - 1) * 100, 2)

        # Dividend yield
        div_yield = info.get("dividendYield")
        if div_yield is not None:
            # yfinance now returns dividendYield already as a percent value
            # (e.g. 0.44 meaning 0.44%), not a fraction — the old *100 here
            # inflated every yield 100x (AAPL showed "35.0%" instead of 0.35%,
            # CI showed "221%" instead of 2.21%). No conversion needed.
            div_yield = round(div_yield, 2)
        else:
            div_yield = 0

        # Institution percentage
        inst_pct = info.get("heldPercentInstitutions")
        if inst_pct is not None:
            inst_pct = round(inst_pct * 100, 1)
        else:
            inst_pct = None
        # Add computed signals
        result = {
            "ticker": ticker,
            "name": ticker_name,
            # `universe` (singular) is the legacy single-valued field; the
            # site prefers `universes` and only falls back to this one.
            "universe": TICKER_UNIVERSE.get(ticker)
                        or (sorted(TICKER_UNIVERSES.get(ticker, ())) or ["Other"])[0],
            "universes": sorted(TICKER_UNIVERSES.get(ticker, ())),
            "price": round(price, 2),
            "change_pct": change_pct,
            "pe": _finite(info.get("trailingPE")),
            "forwardPe": _finite(info.get("forwardPE")),
            "marketCap": info.get("marketCap"),
            "divYield": div_yield,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "recommendation": info.get("recommendationKey"),
            "targetPrice": info.get("targetMeanPrice"),
            "beta": info.get("beta"),
            "volume": volume,
            "avgVolume": avg_vol,
            "rsi": rsi,
            "sma20": sma20,
            "sma50": sma50,
            "high52w": high_52w,
            "low52w": low_52w,
            "institutionPct": inst_pct,
            # Computed signals
            "above_sma20": bool(price > sma20),
            "above_sma50": bool(price > sma50),
            # NOTE (naming, not behavior): despite the "above_52w_high" name,
            # this is the percent the price sits BELOW the 52-week high (0 at
            # the high, larger the further under it) — and despite
            # "below_52w_low", that one is the percent ABOVE the 52-week low.
            # Every current consumer (compute_score()'s near_high/near_low
            # checks below, and the screener UI's w52 filter) already reads
            # them with this meaning, so the values are correct; only the
            # names invite a sign error in a future consumer. Renaming would
            # need a matching change in src/lib/schemas/screener.ts and the
            # UI, out of scope here — left as a documented trap instead.
            "above_52w_high_pct": round((1 - price / high_52w) * 100, 1) if high_52w else None,
            "below_52w_low_pct": round((price / low_52w - 1) * 100, 1) if low_52w else None,
            "volume_ratio": round(volume / avg_vol, 2) if avg_vol else 1.0,
        }
        # Replace NaN with None for valid JSON
        for k, v in result.items():
            if isinstance(v, float) and (v != v):  # NaN check (NaN != NaN)
                result[k] = None
            elif isinstance(v, float) and v == float('inf'):
                result[k] = None
            elif isinstance(v, float) and v == float('-inf'):
                result[k] = None
        return result
    except RateLimited:
        raise
    except Exception as e:
        if _is_rate_limited(e):
            raise RateLimited(str(e)) from e
        print(f"Error fetching {ticker}: {type(e).__name__}: {e}", file=sys.stderr)
        return None


# ── Scoring Computation ────────────────────────────────────────

def compute_score(data):
    """Compute score 1-10 based on backtest strategies."""
    score = 5  # neutral baseline
    reasons = []

    # 1. RSI Strategy: oversold bounce (30-40) = bullish, overbought (70+) = bearish
    rsi_val = data.get('rsi')
    if rsi_val is not None:
        if rsi_val < 35:
            score += 2
            reasons.append("oversold_rsi")
        elif rsi_val < 45:
            score += 1
            reasons.append("rsi_dip")
        elif rsi_val > 75:
            score -= 2
            reasons.append("overbought_rsi")
        elif rsi_val > 65:
            score -= 1
            reasons.append("extended_rsi")

    # 2. SMA Crossover: price above both = bullish
    if data.get('above_sma20') and data.get('above_sma50'):
        score += 1
        reasons.append("above_ma")
    elif data.get('above_sma20') is False and data.get('above_sma50') is False:
        score -= 1
        reasons.append("below_ma")

    # 3. Volume Surge: volume > 1.5x average = momentum
    vol_ratio = data.get('volume_ratio')
    if vol_ratio is not None and vol_ratio > 1.5:
        score += 1
        reasons.append("volume_surge")

    # 4. Near 52w High: price within 5% of 52w high = strength
    near_high = data.get('above_52w_high_pct')
    near_low = data.get('below_52w_low_pct')
    if near_high is not None and near_high < 5:
        score += 1
        reasons.append("near_high")
    elif near_low is not None and near_low < 5:
        score -= 1
        reasons.append("near_low")

    # 5. Value: P/E < 20 and positive = undervalued
    pe_val = data.get('pe')
    if pe_val is not None:
        try:
            pe_val = float(pe_val)
            if 0 < pe_val < 15:
                score += 1
                reasons.append("value_pe")
            elif pe_val > 30:
                score -= 1
                reasons.append("premium_pe")
        except (ValueError, TypeError):
            pass

    # 6. Analyst recommendation (yfinance returns lowercase, e.g. "buy",
    # "strong_buy" — normalize before comparing). str() guards the case where
    # the field arrives as a non-string; `or ''` alone would not.
    rec = str(data.get('recommendation') or '').upper()
    if rec in ('BUY', 'STRONG_BUY'):
        score += 1
        reasons.append("analyst_buy")
    elif rec in ('SELL', 'STRONG_SELL'):
        score -= 1
        reasons.append("analyst_sell")

    # Clamp 1-10
    score = max(1, min(10, score))

    return score, reasons


def compute_universe_coverage(scan_tickers, results):
    """How much of each universe this run actually holds.

    `expected` counts members of that universe in the resolved scan set — what
    the run set out to fetch — and `scanned` counts how many of them came back.
    Both are derived from the same membership map the rows carry, so the site
    can state coverage as a fraction rather than inferring completeness from
    the mere presence of a label.
    """
    expected, scanned = {}, {}
    have = {t['ticker'] for t in results if t.get('ticker')}
    for ticker in scan_tickers:
        for universe in TICKER_UNIVERSES.get(ticker, ()):
            expected[universe] = expected.get(universe, 0) + 1
            if ticker in have:
                scanned[universe] = scanned.get(universe, 0) + 1
    return {
        universe: {
            "expected": count,
            "scanned": scanned.get(universe, 0),
            # Members the cache knows about, which can exceed `expected` when
            # the run did not ask for the whole index.
            "known_members": len(INDEX_UNIVERSES.get(universe, ())) or None,
        }
        for universe, count in sorted(expected.items())
    }


# ── Market Summary ─────────────────────────────────────────────

def compute_market_summary(tickers):
    """Aggregate statistics across all scanned tickers."""
    prices = [t['price'] for t in tickers if t.get('price')]
    changes = [t['change_pct'] for t in tickers if t.get('change_pct') is not None]
    scores = [t['score'] for t in tickers if t.get('score')]

    sectors = {}
    for t in tickers:
        s = t.get('sector') or 'Unknown'  # sector can be present-but-None (ETFs)
        if s not in sectors:
            sectors[s] = {'count': 0, 'avg_change': 0}
        sectors[s]['count'] += 1

    # Compute average change per sector
    sector_changes = {}
    for t in tickers:
        s = t.get('sector') or 'Unknown'
        if s not in sector_changes:
            sector_changes[s] = []
        if t.get('change_pct') is not None:
            sector_changes[s].append(t['change_pct'])

    for s, changes_list in sector_changes.items():
        if changes_list and s in sectors:
            sectors[s]['avg_change'] = round(np.mean(changes_list), 2)

    return {
        "avg_price": round(np.mean(prices), 2) if prices else 0,
        "avg_change": round(np.mean(changes), 2) if changes else 0,
        "avg_score": round(np.mean(scores), 1) if scores else 0,
        "green_count": sum(1 for c in changes if c > 0) if changes else 0,
        "red_count": sum(1 for c in changes if c < 0) if changes else 0,
        "sector_breakdown": sectors,
    }


# ── Main ───────────────────────────────────────────────────────

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Generate screener data.')
    parser.add_argument('--output', default='data/screener-data.json',
                        help='Output JSON file path')
    parser.add_argument('--test-run', action='store_true',
                        help='Fetch only 5 tickers for quick testing')
    parser.add_argument('--universes', default=None,
                        help='Comma-separated universes to scan. Default: the curated '
                             'watchlists only (what the Pi cron has always run). The broad '
                             'indices are opt-in because they are large — Russell 2000 alone '
                             'adds ~2,000 symbols to a serial, rate-limited fetch loop. '
                             'Use --list-universes to see what is available.')
    parser.add_argument('--add-universes', default=None,
                        help='Comma-separated universes to scan IN ADDITION to the default set. '
                             'Use this to add an index to the site: the output file is the whole '
                             'screener, so --universes would drop everything it does not name.')
    parser.add_argument('--resume', default=None, metavar='FILE',
                        help='Carry forward the tickers already in FILE and scan only what is '
                             'missing. Use after a run stops on a rate limit.')
    parser.add_argument('--sleep', type=float, default=0.1, metavar='SECONDS',
                        help='Delay between tickers (default 0.1). Raise it for large scans: '
                             '~1,270 tickers at 0.1s was enough to trip Yahoo on 2026-07-26.')
    parser.add_argument('--list-universes', action='store_true',
                        help='Print the available universes with their sizes and exit.')
    args = parser.parse_args()

    if args.universes and args.add_universes:
        raise SystemExit('Use --universes (replace) or --add-universes (extend), not both.')

    if args.list_universes:
        print("Curated watchlists (scanned by default):")
        for name, members in CURATED_UNIVERSES.items():
            print(f"  {name:28s} {len(members):5d}")
        print("\nIndex constituents (opt in with --universes):")
        if not INDEX_UNIVERSES:
            print("  none — run fetch_universe_constituents.py to populate the cache")
        for name, members in INDEX_UNIVERSES.items():
            source = INDEX_SOURCES.get(name, {})
            print(f"  {name:28s} {len(members):5d}  as of {source.get('as_of', '?')}")
        return

    # ── Concurrency guard ──────────────────────────────────────────────
    # The screener scans 500+ tickers (~5-10 min). If cron fires again before
    # the previous run finishes, concurrent writes corrupt the output JSON.
    _lock_fd = open("/tmp/generate_screener.lock", "w")
    try:
        fcntl.flock(_lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("Another screener instance is running — exiting.", file=sys.stderr)
        return
    try:
        _run_scan(args)
    finally:
        fcntl.flock(_lock_fd, fcntl.LOCK_UN)
        _lock_fd.close()


def _run_scan(args):
    """Actual scan logic, wrapped by the flock guard in main()."""
    def _names(value):
        return [name.strip() for name in value.split(',') if name.strip()] if value else None

    scan_tickers, scanned_labels = resolve_scan_set(
        _names(args.universes), added=_names(args.add_universes),
    )
    print(f"Scan set: {len(scan_tickers)} tickers across {scanned_labels}", file=sys.stderr)

    # --resume carries forward an earlier run's rows and scans only what is
    # missing. A throttled scan is the normal way a big run ends, and without
    # this the only recovery is to refetch everything — which trips the limit
    # again before reaching the tickers that were actually missed.
    results = []
    if args.resume:
        try:
            with open(args.resume, encoding='utf-8') as handle:
                previous = json.load(handle)
            results = [t for t in previous.get('tickers', []) if t.get('ticker')]
            print(f"Resuming from {args.resume}: {len(results)} tickers already scanned",
                  file=sys.stderr)
        except (OSError, ValueError) as exc:
            raise SystemExit(f"--resume could not read {args.resume}: {exc}")

    have = {t['ticker'] for t in results}
    pending = [t for t in scan_tickers if t not in have]
    tickers = pending[:5] if args.test_run else pending

    failed = 0
    throttled = False
    total = len(tickers)

    print(f"Scanning {total} tickers ({len(have)} already held)...", file=sys.stderr)

    for i, ticker in enumerate(tickers, 1):
        print(f"  [{i}/{total}] {ticker}...", file=sys.stderr)

        data = None
        for attempt in range(len(RATE_LIMIT_BACKOFF) + 1):
            try:
                data = fetch_ticker_data(ticker)
                break
            except RateLimited as exc:
                if attempt == len(RATE_LIMIT_BACKOFF):
                    # Out of patience. STOP — do not keep calling. Once Yahoo
                    # starts refusing it refuses everything, so continuing would
                    # mark every remaining ticker "failed" and produce a file
                    # that looks like a completed scan of a universe it barely
                    # touched. That is what the 2026-07-26 run did: 455
                    # consecutive refusals recorded as ordinary failures.
                    print(f"  still rate limited after {sum(RATE_LIMIT_BACKOFF)}s — stopping at "
                          f"{ticker} with {len(tickers) - i + 1} unscanned. Re-run with "
                          f"--resume to pick up the rest. ({exc})", file=sys.stderr)
                    throttled = True
                    break
                wait = RATE_LIMIT_BACKOFF[attempt]
                print(f"  rate limited on {ticker} — waiting {wait}s "
                      f"(attempt {attempt + 1}/{len(RATE_LIMIT_BACKOFF)})", file=sys.stderr)
                time.sleep(wait)
        if throttled:
            break

        if data:
            score, signals = compute_score(data)
            data['score'] = score
            data['signals'] = signals
            results.append(data)
        else:
            failed += 1
        time.sleep(args.sleep)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ticker_count": len(results),
        "failed_count": failed,
        # Which universes this run actually covered. The site needs this to
        # tell "no rows match your filters" apart from "this snapshot never
        # scanned that index" — without it, offering an index in the filter
        # that was not scanned reads to the visitor as "nothing qualifies".
        "universes_scanned": scanned_labels,
        # ...and how completely, because "scanned" is not the same as
        # "complete". A throttled or partial run must not let the site imply
        # full coverage: the 2026-07-26 run held 159 of the 602 S&P 600 names
        # and universes_scanned alone would have claimed the whole index.
        "universe_coverage": compute_universe_coverage(scan_tickers, results),
        # True when the run stopped early because Yahoo was still refusing.
        "rate_limited": throttled,
        # Provenance for the index universes in this run, so the site can say
        # how current the membership is rather than implying it is live.
        "universe_sources": {name: INDEX_SOURCES[name]
                             for name in scanned_labels if name in INDEX_SOURCES},
        "market_summary": compute_market_summary(results),
        "tickers": results,
    }

    # Determine output path — relative to repo root or absolute
    out_path = args.output
    # If relative and we're in pi-scripts dir, go up one level
    if not os.path.isabs(out_path) and os.path.basename(os.getcwd()) == 'pi-scripts':
        out_path = os.path.join('..', out_path)

    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)

    # Atomic write — a crash mid-scan can never expose a partial JSON file
    atomic_write_json(out_path, output)

    print(f"\nDone. {len(results)} tickers written to {out_path}", file=sys.stderr)
    if failed:
        print(f"  {failed} tickers failed", file=sys.stderr)


if __name__ == '__main__':
    main()
