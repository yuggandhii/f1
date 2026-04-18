"""
app/simulation/performance_model.py — Driver rating dataclass + vectorised pace sampling.

All functions are pure NumPy, no DB or I/O calls.

Key design choice — competitive compression:
    Raw normalized ratings span [0, 1] across all 24 drivers (including backmarkers).
    To avoid the best driver winning every single race we compress pace to [0.5, 1.0],
    reflecting that even a backmarker is a competitive F1 driver.  The noise term is
    then of similar magnitude to the pace differences.

    effective_pace = 0.5 + 0.5 * composite_pace   →  range [0.5, 1.0]

Car vs driver split (PRD §7 update):
    composite_pace = driver.base_pace * 0.35 + car_performance * 0.65
    This reflects real F1 where the car accounts for ~65% of lap time.

Noise model (following PRD §7):
    sigma_i = max(BASE_VARIANCE, (1 − consistency_i) × randomness_factor)
    BASE_VARIANCE = 0.02  — minimum noise so even the most consistent driver has variance
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

# Column indices in the ratings matrix built by `build_ratings_matrix`.
_IDX_BASE_PACE      = 0
_IDX_CONSISTENCY    = 1
_IDX_WET_SKILL      = 2
_IDX_TYRE_MGMT      = 3
_IDX_OVERTAKE       = 4
_IDX_DNF_RATE       = 5  # total = mech + driver (backwards compat)
_IDX_QUAL_EDGE      = 6
_IDX_CAR_PERF       = 7  # team car performance (0–1)
_IDX_MECH_DNF_RATE  = 8  # car-failure DNFs, team-averaged
_IDX_DRIVER_DNF_RATE = 9 # crash/error DNFs, individual

# Pace compression floor: all F1 drivers score at least this pace.
_COMPETITIVE_FLOOR = 0.5

# Minimum per-simulation noise (ensures variance even for consistent drivers).
_BASE_VARIANCE = 0.02

# Wet weather bonus weight (PRD §7: mu += wet_skill * 0.15).
_WET_BONUS_WEIGHT = 0.15

# Safety car / yellow flag randomness injection — added to sigma when sc_prob > 0.
_SC_SIGMA_MULTIPLIER = 0.5

# Car vs driver contribution weights
_DRIVER_WEIGHT = 0.35
_CAR_WEIGHT = 0.65

# Qualifying edge contributes a small race pace bonus: good qualifying setups
# tend to carry into race pace (real-world correlation ~2–3%).
_QUAL_RACE_BONUS = 0.025


# ---------------------------------------------------------------------------
# Data contract
# ---------------------------------------------------------------------------

@dataclass
class DriverRating:
    """Normalised performance ratings for one driver in one season.

    All float fields are in [0, 1].  Lower dnf_rate is better.
    car_performance reflects the team's car for the season (0–1).

    DNF split (columns 8–9 in the ratings matrix):
      mechanical_dnf_rate: car-failure DNFs, team-averaged so both teammates
          carry the same factory reliability burden (e.g. Ferrari 2022).
      driver_dnf_rate: crash / driver-error DNFs, individual.
      dnf_rate: kept as the sum of the above for backwards compatibility.
    """
    driver_id: str
    base_pace: float        # 0-1: higher = faster median lap time
    consistency: float      # 0-1: higher = more consistent lap-to-lap
    wet_skill: float        # 0-1: higher = better wet-weather pace
    tyre_management: float  # 0-1: higher = longer stints
    overtake_skill: float   # 0-1: higher = better at gaining positions
    dnf_rate: float         # 0-1: LOWER is better (mech + driver, back-compat)
    qualifying_edge: float  # 0-1: higher = better qualifier
    car_performance: float = field(default=0.5)       # 0-1: team car rating for the season
    mechanical_dnf_rate: float = field(default=0.0)   # car-failure DNFs, team-averaged
    driver_dnf_rate: float = field(default=0.0)       # crash/error DNFs, individual


# ---------------------------------------------------------------------------
# Matrix helpers
# ---------------------------------------------------------------------------

def build_ratings_matrix(ratings: list[DriverRating]) -> np.ndarray:
    """
    Convert a list of DriverRating into a (n_drivers, 10) float32 array.
    Column order matches the _IDX_* constants above.
    """
    n = len(ratings)
    mat = np.empty((n, 10), dtype=np.float32)
    for i, r in enumerate(ratings):
        mat[i] = [
            r.base_pace, r.consistency, r.wet_skill, r.tyre_management,
            r.overtake_skill, r.dnf_rate, r.qualifying_edge, r.car_performance,
            r.mechanical_dnf_rate, r.driver_dnf_rate,
        ]
    return mat


def _effective_pace(mat: np.ndarray, weather: str) -> np.ndarray:
    """
    (n_drivers,) float32 — compressed effective pace for race simulation.

    composite_pace = driver_pace * 0.35 + car_performance * 0.65 + qual_edge * 0.025
    The qualifying edge bonus captures the real-world correlation between
    qualifying setup quality and race pace (~2-3%).
    In wet conditions: wet_skill contributes 15% bonus.
    """
    driver_pace = mat[:, _IDX_BASE_PACE]
    car_perf    = mat[:, _IDX_CAR_PERF]
    qual_edge   = mat[:, _IDX_QUAL_EDGE]
    composite   = (
        _DRIVER_WEIGHT * driver_pace
        + _CAR_WEIGHT * car_perf
        + qual_edge * _QUAL_RACE_BONUS
    ).clip(0.0, 1.0)

    if weather == "wet":
        wet  = mat[:, _IDX_WET_SKILL]
        composite = (composite + wet * _WET_BONUS_WEIGHT).clip(0.0, 1.15)

    # Compress to [_COMPETITIVE_FLOOR, 1.0 + extra].
    return _COMPETITIVE_FLOOR + (1.0 - _COMPETITIVE_FLOOR) * composite


# ---------------------------------------------------------------------------
# Qualifying sampler (simple version — see qualifying_simulator.py for Q1/Q2/Q3)
# ---------------------------------------------------------------------------

def sample_qualifying_grid(
    mat: np.ndarray,          # (n_drivers, 8)
    weather: str,
    randomness: float,
    rng: np.random.Generator,
    n_sims: int,
) -> np.ndarray:
    """
    Sample qualifying grid positions for all simulations (simple single-session model).
    Used as fallback when qualifying_simulator is not available.

    Returns:
        grid_positions: (n_sims, n_drivers) int32, 1-indexed (1 = pole)
    """
    n_drivers = mat.shape[0]
    qual_base = _effective_pace(mat, weather)          # (n_drivers,)
    qual_bonus = mat[:, _IDX_QUAL_EDGE] * 0.05        # up to 5% bonus
    mu = qual_base + qual_bonus                         # (n_drivers,)

    # Lower variance in qualifying.
    consistency = mat[:, _IDX_CONSISTENCY]
    sigma = np.maximum(
        _BASE_VARIANCE * 0.6,
        (1.0 - consistency) * randomness * 0.6,
    )  # (n_drivers,)

    noise = rng.normal(0.0, sigma, size=(n_sims, n_drivers)).astype(np.float32)
    qual_scores = mu[np.newaxis, :] + noise            # (n_sims, n_drivers)

    # argsort descending → rank (0-indexed). Add 1 for 1-indexed positions.
    order = np.argsort(-qual_scores, axis=1)           # (n_sims, n_drivers)
    grid_positions = np.argsort(order, axis=1) + 1     # (n_sims, n_drivers)
    return grid_positions.astype(np.int32)


# ---------------------------------------------------------------------------
# Race pace sampler
# ---------------------------------------------------------------------------

def sample_race_scores(
    mat: np.ndarray,           # (n_drivers, 8)
    grid_positions: np.ndarray,# (n_sims, n_drivers) int32 from qualifying
    overtake_difficulty: float,# 0-1 circuit property
    weather: str,
    randomness: float,
    rng: np.random.Generator,
    n_sims: int,
    safety_car_prob: float = 0.0,
) -> np.ndarray:
    """
    Sample race pace scores for all simulations.

    Combines:
      - Composite pace: driver_pace * 0.35 + car_performance * 0.65
      - Grid position advantage (weighted by how hard the circuit is to overtake)
      - Per-driver noise (less noise for more consistent drivers)
      - Safety car injection (if safety_car_prob > 0, adds extra variance)

    Returns:
        race_scores: (n_sims, n_drivers) float32 — higher is better
    """
    n_drivers = mat.shape[0]
    mu = _effective_pace(mat, weather)   # (n_drivers,)

    # Grid position bonus: at Monaco (overtake_diff=1.0), pole is worth +2.5%.
    n_d = float(n_drivers)
    grid_score = (n_d + 1 - grid_positions) / n_d        # (n_sims, n_drivers) in [0,1]
    grid_weight = overtake_difficulty * 0.05             # max 5% at Monaco
    mu_mat = mu[np.newaxis, :] + grid_weight * grid_score # (n_sims, n_drivers)

    # Per-driver sigma.
    consistency = mat[:, _IDX_CONSISTENCY]
    sigma = np.maximum(
        _BASE_VARIANCE,
        (1.0 - consistency) * randomness,
    )  # (n_drivers,)

    # Safety car injects extra chaos.
    sc_happened = rng.random(n_sims) < safety_car_prob   # (n_sims,) bool
    sc_extra = sc_happened.astype(np.float32) * randomness * _SC_SIGMA_MULTIPLIER
    sigma_mat = sigma[np.newaxis, :] + sc_extra[:, np.newaxis]  # (n_sims, n_drivers)

    noise = rng.normal(0.0, sigma_mat).astype(np.float32)
    return (mu_mat + noise).astype(np.float32)


# ---------------------------------------------------------------------------
# DNF sampler
# ---------------------------------------------------------------------------

def sample_dnf_mask(
    mat: np.ndarray,                          # (n_drivers, 10)
    rng: np.random.Generator,
    n_sims: int,
    reliability_coeff: float = 1.0,
    streak_multiplier: np.ndarray | None = None,  # (n_sims, n_drivers) per-sim boost
) -> np.ndarray:
    """
    Sample which drivers retire in each simulation.

    Uses split DNF rates when populated (cols 8+9):
      - mechanical_dnf_rate (col 8): team-averaged car failures
      - driver_dnf_rate (col 9): individual crash/error rate
    Falls back to the combined dnf_rate (col 5) per driver when the split
    columns are both zero (e.g. old-style SimRating without split data).

    reliability_coeff > 1 = more DNFs (unreliable cars), < 1 = fewer.
    streak_multiplier: per-sim per-driver 1.15× boost for drivers who DNF'd
        the previous race.

    Returns:
        dnf_mask: (n_sims, n_drivers) bool — True means this driver DNF'd
    """
    mech = mat[:, _IDX_MECH_DNF_RATE]    # (n_drivers,)
    drv  = mat[:, _IDX_DRIVER_DNF_RATE]  # (n_drivers,)
    split_total = mech + drv             # (n_drivers,)
    # Per-driver fallback: if split not available (both 0), use combined col 5
    base_rates = np.where(
        split_total > 0,
        split_total,
        mat[:, _IDX_DNF_RATE],
    ) * reliability_coeff                # (n_drivers,)

    if streak_multiplier is not None:
        dnf_rates = (base_rates[np.newaxis, :] * streak_multiplier).clip(0.0, 0.95)
    else:
        dnf_rates = base_rates.clip(0.0, 0.95)[np.newaxis, :]
    rolls = rng.random(size=(n_sims, mat.shape[0])).astype(np.float32)
    return rolls < dnf_rates
