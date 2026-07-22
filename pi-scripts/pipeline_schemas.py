#!/usr/bin/env python3
"""Pydantic validation for AI-produced artifacts before R2 publication."""

from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class ArtifactValidationError(ValueError):
    pass


class _Artifact(BaseModel):
    model_config = ConfigDict(extra="allow")


class MarketPulse(_Artifact):
    regime: str = Field(min_length=1)
    score: float = Field(ge=0, le=10)
    confidence: float = Field(ge=0, le=10)
    one_liner: str = Field(min_length=1)


class CouncilAnalysis(_Artifact):
    meta: dict[str, Any]
    market_pulse: MarketPulse
    risks: list[str]
    trades: list[dict[str, Any]]
    narrative: str = Field(min_length=1)


class CouncilExpertOutputs(_Artifact):
    """The shape maplegamma_analysis*.json actually has in production: the
    council's raw per-expert outputs envelope, not the merged analysis. The
    validator accepts either (see _MODELS) — rejecting this shape blocked the
    entire publish run the first time validation went live."""

    meta: dict[str, Any]
    expert_outputs: dict[str, Any]


class MorningAnalysis(_Artifact):
    meta: dict[str, Any]
    market_pulse: dict[str, Any]
    opportunities: list[dict[str, Any]]
    risk_alerts: list[dict[str, Any]]
    portfolio_actions: dict[str, Any]


class StrategyImprovement(_Artifact):
    generated_at: datetime | str
    model_accuracy: dict[str, Any]
    strategy_weights: dict[str, Any]
    total_outcomes_analyzed: int = Field(ge=0)


class CouncilHistory(_Artifact):
    runs: list[dict[str, Any]]


class TradeOutcomes(_Artifact):
    entries: list[dict[str, Any]]


# Each file maps to the shapes it may legitimately have; validation passes if
# ANY of them matches.
_MODELS: dict[str, tuple[type[BaseModel], ...]] = {
    "maplegamma_analysis.json": (CouncilExpertOutputs, CouncilAnalysis),
    "maplegamma_analysis_b.json": (CouncilExpertOutputs, CouncilAnalysis),
    "morning_analysis.json": (MorningAnalysis,),
    "strategy_improvement.json": (StrategyImprovement,),
    "strategy_improvement_b.json": (StrategyImprovement,),
    "council_history.json": (CouncilHistory,),
    "trade_outcomes.json": (TradeOutcomes,),
    "trade_outcomes_b.json": (TradeOutcomes,),
}


def _assert_finite(value: Any, path: str = "$") -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ArtifactValidationError(f"{path} contains a non-finite number")
    if isinstance(value, dict):
        for key, item in value.items():
            _assert_finite(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _assert_finite(item, f"{path}[{index}]")


def validate_artifact(name: str, payload: Any) -> Any:
    """Validate JSON safety and, for AI artifacts, their semantic envelope."""
    if not isinstance(payload, (dict, list)):
        raise ArtifactValidationError(f"{name} must contain a JSON object or array")
    _assert_finite(payload)
    models = _MODELS.get(Path(name).name)
    if models:
        last_exc: ValidationError | None = None
        for model in models:
            try:
                model.model_validate(payload)
                break
            except ValidationError as exc:
                last_exc = exc
        else:
            raise ArtifactValidationError(f"{name} failed schema validation: {last_exc}") from last_exc
    return payload


def load_and_validate_artifact(path: str | Path) -> Any:
    source = Path(path)

    def reject_constant(value: str) -> None:
        raise ArtifactValidationError(f"{source.name} contains invalid JSON constant {value}")

    try:
        with source.open(encoding="utf-8") as handle:
            payload = json.load(handle, parse_constant=reject_constant)
    except (OSError, json.JSONDecodeError) as exc:
        raise ArtifactValidationError(f"unable to parse {source}: {exc}") from exc
    return validate_artifact(source.name, payload)
