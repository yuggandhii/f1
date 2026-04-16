"""
app/analytics/aggregator.py — Aggregate Monte Carlo output into probability summaries.

All functions are pure NumPy/pandas — no DB or I/O calls.

Inputs:
    all_points:   (n_sims, n_drivers) float32  — season points per simulation
    driver_order: list[str]                    — driver_id per column

Outputs: plain Python dicts / DataFrames suitable for JSON serialisation.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# WDC probability
# ---------------------------------------------------------------------------

def compute_wdc_probabilities(
    all_points: np.ndarray,
    driver_order: list[str],
) -> dict[str, float]:
    """
    Fraction of simulations in which each driver has the maximum points total.

    Ties are broken by assuming both drivers are champion (probability split 50/50),
    but ties are extremely rare with 10k sims.

    Returns: {driver_id: probability}  (probabilities sum to ~1.0)
    """
    n_sims = all_points.shape[0]
    max_pts = all_points.max(axis=1, keepdims=True)          # (n_sims, 1)
    is_champ = all_points == max_pts                          # (n_sims, n_drivers) bool

    # Count how many drivers share max in each sim (normally 1).
    share = is_champ.sum(axis=1, keepdims=True).astype(np.float32)  # (n_sims, 1)
    weighted = is_champ.astype(np.float32) / share           # split ties

    probs = weighted.mean(axis=0)                            # (n_drivers,)
    return {d: float(p) for d, p in zip(driver_order, probs)}


# ---------------------------------------------------------------------------
# WCC probability
# ---------------------------------------------------------------------------

def compute_wcc_probabilities(
    all_points: np.ndarray,
    driver_order: list[str],
    driver_to_constructor: dict[str, str],
) -> dict[str, float]:
    """
    Fraction of simulations in which each constructor wins the most points.

    Args:
        driver_to_constructor: {driver_id: constructor_id}

    Returns: {constructor_id: probability}
    """
    n_sims, n_drivers = all_points.shape
    constructors = sorted(set(driver_to_constructor.values()))
    con_idx = {c: i for i, c in enumerate(constructors)}
    n_con = len(constructors)

    con_points = np.zeros((n_sims, n_con), dtype=np.float32)
    for col, driver_id in enumerate(driver_order):
        c = driver_to_constructor.get(driver_id)
        if c and c in con_idx:
            con_points[:, con_idx[c]] += all_points[:, col]

    max_pts = con_points.max(axis=1, keepdims=True)
    is_champ = con_points == max_pts
    share = is_champ.sum(axis=1, keepdims=True).astype(np.float32)
    weighted = is_champ.astype(np.float32) / share
    probs = weighted.mean(axis=0)
    return {c: float(p) for c, p in zip(constructors, probs)}


# ---------------------------------------------------------------------------
# Expected points & distribution statistics
# ---------------------------------------------------------------------------

def compute_expected_points(
    all_points: np.ndarray,
    driver_order: list[str],
) -> dict[str, dict[str, float]]:
    """
    Per-driver expected points distribution across all simulations.

    Returns: {driver_id: {mean, std, p5, p25, median, p75, p95, min, max}}
    """
    result: dict[str, dict[str, float]] = {}
    for col, driver_id in enumerate(driver_order):
        pts = all_points[:, col]
        result[driver_id] = {
            "mean":   float(pts.mean()),
            "std":    float(pts.std()),
            "p5":     float(np.percentile(pts, 5)),
            "p25":    float(np.percentile(pts, 25)),
            "median": float(np.median(pts)),
            "p75":    float(np.percentile(pts, 75)),
            "p95":    float(np.percentile(pts, 95)),
            "min":    float(pts.min()),
            "max":    float(pts.max()),
        }
    return result


# ---------------------------------------------------------------------------
# Podium / win rate
# ---------------------------------------------------------------------------

def compute_win_rates(
    all_points: np.ndarray,
    driver_order: list[str],
) -> dict[str, float]:
    """
    Probability of each driver winning the championship (same as WDC probs,
    exposed separately for clarity in API responses).
    """
    return compute_wdc_probabilities(all_points, driver_order)


# ---------------------------------------------------------------------------
# Full summary DataFrame
# ---------------------------------------------------------------------------

def build_summary_dataframe(
    all_points: np.ndarray,
    driver_order: list[str],
    driver_to_constructor: dict[str, str] | None = None,
) -> pd.DataFrame:
    """
    Build a human-readable summary DataFrame sorted by WDC probability.

    Columns: driver_id, wdc_prob, expected_pts, pts_std, p5, p95, constructor
    """
    wdc = compute_wdc_probabilities(all_points, driver_order)
    stats = compute_expected_points(all_points, driver_order)

    rows = []
    for driver_id in driver_order:
        row = {
            "driver_id":    driver_id,
            "wdc_prob":     wdc[driver_id],
            "expected_pts": stats[driver_id]["mean"],
            "pts_std":      stats[driver_id]["std"],
            "p5_pts":       stats[driver_id]["p5"],
            "p95_pts":      stats[driver_id]["p95"],
            "constructor":  (driver_to_constructor or {}).get(driver_id, ""),
        }
        rows.append(row)

    df = pd.DataFrame(rows).sort_values("wdc_prob", ascending=False)
    df["wdc_prob_pct"] = (df["wdc_prob"] * 100).round(1)
    return df.reset_index(drop=True)
