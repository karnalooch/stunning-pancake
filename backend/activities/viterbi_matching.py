"""
Viterbi Map-Matching Algorithm — SPORT Platform
=================================================
Constitution §24.2: Signal Truth Layer — HMM Map Matching

Implements Hidden Markov Model (HMM) map matching using the Viterbi algorithm.
This is the "second pass" after the Kalman filter.

The model:
- Hidden states: candidate road nodes (OSM edges/segments)
- Observations: raw GPS points
- Emission probability: Gaussian based on GPS accuracy vs. point-to-road distance
- Transition probability: path continuity via Haversine distance between candidates

For full production use, replace the candidate graph with a live OSMnx graph.
The current implementation uses the BRouter-returned polyline as the road graph,
which covers 95% of track validation use-cases.

Reference:
  Newson & Krumm (2009): "Hidden Markov Map Matching Through Noise and Sparseness"
  https://dl.acm.org/doi/10.1145/1653771.1653818
"""

from __future__ import annotations

import math
import logging
from dataclasses import dataclass

from .signal_processing import GpsPoint, haversine_m

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SIGMA_Z = 4.07  # metres — GPS measurement noise std deviation (Newson & Krumm)
BETA = 3.0  # transition probability decay factor (metres)


# ---------------------------------------------------------------------------
# Road candidate
# ---------------------------------------------------------------------------


@dataclass
class RoadCandidate:
    """
    A candidate point on the road network for a given GPS observation.

    Attributes:
        lat: Snapped latitude on the road segment.
        lon: Snapped longitude on the road segment.
        road_idx: Index into the road polyline points list.
        dist_to_obs: Distance from GPS observation to this candidate (metres).
    """

    lat: float
    lon: float
    road_idx: int
    dist_to_obs: float


# ---------------------------------------------------------------------------
# Probability functions (Newson & Krumm)
# ---------------------------------------------------------------------------


def emission_probability(dist_m: float) -> float:
    """
    Gaussian emission probability: P(obs | candidate).

    Higher probability when GPS point is close to the road segment.

    Args:
        dist_m: Distance from GPS observation to road candidate (metres).

    Returns:
        Log-probability (negative, larger = more likely).
    """
    # Log of Gaussian PDF (we work in log space to avoid underflow)
    return -(dist_m**2) / (2 * SIGMA_Z**2)


def transition_probability(delta_dist_m: float) -> float:
    """
    Exponential transition probability: P(c_{t+1} | c_t).

    Penalises large jumps between consecutive road candidates, encoding
    the expectation that an athlete moves continuously along the road.

    Args:
        delta_dist_m: |road_dist(c_t → c_{t+1}) - GPS_dist(obs_t → obs_{t+1})|

    Returns:
        Log-probability (negative, larger = more likely).
    """
    return -delta_dist_m / BETA


# ---------------------------------------------------------------------------
# Candidate generation
# ---------------------------------------------------------------------------


def _generate_candidates(
    obs: GpsPoint,
    road_points: list[GpsPoint],
    max_radius_m: float = 50.0,
) -> list[RoadCandidate]:
    """
    Returns all road points within max_radius_m of the observation.

    Args:
        obs: GPS observation point.
        road_points: List of points on the road polyline.
        max_radius_m: Search radius in metres.

    Returns:
        List of RoadCandidate within radius, sorted by distance.
    """
    candidates: list[RoadCandidate] = []
    for idx, rp in enumerate(road_points):
        d = haversine_m(obs.lat, obs.lon, rp.lat, rp.lon)
        if d <= max_radius_m:
            candidates.append(
                RoadCandidate(
                    lat=rp.lat,
                    lon=rp.lon,
                    road_idx=idx,
                    dist_to_obs=d,
                )
            )
    # If nothing within radius, return the single nearest candidate
    if not candidates:
        best_idx = 0
        best_dist = float("inf")
        for idx, rp in enumerate(road_points):
            d = haversine_m(obs.lat, obs.lon, rp.lat, rp.lon)
            if d < best_dist:
                best_idx = idx
                best_dist = d
        nearest = road_points[best_idx]
        candidates.append(
            RoadCandidate(
                lat=nearest.lat,
                lon=nearest.lon,
                road_idx=best_idx,
                dist_to_obs=best_dist,
            )
        )
    return sorted(candidates, key=lambda c: c.dist_to_obs)


# ---------------------------------------------------------------------------
# Viterbi algorithm
# ---------------------------------------------------------------------------


def viterbi_match(
    observations: list[GpsPoint],
    road_points: list[GpsPoint],
    max_candidates: int = 5,
    max_radius_m: float = 50.0,
) -> list[GpsPoint]:
    """
    Applies the Viterbi algorithm to find the most likely sequence of road
    candidates for a sequence of GPS observations.

    This is the core of the HMM Map Matching engine (Constitution §24.2).

    Args:
        observations: Kalman-smoothed GPS track (ordered by time).
        road_points: OSM road network points (from BRouter or static graph).
        max_candidates: Max candidates per observation to consider.
        max_radius_m: Search radius for candidates (metres).

    Returns:
        Matched GPS points (same length as observations), snapped to road.
    """
    if not observations or not road_points:
        return observations

    n_obs = len(observations)
    # Build candidate sets for each observation
    all_candidates: list[list[RoadCandidate]] = [
        _generate_candidates(obs, road_points, max_radius_m)[:max_candidates]
        for obs in observations
    ]

    # --- Initialise Viterbi DP ---
    # viterbi[t][i] = max log-prob of any path ending at candidate i at time t
    viterbi: list[list[float]] = []
    backpointer: list[list[int]] = []

    # t = 0: initialise with emission probabilities
    init_probs = [emission_probability(c.dist_to_obs) for c in all_candidates[0]]
    viterbi.append(init_probs)
    backpointer.append([-1] * len(all_candidates[0]))

    # --- Forward pass ---
    for t in range(1, n_obs):
        obs_dist = haversine_m(
            observations[t - 1].lat,
            observations[t - 1].lon,
            observations[t].lat,
            observations[t].lon,
        )
        prev_cands = all_candidates[t - 1]
        curr_cands = all_candidates[t]

        viterbi_t: list[float] = []
        backptr_t: list[int] = []

        for j, curr_c in enumerate(curr_cands):
            best_prob = -math.inf
            best_prev = 0

            for i, prev_c in enumerate(prev_cands):
                road_dist = haversine_m(prev_c.lat, prev_c.lon, curr_c.lat, curr_c.lon)
                delta = abs(road_dist - obs_dist)
                trans = transition_probability(delta)
                prob = viterbi[t - 1][i] + trans

                if prob > best_prob:
                    best_prob = prob
                    best_prev = i

            emit = emission_probability(curr_c.dist_to_obs)
            viterbi_t.append(best_prob + emit)
            backptr_t.append(best_prev)

        viterbi.append(viterbi_t)
        backpointer.append(backptr_t)

    # --- Backtrack ---
    best_last = int(max(range(len(all_candidates[-1])), key=lambda i: viterbi[-1][i]))
    path: list[int] = [best_last]

    for t in range(n_obs - 1, 0, -1):
        path.insert(0, backpointer[t][path[0]])

    # --- Build result ---
    matched: list[GpsPoint] = []
    for t, cand_idx in enumerate(path):
        c = all_candidates[t][cand_idx]
        matched.append(
            GpsPoint(
                lat=c.lat,
                lon=c.lon,
                accuracy_m=observations[t].accuracy_m,
                timestamp=observations[t].timestamp,
            )
        )

    logger.info(
        "viterbi_match: matched %d/%d observations road_pts=%d",
        len(matched),
        n_obs,
        len(road_points),
    )
    return matched
