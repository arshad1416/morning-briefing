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

# ── Ticker Universe (100 tickers) ──────────────────────────────
TICKERS = [
    # Major Indices (4)
    "SPY", "QQQ", "IWM", "DIA",
    # Sector ETFs (12)
    "XLF", "XLK", "XLE", "XLV", "XLI", "XLB", "XLU", "XLRE", "XLY", "XLP", "XLC", "XLG",
    # Large Cap US (25)
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "BRK-B", "JPM", "V",
    "JNJ", "WMT", "MA", "PG", "UNH", "HD", "DIS", "NFLX", "ADBE", "CRM",
    "AMD", "INTC", "BAC", "PFE", "KO",
    # Mid Cap / High Volume (20)
    "PLTR", "MSTR", "TSM", "AVGO", "COST", "ABNB", "UBER", "SNAP", "DDOG", "CRWD",
    "PANW", "SHOP", "SQ", "MCD", "NKE", "BA", "CAT", "GE", "IBM", "ORCL",
    # Top Gainers / High Beta / Popular (15)
    "MARA", "COIN", "RKLB", "ASTS", "SOFI", "HOOD", "RDDT", "CVNA", "DKNG", "TTD",
    "CMG", "LULU", "SBUX", "TGT", "LOW",
    # Canadian (14)
    "XIU.TO", "TD.TO", "RY.TO", "SHOP.TO", "ENB.TO", "BNS.TO", "BMO.TO", "CNQ.TO",
    "SU.TO", "CP.TO", "CNR.TO", "TRP.TO", "FTS.TO", "POW.TO",
    # Fixed Income / Commodity ETFs (6)
    "TLT", "AGG", "BND", "GLD", "SLV", "USO",
    # Bitcoin proxies (4)
    "IBIT", "FBTC", "BITB", "GBTC",
]


# ── Metrics Computation ────────────────────────────────────────

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

        price = hist['Close'][-1]

        # RSI (14-day)
        delta = hist['Close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        last_rs = rs.iloc[-1]
        if last_rs is not None and last_rs != 0 and not np.isnan(last_rs):
            rsi = round(100 - (100 / (1 + last_rs)), 1)
        else:
            rsi = 50.0

        # SMAs
        sma20 = round(hist['Close'].rolling(20).mean().iloc[-1], 2)
        sma50 = round(hist['Close'].rolling(50).mean().iloc[-1], 2)

        # Volume
        volume = int(hist['Volume'][-1])
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
            div_yield = round(div_yield * 100, 2)
        else:
            div_yield = 0

        # Institution percentage
        inst_pct = info.get("heldPercentInstitutions")
        if inst_pct is not None:
            inst_pct = round(inst_pct * 100, 1)
        else:
            inst_pct = None

        return {
            "ticker": ticker,
            "name": info.get("longName", ""),
            "price": round(price, 2),
            "change_pct": change_pct,
            "pe": info.get("trailingPE"),
            "forwardPe": info.get("forwardPE"),
            "marketCap": info.get("marketCap"),
            "divYield": div_yield,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "recommendation": (info.get("recommendationKey") or "").upper(),
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
            "above_52w_high_pct": round((1 - price / high_52w) * 100, 1) if high_52w else None,
            "below_52w_low_pct": round((price / low_52w - 1) * 100, 1) if low_52w else None,
            "volume_ratio": round(volume / avg_vol, 2) if avg_vol else 1.0,
        }
    except Exception as e:
        print(f"Error fetching {ticker}: {e}", file=sys.stderr)
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
    if pe_val is not None and pe_val is not None and 0 < pe_val < 15:
        score += 1
        reasons.append("value_pe")
    elif pe_val is not None and pe_val > 30:
        score -= 1
        reasons.append("premium_pe")

    # 6. Analyst recommendation
    rec = data.get('recommendation', '')
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
        time.sleep(0.2)  # Rate limit: 5 req/sec

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
