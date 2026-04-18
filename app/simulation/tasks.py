"""
app/simulation/tasks.py — Celery simulation task with Redis progress streaming.

Task name: f1sim.simulation.run_season
Queue:     simulations

Progress events are published to Redis channel `sim_progress:{run_id}` as JSON:
    {"run_id": "...", "progress": 0.0-1.0, "message": "..."}
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from app.worker import celery_app

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Celery task
# ---------------------------------------------------------------------------

@celery_app.task(name="f1sim.simulation.run_season", bind=True, max_retries=0)
def run_season_simulation(self, run_id: str) -> dict:
    """
    Run a full-season Monte Carlo simulation for run_id.

    Flow:
      1. Load SimulationRun config from DB
      2. Load driver ratings (DB → parquet fallback)
      3. Apply scenario modifications if present
      4. Run simulate_season()
      5. Save parquet + aggregate → DB
      6. Publish progress to Redis pub/sub throughout
    """
    from app.config import settings

    # ── Redis progress publisher ──────────────────────────────────────────
    try:
        import redis as _redis_sync
        _r = _redis_sync.from_url(settings.redis_url)
    except Exception:
        _r = None

    channel = f"sim_progress:{run_id}"

    def _publish(progress: float, message: str) -> None:
        if _r is None:
            return
        try:
            _r.publish(channel, json.dumps({
                "run_id": run_id,
                "progress": round(progress, 3),
                "message": message,
            }))
        except Exception:
            pass

    # ── Load run config ───────────────────────────────────────────────────
    from app.database import SyncSessionLocal
    from app.models.simulation_run import SimulationRun, SimulationResult

    with SyncSessionLocal() as session:
        run = session.get(SimulationRun, uuid.UUID(run_id))
        if run is None:
            _log.error("SimulationRun %s not found", run_id)
            return {"status": "failed", "error": "run not found"}
        season = run.season
        n_sims = run.n_simulations
        randomness = run.randomness_factor
        scenario = run.scenario or {}
        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        session.commit()

    _publish(0.05, "loading season data")

    # ── Load ratings + circuits ───────────────────────────────────────────
    try:
        sim_ratings = _load_ratings(season)
        from app.ingestion.ergast_client import fetch_season_races
        from app.simulation.season_simulator import circuits_from_dataframe
        circuits_df = fetch_season_races(season)
        if circuits_df.empty:
            raise ValueError(f"No race calendar for season {season}")
        circuits = circuits_from_dataframe(circuits_df, season)
    except Exception as exc:
        _fail_run(run_id, str(exc))
        _publish(0.0, f"failed: {exc}")
        return {"status": "failed", "error": str(exc)}

    # ── Apply what-if scenario or legacy modifications ────────────────────
    starting_points: dict[str, float] | None = None

    # Build team context maps for scenario engine
    # driver_teams: driver_slug → team_constructor_slug (e.g. "charles_leclerc" → "ferrari")
    # team_car_perf: team_constructor_slug → car_performance (e.g. "ferrari" → 0.88)
    driver_teams: dict[str, str] = {}
    team_car_perf: dict[str, float] = {}
    try:
        from app.database import SyncSessionLocal
        from app.models.driver import Driver
        from app.models.team import Team
        import unicodedata as _uni
        def _slug(s: str) -> str:
            nfkd = _uni.normalize("NFKD", s)
            return nfkd.encode("ascii", "ignore").decode("ascii").lower().replace(" ", "_")

        with SyncSessionLocal() as _s:
            # Build team_uuid → constructor_slug map
            team_uuid_to_slug: dict[str, str] = {}
            for t in _s.query(Team).all():
                team_slug = _slug(t.constructor_name or t.name or "")
                if team_slug:
                    team_uuid_to_slug[str(t.id)] = team_slug

            # driver_slug → team_constructor_slug
            for d in _s.query(Driver).all():
                if d.team_id:
                    team_slug = team_uuid_to_slug.get(str(d.team_id), "")
                    if team_slug:
                        driver_teams[_slug(d.name)] = team_slug

            # team_constructor_slug → car_performance (season-specific)
            for t in _s.query(Team).filter(
                Team.car_performance_season == season,
                Team.car_performance.isnot(None),
            ).all():
                team_slug = _slug(t.constructor_name or t.name or "")
                if team_slug:
                    team_car_perf[team_slug] = t.car_performance
    except Exception as _exc:
        _log.warning("Could not load team context for scenario: %s", _exc)

    if scenario.get("scenario"):
        # Nested format from POST /scenarios/what-if: outer wrapper has "scenario" key
        inner = scenario["scenario"]
        from app.analytics.what_if import apply_scenario
        sim_ratings, circuits, starting_points, desc = apply_scenario(
            sim_ratings, circuits, inner,
            driver_teams=driver_teams,
            team_car_perf=team_car_perf,
        )
        _log.info("Applied scenario: %s", desc)
    elif scenario.get("type"):
        # Direct scenario dict (type key at top level, no nesting)
        from app.analytics.what_if import apply_scenario
        sim_ratings, circuits, starting_points, desc = apply_scenario(
            sim_ratings, circuits, scenario,
            driver_teams=driver_teams,
            team_car_perf=team_car_perf,
        )
        _log.info("Applied scenario: %s", desc)
    elif scenario.get("modifications"):
        # Legacy list format
        from app.analytics.what_if import apply_modifications
        sim_ratings, circuits, summary = apply_modifications(
            sim_ratings, circuits, scenario["modifications"],
            driver_teams=driver_teams,
            team_car_perf=team_car_perf,
        )
        _log.info("Applied legacy mods: %s", summary)

    _publish(0.10, f"simulating {n_sims:,} seasons — {len(sim_ratings)} drivers, {len(circuits)} circuits")

    # ── Run Monte Carlo ───────────────────────────────────────────────────
    from app.simulation.season_simulator import simulate_season
    try:
        all_points, driver_order = simulate_season(
            ratings=sim_ratings,
            circuits=circuits,
            n_sims=n_sims,
            randomness=randomness,
            seed=42,
            starting_points=starting_points,
        )
    except Exception as exc:
        _fail_run(run_id, str(exc))
        _publish(0.0, f"simulation failed: {exc}")
        return {"status": "failed", "error": str(exc)}

    _publish(0.80, "aggregating results")

    # ── Build constructor map ─────────────────────────────────────────────
    from app.ingestion.ergast_client import fetch_season_results
    from app.analytics.aggregator import build_summary_dataframe

    results_df = fetch_season_results(season)
    driver_to_con: dict[str, str] = {}
    if not results_df.empty:
        latest = (
            results_df.sort_values("round")
            .groupby("driver_id")
            .last()
            .reset_index()[["driver_id", "constructor_id"]]
        )
        driver_to_con = dict(zip(latest["driver_id"], latest["constructor_id"]))

    summary_df = build_summary_dataframe(all_points, driver_order, driver_to_con)

    # ── Save parquet ──────────────────────────────────────────────────────
    from app.analytics.cache import save_simulation_results
    try:
        result_path = save_simulation_results(
            run_id,
            all_points,
            driver_order,
            metadata={"season": season, "n_sims": n_sims, "randomness": randomness},
        )
    except Exception as exc:
        _log.warning("Parquet save failed: %s", exc)
        result_path = None

    _publish(0.90, "saving to database")

    # ── Persist aggregated results ────────────────────────────────────────
    with SyncSessionLocal() as session:
        run = session.get(SimulationRun, uuid.UUID(run_id))
        if run:
            run.status = "done"
            run.completed_at = datetime.now(timezone.utc)
            run.result_path = result_path

        import unicodedata
        def _ascii_slug(s: str) -> str:
            """Normalize accented chars to ASCII and snake_case."""
            nfkd = unicodedata.normalize("NFKD", s)
            ascii_str = nfkd.encode("ascii", "ignore").decode("ascii")
            return ascii_str.lower().replace(" ", "_")

        from app.models.driver import Driver
        driver_rows = session.query(Driver).all()
        # Build lookup: ergast-style snake_case id → DB UUID (accent-normalized)
        name_to_uuid: dict[str, uuid.UUID] = {}
        for d in driver_rows:
            name_to_uuid[d.name] = d.id
            name_to_uuid[d.name.lower().replace(" ", "_")] = d.id
            name_to_uuid[_ascii_slug(d.name)] = d.id

        for _, row in summary_df.iterrows():
            driver_db_id = name_to_uuid.get(row["driver_id"])
            if driver_db_id is None:
                continue
            result_obj = SimulationResult(
                id=uuid.uuid4(),
                run_id=uuid.UUID(run_id),
                driver_id=driver_db_id,
                wdc_probability=float(row["wdc_prob"]),
                expected_points=float(row["expected_pts"]),
                points_std=float(row["pts_std"]),
            )
            session.merge(result_obj)
        session.commit()

    _publish(1.0, "done")
    _log.info("Simulation %s complete — %d drivers, %d sims", run_id, len(driver_order), n_sims)
    return {"status": "done", "run_id": run_id}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_ratings(season: int):
    """Load driver ratings — DB first, then parquet/Ergast fallback."""
    from app.database import SyncSessionLocal
    from app.models.driver import Driver
    from app.models.driver_rating import DriverRating as DriverRatingModel
    from app.models.team import Team
    from app.simulation.performance_model import DriverRating

    try:
        with SyncSessionLocal() as session:
            rows = (
                session.query(DriverRatingModel, Driver)
                .join(Driver, DriverRatingModel.driver_id == Driver.id)
                .filter(DriverRatingModel.season == season)
                .all()
            )
            if rows:
                # Load car_performance per team for this season
                teams = session.query(Team).filter(
                    Team.car_performance_season == season,
                    Team.car_performance.isnot(None),
                ).all()
                team_car_perf: dict[str, float] = {
                    t.id: t.car_performance for t in teams
                }

                _log.info("Loaded %d driver ratings from DB (season %d)", len(rows), season)
                return [
                    DriverRating(
                        driver_id=d.name.lower().replace(" ", "_"),
                        base_pace=r.base_pace or 0.5,
                        consistency=r.consistency or 0.5,
                        wet_skill=r.wet_skill or 0.5,
                        tyre_management=r.tyre_management or 0.5,
                        overtake_skill=r.overtake_skill or 0.5,
                        dnf_rate=r.dnf_rate or 0.05,
                        qualifying_edge=r.qualifying_edge or 0.5,
                        car_performance=team_car_perf.get(d.team_id, 0.5),
                        mechanical_dnf_rate=r.mechanical_dnf_rate or 0.0,
                        driver_dnf_rate=r.driver_dnf_rate or 0.0,
                    )
                    for r, d in rows
                ]
    except Exception as exc:
        _log.warning("DB ratings unavailable (%s) — falling back to parquet", exc)

    # Fallback: compute from Ergast parquet cache
    from app.ingestion.ergast_client import fetch_season_races, fetch_season_results
    from app.ingestion.transformers import compute_driver_ratings
    from app.simulation.performance_model import DriverRating

    races_df = fetch_season_races(season)
    results_df = fetch_season_results(season)
    if results_df.empty:
        raise ValueError(f"No race results for season {season}")

    results_df = results_df.copy()
    round_to_ref = races_df.set_index("round")["circuit_ref"]
    results_df["circuit_ref"] = results_df["round"].map(round_to_ref)
    overtake_difficulty = dict(zip(races_df["circuit_ref"], races_df["overtake_difficulty"]))

    transformer_ratings = compute_driver_ratings(
        season=season,
        results_df=results_df,
        laps_by_round={},
        weather_by_round={},
        overtake_difficulty=overtake_difficulty,
    )
    return [
        DriverRating(
            driver_id=r.driver_id,
            base_pace=r.base_pace,
            consistency=r.consistency,
            wet_skill=r.wet_skill,
            tyre_management=r.tyre_management,
            overtake_skill=r.overtake_skill,
            dnf_rate=r.dnf_rate,
            qualifying_edge=r.qualifying_edge,
            mechanical_dnf_rate=r.mechanical_dnf_rate,
            driver_dnf_rate=r.driver_dnf_rate,
        )
        for r in transformer_ratings
    ]


def _fail_run(run_id: str, error: str) -> None:
    from app.database import SyncSessionLocal
    from app.models.simulation_run import SimulationRun

    try:
        with SyncSessionLocal() as session:
            run = session.get(SimulationRun, uuid.UUID(run_id))
            if run:
                run.status = "failed"
                run.completed_at = datetime.now(timezone.utc)
                session.commit()
    except Exception as exc:
        _log.error("Could not mark run %s as failed: %s", run_id, exc)
