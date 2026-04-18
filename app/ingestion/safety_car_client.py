"""
app/ingestion/safety_car_client.py — Safety car probability computation.

Derives per-circuit safety car (SC) and virtual safety car (VSC) probabilities
from two sources:

1. FastF1 track_status data (2018–2026):
   status '4' = Safety Car, '5' = Virtual Safety Car, '6' = Red Flag
   A race counts as a SC race if any lap has track_status containing '4' or '6'.
   A race counts as a VSC race if any lap has track_status containing '5'.

2. Hardcoded baseline table (for circuits without sufficient FastF1 coverage).

The computed probabilities are stored in circuits.sc_probability / vsc_probability.
"""
from __future__ import annotations

import logging

import pandas as pd

_log = logging.getLogger(__name__)

# Historical baseline SC/VSC probabilities per circuit_ref.
# Derived from F1 historical records 2014-2023, used as fallback / prior.
BASELINE_SC_PROBABILITY: dict[str, tuple[float, float]] = {
    # circuit_ref: (sc_probability, vsc_probability)
    "albert_park":   (0.42, 0.18),
    "americas":      (0.30, 0.14),
    "bahrain":       (0.24, 0.10),
    "baku":          (0.56, 0.20),
    "catalunya":     (0.22, 0.10),
    "hungaroring":   (0.32, 0.15),
    "imola":         (0.36, 0.16),
    "interlagos":    (0.48, 0.20),
    "jeddah":        (0.52, 0.20),
    "losail":        (0.18, 0.10),
    "marina_bay":    (0.58, 0.22),
    "miami":         (0.38, 0.16),
    "monaco":        (0.64, 0.24),
    "monza":         (0.24, 0.10),
    "red_bull_ring": (0.28, 0.14),
    "rodriguez":     (0.30, 0.14),
    "shanghai":      (0.36, 0.16),
    "silverstone":   (0.34, 0.16),
    "spa":           (0.42, 0.20),
    "suzuka":        (0.26, 0.12),
    "vegas":         (0.46, 0.20),
    "villeneuve":    (0.52, 0.20),
    "yas_marina":    (0.24, 0.10),
    "zandvoort":     (0.28, 0.14),
    "hockenheimring":(0.30, 0.14),
    "istanbul":      (0.34, 0.14),
    "nurburgring":   (0.40, 0.18),
    "paul_ricard":   (0.18, 0.10),
    "portimao":      (0.24, 0.12),
    "mugello":       (0.28, 0.14),
    "sochi":         (0.32, 0.14),
    "ricard":        (0.18, 0.10),
}

_DEFAULT_SC_PROB  = 0.30
_DEFAULT_VSC_PROB = 0.15


def compute_sc_probability_from_fastf1(
    track_status_by_round: dict[int, pd.DataFrame],
) -> tuple[float, float]:
    """
    Compute SC and VSC probability from FastF1 track_status data.

    track_status_by_round: round_number → DataFrame with column 'track_status' (str).
    Returns (sc_probability, vsc_probability) as fractions in [0, 1].

    FastF1 track status codes:
        '1' = Clear (track clear)
        '2' = Yellow flag
        '4' = Safety Car
        '5' = Virtual Safety Car
        '6' = Red Flag
    """
    if not track_status_by_round:
        return _DEFAULT_SC_PROB, _DEFAULT_VSC_PROB

    total_races = len(track_status_by_round)
    sc_races = 0
    vsc_races = 0

    for rnd, df in track_status_by_round.items():
        if df.empty or "track_status" not in df.columns:
            continue

        status_vals = df["track_status"].astype(str)
        had_sc  = status_vals.str.contains("4|6", regex=True, na=False).any()
        had_vsc = status_vals.str.contains("5", regex=True, na=False).any()

        if had_sc:
            sc_races += 1
        if had_vsc:
            vsc_races += 1

    if total_races == 0:
        return _DEFAULT_SC_PROB, _DEFAULT_VSC_PROB

    # Bayesian smoothing: blend computed rate with baseline prior (weight 3 races)
    prior_weight = 3
    sc_prob  = (sc_races + prior_weight * _DEFAULT_SC_PROB) / (total_races + prior_weight)
    vsc_prob = (vsc_races + prior_weight * _DEFAULT_VSC_PROB) / (total_races + prior_weight)

    return round(sc_prob, 3), round(vsc_prob, 3)


def get_sc_probability(
    circuit_ref: str,
    track_status_by_round: dict[int, pd.DataFrame] | None = None,
) -> tuple[float, float]:
    """
    Get SC/VSC probability for a circuit.

    Uses FastF1 data if available, falls back to hardcoded baseline.

    Returns (sc_probability, vsc_probability).
    """
    if track_status_by_round:
        computed = compute_sc_probability_from_fastf1(track_status_by_round)
        _log.debug(
            "Computed SC prob for %s from %d rounds: sc=%.2f vsc=%.2f",
            circuit_ref, len(track_status_by_round), *computed,
        )
        return computed

    baseline = BASELINE_SC_PROBABILITY.get(circuit_ref)
    if baseline:
        return baseline

    _log.debug("No SC data for %s — using defaults", circuit_ref)
    return _DEFAULT_SC_PROB, _DEFAULT_VSC_PROB
