#!/usr/bin/env python3
"""Regime-aware weighting for MapleGamma's five-model council.

This module is deliberately provider-neutral: the external council engine maps
its five provider/model IDs to the stable mandates below, then supplies scored
historical outcomes.  Bayesian smoothing and recency decay prevent tiny samples
from taking over the consensus, while regime affinity makes the adjustment
explainable and bounded.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Mapping


MANDATES = (
    "risk_contrarian",
    "quantitative_gex",
    "momentum",
    "trade_selector",
    "fundamental_macro",
)


@dataclass(frozen=True)
class RegimeContext:
    vix: float
    pin_distance_pct: float | None = None
    days_to_expiry: int | None = None
    macro_event_risk: bool = False

    @property
    def tags(self) -> set[str]:
        tags = {"high_vix" if self.vix >= 25 else "low_vix" if self.vix < 15 else "normal_vix"}
        if (
            self.pin_distance_pct is not None
            and abs(self.pin_distance_pct) <= 0.5
            and self.days_to_expiry is not None
            and self.days_to_expiry <= 2
        ):
            tags.add("pin_heavy_opex")
        if self.macro_event_risk:
            tags.add("macro_catalyst")
        return tags


@dataclass(frozen=True)
class ScoredOutcome:
    mandate: str
    correct: bool
    observed_at: datetime
    regime_tags: frozenset[str] = frozenset()


_AFFINITY: dict[str, dict[str, float]] = {
    "high_vix": {"risk_contrarian": 1.20, "fundamental_macro": 1.12, "momentum": 0.90},
    "pin_heavy_opex": {"quantitative_gex": 1.30, "momentum": 0.88},
    "macro_catalyst": {"fundamental_macro": 1.25, "risk_contrarian": 1.12},
    "low_vix": {"momentum": 1.12, "trade_selector": 1.06},
}


def dynamic_model_weights(
    context: RegimeContext,
    outcomes: Iterable[ScoredOutcome],
    *,
    now: datetime | None = None,
    half_life_days: float = 45.0,
    prior_strength: float = 8.0,
    min_weight: float = 0.08,
    max_weight: float = 0.36,
) -> dict[str, float]:
    """Return normalized weights for the five stable council mandates."""
    if half_life_days <= 0 or prior_strength <= 0:
        raise ValueError("half_life_days and prior_strength must be positive")
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    tags = context.tags
    wins = {mandate: prior_strength * 0.5 for mandate in MANDATES}
    samples = {mandate: prior_strength for mandate in MANDATES}

    for outcome in outcomes:
        if outcome.mandate not in wins:
            continue
        observed = outcome.observed_at
        if observed.tzinfo is None:
            observed = observed.replace(tzinfo=timezone.utc)
        age_days = max(0.0, (current - observed).total_seconds() / 86400)
        recency = math.pow(0.5, age_days / half_life_days)
        regime_match = 1.35 if tags.intersection(outcome.regime_tags) else 0.75
        contribution = recency * regime_match
        samples[outcome.mandate] += contribution
        if outcome.correct:
            wins[outcome.mandate] += contribution

    raw: dict[str, float] = {}
    for mandate in MANDATES:
        score = wins[mandate] / samples[mandate]
        for tag in tags:
            score *= _AFFINITY.get(tag, {}).get(mandate, 1.0)
        raw[mandate] = score

    total = sum(raw.values())
    normalized = {mandate: value / total for mandate, value in raw.items()}
    clipped = {mandate: min(max(value, min_weight), max_weight) for mandate, value in normalized.items()}
    clipped_total = sum(clipped.values())
    return {mandate: round(value / clipped_total, 6) for mandate, value in clipped.items()}


def weighted_consensus(predictions: Mapping[str, float], weights: Mapping[str, float]) -> float:
    """Combine -1..+1 mandate scores; missing predictions abstain."""
    active = {
        mandate: max(-1.0, min(1.0, float(score)))
        for mandate, score in predictions.items()
        if mandate in weights
    }
    denominator = sum(weights[mandate] for mandate in active)
    if denominator == 0:
        return 0.0
    return sum(active[mandate] * weights[mandate] for mandate in active) / denominator
