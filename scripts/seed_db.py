"""
scripts/seed_db.py — Standalone DB seed script. No Celery broker required.

Fetches season data from Ergast/Jolpica, enriches with FastF1 lap + telemetry +
pit stop data, inserts all records into PostgreSQL, then computes and inserts
driver_ratings (7 original + speed_rating + pit_efficiency + teammate_index).

Also seeds:
  - Circuit coordinates (lat/lon) for weather API
  - Circuit SC/VSC probabilities from historical FastF1 data
  - Team car_performance ratings per season
  - Driver teammate_index comparison

Usage:
    python scripts/seed_db.py                              # seed 2024 only
    python scripts/seed_db.py --seasons 2023 2024 2025 2026
    python scripts/seed_db.py --seasons 2018 2019 2020 2021 2022 2023 2024 2025 2026
    python scripts/seed_db.py --skip-fastf1                # Ergast-only ratings
    python scripts/seed_db.py --verify-only                # print row counts only

Prerequisites:
    docker compose up -d      # postgres must be running
    alembic upgrade head      # tables must include 0004 migration
"""
from __future__ import annotations

import argparse
import datetime
import logging
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import SyncSessionLocal
from app.ingestion.ergast_client import (
    CIRCUIT_OVERTAKE_DIFFICULTY,
    fetch_season_qualifying,
    fetch_season_races,
    fetch_season_results,
    get_completed_rounds,
)
from app.ingestion.fastf1_client import (
    fetch_race_weather,
    fetch_season_laps,
    fetch_season_pitstops,
    fetch_season_telemetry,
    try_get_cached_season_laps,
    try_get_cached_season_weather,
)
from app.ingestion.safety_car_client import BASELINE_SC_PROBABILITY
from app.ingestion.transformers import DriverRating, compute_driver_ratings
from app.models.circuit import Circuit
from app.models.driver import Driver
from app.models.driver_rating import DriverRating as DriverRatingModel
from app.models.race_result import RaceResult
from app.models.team import Team

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
_log = logging.getLogger("seed_db")

_CURRENT_YEAR = datetime.date.today().year


# ---------------------------------------------------------------------------
# Static data tables
# ---------------------------------------------------------------------------

# circuit_ref (Ergast) → (latitude, longitude)
CIRCUIT_COORDINATES: dict[str, tuple[float, float]] = {
    "albert_park":    (-37.8497, 144.9680),
    "americas":       (30.1328,  -97.6411),
    "bahrain":        (26.0325,   50.5106),
    "baku":           (40.3725,   49.8533),
    "catalunya":      (41.5700,    2.2611),
    "hungaroring":    (47.5789,   19.2486),
    "imola":          (44.3439,   11.7167),
    "interlagos":     (-23.7036, -46.6997),
    "jeddah":         (21.6319,   39.1044),
    "losail":         (25.4900,   51.4542),
    "marina_bay":     (1.2914,   103.8640),
    "miami":          (25.9581,  -80.2389),
    "monaco":         (43.7347,    7.4206),
    "monza":          (45.6156,    9.2811),
    "red_bull_ring":  (47.2197,   14.7647),
    "rodriguez":      (19.4042,  -99.0907),
    "shanghai":       (31.3389,  121.2198),
    "silverstone":    (52.0786,   -1.0169),
    "spa":            (50.4372,    5.9714),
    "suzuka":         (34.8431,  136.5407),
    "vegas":          (36.1147, -115.1728),
    "villeneuve":     (45.5048,  -73.5228),
    "yas_marina":     (24.4672,   54.6031),
    "zandvoort":      (52.3888,    4.5406),
    # Historic circuits
    "hockenheimring": (49.3278,    8.5653),
    "istanbul":       (40.9517,   29.4050),
    "nurburgring":    (50.3356,    6.9475),
    "paul_ricard":    (43.2506,    5.7914),
    "portimao":       (37.2271,   -8.6277),
    "mugello":        (43.9975,   11.3719),
    "sochi":          (43.4057,   39.9514),
    "ricard":         (43.2506,    5.7914),
    "singapore":      (1.2914,   103.8640),
    "circuit_of_the_americas": (30.1328, -97.6411),
}

# constructor_id (Ergast) → engine_supplier
TEAM_ENGINE_SUPPLIER: dict[str, str] = {
    "mercedes":      "Mercedes",
    "ferrari":       "Ferrari",
    "red_bull":      "Honda RBPT",
    "mclaren":       "Mercedes",
    "aston_martin":  "Mercedes",
    "alpine":        "Renault",
    "williams":      "Mercedes",
    "alphatauri":    "Honda RBPT",
    "rb":            "Honda RBPT",
    "alfa":          "Ferrari",
    "sauber":        "Ferrari",
    "haas":          "Ferrari",
    "kick_sauber":   "Ferrari",
    # Historical
    "force_india":   "Mercedes",
    "racing_point":  "Mercedes",
    "toro_rosso":    "Honda",
    "renault":       "Renault",
    "lotus_f1":      "Mercedes",
    "manor":         "Mercedes",
    "marussia":      "Ferrari",
    "caterham":      "Renault",
    "hrt":           "Cosworth",
    "lotus_racing":  "Cosworth",
    "virgin":        "Cosworth",
    "bmw_sauber":    "BMW",
    "toyota":        "Toyota",
    "super_aguri":   "Honda",
    "spyker":        "Ferrari",
    "midland":       "Toyota",
    "jordan":        "Ford",
    "bar":           "Honda",
    "honda":         "Honda",
    "brawn":         "Mercedes",
    "stewart":       "Ford",
}


# ---------------------------------------------------------------------------
# Car performance calculation
# ---------------------------------------------------------------------------

def _compute_car_performance(
    results_df: pd.DataFrame,
) -> dict[str, float]:
    """
    Compute car_performance (0–1) for each constructor in a season.

    Formula: 60% qualifying pace + 40% race pace (both normalized, higher = better).
    Red Bull 2023 → ~0.95, Alpine → ~0.45, Haas → ~0.35.
    """
    def _norm_invert(series: pd.Series) -> pd.Series:
        mn, mx = series.min(), series.max()
        if mx == mn:
            return pd.Series(0.5, index=series.index)
        return (mx - series) / (mx - mn)

    # Race pace: median finish position per constructor (lower = better)
    finished = results_df[results_df["position"].notna()].copy()
    finished["position"] = finished["position"].astype(float)
    team_race_pos = finished.groupby("constructor_id")["position"].median()
    race_norm = _norm_invert(team_race_pos)

    # Qualifying pace: median grid position per constructor (lower = better)
    qual_df = results_df[results_df.get("grid", pd.Series(dtype=float)).fillna(0) > 0].copy() \
        if "grid" in results_df.columns \
        else pd.DataFrame()

    if not qual_df.empty:
        qual_df["grid"] = qual_df["grid"].astype(float)
        team_qual_pos = qual_df.groupby("constructor_id")["grid"].median()
        qual_norm = _norm_invert(team_qual_pos)
    else:
        qual_norm = race_norm.copy()

    # Combine: 60% qualifying + 40% race
    all_teams = race_norm.index.union(qual_norm.index)
    combined = pd.Series(index=all_teams, dtype=float)
    for team in all_teams:
        q = float(qual_norm.get(team, 0.5))
        r = float(race_norm.get(team, 0.5))
        combined[team] = 0.6 * q + 0.4 * r

    # Ensure [0, 1]
    combined = combined.clip(0.0, 1.0)
    return combined.to_dict()


def _compute_teammate_indices(
    ratings: list[DriverRating],
    results_df: pd.DataFrame,
) -> dict[str, float]:
    """
    Compute teammate_index for all drivers.
    Positive = driver faster than teammate, range [-1, +1].
    """
    from app.analytics.teammate_comparison import compute_teammate_index

    # Build driver → constructor_id mapping from results
    driver_team: dict[str, str] = {}
    for row in results_df[["driver_id", "constructor_id"]].drop_duplicates("driver_id").itertuples(index=False):
        driver_team[row.driver_id] = row.constructor_id

    driver_paces: dict[str, float] = {r.driver_id: r.base_pace for r in ratings}
    return compute_teammate_index(driver_paces, driver_team)


# ---------------------------------------------------------------------------
# DB upsert helpers
# ---------------------------------------------------------------------------


def _upsert_teams(session: Session, results_df: pd.DataFrame) -> dict[str, uuid.UUID]:
    constructors = results_df[["constructor_id", "constructor_name"]].drop_duplicates("constructor_id")
    mapping: dict[str, uuid.UUID] = {}
    for row in constructors.itertuples(index=False):
        existing = session.query(Team).filter_by(constructor_name=row.constructor_id).first()
        if existing:
            if not existing.engine_supplier:
                existing.engine_supplier = TEAM_ENGINE_SUPPLIER.get(row.constructor_id)
            mapping[row.constructor_id] = existing.id
        else:
            team = Team(
                id=uuid.uuid4(),
                name=row.constructor_name,
                constructor_name=row.constructor_id,
                engine_supplier=TEAM_ENGINE_SUPPLIER.get(row.constructor_id),
            )
            session.add(team)
            mapping[row.constructor_id] = team.id
    session.flush()
    return mapping


def _upsert_car_performance(
    session: Session,
    team_map: dict[str, uuid.UUID],
    car_perf: dict[str, float],
    season: int,
) -> int:
    """Update teams with computed car_performance for the season."""
    updated = 0
    for constructor_id, perf in car_perf.items():
        team_id = team_map.get(constructor_id)
        if team_id is None:
            continue
        team = session.get(Team, team_id)
        if team is None:
            continue
        team.car_performance = round(perf, 4)
        team.car_performance_season = season
        updated += 1
    session.flush()
    return updated


def _upsert_circuits(session: Session, races_df: pd.DataFrame) -> dict[str, uuid.UUID]:
    mapping: dict[str, uuid.UUID] = {}
    for row in races_df.drop_duplicates("circuit_ref").itertuples(index=False):
        ref = row.circuit_ref
        lat, lon = CIRCUIT_COORDINATES.get(ref, (None, None))
        sc_prob, vsc_prob = BASELINE_SC_PROBABILITY.get(ref, (0.30, 0.15))

        existing = session.query(Circuit).filter_by(name=row.circuit_name).first()
        if existing:
            existing.country = row.country
            existing.track_type = row.track_type
            existing.lap_count = int(row.lap_count)
            existing.overtake_difficulty = float(row.overtake_difficulty)
            existing.weather_variability = float(row.weather_variability)
            if lat is not None:
                existing.latitude = lat
                existing.longitude = lon
            if existing.sc_probability is None:
                existing.sc_probability = sc_prob
            if existing.vsc_probability is None:
                existing.vsc_probability = vsc_prob
            mapping[ref] = existing.id
        else:
            circuit = Circuit(
                id=uuid.uuid4(),
                name=row.circuit_name,
                country=row.country,
                track_type=row.track_type,
                lap_count=int(row.lap_count),
                overtake_difficulty=float(row.overtake_difficulty),
                weather_variability=float(row.weather_variability),
                latitude=lat,
                longitude=lon,
                sc_probability=sc_prob,
                vsc_probability=vsc_prob,
            )
            session.add(circuit)
            mapping[ref] = circuit.id
    session.flush()
    return mapping


def _upsert_drivers(
    session: Session,
    results_df: pd.DataFrame,
    team_map: dict[str, uuid.UUID],
) -> dict[str, uuid.UUID]:
    driver_info = (
        results_df[["driver_id", "driver_name", "driver_abbr", "driver_nationality", "constructor_id"]]
        .drop_duplicates("driver_id")
    )
    mapping: dict[str, uuid.UUID] = {}
    for row in driver_info.itertuples(index=False):
        abbr = str(row.driver_abbr).strip().upper()[:3] if row.driver_abbr else None
        existing: Driver | None = None
        if abbr:
            existing = session.query(Driver).filter_by(abbreviation=abbr).first()
        if existing is None:
            existing = session.query(Driver).filter_by(name=row.driver_name).first()

        team_id = team_map.get(row.constructor_id)
        if existing:
            if team_id:
                existing.team_id = team_id
            existing.active = True
            mapping[row.driver_id] = existing.id
        else:
            driver = Driver(
                id=uuid.uuid4(),
                name=row.driver_name,
                abbreviation=abbr,
                nationality=row.driver_nationality or None,
                team_id=team_id,
                active=True,
            )
            session.add(driver)
            mapping[row.driver_id] = driver.id
    session.flush()
    return mapping


def _upsert_race_results(
    session: Session,
    results_df: pd.DataFrame,
    driver_map: dict[str, uuid.UUID],
    circuit_map: dict[str, uuid.UUID],
    races_df: pd.DataFrame,
    weather_by_round: dict[int, str],
) -> int:
    round_to_circuit = dict(zip(races_df["round"], races_df["circuit_ref"]))
    inserted = 0
    for row in results_df.itertuples(index=False):
        driver_db_id = driver_map.get(row.driver_id)
        circuit_ref = round_to_circuit.get(int(row.round))
        circuit_db_id = circuit_map.get(circuit_ref) if circuit_ref else None
        if not driver_db_id or not circuit_db_id:
            continue
        exists = session.query(RaceResult).filter_by(
            driver_id=driver_db_id,
            circuit_id=circuit_db_id,
            season=int(row.season),
            round=int(row.round),
        ).first()
        if exists:
            continue
        race_time_s: float | None = None
        race_time_ms = getattr(row, "race_time_ms", None)
        if race_time_ms:
            race_time_s = float(race_time_ms) / 1000.0
        session.add(RaceResult(
            id=uuid.uuid4(),
            driver_id=driver_db_id,
            circuit_id=circuit_db_id,
            season=int(row.season),
            round=int(row.round),
            grid_position=int(row.grid) if row.grid else None,
            finish_position=int(row.position) if row.position else None,
            points=float(row.points),
            dnf=bool(row.dnf),
            dnf_cause=row.dnf_cause if pd.notna(row.dnf_cause) else None,
            fastest_lap=bool(row.fastest_lap),
            weather=weather_by_round.get(int(row.round), "dry"),
            race_time_seconds=race_time_s,
        ))
        inserted += 1
    session.flush()
    return inserted


def _upsert_driver_ratings(
    session: Session,
    ratings: list[DriverRating],
    results_df: pd.DataFrame,
    teammate_indices: dict[str, float] | None = None,
) -> int:
    driver_meta = (
        results_df[["driver_id", "driver_name", "driver_abbr"]]
        .drop_duplicates("driver_id")
        .set_index("driver_id")
    )
    tm_idx = teammate_indices or {}
    upserted = 0
    for rating in ratings:
        meta = driver_meta.loc[rating.driver_id] if rating.driver_id in driver_meta.index else None
        if meta is None:
            continue
        abbr = str(meta["driver_abbr"]).strip().upper()[:3] if meta["driver_abbr"] else None
        name = str(meta["driver_name"])

        db_driver: Driver | None = None
        if abbr:
            db_driver = session.query(Driver).filter_by(abbreviation=abbr).first()
        if db_driver is None:
            db_driver = session.query(Driver).filter_by(name=name).first()
        if db_driver is None:
            _log.warning("Driver not in DB: %s (%s) — skipping rating", name, abbr)
            continue

        t_index = tm_idx.get(rating.driver_id)

        existing = (
            session.query(DriverRatingModel)
            .filter_by(driver_id=db_driver.id, season=rating.season)
            .first()
        )
        if existing:
            existing.base_pace = rating.base_pace
            existing.consistency = rating.consistency
            existing.wet_skill = rating.wet_skill
            existing.tyre_management = rating.tyre_management
            existing.overtake_skill = rating.overtake_skill
            existing.dnf_rate = rating.dnf_rate
            existing.qualifying_edge = rating.qualifying_edge
            existing.speed_rating = rating.speed_rating
            existing.pit_efficiency = rating.pit_efficiency
            existing.mechanical_dnf_rate = rating.mechanical_dnf_rate
            existing.driver_dnf_rate = rating.driver_dnf_rate
            if t_index is not None:
                existing.teammate_index = round(float(t_index), 4)
        else:
            session.add(DriverRatingModel(
                id=uuid.uuid4(),
                driver_id=db_driver.id,
                season=rating.season,
                base_pace=rating.base_pace,
                consistency=rating.consistency,
                wet_skill=rating.wet_skill,
                tyre_management=rating.tyre_management,
                overtake_skill=rating.overtake_skill,
                dnf_rate=rating.dnf_rate,
                qualifying_edge=rating.qualifying_edge,
                speed_rating=rating.speed_rating,
                pit_efficiency=rating.pit_efficiency,
                mechanical_dnf_rate=rating.mechanical_dnf_rate,
                driver_dnf_rate=rating.driver_dnf_rate,
                teammate_index=round(float(t_index), 4) if t_index is not None else None,
            ))
        upserted += 1
    session.flush()
    return upserted


# ---------------------------------------------------------------------------
# Per-season pipeline
# ---------------------------------------------------------------------------


def seed_season(season: int, skip_fastf1: bool = False) -> dict:
    """Full ingestion + ratings pipeline for one season."""
    _log.info("── Season %d ─────────────────────────────────────────", season)

    # ── 1. Ergast / Jolpica calendar + results ──────────────────────────────
    _log.info("[%d] Fetching race calendar...", season)
    races_df = fetch_season_races(season)
    if races_df.empty:
        _log.warning("[%d] No races found — skipping.", season)
        return {"season": season, "status": "no_data"}

    _log.info("[%d] Calendar: %d rounds", season, len(races_df))

    _log.info("[%d] Fetching race results...", season)
    results_df = fetch_season_results(season)
    if results_df.empty:
        _log.warning("[%d] No results yet — skipping.", season)
        return {"season": season, "status": "no_data"}

    # Attach circuit_ref to results
    round_to_circuit_ref = races_df.set_index("round")["circuit_ref"]
    results_df = results_df.copy()
    results_df["circuit_ref"] = results_df["round"].map(round_to_circuit_ref)

    _log.info(
        "[%d] Ergast: %d rounds with results, %d result rows, %d unique drivers",
        season,
        results_df["round"].nunique(),
        len(results_df),
        results_df["driver_id"].nunique(),
    )

    _log.info("[%d] Fetching qualifying data...", season)
    try:
        fetch_season_qualifying(season)
    except Exception as exc:
        _log.warning("[%d] Qualifying fetch failed: %s", season, exc)

    # ── 2. FastF1 lap + telemetry + pitstop + weather data ──────────────────
    all_round_numbers: list[int] = sorted(races_df["round"].tolist())

    if season >= _CURRENT_YEAR:
        fastf1_rounds = get_completed_rounds(season)
        if not fastf1_rounds:
            fastf1_rounds = sorted(results_df["round"].unique().tolist())
        _log.info(
            "[%d] Partial season: fetching FastF1 for %d/%d completed rounds",
            season, len(fastf1_rounds), len(all_round_numbers),
        )
    else:
        fastf1_rounds = all_round_numbers

    laps_by_round: dict[int, pd.DataFrame] = {}
    telemetry_by_round: dict[int, pd.DataFrame] = {}
    pitstops_by_round: dict[int, pd.DataFrame] = {}
    weather_by_round: dict[int, str] = {rnd: "dry" for rnd in all_round_numbers}

    if skip_fastf1:
        _log.info("[%d] Skipping FastF1 data (--skip-fastf1)", season)
    else:
        _log.info("[%d] Fetching FastF1 laps for %d rounds...", season, len(fastf1_rounds))
        laps_by_round = fetch_season_laps(season, fastf1_rounds)
        total_laps = sum(len(df) for df in laps_by_round.values())
        _log.info("[%d] FastF1 laps: %d total rows", season, total_laps)

        _log.info("[%d] Fetching telemetry for %d rounds...", season, len(fastf1_rounds))
        telemetry_by_round = fetch_season_telemetry(season, fastf1_rounds)

        _log.info("[%d] Fetching pit stop data for %d rounds...", season, len(fastf1_rounds))
        pitstops_by_round = fetch_season_pitstops(season, fastf1_rounds)

        for rnd in fastf1_rounds:
            weather_by_round[rnd] = fetch_race_weather(season, rnd)

    # ── 3. Persist teams, circuits, drivers, race results ────────────────────
    _log.info("[%d] Upserting teams, circuits, drivers, race results...", season)
    with SyncSessionLocal() as session:
        team_map = _upsert_teams(session, results_df)
        circuit_map = _upsert_circuits(session, races_df)
        driver_map = _upsert_drivers(session, results_df, team_map)
        results_inserted = _upsert_race_results(
            session, results_df, driver_map, circuit_map, races_df, weather_by_round
        )
        session.commit()

    _log.info(
        "[%d] DB: %d teams, %d circuits, %d drivers, %d results inserted",
        season, len(team_map), len(circuit_map), len(driver_map), results_inserted,
    )

    # ── 4. Load prior seasons for multi-season wet_skill ─────────────────────
    prior_seasons_data: list = []
    prior_results: dict[int, pd.DataFrame] = {}

    if not skip_fastf1:
        for prior in [season - 1, season - 2]:
            if prior < 2018:
                continue
            try:
                cached_laps = try_get_cached_season_laps(prior)
                cached_weather = try_get_cached_season_weather(prior)
                if cached_laps:
                    prior_seasons_data.append((cached_laps, cached_weather))
                    _log.debug("[%d] Loaded prior-season %d laps for wet_skill", season, prior)
            except Exception as exc:
                _log.debug("[%d] Prior season %d laps unavailable: %s", season, prior, exc)

    for prior in [season - 1, season - 2]:
        if prior < 2018:
            continue
        try:
            prior_df = fetch_season_results(prior)
            if not prior_df.empty:
                prior_results[prior] = prior_df
        except Exception:
            pass

    # ── 5. Compute driver ratings ────────────────────────────────────────────
    _log.info("[%d] Computing driver ratings...", season)
    overtake_difficulty = dict(zip(races_df["circuit_ref"], races_df["overtake_difficulty"]))

    ratings = compute_driver_ratings(
        season=season,
        results_df=results_df,
        laps_by_round=laps_by_round,
        weather_by_round=weather_by_round,
        telemetry_by_round=telemetry_by_round or None,
        pitstops_by_round=pitstops_by_round or None,
        prior_seasons_data=prior_seasons_data or None,
        overtake_difficulty=overtake_difficulty,
        prior_results=prior_results or None,
    )

    # ── 6. Compute car performance per team ──────────────────────────────────
    _log.info("[%d] Computing team car performance...", season)
    car_perf = _compute_car_performance(results_df)
    _log.info("[%d] Car performance computed for %d teams", season, len(car_perf))

    # ── 7. Compute teammate indices ──────────────────────────────────────────
    _log.info("[%d] Computing teammate indices...", season)
    teammate_indices = _compute_teammate_indices(ratings, results_df)
    _log.info("[%d] Teammate indices computed for %d drivers", season, len(teammate_indices))

    # ── 8. Persist driver ratings (with teammate_index) + car performance ────
    with SyncSessionLocal() as session:
        ratings_upserted = _upsert_driver_ratings(
            session, ratings, results_df, teammate_indices
        )
        car_perf_updated = _upsert_car_performance(session, team_map, car_perf, season)
        session.commit()

    _log.info(
        "[%d] Driver ratings upserted: %d / %d, car performance updated: %d teams",
        season, ratings_upserted, len(ratings), car_perf_updated,
    )

    return {
        "season": season,
        "status": "done",
        "rounds_in_calendar": len(all_round_numbers),
        "rounds_with_results": results_df["round"].nunique(),
        "fastf1_rounds_fetched": len(fastf1_rounds),
        "total_laps": sum(len(df) for df in laps_by_round.values()),
        "teams": len(team_map),
        "circuits": len(circuit_map),
        "drivers": len(driver_map),
        "results_inserted": results_inserted,
        "ratings_upserted": ratings_upserted,
        "car_perf_updated": car_perf_updated,
    }


# ---------------------------------------------------------------------------
# Verification + reporting
# ---------------------------------------------------------------------------


def verify_db() -> bool:
    with SyncSessionLocal() as session:
        counts = {
            "teams":             session.query(func.count(Team.id)).scalar(),
            "circuits":          session.query(func.count(Circuit.id)).scalar(),
            "drivers":           session.query(func.count(Driver.id)).scalar(),
            "race_results":      session.query(func.count(RaceResult.id)).scalar(),
            "driver_ratings":    session.query(func.count(DriverRatingModel.id)).scalar(),
            "with_car_perf":     session.query(func.count(Team.id)).filter(Team.car_performance.isnot(None)).scalar(),
            "with_coords":       session.query(func.count(Circuit.id)).filter(Circuit.latitude.isnot(None)).scalar(),
            "with_teammate_idx": session.query(func.count(DriverRatingModel.id)).filter(DriverRatingModel.teammate_index.isnot(None)).scalar(),
        }

    _log.info("─" * 65)
    _log.info("DB row counts:")
    for table, count in counts.items():
        _log.info("  %-28s  %d", table, count)
    _log.info("─" * 65)

    checks = [
        (counts["drivers"] >= 20,        f"drivers >= 20 (got {counts['drivers']})"),
        (counts["driver_ratings"] >= 20,  f"driver_ratings >= 20 (got {counts['driver_ratings']})"),
        (counts["circuits"] >= 20,        f"circuits >= 20 (got {counts['circuits']})"),
        (counts["race_results"] > 0,      f"race_results > 0 (got {counts['race_results']})"),
        (counts["with_car_perf"] > 0,     f"teams with car_performance > 0 (got {counts['with_car_perf']})"),
        (counts["with_coords"] > 0,       f"circuits with coordinates > 0 (got {counts['with_coords']})"),
    ]

    ok = True
    for passed, msg in checks:
        status = "PASS" if passed else "FAIL"
        log_fn = _log.info if passed else _log.error
        log_fn("%s  %s", status, msg)
        if not passed:
            ok = False

    return ok


def print_top_ratings(season: int, top_n: int = 10) -> None:
    with SyncSessionLocal() as session:
        results = (
            session.query(DriverRatingModel, Driver)
            .join(Driver, DriverRatingModel.driver_id == Driver.id)
            .filter(DriverRatingModel.season == season)
            .order_by(DriverRatingModel.base_pace.desc())
            .limit(top_n)
            .all()
        )
    if not results:
        _log.info("No ratings found for season %d", season)
        return

    _log.info("── Top %d drivers by pace (season %d) ─────────────────────", top_n, season)
    _log.info(
        "  %2s  %-24s  %5s  %5s  %5s  %5s  %5s  %6s",
        "#", "Driver", "pace", "wet", "tyre", "spd", "pit", "tm_idx",
    )
    for i, (r, d) in enumerate(results, 1):
        _log.info(
            "  %2d  %-24s  %.3f  %.3f  %.3f  %.3f  %.3f  %+.3f",
            i, d.name,
            r.base_pace or 0.0,
            r.wet_skill or 0.0,
            r.tyre_management or 0.0,
            r.speed_rating or 0.0,
            r.pit_efficiency or 0.0,
            r.teammate_index or 0.0,
        )


def print_top_teams_car_performance(season: int, top_n: int = 10) -> None:
    """Print top teams by car_performance for the season."""
    with SyncSessionLocal() as session:
        teams = (
            session.query(Team)
            .filter(
                Team.car_performance.isnot(None),
                Team.car_performance_season == season,
            )
            .order_by(Team.car_performance.desc())
            .limit(top_n)
            .all()
        )

    if not teams:
        _log.info("No car performance data for season %d", season)
        return

    _log.info("── Top %d teams by car performance (season %d) ─────────────", top_n, season)
    _log.info("  %2s  %-28s  %-18s  %7s", "#", "Team", "Engine", "car_perf")
    for i, t in enumerate(teams, 1):
        _log.info(
            "  %2d  %-28s  %-18s  %.4f",
            i, t.name, t.engine_supplier or "-", t.car_performance or 0.0,
        )


def print_top_teammate_index(season: int, top_n: int = 10) -> None:
    """Print top drivers by teammate_index for the season."""
    with SyncSessionLocal() as session:
        results = (
            session.query(DriverRatingModel, Driver)
            .join(Driver, DriverRatingModel.driver_id == Driver.id)
            .filter(
                DriverRatingModel.season == season,
                DriverRatingModel.teammate_index.isnot(None),
            )
            .order_by(DriverRatingModel.teammate_index.desc())
            .limit(top_n)
            .all()
        )

    if not results:
        _log.info("No teammate index data for season %d", season)
        return

    _log.info("── Top %d drivers by teammate index (season %d) ─────────────", top_n, season)
    _log.info("  %2s  %-24s  %8s  %5s", "#", "Driver", "tm_index", "pace")
    for i, (r, d) in enumerate(results, 1):
        _log.info(
            "  %2d  %-24s  %+.4f  %.3f",
            i, d.name, r.teammate_index or 0.0, r.base_pace or 0.0,
        )


def print_top_sc_circuits(top_n: int = 10) -> None:
    """Print circuits with highest safety car probability."""
    with SyncSessionLocal() as session:
        circuits = (
            session.query(Circuit)
            .filter(Circuit.sc_probability.isnot(None))
            .order_by(Circuit.sc_probability.desc())
            .limit(top_n)
            .all()
        )

    if not circuits:
        _log.info("No SC probability data in DB")
        return

    _log.info("── Top %d circuits by SC probability ───────────────────────", top_n)
    _log.info("  %2s  %-32s  %7s  %7s", "#", "Circuit", "sc_prob", "vsc_prob")
    for i, c in enumerate(circuits, 1):
        _log.info(
            "  %2d  %-32s  %.3f    %.3f",
            i, c.name, c.sc_probability or 0.0, c.vsc_probability or 0.0,
        )


def print_season_round_counts(summaries: list[dict]) -> None:
    _log.info("─" * 80)
    _log.info(
        "  %-6s  %7s  %7s  %7s  %10s  %7s  %7s  %8s",
        "Season", "Cal-Rnd", "Res-Rnd", "FF1-Rnd", "Laps", "Results", "Ratings", "CarPerf",
    )
    _log.info("─" * 80)
    for s in summaries:
        if s.get("status") == "no_data":
            _log.info("  %-6d  no data", s["season"])
        elif s.get("status") == "done":
            _log.info(
                "  %-6d  %7d  %7d  %7d  %10d  %7d  %7d  %8d",
                s["season"],
                s.get("rounds_in_calendar", 0),
                s.get("rounds_with_results", 0),
                s.get("fastf1_rounds_fetched", 0),
                s.get("total_laps", 0),
                s.get("results_inserted", 0),
                s.get("ratings_upserted", 0),
                s.get("car_perf_updated", 0),
            )
        else:
            _log.info("  %-6d  %s", s["season"], s.get("status", "error"))
    _log.info("─" * 80)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed the F1 simulator database")
    p.add_argument(
        "--seasons", nargs="+", type=int, default=[2024], metavar="YEAR",
        help="Seasons to ingest (default: 2024)",
    )
    p.add_argument(
        "--skip-fastf1", action="store_true",
        help="Skip FastF1 data — Ergast-only ratings (faster but less accurate)",
    )
    p.add_argument(
        "--verify-only", action="store_true",
        help="Skip ingestion; print row counts and exit",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    if args.verify_only:
        ok = verify_db()
        sys.exit(0 if ok else 1)

    summaries: list[dict] = []
    failed_seasons: list[int] = []

    for season in args.seasons:
        if season < 2018:
            _log.warning(
                "Season %d pre-dates 2018: FastF1 telemetry unavailable, "
                "ratings will be Ergast-only and may be inaccurate. "
                "Recommend --seasons 2018 2019 2020 2021 2022 2023 2024.",
                season,
            )
        try:
            result = seed_season(season, skip_fastf1=args.skip_fastf1)
            summaries.append(result)
            if result.get("status") not in ("done", "no_data"):
                failed_seasons.append(season)
        except Exception:
            _log.exception("Unhandled error seeding season %d", season)
            summaries.append({"season": season, "status": "error"})
            failed_seasons.append(season)

    print_season_round_counts(summaries)

    ok = verify_db()

    # Show analytics reports for recent seasons
    for season in args.seasons:
        if season >= 2022:
            print_top_ratings(season, top_n=10)
            print_top_teams_car_performance(season, top_n=10)
            print_top_teammate_index(season, top_n=10)

    print_top_sc_circuits(top_n=10)

    if failed_seasons:
        _log.error("Failed seasons: %s", failed_seasons)

    sys.exit(0 if (ok and not failed_seasons) else 1)
