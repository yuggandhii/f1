"""
scripts/fix_2026_ratings.py — Recompute 2026 driver ratings from actual race results.

The seeded 2026 ratings are pre-season estimates (VER dominant) and do not
reflect the actual 2026 season where ANT/RUS have been winning. This script:
  1. Clears the stale 2026 Ergast parquet cache
  2. Fetches current 2026 results fresh from Jolpica
  3. Recomputes ratings from finish positions (no FastF1 needed)
  4. Updates driver_ratings table for season=2026 only

Run inside Docker:
    docker compose exec app python scripts/fix_2026_ratings.py
"""
from __future__ import annotations

import logging
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
_log = logging.getLogger("fix_2026")

SEASON = 2026


def main() -> None:
    # ── 1. Clear stale parquet cache so we get fresh data from Jolpica ──────
    for fname in ("ergast_results.parquet", "ergast_qualifying.parquet"):
        p = Path(f"data/cache/{SEASON}/{fname}")
        if p.exists():
            p.unlink()
            _log.info("Cleared stale cache: %s", p)

    # ── 2. Fetch fresh results from Jolpica ──────────────────────────────────
    from app.ingestion.ergast_client import fetch_season_races, fetch_season_results
    from app.ingestion.transformers import compute_driver_ratings

    races_df = fetch_season_races(SEASON)
    if races_df.empty:
        _log.error("No 2026 calendar found — cannot fix ratings")
        sys.exit(1)

    results_df = fetch_season_results(SEASON)
    if results_df.empty:
        _log.error("No 2026 results found from Jolpica — cannot fix ratings")
        sys.exit(1)

    _log.info(
        "Fetched %d result rows across %d completed rounds",
        len(results_df), results_df["round"].nunique(),
    )

    # ── 3. Attach circuit_ref and overtake difficulty ────────────────────────
    if "circuit_ref" not in results_df.columns or results_df["circuit_ref"].isna().all():
        r2c = races_df.set_index("round")["circuit_ref"]
        results_df = results_df.copy()
        results_df["circuit_ref"] = results_df["round"].map(r2c)

    overtake_difficulty: dict[str, float] = {}
    if "circuit_ref" in races_df.columns and "overtake_difficulty" in races_df.columns:
        overtake_difficulty = dict(zip(races_df["circuit_ref"], races_df["overtake_difficulty"]))

    # ── 4. Compute ratings (position-based, no FastF1 lap data) ─────────────
    ratings = compute_driver_ratings(
        season=SEASON,
        results_df=results_df,
        laps_by_round={},
        weather_by_round={},
        overtake_difficulty=overtake_difficulty,
    )
    _log.info("Computed ratings for %d drivers", len(ratings))

    # Print computed ratings for review
    sorted_ratings = sorted(ratings, key=lambda r: r.base_pace, reverse=True)
    _log.info("%-30s  pace   consistency  overtake  dnf", "driver_id")
    for r in sorted_ratings[:20]:
        _log.info(
            "  %-28s  %.3f  %.3f        %.3f     %.4f",
            r.driver_id, r.base_pace, r.consistency, r.overtake_skill, r.dnf_rate,
        )

    # ── 5. Update driver_ratings in DB ───────────────────────────────────────
    from app.database import SyncSessionLocal
    from app.models.driver import Driver
    from app.models.driver_rating import DriverRating as DriverRatingModel
    import unicodedata

    def _slug(s: str) -> str:
        nfkd = unicodedata.normalize("NFKD", s)
        return nfkd.encode("ascii", "ignore").decode("ascii").lower().replace(" ", "_")

    with SyncSessionLocal() as session:
        # Build comprehensive lookup: full slug, last-name only, abbreviation
        all_drivers = session.query(Driver).all()
        name_to_db: dict[str, Driver] = {}
        for d in all_drivers:
            name_to_db[_slug(d.name)] = d                          # "george_russell"
            name_to_db[d.name.lower().replace(" ", "_")] = d       # same
            # Last name only — Jolpica uses "russell" not "george_russell"
            parts = d.name.split()
            if parts:
                name_to_db[_slug(parts[-1])] = d                   # "russell"
            if d.abbreviation:
                name_to_db[d.abbreviation.lower()] = d             # "rus"

        # Also build abbr→driver from results_df for cross-referencing
        abbr_to_db: dict[str, "Driver"] = {}
        for _, row in results_df.iterrows():
            abbr = str(row.get("driver_abbr", "")).upper()
            did = str(row.get("driver_id", ""))
            if abbr and len(abbr) == 3 and abbr not in abbr_to_db:
                found = name_to_db.get(did) or name_to_db.get(did.split("_")[-1])
                if found:
                    abbr_to_db[abbr] = found

        updated = 0
        skipped = 0
        for r in ratings:
            driver_db = (
                name_to_db.get(r.driver_id)                # "max_verstappen"
                or name_to_db.get(r.driver_id.split("_")[-1])  # last part: "russell"
                or name_to_db.get(r.driver_id.replace("_", ""))
            )
            if driver_db is None:
                _log.warning("DB driver not found for: %s", r.driver_id)
                skipped += 1
                continue

            existing = (
                session.query(DriverRatingModel)
                .filter_by(driver_id=driver_db.id, season=SEASON)
                .first()
            )

            if existing:
                existing.base_pace          = r.base_pace
                existing.consistency        = r.consistency
                existing.wet_skill          = r.wet_skill
                existing.tyre_management    = r.tyre_management
                existing.overtake_skill     = r.overtake_skill
                existing.dnf_rate           = r.dnf_rate
                existing.qualifying_edge    = r.qualifying_edge
                existing.mechanical_dnf_rate = r.mechanical_dnf_rate
                existing.driver_dnf_rate    = r.driver_dnf_rate
                updated += 1
            else:
                session.add(DriverRatingModel(
                    id=uuid.uuid4(),
                    driver_id=driver_db.id,
                    season=SEASON,
                    base_pace=r.base_pace,
                    consistency=r.consistency,
                    wet_skill=r.wet_skill,
                    tyre_management=r.tyre_management,
                    overtake_skill=r.overtake_skill,
                    dnf_rate=r.dnf_rate,
                    qualifying_edge=r.qualifying_edge,
                    mechanical_dnf_rate=r.mechanical_dnf_rate,
                    driver_dnf_rate=r.driver_dnf_rate,
                ))
                updated += 1

        session.commit()

    _log.info("Done — updated %d driver ratings for 2026 (%d skipped)", updated, skipped)

    # ── 6. Update 2026 team car_performance from actual results ──────────────
    # Mercedes winning -> high car perf; Red Bull struggling -> low car perf
    from app.models.team import Team
    _2026_CAR_PERF: dict[str, float] = {
        "mercedes":    0.88,   # ANT + RUS winning races
        "ferrari":     0.78,   # top-5 consistent
        "mclaren":     0.75,   # NOR/PIA points but not winning
        "red_bull":    0.62,   # VER DNF + poor results
        "alpine":      0.60,
        "aston_martin": 0.58,
        "rb":          0.56,
        "williams":    0.55,
        "haas":        0.54,
        "kick_sauber": 0.52,
        "cadillac":    0.50,
    }
    with SyncSessionLocal() as session:
        teams = session.query(Team).all()
        car_updated = 0
        for team in teams:
            cname = (team.constructor_name or "").lower().replace(" ", "_")
            perf = _2026_CAR_PERF.get(cname)
            if perf is not None:
                team.car_performance = perf
                team.car_performance_season = SEASON
                car_updated += 1
                _log.info("  Team %s car_performance → %.2f", team.name, perf)
        session.commit()
    _log.info("Updated %d team car ratings for 2026", car_updated)
    _log.info("")
    _log.info("Now flush Redis cache and re-run a simulation:")
    _log.info("  docker compose exec redis redis-cli FLUSHDB")


if __name__ == "__main__":
    main()
