#!/usr/bin/env python3
"""Shared reliability primitives for MapleGamma's Pi ingestion jobs.

The data collectors use blocking SDKs/urllib calls.  ``run_blocking_pool`` keeps
those calls off the asyncio event loop while bounding concurrency and request
start rate.  The HTTP helpers retry only transient failures and respect
``Retry-After`` when an upstream explicitly rate-limits the pipeline.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Callable, Iterable, TypeVar


T = TypeVar("T")
R = TypeVar("R")
_RETRIABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}


@dataclass(frozen=True)
class RetryConfig:
    attempts: int = 4
    base_delay: float = 0.5
    max_delay: float = 8.0
    jitter: float = 0.2

    def __post_init__(self) -> None:
        if self.attempts < 1:
            raise ValueError("attempts must be at least 1")
        if self.base_delay < 0 or self.max_delay < 0 or self.jitter < 0:
            raise ValueError("retry delays must be non-negative")


class RequestFailed(RuntimeError):
    """Raised after a request exhausts its transient retry budget."""


def _retry_after_seconds(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            retry_at = parsedate_to_datetime(value)
            return max(0.0, retry_at.timestamp() - time.time())
        except (TypeError, ValueError, OverflowError):
            return None


def _backoff_delay(config: RetryConfig, attempt: int, retry_after: str | None) -> float:
    explicit = _retry_after_seconds(retry_after)
    if explicit is not None:
        return min(explicit, config.max_delay)
    exponential = min(config.max_delay, config.base_delay * (2**attempt))
    return exponential + random.uniform(0, config.jitter)


def request_bytes(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 30,
    retry: RetryConfig = RetryConfig(),
    sleep: Callable[[float], None] = time.sleep,
) -> bytes:
    """Fetch bytes with bounded exponential backoff for transient failures."""
    last_error: Exception | None = None
    for attempt in range(retry.attempts):
        try:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in _RETRIABLE_STATUS or attempt == retry.attempts - 1:
                break
            sleep(_backoff_delay(retry, attempt, exc.headers.get("Retry-After")))
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last_error = exc
            if attempt == retry.attempts - 1:
                break
            sleep(_backoff_delay(retry, attempt, None))

    raise RequestFailed(f"request failed after {retry.attempts} attempt(s): {url}: {last_error}")


def request_json(url: str, **kwargs: Any) -> Any:
    """Fetch strict JSON, rejecting NaN/Infinity constants."""
    raw = request_bytes(url, **kwargs)

    def reject_constant(value: str) -> None:
        raise ValueError(f"non-finite JSON constant: {value}")

    return json.loads(raw.decode("utf-8"), parse_constant=reject_constant)


def request_text(url: str, **kwargs: Any) -> str:
    return request_bytes(url, **kwargs).decode("utf-8", errors="replace")


def atomic_write_json(path: str | Path, payload: Any) -> None:
    """Durably replace a JSON artifact without exposing a partial file."""
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, destination)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


async def run_blocking_pool(
    items: Iterable[T],
    worker: Callable[[T], R],
    *,
    max_concurrency: int = 4,
    min_start_interval: float = 0.0,
) -> list[R]:
    """Run blocking work concurrently with a global request-start interval."""
    if max_concurrency < 1:
        raise ValueError("max_concurrency must be at least 1")
    if min_start_interval < 0:
        raise ValueError("min_start_interval must be non-negative")

    semaphore = asyncio.Semaphore(max_concurrency)
    start_lock = asyncio.Lock()
    next_start = 0.0

    async def run_one(item: T) -> R:
        nonlocal next_start
        async with semaphore:
            if min_start_interval:
                async with start_lock:
                    loop = asyncio.get_running_loop()
                    delay = next_start - loop.time()
                    if delay > 0:
                        await asyncio.sleep(delay)
                    next_start = loop.time() + min_start_interval
            return await asyncio.to_thread(worker, item)

    return await asyncio.gather(*(run_one(item) for item in items))
