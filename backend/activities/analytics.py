"""
Performance Prediction Service — SPORT Platform (Milestone 5)
===============================================================
Constitution §25: Premium Analytics Layer

Provides statistically-grounded performance insights for premium users:

1. trend_analysis()  — Linear regression over weekly km totals.
   Tells the user if they are improving, declining, or stable.

2. predict_race_time() — Riegel's formula: T2 = T1 × (D2/D1)^1.06
   Classic endurance running formula, generalised for cyclists.

3. training_load()  — Acute/Chronic Workload Ratio (ACWR).
   Used in sports science to predict injury risk.
   ACWR < 0.8: detraining | 0.8–1.3: optimal | > 1.5: overtraining risk.

All computation is pure Python + statistics stdlib — no ML deps required.
"""

from __future__ import annotations

import logging
import math
import statistics
from datetime import date, timedelta
from typing import TypedDict

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Type definitions
# ---------------------------------------------------------------------------


class WeeklyLoad(TypedDict):
    week_start: str  # ISO date
    km: float


class TrendResult(TypedDict):
    slope_km_per_week: float  # Positive = improving, negative = declining
    intercept: float
    trend: str  # "IMPROVING" | "DECLINING" | "STABLE"
    r_squared: float  # Fit quality 0–1
    weeks_analysed: int


class RaceTimePrediction(TypedDict):
    target_distance_km: float
    predicted_time_s: float
    predicted_pace_s_per_km: float
    confidence: str  # "HIGH" | "MEDIUM" | "LOW"
    formula: str  # "riegel"


class ACWRResult(TypedDict):
    acwr: float
    acute_km: float  # Last 7 days
    chronic_km: float  # Rolling 28-day average
    status: str  # "OPTIMAL" | "UNDERTRAINED" | "OVERTRAINING_RISK"
    recommendation: str


# ---------------------------------------------------------------------------
# Trend Analysis
# ---------------------------------------------------------------------------


def trend_analysis(weekly_loads: list[WeeklyLoad]) -> TrendResult | None:
    """
    Fits a linear regression to weekly training volume (km).

    Args:
        weekly_loads: List of dicts {week_start, km}, oldest first.

    Returns:
        TrendResult with slope, R², and trend label, or None if too few weeks.
    """
    if len(weekly_loads) < 4:
        return None

    n = len(weekly_loads)
    xs = list(range(n))
    ys = [w["km"] for w in weekly_loads]

    x_mean = statistics.mean(xs)
    y_mean = statistics.mean(ys)

    ss_xy = sum((xs[i] - x_mean) * (ys[i] - y_mean) for i in range(n))
    ss_xx = sum((xs[i] - x_mean) ** 2 for i in range(n))

    if ss_xx == 0:
        return None

    slope = ss_xy / ss_xx
    intercept = y_mean - slope * x_mean

    # R²
    y_pred = [slope * x + intercept for x in xs]
    ss_res = sum((ys[i] - y_pred[i]) ** 2 for i in range(n))
    ss_tot = sum((ys[i] - y_mean) ** 2 for i in range(n))
    r2 = 1 - (ss_res / max(ss_tot, 0.0001))

    if slope > 0.5:
        trend = "IMPROVING"
    elif slope < -0.5:
        trend = "DECLINING"
    else:
        trend = "STABLE"

    return TrendResult(
        slope_km_per_week=round(slope, 2),
        intercept=round(intercept, 2),
        trend=trend,
        r_squared=round(max(r2, 0.0), 3),
        weeks_analysed=n,
    )


# ---------------------------------------------------------------------------
# Race Time Prediction (Riegel's Formula)
# ---------------------------------------------------------------------------


def predict_race_time(
    reference_distance_km: float,
    reference_time_s: float,
    target_distance_km: float,
    activity_type: str = "RUN",
) -> RaceTimePrediction | None:
    """
    Predicts finish time for a target distance using Riegel's formula:
        T2 = T1 × (D2 / D1) ^ exponent

    Exponents by activity type:
        RUN:  1.06 (standard Riegel)
        BIKE: 1.02 (road cycling — less exponential fatigue)
        WALK: 1.10 (slower speeds, more fatigue)

    Args:
        reference_distance_km: Distance of known best effort.
        reference_time_s: Time of known best effort in seconds.
        target_distance_km: Distance to predict for.
        activity_type: SPORT activity type string.

    Returns:
        RaceTimePrediction or None on invalid input.
    """
    if reference_distance_km <= 0 or reference_time_s <= 0 or target_distance_km <= 0:
        return None

    exponents = {"RUN": 1.06, "BIKE": 1.02, "WALK": 1.10, "WHEELCHAIR": 1.08}
    exp = exponents.get(activity_type.upper(), 1.06)

    ratio = target_distance_km / reference_distance_km
    predicted_s = reference_time_s * (ratio**exp)
    pace_s_per_km = predicted_s / target_distance_km

    # Confidence based on ratio distance
    if ratio <= 3.0:
        confidence = "HIGH"
    elif ratio <= 6.0:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return RaceTimePrediction(
        target_distance_km=target_distance_km,
        predicted_time_s=round(predicted_s, 1),
        predicted_pace_s_per_km=round(pace_s_per_km, 1),
        confidence=confidence,
        formula="riegel",
    )


# ---------------------------------------------------------------------------
# Acute/Chronic Workload Ratio (ACWR)
# ---------------------------------------------------------------------------


def training_load(daily_km: dict[date, float]) -> ACWRResult | None:
    """
    Calculates the Acute/Chronic Workload Ratio for injury risk assessment.

    ACWR = Acute (7-day sum) / Chronic (28-day rolling avg × 7)

    Risk zones:
        < 0.80 → UNDERTRAINED (reduced fitness adaptation)
        0.80 – 1.30 → OPTIMAL ("sweet spot")
        > 1.50 → OVERTRAINING_RISK (injury probability ↑)

    Args:
        daily_km: Dict mapping date → km run that day.

    Returns:
        ACWRResult or None if insufficient data.
    """
    if len(daily_km) < 7:
        return None

    today = max(daily_km.keys())

    # Acute: sum of last 7 days
    acute_km = sum(daily_km.get(today - timedelta(days=i), 0.0) for i in range(7))

    # Chronic: mean of last 4 × 7-day blocks (28 days)
    weekly_sums = []
    for week in range(4):
        start = week * 7
        week_km = sum(daily_km.get(today - timedelta(days=start + i), 0.0) for i in range(7))
        weekly_sums.append(week_km)

    chronic_weekly = statistics.mean(weekly_sums) if weekly_sums else 0.0

    if chronic_weekly < 0.1:
        return None  # New user, no chronic baseline

    acwr = round(acute_km / chronic_weekly, 2)

    if acwr < 0.80:
        status = "UNDERTRAINED"
        rec = "Increase training volume gradually (+10% per week)."
    elif acwr > 1.50:
        status = "OVERTRAINING_RISK"
        rec = "Reduce load immediately. Take 1–2 recovery days."
    elif acwr > 1.30:
        status = "ELEVATED"
        rec = "You are pushing hard. Monitor recovery closely."
    else:
        status = "OPTIMAL"
        rec = "Training load is in the sweet spot. Keep it up!"

    return ACWRResult(
        acwr=acwr,
        acute_km=round(acute_km, 2),
        chronic_km=round(chronic_weekly, 2),
        status=status,
        recommendation=rec,
    )
