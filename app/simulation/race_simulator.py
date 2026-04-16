"""
app/simulation/race_simulator.py — Vectorised single-race Monte Carlo simulation.

simulate_race() runs `n_sims` independent races simultaneously using pure NumPy.
No DB calls; all inputs are plain Python/NumPy objects.

Output positions are always a valid permutation of 1..n_drivers.
DNF drivers are ranked last (they receive the worst positions).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.simulation.performance_model import (
    DriverRating,
    build_ratings_matrix,
    sample_dnf_mask,
    sample_qualifying_grid,
    sample_race_scores,
)
from app.simulation.scoring import award_race_points, award_sprint_points


# ---------------------------------------------------------------------------
# Circuit descriptor
# ---------------------------------------------------------------------------

@dataclass
class CircuitInfo:
    """Static properties of a race circuit used during simulation."""
    circuit_ref: str           # Ergast circuitId slug (e.g. "monaco")
    name: str                  # Human-readable name
    overtake_difficulty: float  # 0-1 (1 = Monaco, 0 = easy highway circuit)
    weather_variability: float  # 0-1 probability of wet/mixed weather
    has_sprint: bool = False    # Whether this round includes a sprint race
    safety_car_prob: float = 0.3  # Per-race safety car probability


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _scores_to_positions(
    scores: np.ndarray,   # (n_sims, n_drivers) float32
    dnf_mask: np.ndarray, # (n_sims, n_drivers) bool
) -> np.ndarray:
    """
    Convert raw scores to 1-indexed finish positions.

    DNF drivers get score = -1e9 so they always rank last.
    Ties are broken arbitrarily by np.argsort (stable).

    Returns:
        positions: (n_sims, n_drivers) int32, 1-indexed
    """
    penalised = scores.copy()
    penalised[dnf_mask] = -1e9

    # argsort descending gives driver-index order (best first).
    order = np.argsort(-penalised, axis=1, kind="stable")  # (n_sims, n_drivers)
    # Invert: positions[i, driver_j] = finishing position of driver j in sim i.
    positions = np.argsort(order, axis=1, kind="stable") + 1  # 1-indexed
    return positions.astype(np.int32)


def _sample_weather(
    variability: float,
    weather_mode: str,
    rng: np.random.Generator,
    n_sims: int,
) -> list[str]:
    """
    Return a per-sim weather label for a circuit.

    weather_mode:
        'historical' — randomly draw wet/mixed/dry using circuit variability
        'dry'        — always dry
        'wet'        — always wet
        'random'     — uniform 50% chance of wet
    """
    if weather_mode == "dry":
        return ["dry"] * n_sims
    if weather_mode == "wet":
        return ["wet"] * n_sims

    prob = variability if weather_mode == "historical" else 0.5
    rolls = rng.random(n_sims)
    return [
        "wet" if r < prob * 0.4 else ("mixed" if r < prob else "dry")
        for r in rolls
    ]


def _dominant_weather(weathers: list[str]) -> str:
    """Pick the most common weather string for the batch (used for pace sampling)."""
    counts = {"dry": 0, "wet": 0, "mixed": 0}
    for w in weathers:
        counts[w] = counts.get(w, 0) + 1
    return max(counts, key=counts.__getitem__)


def _pick_fastest_lap(
    race_scores: np.ndarray,  # (n_sims, n_drivers)
    positions: np.ndarray,    # (n_sims, n_drivers)
) -> np.ndarray:
    """
    Select the fastest-lap driver per simulation.

    Among finishers (position <= 10), the driver with the highest race score
    most likely set the fastest lap.  If no one is in top 10 (impossible), fall
    back to the overall score winner.

    Returns:
        fl_idx: (n_sims,) int — column index of FL driver per simulation
    """
    n_sims, n_drivers = race_scores.shape
    # Mask out positions > 10 by setting score to -inf.
    top10_scores = np.where(positions <= 10, race_scores, -np.inf)
    fl_idx = np.argmax(top10_scores, axis=1)  # (n_sims,)
    return fl_idx


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def simulate_race(
    ratings: list[DriverRating],
    circuit: CircuitInfo,
    n_sims: int,
    randomness: float,
    rng: np.random.Generator,
    weather_mode: str = "historical",
    reliability_coeff: float = 1.0,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray | None]:
    """
    Simulate `n_sims` independent instances of one race.

    Args:
        ratings:           Per-driver DriverRating objects.
        circuit:           CircuitInfo for this race.
        n_sims:            Number of Monte Carlo simulations.
        randomness:        Noise scale (0.0–1.0).  Default 0.15.
        rng:               NumPy Generator (seeded externally).
        weather_mode:      'historical' | 'dry' | 'wet' | 'random'.
        reliability_coeff: DNF rate multiplier (1.0 = nominal).

    Returns:
        race_positions:    (n_sims, n_drivers) int32 — 1-indexed finish positions
        race_points:       (n_sims, n_drivers) float32 — championship points scored
        sprint_positions:  (n_sims, n_drivers) int32 or None if no sprint
        sprint_points:     (n_sims, n_drivers) float32 or None if no sprint
    """
    mat = build_ratings_matrix(ratings)  # (n_drivers, 7)

    # ── Weather ──────────────────────────────────────────────────────────────
    weathers = _sample_weather(circuit.weather_variability, weather_mode, rng, n_sims)
    weather = _dominant_weather(weathers)

    # ── Qualifying ───────────────────────────────────────────────────────────
    grid = sample_qualifying_grid(mat, weather, randomness, rng, n_sims)

    # ── Sprint (if applicable) ───────────────────────────────────────────────
    sprint_positions: np.ndarray | None = None
    sprint_points: np.ndarray | None = None
    if circuit.has_sprint:
        sprint_scores = sample_race_scores(
            mat, grid, circuit.overtake_difficulty, weather,
            randomness, rng, n_sims, circuit.safety_car_prob * 0.5,
        )
        sprint_dnf = sample_dnf_mask(mat, rng, n_sims, reliability_coeff * 0.3)
        sprint_positions = _scores_to_positions(sprint_scores, sprint_dnf)
        sprint_points = award_sprint_points(sprint_positions)
        # Sprint result sets a new grid for the feature race.
        grid = sprint_positions.copy()

    # ── Race ─────────────────────────────────────────────────────────────────
    race_scores = sample_race_scores(
        mat, grid, circuit.overtake_difficulty, weather,
        randomness, rng, n_sims, circuit.safety_car_prob,
    )
    dnf_mask = sample_dnf_mask(mat, rng, n_sims, reliability_coeff)
    race_positions = _scores_to_positions(race_scores, dnf_mask)
    fl_idx = _pick_fastest_lap(race_scores, race_positions)
    race_points = award_race_points(race_positions, fl_idx)

    return race_positions, race_points, sprint_positions, sprint_points
