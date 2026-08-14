#!/usr/bin/env bash
# deploy-ibkr-safefloat-2026-08-14.sh — the account-summary half of the
# 2026-08-14 IBKR audit: the agent logged 17 `_safe_float: could not extract`
# warnings and printed `Net Liq: $0.00 CAD | Buying Power: $0.00` while the
# account really held $40.40.
#
# Run ON THE PI:   bash ~/morning-briefing/pi-scripts/deploy-ibkr-safefloat-2026-08-14.sh
# Idempotent: every phase checks current state and skips itself when done.
# Takes a .bak-safefloat-2026-08-14 backup (deliberately NOT the plain
# .bak-2026-08-14 that deploy-audit-fixes-2026-08-14.sh already left behind —
# reverting to THAT one would undo the exit-code fix) and py_compile-verifies,
# reverting from that exact backup on failure. Aborts on the first unexpected
# condition. Commits/pushes nothing and restarts nothing.
#
# ibkr_portfolio_agent.py is a PI-ONLY script — no repo copy — so it is edited
# in place (AGENTS.md rule 4, same as Phase B of the earlier deploy script).
#
# THREE INDEPENDENT CAUSES, verified live against the gateway on 2026-08-14:
#
#  1. CASE. /portfolio/{acct}/summary returns 70 keys, ALL lower-cased
#     ("netliquidation"); the agent asked for "NetLiquidation". Fixed once,
#     inside _safe_float, for all 13 call sites — Phase 1.
#  2. DIFFERENT NAMES. "MaintenanceMargin" is really "maintmarginreq" and
#     "CashBalance" is really "totalcashvalue". Case-insensitivity cannot find
#     those; they need explicit aliases — Phase 2.
#  3. GENUINELY ABSENT. /summary has ZERO keys containing "pnl", /positions
#     carries neither costBasisMoney nor unrealizedPnlPct, and the asset-class
#     breakdown lives under /allocation in a shape the agent mis-reads.
#     Phases 2–4 source each from where it actually exists, or emit null.
#
# The standard this audit holds: a field that cannot be sourced truthfully ends
# up null/absent so the dashboard shows an em-dash. It must never default to
# 0.0 and get rendered as "Realized P&L $0.00". positions-client.tsx already
# does `s.realized_pnl != null ? … : '—'`, so null is handled today.

set -euo pipefail
# HS is overridable only so this can be rehearsed against a scratch copy of the
# agent before it is run for real; leave it unset on the Pi.
HS="${HS:-$HOME/.hermes/scripts}"
AGENT="$HS/ibkr_portfolio_agent.py"
TAG="bak-safefloat-2026-08-14"

[ -f "$AGENT" ] || { echo "ABORT: $AGENT not found."; exit 1; }

edit_once() {  # edit_once <file> <old> <new> — replace exactly-once or abort
  python3 - "$1" "$2" "$3" <<'PY'
import sys
path, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path).read()
# `new in src` alone is the applied test — deliberately NOT the reference
# script's `new in src and old not in src`. Two of the edits below are
# insertions that KEEP their anchor, so `old` is a substring of `new` and
# survives the edit; the stricter test re-inserted them on every re-run.
if new in src:
    print(f"  already applied: {path}")
    sys.exit(0)
n = src.count(old)
if n != 1:
    sys.exit(f"ABORT: expected exactly 1 occurrence of the target in {path}, found {n}")
open(path, "w").write(src.replace(old, new, 1))
print(f"  edited: {path}")
PY
}

backup() {  # backup <file> — one .bak per file, kept for compile_or_revert
  [ -f "$1.$TAG" ] || cp "$1" "$1.$TAG"
}

compile_or_revert() {  # compile_or_revert <file> — reverts from THIS file's .bak
  if ! python3 -m py_compile "$1"; then
    echo "COMPILE FAILED — reverting $1 from $1.$TAG"
    cp "$1.$TAG" "$1"
    exit 1
  fi
}

backup "$AGENT"

echo "── Phase 1: _safe_float — match keys case-insensitively ──"
# The one-place fix for cause (1). /summary's keys are all lower-cased, so
# every CamelCase ask missed and returned the 0.0 default. Verified live: every
# one of /summary's 70 values IS a {"amount", "currency", "isNull", …} wrapper,
# so the FIRST alternative ("NetLiquidation.amount" → "netliquidation" →
# "amount") is the one that now resolves. The bare-key alternatives are kept
# only as a fallback for endpoints that return a scalar directly.
edit_once "$AGENT" \
'            for key in keys:
                if isinstance(val, dict):
                    val = val[key]
                else:
                    raise KeyError(key)' \
'            for key in keys:
                if not isinstance(val, dict):
                    raise KeyError(key)
                if key in val:
                    val = val[key]
                else:
                    # /portfolio/{acct}/summary lower-cases every key
                    # ("netliquidation"), so a CamelCase ask found nothing and
                    # every account figure silently defaulted to 0.0.
                    lower = key.lower()
                    match = next((k for k in val if k.lower() == lower), None)
                    if match is None:
                        raise KeyError(key)
                    val = val[match]'
# Second half of cause (1): every /summary value is a
# {"amount": …, "currency": "CAD", …} wrapper, so a path that lands on the
# wrapper itself used to return the default immediately and never try the
# remaining alternatives. Kept as defence for any alias ordering where a bare
# key precedes a dotted one — NOT load-bearing for today's payload: reverting
# only this edit still yields cash_balance 29.02 and zero warnings, because the
# dotted alternative is tried first.
edit_once "$AGENT" \
'                if not math.isfinite(result):
                    return default
                return result
            return default
        except (KeyError, IndexError, TypeError, ValueError):' \
'                if not math.isfinite(result):
                    return default
                return result
            # Landed on a non-scalar (IBKR wraps every /summary number in
            # {"amount": …, "currency": …}): try the remaining alternatives
            # rather than giving up on this object entirely.
            continue
        except (KeyError, IndexError, TypeError, ValueError):'
compile_or_revert "$AGENT"

echo "── Phase 2a: _ledger_base helper — account P&L has no /summary key ──"
edit_once "$AGENT" \
'def _normalise_position(pos: JSON) -> JSON:
    """Convert a raw IBKR position dict into a standardised format."""' \
'def _ledger_base(ledger_raw: Any, key: str) -> float | None:
    """Account-level value from the ledger'"'"'s BASE (base-currency) row.

    Returns None — not 0.0 — when the row or key is missing: the dashboard
    renders null as an em-dash, while a fabricated 0.0 is indistinguishable
    from a genuinely flat day.
    """
    row = ledger_raw.get("BASE") if isinstance(ledger_raw, dict) else None
    if isinstance(row, dict) and isinstance(row.get(key), (int, float)):
        return float(row[key])
    return None


def _normalise_position(pos: JSON) -> JSON:
    """Convert a raw IBKR position dict into a standardised format."""'
compile_or_revert "$AGENT"

echo "── Phase 2b: account summary — real key names, real P&L source ──"
edit_once "$AGENT" \
'                "cash_balance": _safe_float(acct_block,
                    "CashBalance.amount", "CashBalance"),
                "init_margin_req": _safe_float(acct_block,
                    "InitMarginReq.amount", "InitMarginReq"),
                "maintenance_margin": _safe_float(acct_block,
                    "MaintenanceMargin.amount", "MaintenanceMargin"),
                "available_funds": _safe_float(acct_block,
                    "AvailableFunds.amount", "AvailableFunds"),
                "excess_liquidity": _safe_float(acct_block,
                    "ExcessLiquidity.amount", "ExcessLiquidity"),
                "unrealized_pnl": _safe_float(acct_block,
                    "UnrealizedPnL.amount", "UnrealizedPnL"),
                "realized_pnl": _safe_float(acct_block,
                    "RealizedPnL.amount", "RealizedPnL"),' \
'                # These two differ by NAME, not just case, so the Phase 1
                # case-insensitive match cannot find them on its own.
                "cash_balance": _safe_float(acct_block,
                    "CashBalance.amount", "CashBalance",
                    "totalcashvalue.amount", "totalcashvalue"),
                "init_margin_req": _safe_float(acct_block,
                    "InitMarginReq.amount", "InitMarginReq"),
                "maintenance_margin": _safe_float(acct_block,
                    "MaintenanceMargin.amount", "MaintenanceMargin",
                    "maintmarginreq.amount", "maintmarginreq"),
                "available_funds": _safe_float(acct_block,
                    "AvailableFunds.amount", "AvailableFunds"),
                "excess_liquidity": _safe_float(acct_block,
                    "ExcessLiquidity.amount", "ExcessLiquidity"),
                # /summary carries no P&L at all (verified live 2026-08-14:
                # zero of its 70 keys contain "pnl"), so these come from the
                # ledger BASE row — already fetched above, no extra call.
                # Do NOT "simplify" this into a sum over positions: each
                # position'"'"'s unrealizedPnl is in its OWN currency (KOSS
                # -104.56 USD) and summing them gives -181.60 where the real
                # base-CAD account figure is -222.13.
                "unrealized_pnl": _ledger_base(ledger_raw, "unrealizedpnl"),
                "realized_pnl": _ledger_base(ledger_raw, "realizedpnl"),'
compile_or_revert "$AGENT"

echo "── Phase 3: positions — derive cost_basis and unrealized_pnl_pct ──"
edit_once "$AGENT" \
'    out: JSON = {
        "ticker": pos.get("symbol") or pos.get("ticker", ""),' \
'    # The gateway sends neither costBasisMoney nor unrealizedPnlPct (verified
    # live 2026-08-14), so both are derived. avgCost is per share; for options
    # IBKR already folds the multiplier into it.
    # abs() on the denominator: a short'"'"'s cost basis is negative (proceeds
    # received), so dividing by the signed value flips the sign of a winning
    # short into a loss. Only the P&L'"'"'s own sign should drive the pct.
    cost_basis = (_safe_float(pos, "avgCost", "averageCost")
                  * _safe_float(pos, "position"))
    unrealized_pnl = _safe_float(pos, "unrealizedPnl", "unrealizedPnL",
        "unrealized_pnl")

    out: JSON = {
        "ticker": pos.get("symbol") or pos.get("ticker", ""),'
edit_once "$AGENT" \
'        "cost_basis": _safe_float(pos, "costBasisMoney",
            "costBasis", "cost_basis"),
        "unrealized_pnl": _safe_float(pos, "unrealizedPnl",
            "unrealizedPnL", "unrealized_pnl"),
        "unrealized_pnl_pct": _safe_float(pos, "unrealizedPnlPct",
            "unrealized_pnl_pct"),' \
'        "cost_basis": cost_basis,
        "unrealized_pnl": unrealized_pnl,
        # None, not 0.0, when there is nothing to divide by.
        "unrealized_pnl_pct": (round(unrealized_pnl / abs(cost_basis) * 100, 2)
                               if cost_basis else None),'
compile_or_revert "$AGENT"

echo "── Phase 4: allocation — read the shape the gateway actually returns ──"
# No extra API call needed: fetch_account_summary already GETs
# /portfolio/{acct}/allocation. It just mis-read the payload, and the else
# branch then wrote stocks/options/cash/futures/bonds = 0.0 into
# ibkr_account.json — which r2_sync.py uploads. That is the fabricated-zero
# defect this audit is about, so the no-data case now emits nothing.
edit_once "$AGENT" \
'            class_values: dict[str, float] = {
                "stocks": _safe_float(by_class, "STK",
                    "stocks", default=0.0),
                "options": _safe_float(by_class, "OPT",
                    "options", default=0.0),
                "cash": _safe_float(by_class, "CASH",
                    "cash", default=0.0),
                "futures": _safe_float(by_class, "FUT",
                    "futures", default=0.0),
                "bonds": _safe_float(by_class, "BOND",
                    "bonds", default=0.0),
            }
            total = sum(v for v in class_values.values() if v)
            if total > 0:
                for k, v in class_values.items():
                    result[k] = round(v / total * 100, 1)
            else:
                result.update(class_values)' \
'            # Live shape is {"long": {"STK": …}, "short": {…}}, never the flat
            # {"STK": …} this used to assume.
            # ponytail: long and short summed as magnitudes, which is what a
            # pie wants; make it sign-aware if shorts ever matter here.
            flat: dict[str, float] = {}
            for side in ("long", "short"):
                side_vals = by_class.get(side)
                if not isinstance(side_vals, dict):
                    continue
                for k, v in side_vals.items():
                    if isinstance(v, (int, float)):
                        flat[k] = flat.get(k, 0.0) + abs(float(v))
            total = sum(flat.values())
            if total > 0:
                for out_key, raw_key in (("stocks", "STK"), ("options", "OPT"),
                        ("cash", "CASH"), ("futures", "FUT"),
                        ("bonds", "BOND")):
                    result[out_key] = round(flat.get(raw_key, 0.0) / total * 100, 1)
            # No allocation data → emit nothing. Five 0.0s render as a real
            # "0% stocks" breakdown, which is a lie, not a missing value.'
compile_or_revert "$AGENT"

echo "── Self-check: replay the real 2026-08-14 gateway payloads ──"
# Fixtures are verbatim excerpts of the live responses (2026-08-14, U5105815).
# No network, no files written — just the four normalisers.
python3 - "$HS" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import ibkr_portfolio_agent as a

def amt(x):  # every /summary value is wrapped exactly like this
    return {"amount": x, "currency": "CAD", "isNull": False,
            "timestamp": 1786724689000, "value": None, "severity": 0}

SUMMARY = {"netliquidation": amt(40.400001525878906),
           "buyingpower": amt(29.020000457763672),
           "availablefunds": amt(29.020000457763672),
           "excessliquidity": amt(29.020000457763672),
           "grosspositionvalue": amt(11.380000114440918),
           "initmarginreq": amt(0.0), "maintmarginreq": amt(0.0),
           "totalcashvalue": amt(29.020000457763672)}
LEDGER = {"BASE": {"unrealizedpnl": -222.13, "realizedpnl": 0.0, "cashbalance": 29.02}}
KOSS = {"assetClass": "STK", "ticker": "KOSS", "position": 2.0, "avgCost": 56.0,
        "mktPrice": 3.7209289, "mktValue": 7.44, "unrealizedPnl": -104.56,
        "realizedPnl": 0.0, "currency": "USD", "strike": "0", "multiplier": 0.0}
ARCO = {"assetClass": "STK", "ticker": "ARCO", "position": 2.0, "avgCost": 0.0,
        "mktPrice": 0.0, "mktValue": 0.0, "unrealizedPnl": 0.0, "realizedPnl": 0.0,
        "currency": "CAD", "strike": "0", "multiplier": 0.0}
ALLOC = {"assetClass": {"long": {"STK": 11.37276354789734,
                                 "CASH": 29.019479523897168}, "short": {}}}

def cls(d):  # the always-present (and always-empty) "sectors" key is not ours
    return {k: v for k, v in d.items() if k != "sectors"}

# (1) case-only fields resolve through the CamelCase names the call sites use
assert a._safe_float(SUMMARY, "NetLiquidation.amount", "NetLiquidation") == 40.400001525878906
assert a._safe_float(SUMMARY, "BuyingPower.amount", "BuyingPower") == 29.020000457763672
assert a._safe_float(SUMMARY, "GrossPositionValue.amount", "GrossPositionValue") == 11.380000114440918
assert a._safe_float(SUMMARY, "AvailableFunds.amount", "AvailableFunds") == 29.020000457763672
assert a._safe_float(SUMMARY, "ExcessLiquidity.amount", "ExcessLiquidity") == 29.020000457763672
assert a._safe_float(SUMMARY, "InitMarginReq.amount", "InitMarginReq") == 0.0
# (2) renamed fields need their aliases
assert a._safe_float(SUMMARY, "CashBalance.amount", "CashBalance",
                     "totalcashvalue.amount", "totalcashvalue") == 29.020000457763672
assert a._safe_float(SUMMARY, "MaintenanceMargin.amount", "MaintenanceMargin",
                     "maintmarginreq.amount", "maintmarginreq") == 0.0
# a path landing on the {"amount": …} wrapper must not stop the search
assert a._safe_float({"x": {"amount": 1.5}}, "x", "x.amount") == 1.5
a.logger.disabled = True  # the next line deliberately hits the warn+default path
assert a._safe_float({"x": {"amount": 1.5}}, "nope", default=-1.0) == -1.0
a.logger.disabled = False
# (3) unsourceable → None, never a fabricated 0.0
assert a._ledger_base(LEDGER, "unrealizedpnl") == -222.13
assert a._ledger_base(LEDGER, "realizedpnl") == 0.0
assert a._ledger_base({}, "unrealizedpnl") is None
assert a._ledger_base(None, "realizedpnl") is None

k = a._normalise_position(KOSS)
assert k["cost_basis"] == 112.0, k["cost_basis"]
assert k["unrealized_pnl"] == -104.56
assert k["unrealized_pnl_pct"] == -93.36, k["unrealized_pnl_pct"]
z = a._normalise_position(ARCO)
assert z["cost_basis"] == 0.0 and z["unrealized_pnl_pct"] is None, z

# A WINNING SHORT must report a POSITIVE pct. This account holds no shorts, so
# nothing here would have caught the signed-denominator bug: pnl/cost_basis
# reduces to (P-C)/C, which inverts once cost_basis goes negative.
SHORT = {"ticker": "SHRT", "position": -2.0, "avgCost": 50.0,
         "mktPrice": 40.0, "mktValue": -80.0, "unrealizedPnl": 20.0,
         "realizedPnl": 0.0, "assetClass": "STK"}
s = a._normalise_position(SHORT)
assert s["cost_basis"] == -100.0, s["cost_basis"]
assert s["unrealized_pnl_pct"] == 20.0, s["unrealized_pnl_pct"]

al = cls(a._normalise_allocation(ALLOC))
assert al == {"stocks": 28.2, "options": 0.0, "cash": 71.8,
              "futures": 0.0, "bonds": 0.0}, al
assert cls(a._normalise_allocation({})) == {}, "no data must emit no keys, not zeros"
assert cls(a._normalise_allocation({"assetClass": {}})) == {}, "empty breakdown must emit no keys"

src = open(sys.argv[1] + "/ibkr_portfolio_agent.py").read()
assert '"UnrealizedPnL.amount"' not in src, "account P&L still read from /summary"
assert '_safe_float(pos, "costBasisMoney"' not in src, \
    "cost_basis still read from a key the gateway does not send"
print("  self-check passed — expected next run (fixture values are the")
print("  2026-08-14 snapshot; the live figures drift with the market):")
print("    Net Liq: $40.40 CAD | Buying Power: $29.02")
print("    Unrealized P&L: $-222.13   (realized 0.00, from the ledger BASE row)")
print("    zero _safe_float warnings")
PY

echo "── All phases complete ──"
echo "Nothing was restarted; the 07:12 weekday cron run picks this up."
echo "Backup: $AGENT.$TAG"
