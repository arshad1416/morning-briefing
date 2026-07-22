#!/usr/bin/env python3
"""
R2 sync for the MapleGamma paywall hard gate.

- make_screener_lite(): writes the PUBLIC screener-lite.json (market summary +
  top-8 tickers) that the free Dashboard's sector section uses, so the full
  screener-data.json can be private.
- sync_private_to_r2(): uploads the premium file set to the private R2 bucket
  (S3 API via boto3). Credentials come from ~/.hermes/.env (R2_ACCESS_KEY_ID /
  R2_SECRET_ACCESS_KEY / R2_S3_ENDPOINT) — never hard-coded.

The private set MUST mirror the Worker's data_gate.js. Both are best-effort and
wrapped by the caller so a sync hiccup never blocks the data pipeline.
"""
import json
import os
import sys

from pipeline_runtime import atomic_write_json
from pipeline_schemas import ArtifactValidationError, load_and_validate_artifact

DATA_DIR = os.path.expanduser("~/morning-briefing/data")
# Dedicated creds file (nothing else manages it) preferred over the big .env,
# which hermes may regenerate and wipe manual edits.
ENV_FILES = [os.path.expanduser("~/.hermes/.r2_env"), os.path.expanduser("~/.hermes/.env")]
BUCKET = "maplegamma-private"

PRIVATE_FILES = [
    # basic tier
    "screener-data.json", "morning_analysis.json", "maplegamma_analysis.json",
    "web-news.json", "polymarket_sentiment.json", "earnings.json",
    "sec_filings.json", "journal.json", "paper_trades.json",
    # pro tier
    "walk_forward_v2.json", "walk_forward.json", "strategy_improvement.json",
    "strategy_improvement_b.json", "trade_outcomes.json", "trade_outcomes_b.json",
    "prediction-engine.json", "accuracy.json", "council_history.json",
    "simulation.json", "gex-detail.json", "nope-detail.json",
    "ibkr_account.json", "ibkr_positions.json", "ibkr_trades.json",
]


def _load_r2_env():
    env = {}
    for path in ENV_FILES:
        if not os.path.exists(path):
            continue
        for line in open(path):
            line = line.strip()
            if line.startswith("export "):
                line = line[len("export "):].strip()
            if line and not line.startswith("#") and "=" in line and line.startswith("R2_"):
                k, _, v = line.partition("=")
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        if {"R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_S3_ENDPOINT"} <= set(env):
            break
    return env


def make_screener_lite():
    """Public teaser derived from the (now-private) full screener."""
    src = os.path.join(DATA_DIR, "screener-data.json")
    if not os.path.exists(src):
        return False
    try:
        d = json.load(open(src))
    except Exception:
        return False
    tickers = sorted(d.get("tickers", []), key=lambda t: t.get("score") or 0, reverse=True)
    lite = {
        "generated_at": d.get("generated_at"),
        "ticker_count": d.get("ticker_count"),
        "market_summary": d.get("market_summary", {}),  # sector_breakdown lives here
        "tickers": tickers[:8],
        "_note": "Public teaser — full screener is subscriber-only via /api/data/screener-data.json",
    }
    out = os.path.join(DATA_DIR, "screener-lite.json")
    atomic_write_json(out, lite)
    return True


def sync_private_to_r2():
    """Upload the premium set + charts to R2. Returns (uploaded, skipped)."""
    env = _load_r2_env()
    ak, sk, ep = env.get("R2_ACCESS_KEY_ID"), env.get("R2_SECRET_ACCESS_KEY"), env.get("R2_S3_ENDPOINT")
    if not (ak and sk and ep):
        print("  R2 sync: creds not set in ~/.hermes/.env — skipping", file=sys.stderr)
        return (0, 0)
    import boto3
    from botocore.config import Config
    s3 = boto3.client(
        "s3", endpoint_url=ep, aws_access_key_id=ak, aws_secret_access_key=sk,
        config=Config(signature_version="s3v4", region_name="auto"),
    )
    uploaded = skipped = 0

    def put(key, path):
        nonlocal uploaded, skipped
        try:
            # R2 is the publish/database boundary for premium AI artifacts.
            # Reject malformed schemas and non-standard NaN/Infinity values
            # before subscribers or webhook consumers can receive them.
            load_and_validate_artifact(path)
            s3.upload_file(path, BUCKET, key, ExtraArgs={"ContentType": "application/json"})
            uploaded += 1
        except ArtifactValidationError as e:
            skipped += 1
            print(f"  R2 validation failed {key}: {e}", file=sys.stderr)
        except Exception as e:
            skipped += 1
            print(f"  R2 put failed {key}: {e}", file=sys.stderr)

    for f in PRIVATE_FILES:
        p = os.path.join(DATA_DIR, f)
        if os.path.exists(p):
            put(f, p)
    charts_dir = os.path.join(DATA_DIR, "charts")
    if os.path.isdir(charts_dir):
        for fn in os.listdir(charts_dir):
            if fn.endswith(".json"):
                put(f"charts/{fn}", os.path.join(charts_dir, fn))
    print(f"  R2 sync: {uploaded} uploaded, {skipped} skipped")
    return (uploaded, skipped)


def run():
    make_screener_lite()
    return sync_private_to_r2()


if __name__ == "__main__":
    run()
