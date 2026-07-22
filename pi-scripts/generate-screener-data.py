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
from datetime import datetime, timezone

# ── Ticker Universe (500+ tickers) ──────────────────────────────
UNIVERSES = {
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
TICKERS = []
TICKER_UNIVERSE = {}
seen = set()
for universe, tickers in UNIVERSES.items():
    for t in tickers:
        if t not in seen:
            TICKERS.append(t)
            TICKER_UNIVERSE[t] = universe
            seen.add(t)


# ── Metrics Computation ────────────────────────────────────────


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
            "universe": TICKER_UNIVERSE.get(ticker, "Other"),
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
    except Exception as e:
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

    # 6. Analyst recommendation
    # BUG FIX: yfinance's recommendationKey is lowercase ('buy',
    # 'strong_buy', ...) but this compared against uppercase literals, so
    # the comparison never matched and analyst_buy/analyst_sell never fired
    # (confirmed against data/screener-lite.json: rows with
    # recommendation:'buy' carried no analyst_buy signal). Normalize case
    # before comparing.
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


# ── Market Summary ─────────────────────────────────────────────

def compute_market_summary(tickers):
    """Aggregate statistics across all scanned tickers."""
    prices = [t['price'] for t in tickers if t.get('price')]
    changes = [t['change_pct'] for t in tickers if t.get('change_pct') is not None]
    scores = [t['score'] for t in tickers if t.get('score')]

    sectors = {}
    for t in tickers:
        s = t.get('sector', 'Unknown')
        if s not in sectors:
            sectors[s] = {'count': 0, 'avg_change': 0}
        sectors[s]['count'] += 1

    # Compute average change per sector
    sector_changes = {}
    for t in tickers:
        s = t.get('sector', 'Unknown')
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
    args = parser.parse_args()

    tickers = TICKERS[:5] if args.test_run else TICKERS
    results = []
    failed = 0
    total = len(tickers)

    print(f"Scanning {total} tickers...", file=sys.stderr)

    for i, ticker in enumerate(tickers, 1):
        print(f"  [{i}/{total}] {ticker}...", file=sys.stderr)
        data = fetch_ticker_data(ticker)
        if data:
            score, signals = compute_score(data)
            data['score'] = score
            data['signals'] = signals
            results.append(data)
        else:
            failed += 1
        time.sleep(0.1)  # Rate limit: 10 req/sec

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ticker_count": len(results),
        "failed_count": failed,
        "market_summary": compute_market_summary(results),
        "tickers": results,
    }

    # Determine output path — relative to repo root or absolute
    out_path = args.output
    # If relative and we're in pi-scripts dir, go up one level
    if not os.path.isabs(out_path) and os.path.basename(os.getcwd()) == 'pi-scripts':
        out_path = os.path.join('..', out_path)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nDone. {len(results)} tickers written to {out_path}", file=sys.stderr)
    if failed:
        print(f"  {failed} tickers failed", file=sys.stderr)


if __name__ == '__main__':
    main()
