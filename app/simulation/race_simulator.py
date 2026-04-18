"""
app/simulation/race_simulator.py — Vectorised single-race Monte Carlo simulation.

simulate_race() runs `n_sims` independent races simultaneously using pure NumPy.
No DB calls; all inputs are plain Python/NumPy objects.

Output positions are always a valid permutation of 1..n_drivers.
DNF drivers are ranked last (they receive the worst positions).

Changes from original:
  - Qualifying now uses Q1/Q2/Q3 knockout (qualifying_simulator.py).
  - Tyre strategy delta applied to race scores (tyre_strategy.py).
  - CircuitInfo exposes track_type for tyre degradation routing.
  - Safety car uses per-circuit sc_probability from CircuitInfo.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.simulation.performance_model import (
    DriverRating,
    build_ratings_matrix,
    sample_dnf_mask,
    sample_race_scores,
)
from app.simulation.qualifying_simulator import simulate_qualifying
from app.simulation.scoring import award_race_points, award_sprint_points
from app.simulation.tyre_strategy import compute_tyre_race_delta


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
    track_type: str = "permanent"  # 'street' | 'permanent' | 'mixed'
    predicted_weather: str | None = None  # Override from weather forecast table
    round: int = 0             # Season round number (1-indexed); 0 = unknown


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

    order = np.argsort(-penalised, axis=1, kind="stable")  # (n_sims, n_drivers)
    positions = np.argsort(order, axis=1, kind="stable") + 1  # 1-indexed
    return positions.astype(np.int32)


def _sample_weather(
    variability: float,
    weather_mode: str,
    rng: np.random.Generator,
    n_sims: int,
    predicted_weather: str | None = None,
) -> list[str]:
    """
    Return a per-sim weather label for a circuit.

    If predicted_weather is set (from the weather forecast table), it overrides
    the random sampling and all sims use the same predicted condition.

    weather_mode:
        'historical' — randomly draw wet/mixed/dry using circuit variability
        'dry'        — always dry
        'wet'        — always wet
        'random'     — uniform 50% chance of wet
    """
    if predicted_weather is not None:
        return [predicted_weather] * n_sims

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
    counts: dict[str, int] = {}
    for w in weathers:
        counts[w] = counts.get(w, 0) + 1
    return max(counts, key=counts.__getitem__)


def _pick_fastest_lap(
    race_scores: np.ndarray,  # (n_sims, n_drivers)
    positions: np.ndarray,    # (n_sims, n_drivers)
) -> np.ndarray:
    """
    Select the fastest-lap driver per simulation.

    Among finishers in top 10, the driver with the highest race score
    most likely set the fastest lap.

    Returns:
        fl_idx: (n_sims,) int — column index of FL driver per simulation
    """
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
    dnf_streak_multiplier: np.ndarray | None = None,  # (n_sims, n_drivers)
) -> tuple[np.ndarray, np.ndarray, np.ndarray | None, np.ndarray | None, np.ndarray]:
    """
    Simulate `n_sims` independent instances of one race.

    Args:
        ratings:              Per-driver DriverRating objects.
        circuit:              CircuitInfo for this race.
        n_sims:               Number of Monte Carlo simulations.
        randomness:           Noise scale (0.0–1.0).  Default 0.15.
        rng:                  NumPy Generator (seeded externally).
        weather_mode:         'historical' | 'dry' | 'wet' | 'random'.
        reliability_coeff:    DNF rate multiplier (1.0 = nominal).
        dnf_streak_multiplier: Per-sim per-driver reliability boost for
                              drivers who DNF'd the previous race.

    Returns:
        race_positions:    (n_sims, n_drivers) int32 — 1-indexed finish positions
        race_points:       (n_sims, n_drivers) float32 — championship points scored
        sprint_positions:  (n_sims, n_drivers) int32 or None if no sprint
        sprint_points:     (n_sims, n_drivers) float32 or None if no sprint
        dnf_mask:          (n_sims, n_drivers) bool — True = DNF'd this race
    """
    mat = build_ratings_matrix(ratings)  # (n_drivers, 8)
    n_drivers = mat.shape[0]

    # ── Weather ──────────────────────────────────────────────────────────────
    weathers = _sample_weather(
        circuit.weather_variability, weather_mode, rng, n_sims,
        circuit.predicted_weather,
    )
    weather = _dominant_weather(weathers)

    # ── Qualifying (Q1/Q2/Q3 knockout) ───────────────────────────────────────
    grid = simulate_qualifying(mat, weather, randomness, rng, n_sims)

    # ── Grid penalties (8% chance per race a single driver gets 3-5 places) ───
    # 8% of races have one grid penalty incident (engine, gearbox, incidents).
    has_penalty = rng.random(n_sims) < 0.08                       # (n_sims,)
    penalty_driver = rng.integers(0, n_drivers, size=n_sims)      # (n_sims,)
    penalty_places = rng.integers(3, 6, size=n_sims)              # (n_sims,)
    # One-hot mask: which sim × driver receives the penalty
    is_penalized = (
        (np.arange(n_drivers)[np.newaxis, :] == penalty_driver[:, np.newaxis])
        & has_penalty[:, np.newaxis]
    )  # (n_sims, n_drivers)
    grid = np.where(
        is_penalized,
        np.minimum(grid + penalty_places[:, np.newaxis], n_drivers),
        grid,
    ).astype(np.int32)

    # ── Rain-start equalisation ───────────────────────────────────────────────
    # In wet conditions top-3 qualifiers lose 20% of their pole advantage at
    # the start (wet starts shuffle the order).  We'll apply this to grid scores
    # inside sample_race_scores by capping the grid_weight contribution.
    rain_start = weather == "wet"

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
        grid = sprint_positions.copy()

    # ── Race ─────────────────────────────────────────────────────────────────
    race_scores = sample_race_scores(
        mat, grid, circuit.overtake_difficulty, weather,
        randomness, rng, n_sims, circuit.safety_car_prob,
    )

    # Rain start: reduce top-3 qualifying advantage by 20% in wet conditions.
    if rain_start:
        top3_mask = grid <= 3   # (n_sims, n_drivers) bool
        # Compute per-driver qualifying edge contribution and reduce it.
        # We subtract 20% of the qualifying_edge bonus from top-3 starters.
        qual_edge = mat[:, 6]  # _IDX_QUAL_EDGE
        rain_penalty = (qual_edge[np.newaxis, :] * 0.05 * 0.20).astype(np.float32)
        race_scores = np.where(top3_mask, race_scores - rain_penalty, race_scores)

    # Apply tyre strategy delta — captures compound choice, degradation, pit stops
    tyre_delta = compute_tyre_race_delta(mat, circuit.track_type, rng, n_sims)
    race_scores = race_scores + tyre_delta

    # ── DNF sampling (with optional streak multiplier) ────────────────────────
    dnf_mask = sample_dnf_mask(mat, rng, n_sims, reliability_coeff, dnf_streak_multiplier)

    # ── Lap 1 incident (12% * overtake_difficulty probability) ───────────────
    lap1_prob = 0.08 + 0.04 * circuit.overtake_difficulty
    lap1_incident = rng.random(n_sims) < lap1_prob              # (n_sims,) bool
    n_victims = rng.integers(1, 3, size=n_sims)                 # 1 or 2 drivers
    # Select random victim indices for each simulation
    victim_idx = rng.integers(0, n_drivers, size=(n_sims, 2))   # (n_sims, 2)
    for v in range(2):
        add_dnf = lap1_incident & (n_victims > v)               # (n_sims,) bool
        dnf_mask[add_dnf, victim_idx[add_dnf, v]] = True

    race_positions = _scores_to_positions(race_scores, dnf_mask)
    fl_idx = _pick_fastest_lap(race_scores, race_positions)
    race_points = award_race_points(race_positions, fl_idx)

    return race_positions, race_points, sprint_positions, sprint_points, dnf_mask
