#!/usr/bin/env python3
"""generate_agentic_os.py — produces data/agentic-os.json for the dashboard.

Reads available system state from the Pi and writes a JSON file that the
Agentic OS dashboard page renders. Called from the morning briefing pipeline.

Stdlib only.
"""
import json
import os
import time
from pathlib import Path

HOME = Path.home()
HERMES_HOME = HOME / ".hermes"
DATA_DIR = HOME / "morning-briefing" / "data"
OUTPUT = DATA_DIR / "agentic-os.json"

# Data sources
HEARTBEAT = HERMES_HOME / "data" / "heartbeats" / "stop_loss_monitor.json"
WATCHDOG_STATE = HERMES_HOME / "data" / "watchdog" / "watchdog.state"
SKILLS_DIR = HERMES_HOME / "skills"
USAGE_DIR = HOME / "usage-analytics" / "aggregated" / "daily"
REC_CRON_STATE = HERMES_HOME / "data" / "rec_cron" / "state.json"
DISABLED_FLAG = HERMES_HOME / "data" / "rec_cron" / ".disabled"

# API keys (masked)
ENV_FILE = HERMES_HOME / ".env"


def load_json(path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def get_watchdog_status():
    """Read heartbeat + watchdog state."""
    hb = load_json(HEARTBEAT)
    ws = load_json(WATCHDOG_STATE)
    
    if hb is None:
        return {"status": "inactive", "last_heartbeat": None}
    
    age = int(time.time()) - hb.get("ts", 0)
    return {
        "status": hb.get("status", "unknown"),
        "age_s": age,
        "broker_reachable": hb.get("broker_reachable", False),
        "open_positions": hb.get("open_positions", 0),
        "stops_armed": hb.get("stops_armed", 0),
        "unprotected": hb.get("unprotected", 0),
        "last_heartbeat": hb.get("ts"),
        "consecutive_failures": ws.get("consecutive_failures", 0) if ws else 0,
        "last_status": ws.get("last_status", "ok") if ws else "ok",
    }


def get_skills_summary():
    """Count skills by category using glob for nested structure."""
    if not SKILLS_DIR.exists():
        return {"total": 0, "by_category": {}}
    
    by_cat = {}
    total = 0
    for f in SKILLS_DIR.rglob("SKILL.md"):
        total += 1
        cat = f.parent.parent.name  # e.g., finance/cost-tripwire/SKILL.md -> finance
        if cat == ".git" or cat.startswith("."):
            continue
        by_cat[cat] = by_cat.get(cat, 0) + 1
    
    return {"total": total, "by_category": by_cat}


def get_usage_summary():
    """Read last 7 days of usage data."""
    if not USAGE_DIR.exists():
        return {"days": 0, "total_prompts": 0, "total_commands": 0}
    
    total_prompts = 0
    total_commands = 0
    days = 0
    today = time.time()
    
    for i in range(7):
        d = time.strftime("%Y-%m-%d", time.gmtime(today - i * 86400))
        f = USAGE_DIR / f"{d}.json"
        data = load_json(f)
        if data:
            days += 1
            claude = data.get("claude", {})
            codex = data.get("codex", {})
            term = data.get("terminal", {})
            total_prompts += claude.get("prompts_today", 0) + codex.get("prompts_today", 0)
            total_commands += term.get("total_commands", 0)
    
    return {"days": days, "total_prompts": total_prompts, "total_commands": total_commands}


def get_rec_cron_status():
    """Read rec cron state."""
    state = load_json(REC_CRON_STATE)
    disabled = DISABLED_FLAG.exists()
    
    if state is None:
        return {"status": "idle", "disabled": disabled}
    
    unacked = state.get("unacked_since", 0)
    last_sent = state.get("last_sent_ts", 0)
    now = int(time.time())
    
    return {
        "status": "disabled" if disabled else "active",
        "disabled": disabled,
        "last_findings_sent": last_sent,
        "hours_since_last_send": (now - last_sent) // 3600 if last_sent else None,
        "unacked_since": unacked,
        "kill_clock_running": unacked > 0,
        "hours_until_auto_disable": max(0, (168 - (now - unacked)) // 3600) if unacked else None,
    }


def get_model_info():
    """Extract model/provider info from Hermes config."""
    config_path = HERMES_HOME / "config.yaml"
    if not config_path.exists():
        return {"model": "unknown", "provider": "unknown"}
    
    model = "unknown"
    provider = "unknown"
    try:
        for line in config_path.read_text().splitlines():
            if line.strip().startswith("default:"):
                model = line.split(":", 1)[1].strip().strip('"').strip("'")
            if line.strip().startswith("provider:"):
                provider = line.split(":", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return {"model": model, "provider": provider}


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "generated_on": os.uname().nodename,
        "system": get_model_info(),
        "watchdog": get_watchdog_status(),
        "rec_cron": get_rec_cron_status(),
        "skills": get_skills_summary(),
        "usage_7d": get_usage_summary(),
    }
    
    tmp = OUTPUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(report, indent=2))
    tmp.replace(OUTPUT)
    print(f"[agentic-os] Written to {OUTPUT}")


if __name__ == "__main__":
    main()
