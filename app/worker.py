"""
app/worker.py — Celery application instance.

All Celery tasks are auto-discovered from:
  - app.ingestion.tasks
  - app.simulation.tasks

Usage:
  celery -A app.worker worker --loglevel=info
  celery -A app.worker beat   --loglevel=info
"""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import settings

# ---------------------------------------------------------------------------
# Celery app
# ---------------------------------------------------------------------------
celery_app = Celery(
    "f1sim",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.ingestion.tasks",
        "app.simulation.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Route tasks to specific queues
    task_routes={
        "f1sim.ingestion.*": {"queue": "ingestion"},
        "f1sim.simulation.*": {"queue": "simulations"},
    },
    # Beat schedule — weekly Monday 04:00 UTC refresh
    beat_schedule={
        "weekly-ingestion-refresh": {
            "task": "f1sim.ingestion.fetch_season",
            "schedule": crontab(hour=4, minute=0, day_of_week=1),
            "kwargs": {"season": "current"},
        },
    },
)

# Expose as `app.worker` for CLI invocation
app = celery_app
