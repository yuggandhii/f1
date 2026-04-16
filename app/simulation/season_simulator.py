"""
app/simulation/season_simulator.py — Full-season Monte Carlo simulation.

simulate_season() runs n_sims complete F1 season simulations and returns
an (n_sims, n_drivers) points matrix plus per-race position history.

Parallelism strategy (PRD §7):
    The n_sims dimension is fully vectorised — each NumPy call processes
    all simulations simultaneously.  For very large n_sims (>10k), the work
    is split into batches across ProcessPoolExecutor workers.
"""
from __future__ import annotations

import logging
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.simulation.performance_model import DriverRating
from app.simulation.race_simulator import CircuitInfo, simulate_race

_log = logging.getLogger(__name__)

# Sprint circuits by season year → set of circuit_ref strings.
# Derived from official FIA calendars.
SPRINT_CIRCUIT_REFS: dict[int, set[str]] = {
    2021: {"silverstone", "interlagos"},
    2022: {"imola", "red_bull_ring", "interlagos"},
    2023: {"baku", "red_bull_ring", "spa", "losail", "circuit_of_the_americas", "interlagos"},
    2024: {"shanghai", "miami", "red_bull_ring", "circuit_of_the_americas", "interlagos", "losail"},
}


# ---------------------------------------------------------------------------
# Batch worker (must be module-level for pickling by ProcessPoolExecutor)
# ---------------------------------------------------------------------------

def _run_batch(
    args: tuple[
        list[DriverRating],   # ratings
        list[CircuitInfo],    # circuits
        int,                  # n_sims in this batch
        float,                # randomness
        float,                # reliability_coeff
        str,                  # weather_mode
        int,                  # random seed
    ],
) -> np.ndarray:
    """
    Worker function: simulate one batch of n_sims seasons.
    Returns all_points: (n_sims, n_drivers) float32.
    """
    ratings, circuits, n_sims, randomness, reliability_coeff, weather_mode, seed = args
    rng = np.random.default_rng(seed)
    n_drivers = len(ratings)
    all_points = np.zeros((n_sims, n_drivers), dtype=np.float32)

    for circuit in circuits:
        _, race_pts, _, sprint_pts = simulate_race(
            ratings, circuit, n_sims, randomness, rng,
            weather_mode, reliability_coeff,
        )
        all_points += race_pts
        if sprint_pts is not None:
            all_points += sprint_pts

    return all_points


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def simulate_season(
    ratings: list[DriverRating],
    circuits: list[CircuitInfo],
    n_sims: int = 10_000,
    randomness: float = 0.15,
    reliability_coeff: float = 1.0,
    weather_mode: str = "historical",
    seed: int | None = None,
    n_workers: int = 1,
) -> tuple[np.ndarray, list[str]]:
    """
    Run a full Monte Carlo season simulation.

    Args:
        ratings:           Driver performance ratings (one per driver).
        circuits:          Ordered race calendar, including sprint flags.
        n_sims:            Number of independent season simulations.
        randomness:        Per-race pace noise scale [0, 1].
        reliability_coeff: DNF rate multiplier (>1 = more unreliable).
        weather_mode:      'historical' | 'dry' | 'wet' | 'random'.
        seed:              Master RNG seed (None = non-deterministic).
        n_workers:         Parallel workers (>1 uses ProcessPoolExecutor).

    Returns:
        all_points:   (n_sims, n_drivers) float32 — total season points.
        driver_order: list[str] — driver_id per column of all_points.
    """
    driver_order = [r.driver_id for r in ratings]
    n_drivers = len(ratings)

    if n_workers <= 1 or n_sims < 500:
        # Single-process path — simpler, lower overhead.
        rng = np.random.default_rng(seed)
        all_points = np.zeros((n_sims, n_drivers), dtype=np.float32)
        for i, circuit in enumerate(circuits):
            _, race_pts, _, sprint_pts = simulate_race(
                ratings, circuit, n_sims, randomness, rng,
                weather_mode, reliability_coeff,
            )
            all_points += race_pts
            if sprint_pts is not None:
                all_points += sprint_pts
            _log.debug("Simulated round %d/%d: %s", i + 1, len(circuits), circuit.name)
        return all_points, driver_order

    # Multi-process path — split sims into batches.
    rng_master = np.random.default_rng(seed)
    batch_size = max(100, n_sims // n_workers)
    batches: list[int] = []
    remaining = n_sims
    while remaining > 0:
        b = min(batch_size, remaining)
        batches.append(b)
        remaining -= b

    # Each batch gets a distinct seed derived from the master RNG.
    batch_seeds = rng_master.integers(0, 2**31, size=len(batches)).tolist()

    args_list = [
        (ratings, circuits, b, randomness, reliability_coeff, weather_mode, s)
        for b, s in zip(batches, batch_seeds)
    ]

    results: list[np.ndarray] = [None] * len(batches)  # type: ignore[list-item]
    with ProcessPoolExecutor(max_workers=n_workers) as pool:
        futures = {pool.submit(_run_batch, a): i for i, a in enumerate(args_list)}
        for fut in as_completed(futures):
            idx = futures[fut]
            results[idx] = fut.result()

    all_points = np.concatenate(results, axis=0)
    return all_points, driver_order


# ---------------------------------------------------------------------------
# Convenience: build CircuitInfo list from DataFrames
# ---------------------------------------------------------------------------

def circuits_from_dataframe(races_df, season: int) -> list[CircuitInfo]:
    """
    Build a list of CircuitInfo from an Ergast races DataFrame.

    Expected columns: circuit_ref, circuit_name (or race_name), country,
                      overtake_difficulty, weather_variability.
    """
    sprint_refs = SPRINT_CIRCUIT_REFS.get(season, set())
    circuits: list[CircuitInfo] = []
    for row in races_df.sort_values("round").itertuples(index=False):
        ref = row.circuit_ref
        name = getattr(row, "circuit_name", getattr(row, "race_name", ref))
        circuits.append(CircuitInfo(
            circuit_ref=ref,
            name=name,
            overtake_difficulty=float(row.overtake_difficulty),
            weather_variability=float(row.weather_variability),
            has_sprint=ref in sprint_refs,
            safety_car_prob=0.3,
        ))
    return circuits
