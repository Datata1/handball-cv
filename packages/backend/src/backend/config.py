from pathlib import Path

from pydantic_settings import BaseSettings

# packages/backend/src/backend/config.py — go up 4 levels to reach repo root
_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    app_name: str = "WELS Handball Analytics"
    debug: bool = False
    database_url: str = "sqlite:///./wels.db"
    video_input_dir: str = str(_REPO_ROOT / "data" / "input" / "videos")
    duckdb_path: str = str(_REPO_ROOT / "data" / "output" / "duckdb" / "matches.duckdb")
    model_config = {"env_prefix": "WELS_"}


settings = Settings()
