"""
app/analytics/cache.py — Parquet read/write helpers for simulation outputs.

All functions are pure I/O — no DB or simulation calls.

File layout:
    data/simulations/{run_id}/results.parquet  — (n_sims, n_drivers) float32
    data/simulations/{run_id}/metadata.json    — driver_order, params
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from app.config import settings


def _sim_dir(run_id: str) -> Path:
    return Path(settings.simulations_dir) / run_id


def save_simulation_results(
    run_id: str,
    all_points: np.ndarray,
    driver_order: list[str],
    metadata: dict,
) -> str:
    """
    Persist (n_sims, n_drivers) float32 array to parquet + metadata JSON.
    Returns the directory path string (stored as SimulationRun.result_path).
    """
    out_dir = _sim_dir(run_id)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.DataFrame(all_points, columns=driver_order)
    df.to_parquet(str(out_dir / "results.parquet"), index=False)

    (out_dir / "metadata.json").write_text(
        json.dumps({**metadata, "driver_order": driver_order})
    )
    return str(out_dir)


def load_simulation_results(run_id: str) -> tuple[np.ndarray, list[str]] | None:
    """
    Load simulation results from parquet.
    Returns (all_points, driver_order) or None if not found.
    """
    parquet_path = _sim_dir(run_id) / "results.parquet"
    if not parquet_path.exists():
        return None
    df = pd.read_parquet(str(parquet_path))
    return df.values.astype(np.float32), list(df.columns)


def load_simulation_metadata(run_id: str) -> dict | None:
    """Load simulation metadata from JSON. Returns None if not found."""
    meta_path = _sim_dir(run_id) / "metadata.json"
    if not meta_path.exists():
        return None
    return json.loads(meta_path.read_text())
