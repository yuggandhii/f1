"""
app/simulation/scoring.py — F1 points system (vectorised NumPy).

Exports:
    POINTS_MAP          — race finish → points dict
    SPRINT_POINTS       — sprint finish → points dict
    FASTEST_LAP_BONUS   — int (1)
    race_points_array() — build lookup array for argsort output
    award_race_points() — vectorised (n_sims, n_drivers) → points matrix
    award_sprint_points()
"""
from __future__ import annotations

import numpy as np

# ---------------------------------------------------------------------------
# Points tables (official FIA 2010–present)
# ---------------------------------------------------------------------------

POINTS_MAP: dict[int, int] = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8,  7: 6,  8: 4,  9: 2,  10: 1,
}

SPRINT_POINTS: dict[int, int] = {
    1: 8, 2: 7, 3: 6, 4: 5, 5: 4,
    6: 3, 7: 2, 8: 1,
}

FASTEST_LAP_BONUS: int = 1   # awarded only if the driver finishes in the top 10


# ---------------------------------------------------------------------------
# Lookup array builders
# ---------------------------------------------------------------------------

def _build_lookup(points_dict: dict[int, int], size: int) -> np.ndarray:
    """
    Build a 1-indexed lookup array of length `size + 1`.
    arr[position] = points for that position (0 for unscored positions).
    arr[0] is unused (positions are 1-indexed).
    """
    arr = np.zeros(size + 1, dtype=np.float32)
    for pos, pts in points_dict.items():
        if pos <= size:
            arr[pos] = float(pts)
    return arr


# ---------------------------------------------------------------------------
# Vectorised award functions
# ---------------------------------------------------------------------------

def award_race_points(
    finish_positions: np.ndarray,    # (n_sims, n_drivers) int32, 1-indexed
    fastest_lap_idx: np.ndarray,     # (n_sims,) int — driver index who sets FL
) -> np.ndarray:
    """
    Compute race points for every simulation in one NumPy pass.

    Args:
        finish_positions: (n_sims, n_drivers) positions, 1-indexed.
            DNF drivers should have position > n_drivers (e.g. n_drivers+1).
        fastest_lap_idx: (n_sims,) index (axis=1) of the FL driver per sim.

    Returns:
        points: (n_sims, n_drivers) float32
    """
    n_sims, n_drivers = finish_positions.shape
    lookup = _build_lookup(POINTS_MAP, n_drivers + 1)  # +1 to safely index DNF pos

    # Clamp positions to lookup size (DNF positions beyond lookup → 0 pts).
    clamped = finish_positions.clip(1, len(lookup) - 1)
    points = lookup[clamped]  # (n_sims, n_drivers)

    # Fastest lap bonus: +1 if FL driver finishes in top 10.
    sim_idx = np.arange(n_sims)
    fl_positions = finish_positions[sim_idx, fastest_lap_idx]  # (n_sims,)
    fl_in_top10 = fl_positions <= 10

    fl_bonus = np.zeros((n_sims, n_drivers), dtype=np.float32)
    fl_bonus[sim_idx[fl_in_top10], fastest_lap_idx[fl_in_top10]] = float(FASTEST_LAP_BONUS)
    points += fl_bonus

    return points


def award_sprint_points(
    sprint_positions: np.ndarray,    # (n_sims, n_drivers) int32, 1-indexed
) -> np.ndarray:
    """
    Compute sprint race points.  No fastest-lap bonus in sprint.

    Returns:
        points: (n_sims, n_drivers) float32
    """
    n_sims, n_drivers = sprint_positions.shape
    lookup = _build_lookup(SPRINT_POINTS, n_drivers + 1)
    clamped = sprint_positions.clip(1, len(lookup) - 1)
    return lookup[clamped]
