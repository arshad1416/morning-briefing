#!/usr/bin/env python3
"""
generate_prediction_accuracy.py — Enhanced prediction accuracy with expectancy metrics.

Qwen modification: Track EXPECTANCY (WR × Avg Win - LR × Avg Loss),
Max Drawdown, Slippage vs Theoretical. Not just win rate.

Output: ~/morning-briefing/data/accuracy.json

Usage:
    python3 generate_prediction_accuracy.py
"""

import json
import os
import math
from datetime import datetime, timezone

DATA_DIR = os.path.expanduser("~/morning-briefing/data")
INTEL_DIR = os.path.expanduser("~/.hermes/market-intel")
OUTPUT = os.path.join(DATA_DIR, "accuracy.json")
LEDGER = os.path.join(INTEL_DIR, "paper_trading.json")


def load_json(path):
    if not os.path.exists(path):
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def compute_max_drawdown(pnls: list) -> dict:
    """Compute max drawdown from a sequence of trade PnLs."""
    if not pnls:
        return {"max_drawdown_pct": 0, "drawdown_duration": 0}

    # Build equity curve
    equity = [100.0]
    for p in pnls:
        equity.append(equity[-1] * (1 + p / 100))

    peak = equity[0]
    max_dd = 0
    dd_start = 0
    dd_duration = 0
    max_dd_duration = 0

    for i, val in enumerate(equity):
        if val > peak:
            peak = val
            dd_start = i
        dd = (peak - val) / peak * 100
        if dd > max_dd:
            max_dd = dd
            dd_duration = i - dd_start
        if dd > 0:
            max_dd_duration = max(max_dd_duration, i - dd_start)

    return {
        "max_drawdown_pct": round(max_dd, 2),
        "drawdown_duration_trades": dd_duration,
        "max_drawdown_duration_trades": max_dd_duration,
    }


def compute_expectancy(pnls: list) -> dict:
    """
    Compute expectancy: WR × Avg_Win - LR × Avg_Loss
    This is the key metric — positive expectancy = profitable system.
    """
    if not pnls:
        return {"expectancy": 0, "expectancy_per_dollar_risked": 0}

    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    n = len(pnls)

    wr = len(wins) / n if n > 0 else 0
    lr = len(losses) / n if n > 0 else 0
    avg_win = sum(wins) / len(wins) if wins else 0
    avg_loss = sum(losses) / len(losses) if losses else 0

    expectancy = wr * avg_win + lr * avg_loss  # lr is negative, so this subtracts

    # Expectancy per dollar risked (Kelly-like)
    # Risk = |avg_loss|, Reward = avg_win
    risk = abs(avg_loss) if avg_loss != 0 else 1
    expectancy_per_risk = expectancy / risk if risk > 0 else 0

    # Kelly criterion (optimal bet fraction)
    if avg_loss != 0 and wr > 0 and wr < 1:
        kelly = wr - (1 - wr) / (avg_win / abs(avg_loss))
        kelly = max(0, min(kelly, 0.5))  # Cap at 50%
    else:
        kelly = 0

    # Fractional Kelly (Half-Kelly) — safer for real-world use
    # Full Kelly is too aggressive; half-Kelly reduces drawdown significantly
    # while retaining ~75% of the growth rate
    half_kelly = kelly * 0.5

    return {
        "expectancy_pct": round(expectancy, 3),
        "expectancy_per_dollar_risked": round(expectancy_per_risk, 3),
        "win_rate": round(wr * 100, 1),
        "loss_rate": round(lr * 100, 1),
        "avg_win_pct": round(avg_win, 3),
        "avg_loss_pct": round(avg_loss, 3),
        # Infinity is not valid JSON and causes the browser's JSON parser to
        # reject the entire Pro-gated artifact when a sample has no losses yet.
        "profit_factor": round(abs(sum(wins) / sum(losses)), 2) if losses and sum(losses) != 0 else None,
        "kelly_fraction_raw": round(kelly * 100, 1),
        "kelly_fraction_half": round(half_kelly * 100, 1),
        "kelly_fraction": round(half_kelly * 100, 1),  # Default display = Half-Kelly
        "kelly_note": "Half-Kelly (0.5x) recommended — raw Kelly too aggressive for live trading",
        "n_trades": n,
        "n_wins": len(wins),
        "n_losses": len(losses),
    }


def compute_slippage(closed_trades: list) -> dict:
    """
    Estimate slippage: difference between theoretical and actual execution.
    For now, uses entry_price vs the 'ideal' price from signals.
    """
    slippages = []
    for t in closed_trades:
        # If we have both signal price and entry price
        signal_price = t.get("signal_price", t.get("entry_price"))
        entry_price = t.get("entry_price")
        if signal_price and entry_price:
            try:
                s = float(signal_price)
                e = float(entry_price)
                if s > 0:
                    slip = (e - s) / s * 100
                    slippages.append(slip)
            except (TypeError, ValueError):
                pass

    if not slippages:
        return {
            "avg_slippage_pct": 0,
            "max_slippage_pct": 0,
            "n_measured": 0,
            "note": "No signal_price vs entry_price data available",
        }

    return {
        "avg_slippage_pct": round(sum(slippages) / len(slippages), 3),
        "max_slippage_pct": round(max(slippages), 3),
        "min_slippage_pct": round(min(slippages), 3),
        "n_measured": len(slippages),
    }


def compute_per_strategy_metrics(closed_trades: list) -> list:
    """Compute expectancy and drawdown per strategy."""
    by_strategy = {}
    for t in closed_trades:
        strat = t.get("strategy", "unknown")
        if strat not in by_strategy:
            by_strategy[strat] = []
        pnl = float(t.get("pnl_pct", 0) or 0)
        # Normalize: if stored as decimal, convert to percentage
        if abs(pnl) < 1:
            pnl *= 100
        by_strategy[strat].append(pnl)

    results = []
    for strat, pnls in sorted(by_strategy.items()):
        exp = compute_expectancy(pnls)
        dd = compute_max_drawdown(pnls)

        results.append({
            "strategy": strat,
            **exp,
            **dd,
            "status": "profitable" if exp["expectancy_pct"] > 0 else "losing",
        })

    return results


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    print("=" * 50)
    print("  Enhanced Prediction Accuracy")
    print("=" * 50)

    # Load trading data
    ledger = load_json(LEDGER)
    if not ledger:
        print("No paper_trading.json found")
        return

    closed = ledger.get("closed_trades", [])
    open_trades = ledger.get("open_trades", ledger.get("open_positions", []))
    meta = ledger.get("metadata", {})
    acct = ledger.get("account", {})

    if not closed:
        print("No closed trades found")
        return

    # Extract PnLs
    pnls = []
    for t in closed:
        pnl = float(t.get("pnl_pct", 0) or 0)
        if abs(pnl) < 1:
            pnl *= 100
        pnls.append(pnl)

    print(f"\nTrades: {len(closed)} closed, {len(open_trades)} open")

    # Overall metrics
    expectancy = compute_expectancy(pnls)
    drawdown = compute_max_drawdown(pnls)
    slippage = compute_slippage(closed)
    per_strategy = compute_per_strategy_metrics(closed)

    # Rolling 20-trade performance
    rolling_20 = []
    if len(pnls) >= 20:
        for i in range(len(pnls) - 19):
            window = pnls[i:i+20]
            wr = sum(1 for p in window if p > 0) / 20 * 100
            rolling_20.append({
                "start_trade": i,
                "win_rate": round(wr, 1),
                "avg_pnl": round(sum(window) / 20, 3),
            })

    # Current rolling stats
    current_rolling = rolling_20[-1] if rolling_20 else None

    # Print summary
    print(f"\n📊 Overall Performance:")
    print(f"   Expectancy: {expectancy['expectancy_pct']:+.3f}% per trade")
    print(f"   Per $ risked: {expectancy['expectancy_per_dollar_risked']:+.3f}")
    print(f"   Win Rate: {expectancy['win_rate']}% ({expectancy['n_wins']}W/{expectancy['n_losses']}L)")
    print(f"   Avg Win: {expectancy['avg_win_pct']:+.3f}% | Avg Loss: {expectancy['avg_loss_pct']:+.3f}%")
    print(f"   Profit Factor: {expectancy['profit_factor']}")
    print(f"   Kelly (Raw): {expectancy['kelly_fraction_raw']}%  ← DO NOT USE DIRECTLY")
    print(f"   Kelly (Half-Kelly 0.5x): {expectancy['kelly_fraction_half']}%  ← RECOMMENDED")
    print(f"   Max Drawdown: {drawdown['max_drawdown_pct']}%")
    print(f"   Slippage: {slippage['avg_slippage_pct']}% avg ({slippage['n_measured']} measured)")

    if current_rolling:
        print(f"\n   Rolling 20-trade WR: {current_rolling['win_rate']}%")

    print(f"\n📋 Per-Strategy:")
    for s in per_strategy:
        icon = "🟢" if s["status"] == "profitable" else "🔴"
        print(f"   {icon} {s['strategy']:20s} Exp={s['expectancy_pct']:+.3f}% "
              f"WR={s['win_rate']}% PF={s['profit_factor']} DD={s['max_drawdown_pct']}%")

    # Build output
    starting = float(acct.get("starting_balance", 2000))
    current = float(acct.get("current_balance", 0) or acct.get("cash", 0) or 0)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_trades": len(closed) + len(open_trades),
            "closed_trades": len(closed),
            "open_positions": len(open_trades),
            "win_rate": expectancy["win_rate"],
            "return_pct": round((current - starting) / starting * 100, 2) if starting > 0 else 0,
        },
        "expectancy": expectancy,
        "drawdown": drawdown,
        "slippage": slippage,
        "per_strategy": per_strategy,
        "rolling_20": {
            "current": current_rolling,
            "history": rolling_20[-10:] if rolling_20 else [],  # Last 10 windows
        },
    }

    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅ Saved to {OUTPUT}")


if __name__ == "__main__":
    main()
