"""
app/config.py — Pydantic settings loaded from environment / .env file.

All application configuration is centralised here.  Import `settings` wherever
you need a config value; never read os.environ directly elsewhere.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AnyUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    database_url: str = Field(
        default="postgresql+asyncpg://f1user:f1pass@localhost:5432/f1sim",
        description="Async SQLAlchemy DSN — must use asyncpg driver",
    )

    # ------------------------------------------------------------------
    # Redis
    # ------------------------------------------------------------------
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )

    # ------------------------------------------------------------------
    # Celery
    # ------------------------------------------------------------------
    celery_broker_url: str = Field(default="redis://localhost:6379/0")
    celery_result_backend: str = Field(default="redis://localhost:6379/1")

    # ------------------------------------------------------------------
    # FastF1 cache
    # ------------------------------------------------------------------
    f1_cache_dir: Path = Field(
        default=Path("./data/fastf1_cache"),
        description="Directory where FastF1 caches session telemetry",
    )

    # ------------------------------------------------------------------
    # Simulation defaults
    # ------------------------------------------------------------------
    default_n_sims: int = Field(default=10_000, ge=100, le=50_000)
    default_randomness: float = Field(default=0.15, ge=0.0, le=1.0)

    # ------------------------------------------------------------------
    # API / security
    # ------------------------------------------------------------------
    api_secret_key: str = Field(default="changeme-replace-in-production")
    # Comma-separated string; use .cors_origins_list property for the parsed list
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000"
    )

    # ------------------------------------------------------------------
    # App meta
    # ------------------------------------------------------------------
    app_env: Literal["development", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # ------------------------------------------------------------------
    # Derived paths (not from env, computed)
    # ------------------------------------------------------------------
    @property
    def simulations_dir(self) -> Path:
        return Path("./data/simulations")

    @property
    def cache_dir(self) -> Path:
        return Path("./data/cache")

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parsed list of CORS origins from the comma-separated env string."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------
    @field_validator("f1_cache_dir", mode="before")
    @classmethod
    def ensure_path(cls, v: str | Path) -> Path:
        return Path(v)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings singleton.  Use this in FastAPI deps."""
    return Settings()


# Module-level singleton for direct imports: ``from app.config import settings``
settings: Settings = get_settings()
