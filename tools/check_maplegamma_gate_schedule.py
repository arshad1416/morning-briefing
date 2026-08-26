#!/usr/bin/env python3
"""Validate the fail-closed MapleGamma morning gate schedule."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import sys


@dataclass(frozen=True)
class CronEntry:
    minutes: tuple[int, ...]
    hour: int
    day_of_week: str
    command: str


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_minutes(raw: str, line: str) -> tuple[int, ...]:
    try:
        minutes = tuple(sorted({int(part) for part in raw.split(",")}))
    except ValueError:
        fail(f"unsupported minute field {raw!r} in: {line}")
    if not minutes or any(minute < 0 or minute > 59 for minute in minutes):
        fail(f"invalid minute field {raw!r} in: {line}")
    return minutes


def parse_entries(contents: str) -> list[CronEntry]:
    entries: list[CronEntry] = []
    for raw_line in contents.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" in line.split(maxsplit=1)[0]:
            continue
        fields = line.split(maxsplit=5)
        if len(fields) != 6:
            continue
        minute, hour, _day, _month, day_of_week, command = fields
        try:
            parsed_hour = int(hour)
        except ValueError:
            continue
        entries.append(
            CronEntry(parse_minutes(minute, line), parsed_hour, day_of_week, command)
        )
    return entries


def one_entry(entries: list[CronEntry], marker: str, label: str) -> CronEntry:
    matches = [entry for entry in entries if marker in entry.command]
    if len(matches) != 1:
        fail(f"expected exactly one {label}; found {len(matches)}")
    return matches[0]


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: check_maplegamma_gate_schedule.py CRONTAB_FILE")
    contents = Path(sys.argv[1]).read_text(encoding="utf-8")

    gate_days = re.findall(r"^MAPLEGAMMA_GATE_DAYS=([^\s#]+)", contents, re.MULTILINE)
    if gate_days != ["0,1,2,3,4"]:
        fail(
            "MAPLEGAMMA_GATE_DAYS must appear once and cover every Python weekday "
            f"(got {gate_days!r})"
        )

    entries = parse_entries(contents)
    producer = one_entry(entries, "run_maplegamma_gate.sh", "gate producer")
    watchdog = one_entry(entries, "mg_gate_watchdog.py", "gate watchdog")
    executor_a = one_entry(
        [entry for entry in entries if "--variant b" not in entry.command],
        "council_trade_executor.py",
        "variant-A council executor",
    )
    executor_b = one_entry(
        [entry for entry in entries if "--variant b" in entry.command],
        "council_trade_executor.py",
        "variant-B council executor",
    )
    briefing = one_entry(
        entries, "send_comprehensive_briefing.py", "briefing consumer"
    )
    paper = one_entry(entries, "automated_paper_trader.py", "paper-trader consumer")

    if (producer.minutes, producer.hour, producer.day_of_week) != (
        (34, 36, 38),
        7,
        "1-5",
    ):
        fail("gate producer must run at 07:34, 07:36, and 07:38 on weekdays")
    for required in (
        "/usr/bin/flock -n /tmp/maplegamma_gate.lock",
        "/usr/bin/timeout 90",
    ):
        if required not in producer.command:
            fail(f"gate producer missing bounded/locked execution: {required}")

    if (watchdog.minutes, watchdog.hour, watchdog.day_of_week) != (
        (40, 50),
        7,
        "1-5",
    ):
        fail("gate watchdog must run at 07:40 and 07:50 on weekdays")

    consumers = (executor_a, executor_b, briefing, paper)
    if any(entry.hour != 7 for entry in consumers):
        fail("all guarded morning consumers must remain in the 07:00 hour")
    first_consumer = min(min(entry.minutes) for entry in consumers)
    if max(producer.minutes) >= min(watchdog.minutes):
        fail("gate producer retries must finish before the first watchdog")
    if min(watchdog.minutes) >= first_consumer:
        fail("gate watchdog must run before the first guarded consumer")

    print(
        "PASS: gate schedule OK "
        "(producer 07:34/36/38 -> watchdog 07:40 -> consumers 07:41+)"
    )


if __name__ == "__main__":
    main()
