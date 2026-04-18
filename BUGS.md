# BUGS.md — Fixed Issues

## [FIXED] Backtest: Verstappen WDC probability too low (50.9% vs target >85%)

**Root cause**: `car_performance` defaulted to 0.5 for all drivers when the Ergast
parquet cache pre-dated the `driver_name` column. In `load_ratings_from_db()`, the
constructor lookup `driver_con_map.get(driver.name, "")` returned `""` for every
driver, so `car_perf.get("", 0.5)` always yielded 0.5. With all teams at equal
car_performance, the Red Bull's 2023 dominant car advantage (≈0.95) was invisible
to the simulator and the field compressed artificially.

**Fix** (`scripts/run_backtest.py`):
- Added `abbr_con_map` (3-letter abbreviation → constructor_id) as fallback lookup
  alongside the existing name-based `driver_con_map`.
- Built from `results_df["driver_abbr"]` which is present in all parquet cache versions.
- `load_ratings_from_db()` now tries name → abbreviation → defaults to 0.5.
- Added warning log when cache is missing both lookup columns.

**Impact**: With Red Bull 2023 car_performance ≈ 0.95 correctly loaded, Verstappen's
composite pace = 0.35 × driver_pace + 0.65 × 0.95 gives a ~12% gap over field
instead of ~4%, raising WDC probability from ~50% to >85%.

---

## [FIXED] Stale 2015/2016/2017 data polluting historical averages

**Root cause**: Seasons 2015–2017 were seeded via Ergast-only (no FastF1 telemetry).
Wet-skill, tyre-management, and consistency ratings for these seasons are unreliable
and skew the weighted averages used in trailing-season DNF rate and wet_skill
calculations.

**Fix**:
- Deleted `race_results` and `driver_ratings` rows for seasons 2015, 2016, 2017.
- `seed_db.py` `prior < 2015` boundary changed to `prior < 2018` so prior-season
  data loading never references the now-deleted seasons.
- Docstring usage example updated to start from 2018.

---

---

## [FIXED] 2022 backtest: Sainz ranked 2nd, Leclerc ranked 4th (reality: Leclerc 2nd, Sainz 5th)

**Root cause**: The combined `dnf_rate` field attributed all of Ferrari's 2022 mechanical
failures to individual drivers' personal ratings. Leclerc had 8 DNFs (most from engine
fires — factory issues) and Sainz had 3, so the simulator treated Leclerc as a
high-DNF driver and Sainz as reliable. In reality both should share Ferrari's factory
reliability burden equally.

**Fix** (6 files changed):

*`app/ingestion/transformers.py`*:
- Replaced `_compute_dnf_rate()` with `_compute_dnf_rates()` returning three series:
  `(total, mechanical_pooled, driver_error)`.
- Mechanical DNFs (engine, hydraulics, etc.) are averaged within the current season's
  constructor — both Ferrari drivers get `(Leclerc_mech + Sainz_mech) / 2`.
- Driver-error DNFs (crashes, incidents) remain individual.
- `dnf_rate` is set to `mechanical_pooled + driver_error` (unchanged sum for back-compat).

*`app/simulation/performance_model.py`*:
- Added `_IDX_MECH_DNF_RATE = 8` and `_IDX_DRIVER_DNF_RATE = 9` matrix columns.
- `DriverRating` dataclass gains `mechanical_dnf_rate` and `driver_dnf_rate` fields.
- `build_ratings_matrix()` now returns `(n_drivers, 10)`.
- `sample_dnf_mask()` uses `mech + driver` from cols 8+9; falls back per-driver to
  col 5 (`dnf_rate`) when split columns are both zero (old-style ratings).

*`app/models/driver_rating.py`*:
- Added `mechanical_dnf_rate` and `driver_dnf_rate` nullable Float columns.

*`alembic/versions/0005_split_dnf_rates.py`*:
- Migration adding both new columns to `driver_ratings`.

*`scripts/seed_db.py`*:
- `_upsert_driver_ratings()` persists both new columns.

*`scripts/run_backtest.py`*:
- `_transformer_to_sim()` passes new fields through.
- `load_ratings_from_db()` loads and passes both columns.

**Expected result after re-seeding**: Leclerc and Sainz both carry Ferrari 2022's
pooled mechanical_dnf_rate (~18%), removing Leclerc's artificial disadvantage.

---

## [ALREADY IMPLEMENTED — confirmed not broken]

The following features were verified as fully implemented at the time of the
Phase 5 audit (2026-04-18). No code changes were required.

### Monte Carlo realism (season_simulator.py / race_simulator.py)
- `n_sims` default = 10,000 ✓
- DNF reliability streak: 15% DNF rate increase for drivers who DNF'd previous race ✓
- Grid penalty: 8% chance per race, 3–5 place penalty ✓
- Rain-start equalisation: top-3 qualifiers lose 20% qualifying edge in wet ✓
- Lap-1 incident: 8–12% chance per race (scaled by overtake_difficulty), 1–2 victims ✓

### Points system (scoring.py / race_simulator.py)
- POINTS_MAP: {1:25, 2:18, …, 10:1} ✓
- FASTEST_LAP_BONUS: +1 point for FL driver finishing in top 10 ✓
- SPRINT_POINTS: {1:8, 2:7, …, 8:1} applied for all sprint-round circuits ✓
- 2023 sprint circuits correctly mapped: baku, red_bull_ring, spa, losail,
  circuit_of_the_americas, interlagos (6 rounds) ✓

### Wet-skill from INTER laps (transformers.py)
- `_compute_wet_skill_from_inter()` used when wet_rounds < 2 ✓
- Computes dry/INTER lap-time ratio as proxy, avoiding the 0.5 fallback ✓
