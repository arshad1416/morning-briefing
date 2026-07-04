#!/usr/bin/env python3
"""Run IBKR GEX/DEX/VEX calculations and push to briefing dashboard."""
import subprocess, json, os, sys, re
from pathlib import Path
from collections import defaultdict

DASHBOARD_REPO = Path(os.path.expanduser("~/morning-briefing"))
OUTPUT = DASHBOARD_REPO / "data" / "maplegamma-data.json"

def _build_gamma_profile(strikes):
    """Merge calls and puts at the same strike into a gamma_profile list."""
    merged = defaultdict(lambda: {"call_gex": 0, "put_gex": 0, "call_oi": 0, "put_oi": 0, "dex": 0, "vex": 0})
    for s in strikes:
        strike = s["strike"]
        if s["type"] == "C":
            merged[strike]["call_gex"] = s["gex"]
            merged[strike]["call_oi"] = s["oi"]
        else:
            merged[strike]["put_gex"] = s["gex"]
            merged[strike]["put_oi"] = s["oi"]
        merged[strike]["dex"] += s["dex"]
        merged[strike]["vex"] += s["vex"]

    gamma_profile = []
    for strike in sorted(merged.keys()):
        m = merged[strike]
        gamma_profile.append({
            "strike": strike,
            "call_gex": m["call_gex"],
            "put_gex": m["put_gex"],
            "net_gex": m["call_gex"] + m["put_gex"],
            "dex": m["dex"],
            "vex": m["vex"],
            "oi": m["call_oi"] + m["put_oi"]
        })
    return gamma_profile

def main():
    # Run the GEX calculator
    r = subprocess.run(
        [sys.executable, os.path.expanduser("~/.hermes/scripts/ibkr_gex.py")],
        capture_output=True, text=True, timeout=120
    )
    if r.returncode != 0:
        print(f"GEX script failed: {r.stderr[:200]}")
        return

    output = r.stdout.strip()
    
    # Parse the tabular output into structured data
    # The script prints a table of strikes
    lines = output.split("\n")
    tickers = {}
    current_ticker = "SPX"
    strikes = []
    summary = {}
    
    for line in lines:
        line = line.strip()
        if line.startswith("Total GEX:"):
            m = re.search(r"[-+]?[\d,]+", line)
            if m: summary["total_gex"] = int(m.group().replace(",",""))
        elif line.startswith("Total DEX:"):
            m = re.search(r"[-+]?[\d,]+", line)
            if m: summary["total_dex"] = int(m.group().replace(",",""))
        elif line.startswith("Total VEX:"):
            m = re.search(r"[-+]?[\d,]+", line)
            if m: summary["total_vex"] = int(m.group().replace(",",""))
        elif line.startswith("Max GEX strike:"):
            m = re.search(r"\$([\d.]+)\s*\(([-+]?[\d,]+)\)", line)
            if m: summary["max_gex_strike"] = float(m.group(1)); summary["max_gex_value"] = int(m.group(2).replace(",",""))
        elif line.startswith("Neutral GEX range:"):
            m = re.search(r"\$([\d.]+)\s*-\s*\$([\d.]+)", line)
            if m: summary["neutral_range"] = [float(m.group(1)), float(m.group(2))]
        elif line.startswith("$"):
            # Strike line: "$   755 C        7,433    +13,954    +75,778   +98,224"
            parts = line.split()
            if len(parts) >= 6 and parts[1].replace(".","").isdigit():
                try:
                    strike = float(parts[1])
                    opt_type = parts[2]
                    oi = int(parts[3].replace(",",""))
                    gex = int(parts[4].replace(",",""))
                    dex = int(parts[5].replace(",",""))
                    vex = int(parts[6].replace(",",""))
                    strikes.append({
                        "strike": strike, "type": opt_type, "oi": oi,
                        "gex": gex, "dex": dex, "vex": vex
                    })
                except (ValueError, IndexError):
                    pass
    
    # Get multi-expiry data via direct import (primary source for all bucket data)
    expiry_data = {}
    ibkr_px = None
    all_bucket_strikes = []
    try:
        from ibkr_gex import calc_gex_multi
        try:
            from ibkr_gex import get_ibkr_price
            ibkr_px = get_ibkr_price("SPY")
        except Exception:
            pass
        multi = calc_gex_multi("SPY", live_price=ibkr_px)
        if multi:
            for mode, mdata in multi.items():
                merged_strikes = mdata.get("strikes", [])
                expiry_data[mode] = {
                    "gamma_profile": _build_gamma_profile(merged_strikes),
                    "total_gex": mdata.get("total_gex", 0),
                    "total_dex": mdata.get("total_dex", 0),
                    "total_vex": mdata.get("total_vex", 0),
                    "expiry_count": mdata.get("expiry_count", 0),
                }
            # Use 'all' bucket strikes for main gamma_profile if subprocess parsing yielded nothing
            if not strikes and "all" in multi:
                all_bucket_strikes = multi["all"].get("strikes", [])
                summary.setdefault("total_gex", multi["all"].get("total_gex", 0))
                summary.setdefault("total_dex", multi["all"].get("total_dex", 0))
                summary.setdefault("total_vex", multi["all"].get("total_vex", 0))
                summary.setdefault("max_gex_strike", multi["all"].get("max_gex_strike"))
                summary.setdefault("max_gex_value", multi["all"].get("max_gex_value"))
    except Exception as e:
        print(f"⚠️ calc_gex_multi failed: {type(e).__name__}: {e}", file=sys.stderr)

    if not strikes and not all_bucket_strikes:
        # Both sources empty — keep the existing maplegamma-data.json intact
        print("❌ No strikes from subprocess output or calc_gex_multi; not overwriting existing data", file=sys.stderr)
        sys.exit(1)

    # Compute call/put/net GEX — merge calls and puts at the same strike
    gamma_profile = _build_gamma_profile(strikes if strikes else all_bucket_strikes)

    # Get current price/change for the SAME underlying the chain is built on
    # (SPY). This previously pulled the SPX index (^GSPC), which stamped a
    # ~7,500 price over ~750 SPY strikes — every strike sat "below" price, so
    # ceiling detection never fired and the floor/price levels were nonsense.
    summary["current_price"] = 0
    summary["change_pct"] = 0
    try:
        import yfinance as yf
        hist = yf.Ticker("SPY").history(period="5d")
        if not hist.empty:
            price = round(float(hist["Close"].iloc[-1]), 2)
            prev = round(float(hist["Close"].iloc[-2]), 2) if len(hist) > 1 else price
            summary["current_price"] = price
            summary["change_pct"] = round((price - prev) / prev * 100, 2)
    except Exception:
        pass
    if not summary["current_price"] and ibkr_px:
        summary["current_price"] = round(float(ibkr_px), 2)

    # Compute floor and ceiling zones from gamma profile
    current_price = summary.get("current_price", 0)
    floor_zone = None
    ceiling_zone = None
    neutral_range = summary.get("neutral_range", [0, 0])
    for p in gamma_profile:
        if p["strike"] < current_price and p["net_gex"] > 0:
            if floor_zone is None or p["net_gex"] > floor_zone["net_gex"]:
                strength = "strong" if p["net_gex"] > 15000 else "moderate" if p["net_gex"] > 5000 else "weak"
                floor_zone = {"strike": p["strike"], "net_gex": p["net_gex"],
                              "total_gex": p["call_gex"] + p["put_gex"],
                              "range_start": p["strike"] - 5, "range_end": p["strike"] + 5,
                              "strength": strength,
                              "narrative": f"Gamma floor at ${p['strike']:.0f}"}
        elif p["strike"] > current_price and p["net_gex"] > 0:
            if ceiling_zone is None or p["net_gex"] > ceiling_zone["net_gex"]:
                strength = "strong" if p["net_gex"] > 15000 else "moderate" if p["net_gex"] > 5000 else "weak"
                ceiling_zone = {"strike": p["strike"], "net_gex": p["net_gex"],
                                "total_gex": p["call_gex"] + p["put_gex"],
                                "range_start": p["strike"] - 5, "range_end": p["strike"] + 5,
                                "strength": strength,
                                "narrative": f"Gamma ceiling at ${p['strike']:.0f}"}

    # Determine gamma regime
    total_gex = summary.get("total_gex", 0)
    gamma_regime = "bullish" if total_gex > 0 else "bearish" if total_gex < 0 else "neutral"

    ticker_data = {
        "current_price": summary.get("current_price", 0),
        "change_pct": summary.get("change_pct", 0),
        "gamma_regime": gamma_regime,
        "total_gex": total_gex,
        "total_dex": summary.get("total_dex", 0),
        "total_vex": summary.get("total_vex", 0),
        "max_gex_strike": summary.get("max_gex_strike"),
        "max_gex_value": summary.get("max_gex_value"),
        "neutral_range": summary.get("neutral_range", []),
        "gamma_profile": gamma_profile,
        "floor_zone": floor_zone,
        "ceiling_zone": ceiling_zone,
        "narrative": f"Net GEX: ${total_gex:+,.0f} — dealers are {'long gamma (range-bound)' if total_gex > 0 else 'short gamma (trending)'}",
    }
    if expiry_data:
        ticker_data["expiry_data"] = expiry_data

    data = {
        "generated_at": __import__("datetime").datetime.now().strftime("%Y-%m-%dT%H:%M:%S-04:00"),
        "market_overview": {
            "total_net_gex": total_gex,
            "total_oi": sum(s["oi"] for s in gamma_profile),
            "current_price": summary.get("current_price", 0),
            "change_pct": summary.get("change_pct", 0),
        },
        "tickers": {
            # Labeled honestly: the chain, strikes, and price are all SPY.
            # (SPY tracks SPX at ~1/10 scale, but calling it SPX with SPY
            # strikes made every published level wrong.)
            "SPY": ticker_data
        }
    }
    
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(data, f, indent=2)
    
    n = len(strikes) if strikes else len(all_bucket_strikes)
    print(f"✅ GEX/DEX/VEX pushed: {n} strikes, ${summary.get('total_gex',0):+,.0f} GEX")

if __name__ == "__main__":
    main()
