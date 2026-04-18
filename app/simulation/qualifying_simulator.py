"""
app/simulation/qualifying_simulator.py — Vectorised Q1/Q2/Q3 knockout qualifying simulation.

Replaces the simple single-session qualifying grid sampler with a proper three-session
knockout format:
  Q1: all drivers, bottom 5 eliminated (16th-20th on grid)
  Q2: 15 survivors, bottom 5 eliminated (11th-15th on grid)
  Q3: top 10 run three attempts, fastest time sets grid position 1-10

Design:
    Fully vectorised across n_sims — each NumPy op processes all sims simultaneously.
    Uses very tight sigma (0.003) to reflect qualifying precision vs race variance.
    2% DNF chance per driver per qualifying session (mechanical / crash).

Returns:
    grid_positions: (n_sims, n_drivers) int32, 1-indexed (1 = pole position)
"""
from __future__ import annotations

import numpy as np

from app.simulation.performance_model import (
    _IDX_QUAL_EDGE,
    _effective_pace,
)

# Qualifying lap time variance — much tighter than race (drivers push for single lap)
_SIGMA_QUALI = 0.003

# Probability a driver has a DNF (crash / mechanical) in qualifying
_QUALI_DNF_PROB = 0.02

# Q3: each driver gets this many flying laps
_Q3_ATTEMPTS = 3


def simulate_qualifying(
    mat: np.ndarray,          # (n_drivers, 8) — output of build_ratings_matrix()
    weather: str,
    randomness: float,
    rng: np.random.Generator,
    n_sims: int,
) -> np.ndarray:
    """
    Run a vectorised Q1/Q2/Q3 knockout qualifying simulation.

    Args:
        mat:        (n_drivers, 8) float32 ratings matrix.
        weather:    'dry' | 'wet' | 'mixed' — affects effective pace.
        randomness: Season-level noise scale (moderates quali sigma).
        rng:        Seeded NumPy Generator (shared with race simulator).
        n_sims:     Number of independent simulations.

    Returns:
        grid_positions: (n_sims, n_drivers) int32 — 1-indexed grid positions.
    """
    n_drivers = mat.shape[0]

    # Base pace + qualifying edge bonus
    eff_pace = _effective_pace(mat, weather)          # (n_drivers,)
    qual_bonus = mat[:, _IDX_QUAL_EDGE] * 0.05       # up to +5%
    mu = eff_pace + qual_bonus                         # (n_drivers,)

    # Qualifying sigma blends the fixed precision term with per-driver randomness
    sigma = max(_SIGMA_QUALI, randomness * 0.02)

    # Q1 DNF mask — applies to all three sessions (if you crash in Q1 you're done)
    quali_dnf = rng.random((n_sims, n_drivers)) < _QUALI_DNF_PROB  # (n_sims, n_drivers)

    def _best_of_n(active: np.ndarray, attempts: int) -> np.ndarray:
        """
        Simulate `attempts` lap runs for active drivers, return best score per sim/driver.
        Inactive (eliminated / DNF) drivers keep score = -inf.

        active: (n_sims, n_drivers) bool
        Returns: (n_sims, n_drivers) float32
        """
        best = np.full((n_sims, n_drivers), -np.inf, dtype=np.float32)
        for _ in range(attempts):
            noise = rng.normal(0.0, sigma, (n_sims, n_drivers)).astype(np.float32)
            scores = mu[np.newaxis, :] + noise
            scores = np.where(active & ~quali_dnf, scores, -np.inf)
            best = np.maximum(best, scores)
        return best

    # ── Q1: all 20 drivers ───────────────────────────────────────────────────
    n_q1_survive = min(15, n_drivers)
    n_q1_out     = n_drivers - n_q1_survive

    q1_active = np.ones((n_sims, n_drivers), bool)
    q1_scores  = _best_of_n(q1_active, attempts=1)   # Q1 = 1 flying lap per driver

    # Identify Q1 eliminated (worst n_q1_out per sim, ascending sort)
    q1_order = np.argsort(q1_scores, axis=1)          # worst→best column indices
    q1_eliminated = np.zeros((n_sims, n_drivers), bool)
    if n_q1_out > 0:
        knocked = q1_order[:, :n_q1_out]              # (n_sims, n_q1_out) worst drivers
        rows = np.arange(n_sims)[:, np.newaxis]
        q1_eliminated[rows, knocked] = True

    # ── Q2: Q1 survivors (top 15) ────────────────────────────────────────────
    n_q2_survive = min(10, n_q1_survive)
    n_q2_out     = n_q1_survive - n_q2_survive

    q2_active  = ~q1_eliminated
    q2_scores  = _best_of_n(q2_active, attempts=1)    # Q2 = 1 flying lap

    q2_order = np.argsort(q2_scores, axis=1)
    q2_eliminated = np.zeros((n_sims, n_drivers), bool)
    if n_q2_out > 0:
        # Among Q2 competitors only, identify the bottom n_q2_out
        # Since eliminated Q1 drivers have -inf, their rank is always worst.
        # We take positions [n_q1_out : n_q1_out + n_q2_out] from the sorted order
        # to get the Q2 eliminees.
        knocked = q2_order[:, n_q1_out : n_q1_out + n_q2_out]
        rows = np.arange(n_sims)[:, np.newaxis]
        q2_eliminated[rows, knocked] = True

    # ── Q3: top 10 get three attempts ────────────────────────────────────────
    q3_active  = ~q1_eliminated & ~q2_eliminated
    q3_scores  = _best_of_n(q3_active, attempts=_Q3_ATTEMPTS)

    # ── Build final grid positions using tiered scoring ──────────────────────
    # Tier 3 (Q3): raw scores → positions 1-10
    # Tier 2 (Q2 out): scores offset by -1e6 → positions 11-15
    # Tier 1 (Q1 out): scores offset by -2e6 → positions 16-20
    grid_scores = np.where(q3_active, q3_scores,
                  np.where(q2_eliminated, q2_scores - 1e6,
                           q1_scores - 2e6))

    # Descending argsort → driver ranking (0-indexed). Add 1 → 1-indexed positions.
    order = np.argsort(-grid_scores, axis=1)           # (n_sims, n_drivers)
    grid_positions = np.argsort(order, axis=1) + 1     # (n_sims, n_drivers)

    return grid_positions.astype(np.int32)
