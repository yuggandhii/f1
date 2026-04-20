from app.database import SyncSessionLocal
from app.models.driver import Driver
from app.models.driver_rating import DriverRating
from collections import defaultdict
with SyncSessionLocal() as session:
    rows = session.query(DriverRating, Driver).join(Driver, Driver.id == DriverRating.driver_id).filter(DriverRating.season == 2026).all()
    # Team max rating
    team_best = {}
    for r, d in rows:
        rating = r.base_pace + r.consistency
        t_id = d.team_id
        if t_id not in team_best or rating > team_best[t_id][1]:
            team_best[t_id] = (d.name.lower().replace(' ', '_'), rating)
    print("Team best:", team_best.values())
