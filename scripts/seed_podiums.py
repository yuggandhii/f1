"""
scripts/seed_podiums.py — Fast, comprehensive race-result seeder.

Seeds every race result (all positions) for seasons 2018-2026 into PostgreSQL.
No FastF1 telemetry, no driver ratings — just calendar + results. Runs in ~5 min.

Falls back to OpenF1 API for any season where Jolpica returns empty (e.g. 2026
early-season lag before Ergast indexes new results).

Run (outside Docker):
    python scripts/seed_podiums.py
    python scripts/seed_podiums.py --seasons 2025 2026
    python scripts/seed_podiums.py --force         # clears parquet cache, re-fetches

Run (inside Docker — recommended for persistence):
    docker compose exec app python scripts/seed_podiums.py
    docker compose exec app python scripts/seed_podiums.py --seasons 2026 --force
    docker compose exec app python scripts/seed_podiums.py --verify
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import requests
import pandas as pd

from app.database import SyncSessionLocal
from app.ingestion.ergast_client import fetch_season_races, fetch_season_results
from app.models.circuit import Circuit
from app.models.driver import Driver
from app.models.race_result import RaceResult
from app.models.team import Team
from scripts.seed_db import (
    TEAM_ENGINE_SUPPLIER,
    _upsert_circuits,
    _upsert_drivers,
    _upsert_race_results,
    _upsert_teams,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
_log = logging.getLogger("seed_podiums")

ALL_SEASONS = list(range(2018, 2027))
_OPENF1_BASE = "https://api.openf1.org/v1"

# Map OpenF1 team names → Ergast constructor_id for de-duplication
_OPENF1_TEAM_MAP: dict[str, str] = {
    "mclaren racing":                       "mclaren",
    "mclaren":                              "mclaren",
    "oracle red bull racing":               "red_bull",
    "red bull racing":                      "red_bull",
    "scuderia ferrari":                     "ferrari",
    "ferrari":                              "ferrari",
    "mercedes-amg petronas f1 team":        "mercedes",
    "mercedes":                             "mercedes",
    "aston martin aramco f1 team":          "aston_martin",
    "aston martin":                         "aston_martin",
    "williams racing":                      "williams",
    "williams":                             "williams",
    "visa cash app rb formula one team":    "rb",
    "racing bulls":                         "rb",
    "rb":                                   "rb",
    "stake f1 team kick sauber":            "kick_sauber",
    "sauber":                               "kick_sauber",
    "bwt alpine f1 team":                   "alpine",
    "alpine":                               "alpine",
    "haas f1 team":                         "haas",
    "haas":                                 "haas",
    "cadillac f1 team":                     "cadillac",
    "cadillac":                             "cadillac",
}


# ---------------------------------------------------------------------------
# OpenF1 helpers
# ---------------------------------------------------------------------------

def _of1_get(path: str, params: dict | None = None) -> list[dict]:
    url = f"{_OPENF1_BASE}/{path}"
    resp = requests.get(url, params=params or {}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _fetch_from_openf1(season: int) -> pd.DataFrame:
    """
    Fetch race results from OpenF1 for a given season.

    Strategy: get each Race session → fetch all position entries → take the
    last recorded position per driver (= final classified position).
    Returns a DataFrame with the same columns as fetch_season_results().
    """
    _log.info("[%d] OpenF1: fetching race sessions...", season)
    try:
        sessions = sorted(
            _of1_get("sessions", {"year": season, "session_name": "Race"}),
            key=lambda s: s.get("date_start", ""),
        )
    except Exception as exc:
        _log.warning("[%d] OpenF1 sessions failed: %s", season, exc)
        return pd.DataFrame()

    if not sessions:
        _log.warning("[%d] OpenF1: no race sessions found for %d", season, season)
        return pd.DataFrame()

    _log.info("[%d] OpenF1: found %d race sessions", season, len(sessions))
    rows: list[dict] = []

    for idx, sess in enumerate(sessions):
        rnd = idx + 1
        sk = sess["session_key"]
        _log.info("[%d] OpenF1: R%02d — session_key=%s", season, rnd, sk)

        # Final positions: last position entry per driver
        try:
            pos_entries = _of1_get("position", {"session_key": sk})
        except Exception as exc:
            _log.warning("[%d] R%02d: position fetch failed: %s", season, rnd, exc)
            continue

        final: dict[int, dict] = {}
        for entry in pos_entries:
            dn = entry.get("driver_number")
            if dn:
                final[dn] = entry  # later entries overwrite earlier ones

        if not final:
            _log.warning("[%d] R%02d: no position data returned", season, rnd)
            continue

        # Driver info
        try:
            driver_list = _of1_get("drivers", {"session_key": sk})
            drv_map = {d["driver_number"]: d for d in driver_list}
        except Exception as exc:
            _log.warning("[%d] R%02d: driver fetch failed: %s", season, rnd, exc)
            drv_map = {}

        for p_entry in sorted(final.values(), key=lambda x: x.get("position", 99)):
            dn = p_entry.get("driver_number")
            pos = p_entry.get("position")
            if pos is None:
                continue
            drv = drv_map.get(dn, {})
            abbr = (drv.get("name_acronym") or f"D{dn:02d}")[:3].upper()
            full_name = drv.get("full_name") or f"Driver {dn}"
            team_raw = (drv.get("team_name") or "Unknown").strip()
            team_key = _OPENF1_TEAM_MAP.get(team_raw.lower(), team_raw.lower().replace(" ", "_")[:20])

            rows.append({
                "round":               rnd,
                "season":              season,
                "driver_id":           f"of1_{abbr.lower()}",
                "driver_name":         full_name,
                "driver_abbr":         abbr,
                "driver_nationality":  drv.get("country_code", ""),
                "constructor_id":      team_key,
                "constructor_name":    team_raw,
                "grid":                0,
                "position":            int(pos),
                "points":              0.0,
                "status":              "Finished",
                "dnf":                 False,
                "dnf_cause":           None,
                "fastest_lap":         False,
                "race_time_ms":        None,
            })

        time.sleep(0.4)  # polite pacing

    df = pd.DataFrame(rows)
    if not df.empty:
        _log.info(
            "[%d] OpenF1: %d rows, %d rounds",
            season, len(df), df["round"].nunique(),
        )
    return df


def _upsert_teams_extended(session, results_df: pd.DataFrame) -> dict[str, uuid.UUID]:
    """
    Like seed_db._upsert_teams but also handles OpenF1 constructor names by
    trying to match against existing teams before creating new ones.
    """
    constructors = results_df[["constructor_id", "constructor_name"]].drop_duplicates("constructor_id")
    mapping: dict[str, uuid.UUID] = {}

    for row in constructors.itertuples(index=False):
        cid = row.constructor_id
        cname = row.constructor_name

        # 1) Exact match on constructor_name (Ergast-style)
        existing = session.query(Team).filter_by(constructor_name=cid).first()
        if existing:
            mapping[cid] = existing.id
            continue

        # 2) Fuzzy: match any team whose name contains the key substring
        cid_key = cid.replace("_", " ")
        existing = (
            session.query(Team)
            .filter(Team.constructor_name.ilike(f"%{cid_key}%"))
            .first()
        )
        if existing:
            _log.debug("Matched '%s' → existing team '%s'", cid, existing.constructor_name)
            mapping[cid] = existing.id
            continue

        # 3) Create new team
        team = Team(
            id=uuid.uuid4(),
            name=cname,
            constructor_name=cid,
            engine_supplier=TEAM_ENGINE_SUPPLIER.get(cid),
        )
        session.add(team)
        mapping[cid] = team.id

    session.flush()
    return mapping


def _upsert_openf1_race_results(
    session,
    results_df: pd.DataFrame,
    circuit_map: dict[str, uuid.UUID],
    races_df: pd.DataFrame,
    weather_by_round: dict[int, str],
) -> int:
    """
    Insert OpenF1-sourced race results, matching drivers by abbreviation against
    existing DB records (OpenF1 driver_ids differ from Ergast).
    """
    round_to_circuit = dict(zip(races_df["round"], races_df["circuit_ref"]))
    inserted = 0

    for row in results_df.itertuples(index=False):
        abbr = str(row.driver_abbr).upper()[:3]
        db_driver = session.query(Driver).filter_by(abbreviation=abbr).first()

        if db_driver is None:
            # Create minimal driver record
            team_id = None  # team matching is best-effort for OpenF1
            db_driver = Driver(
                id=uuid.uuid4(),
                name=str(row.driver_name),
                abbreviation=abbr,
                nationality=str(row.driver_nationality) or None,
                team_id=team_id,
                active=True,
            )
            session.add(db_driver)
            session.flush()
            _log.debug("Created new driver from OpenF1: %s (%s)", row.driver_name, abbr)

        circuit_ref = round_to_circuit.get(int(row.round))
        circuit_db_id = circuit_map.get(circuit_ref) if circuit_ref else None
        if not circuit_db_id:
            _log.debug("OpenF1: no circuit for R%02d — skipping", row.round)
            continue

        exists = session.query(RaceResult).filter_by(
            driver_id=db_driver.id,
            circuit_id=circuit_db_id,
            season=int(row.season),
            round=int(row.round),
        ).first()
        if exists:
            continue

        session.add(RaceResult(
            id=uuid.uuid4(),
            driver_id=db_driver.id,
            circuit_id=circuit_db_id,
            season=int(row.season),
            round=int(row.round),
            grid_position=None,
            finish_position=int(row.position) if row.position else None,
            points=0.0,
            dnf=False,
            weather=weather_by_round.get(int(row.round), "dry"),
        ))
        inserted += 1

    session.flush()
    return inserted


# ---------------------------------------------------------------------------
# Per-season pipeline
# ---------------------------------------------------------------------------

def seed_season_fast(season: int, force: bool = False) -> dict:
    """Seed one season: calendar + results only (no FastF1, no driver ratings)."""
    _log.info("── Season %d ─────────────────────────────────────────────────", season)

    if force:
        for fname in ("ergast_races.parquet", "ergast_results.parquet"):
            p = Path(f"data/cache/{season}/{fname}")
            if p.exists():
                p.unlink()
                _log.info("[%d] Cleared parquet cache: %s", season, fname)

    # --- calendar ---
    races_df = fetch_season_races(season)
    if races_df.empty:
        _log.warning("[%d] No calendar found — skipping", season)
        return {"season": season, "status": "no_calendar"}

    # --- results: Jolpica first, OpenF1 fallback ---
    results_df = fetch_season_results(season)
    source = "jolpica"

    if results_df.empty and season >= 2025:
        _log.info("[%d] Jolpica returned empty — trying OpenF1 fallback...", season)
        results_df = _fetch_from_openf1(season)
        source = "openf1"

    if results_df.empty:
        _log.warning("[%d] No results from Jolpica or OpenF1", season)
        return {"season": season, "status": "no_results"}

    _log.info(
        "[%d] Source=%s  %d rows  %d rounds  %d drivers",
        season, source, len(results_df),
        results_df["round"].nunique(),
        results_df["driver_id"].nunique(),
    )

    # Attach circuit_ref if missing
    if "circuit_ref" not in results_df.columns or results_df["circuit_ref"].isna().all():
        r2c = races_df.set_index("round")["circuit_ref"]
        results_df = results_df.copy()
        results_df["circuit_ref"] = results_df["round"].map(r2c)

    weather_by_round: dict[int, str] = {int(r): "dry" for r in races_df["round"]}

    with SyncSessionLocal() as session:
        if source == "jolpica":
            team_map    = _upsert_teams(session, results_df)
            circuit_map = _upsert_circuits(session, races_df)
            driver_map  = _upsert_drivers(session, results_df, team_map)
            n = _upsert_race_results(
                session, results_df, driver_map, circuit_map, races_df, weather_by_round,
            )
        else:
            # OpenF1: use extended team upsert + abbreviation-based driver matching
            _upsert_teams_extended(session, results_df)
            circuit_map = _upsert_circuits(session, races_df)
            n = _upsert_openf1_race_results(
                session, results_df, circuit_map, races_df, weather_by_round,
            )
        session.commit()

    _log.info("[%d] ✓ %d results written to DB (source: %s)", season, n, source)
    return {"season": season, "status": "ok", "source": source, "inserted": n}


# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------

def verify() -> None:
    """Print row counts per season in the race_results table."""
    from sqlalchemy import func, text
    _log.info("── DB verification ────────────────────────────────────────────")
    with SyncSessionLocal() as session:
        rows = session.execute(
            text(
                "SELECT season, COUNT(*) AS total_results, "
                "COUNT(DISTINCT round) AS rounds, "
                "SUM(CASE WHEN finish_position = 1 THEN 1 ELSE 0 END) AS winners "
                "FROM race_results GROUP BY season ORDER BY season"
            )
        ).fetchall()
    if not rows:
        _log.info("  race_results table is empty — run seed_podiums.py to populate")
        return
    _log.info("  season  rounds  results  winners")
    for r in rows:
        _log.info("  %d     %6d  %7d  %7d", r[0], r[2], r[1], r[3])


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed all F1 race results into PostgreSQL (fast — no FastF1/ratings)."
    )
    parser.add_argument(
        "--seasons", nargs="+", type=int, default=ALL_SEASONS,
        metavar="YEAR",
        help="seasons to seed (default: 2018-2026)",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="clear Jolpica parquet cache and re-fetch from API before seeding",
    )
    parser.add_argument(
        "--verify", action="store_true",
        help="print DB row counts and exit (no seeding)",
    )
    args = parser.parse_args()

    if args.verify:
        verify()
        return

    results = []
    for season in sorted(args.seasons):
        try:
            r = seed_season_fast(season, force=args.force)
        except Exception as exc:
            _log.error("[%d] Unexpected error: %s", season, exc, exc_info=True)
            r = {"season": season, "status": "error", "error": str(exc)}
        results.append(r)

    _log.info("\n── Summary ────────────────────────────────────────────────────")
    for r in results:
        ins = r.get("inserted", "—")
        src = r.get("source", "—")
        _log.info("  %d  %-12s  %s rows  (src: %s)", r["season"], r["status"].upper(), ins, src)

    _log.info(
        "\nTo re-run anytime:\n"
        "  docker compose exec app python scripts/seed_podiums.py\n"
        "  docker compose exec app python scripts/seed_podiums.py --seasons 2026 --force\n"
        "  docker compose exec app python scripts/seed_podiums.py --verify"
    )


if __name__ == "__main__":
    main()
