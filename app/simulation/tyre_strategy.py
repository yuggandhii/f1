"""
app/simulation/tyre_strategy.py — Vectorised tyre degradation and strategy simulation.

Models tyre compound choice, degradation per circuit type, and pit stop penalties.
Outputs a (n_sims, n_drivers) float32 race score delta — positive = tyre advantage.

Design decisions:
    - Does NOT model lap-by-lap to preserve the fully-vectorised simulation model.
    - Instead computes a race-level tyre performance delta per driver per sim.
    - Delta captures: compound choice, degradation rate, pit stop count penalty.
    - Noise term adds per-sim variation (strategic miscalls, SC timing, etc.).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.simulation.performance_model import _IDX_TYRE_MGMT

# Degradation rate per compound per circuit type (fraction of pace lost per lap)
DEGRADATION_RATES: dict[str, dict[str, float]] = {
    "soft":   {"street": 0.08, "permanent": 0.06, "mixed": 0.07},
    "medium": {"street": 0.05, "permanent": 0.04, "mixed": 0.045},
    "hard":   {"street": 0.03, "permanent": 0.025, "mixed": 0.028},
}

# Typical race lap counts by track type (used to compute total degradation loss)
_TYPICAL_LAPS: dict[str, int] = {
    "street": 78,
    "permanent": 53,
    "mixed": 63,
}

# Pit stop time cost as a fraction of a typical 90-min race
# 22 seconds in a 5400-second race ≈ 0.0041
_PIT_STOP_FRACTION = 22.0 / 5400.0


@dataclass
class TyreStrategy:
    """Chosen tyre strategy for one driver in one race."""
    compound: str          # 'soft', 'medium', 'hard'
    n_stops: int           # number of tyre changes
    total_stint_laps: int  # total race laps on primary compound
    deg_rate: float        # degradation rate for chosen compound + circuit
    pace_delta: float      # net race score delta (positive = advantage)


def _choose_compound(tyre_management: np.ndarray) -> list[str]:
    """
    Select primary starting compound per driver based on tyre_management rating.

    High tyre_management → harder compound (less degradation, longer stints).
    Low tyre_management  → softer compound (more grip but degrades faster).
    """
    compounds = []
    for mgmt in tyre_management:
        if mgmt > 0.65:
            compounds.append("hard")
        elif mgmt > 0.35:
            compounds.append("medium")
        else:
            compounds.append("soft")
    return compounds


def _choose_n_stops(tyre_management: np.ndarray, compound: list[str]) -> np.ndarray:
    """
    Determine likely number of pit stops per driver.

    Soft compound + low mgmt → likely 2+ stops.
    Hard compound + high mgmt → likely 1 stop.
    """
    n_stops = np.ones(len(tyre_management), dtype=int)
    for i, (mgmt, comp) in enumerate(zip(tyre_management, compound)):
        if comp == "soft" and mgmt < 0.4:
            n_stops[i] = 2
        elif comp == "soft" and mgmt < 0.2:
            n_stops[i] = 3
    return n_stops


def compute_tyre_race_delta(
    mat: np.ndarray,       # (n_drivers, 8) ratings matrix
    circuit_type: str,     # 'street' | 'permanent' | 'mixed'
    rng: np.random.Generator,
    n_sims: int,
) -> np.ndarray:           # (n_sims, n_drivers) float32
    """
    Compute per-driver tyre performance delta for a race.

    Positive delta = good tyre management → better average race pace.
    Negative delta = high degradation or too many stops → pace penalty.

    The delta is scaled to match the race score space (~0.5–1.0).

    Args:
        mat:          (n_drivers, 8) ratings matrix from build_ratings_matrix().
        circuit_type: Track classification affecting degradation rate.
        rng:          Seeded NumPy Generator.
        n_sims:       Number of simulations.

    Returns:
        tyre_delta: (n_sims, n_drivers) float32
    """
    n_drivers = mat.shape[0]
    tyre_mgmt = mat[:, _IDX_TYRE_MGMT]              # (n_drivers,)

    ct = circuit_type if circuit_type in DEGRADATION_RATES["soft"] else "permanent"
    laps = _TYPICAL_LAPS.get(ct, 57)

    compounds = _choose_compound(tyre_mgmt)
    n_stops   = _choose_n_stops(tyre_mgmt, compounds)

    # Per-driver degradation rate
    deg_rate = np.array(
        [DEGRADATION_RATES[c][ct] for c in compounds], dtype=np.float32
    )  # (n_drivers,)

    # Effective degradation is moderated by tyre_management skill
    # High management → 50% reduction in effective degradation loss
    effective_deg = deg_rate * (1.0 - tyre_mgmt.astype(np.float32) * 0.5)

    # Total degradation loss over the race as a pace fraction
    # Approximation: average pace loss = deg_rate * laps / 2 (linear degradation)
    degradation_loss = effective_deg * laps / 2.0

    # Pit stop time cost (per stop)
    pit_loss = n_stops.astype(np.float32) * _PIT_STOP_FRACTION

    # Net tyre penalty (negative = slower): convert to score-space delta
    # Empirical scaling: 0.04 total loss → -0.01 score delta (4× compression)
    base_delta = -(degradation_loss + pit_loss) * 0.25   # (n_drivers,)

    # Per-sim random variation (strategy miscalls, timing luck, SC deployment)
    noise = rng.normal(0.0, 0.004, (n_sims, n_drivers)).astype(np.float32)

    return base_delta[np.newaxis, :] + noise              # (n_sims, n_drivers)


def simulate_tyre_degradation(
    tyre_management: float,
    circuit_type: str,
    total_laps: int,
) -> list[TyreStrategy]:
    """
    Simulate tyre stint plan for a single driver in a single race.
    Returns a list of TyreStrategy objects (one per stint).

    Used for analytics / display — not called during vectorised MC simulation.
    """
    ct = circuit_type if circuit_type in DEGRADATION_RATES["soft"] else "permanent"

    compound = _choose_compound(np.array([tyre_management]))[0]
    deg = DEGRADATION_RATES[compound][ct]
    eff_deg = deg * (1.0 - tyre_management * 0.5)

    # Maximum stint length before compound falls off a cliff (>30% pace loss)
    max_stint = int(0.30 / eff_deg) if eff_deg > 0 else total_laps

    stints: list[TyreStrategy] = []
    remaining = total_laps
    stop = 0

    while remaining > 0:
        stint_laps = min(max_stint, remaining)
        pace_delta = -(eff_deg * stint_laps / 2.0 + (stop * _PIT_STOP_FRACTION)) * 0.25
        stints.append(TyreStrategy(
            compound=compound,
            n_stops=stop,
            total_stint_laps=stint_laps,
            deg_rate=eff_deg,
            pace_delta=pace_delta,
        ))
        remaining -= stint_laps
        stop += 1
        # Switch to harder compound for subsequent stints
        if compound == "soft":
            compound = "medium"
        elif compound == "medium":
            compound = "hard"
        if compound in DEGRADATION_RATES:
            deg = DEGRADATION_RATES[compound][ct]
            eff_deg = deg * (1.0 - tyre_management * 0.5)
            max_stint = int(0.30 / eff_deg) if eff_deg > 0 else remaining

    return stints
