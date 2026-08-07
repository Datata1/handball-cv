from pathlib import Path

from pydantic_settings import BaseSettings

# packages/ml/src/ml/config.py → go up 4 levels → repo root
_REPO_ROOT = Path(__file__).resolve().parents[4]


class MLSettings(BaseSettings):
    model_config = {"env_prefix": "WELS_"}

    # Data — absolute paths anchored to repo root
    duckdb_path: Path = _REPO_ROOT / "data/output/duckdb/matches.duckdb"
    models_dir: Path = _REPO_ROOT / "data/input/models"

    # Graph construction
    window_size: int = 25  # frames per training sample (1 second at 25 FPS)
    k_neighbors: int = 5  # k-NN edges per player node

    # Model hyperparameters
    node_features: int = 10
    hidden_dim: int = 128
    lstm_hidden: int = 128

    # Training
    epochs: int = 50
    learning_rate: float = 1e-3
    batch_size: int = 32
    val_split: float = 0.2

    # Inference device. "auto" detects a CUDA GPU at runtime and uses it,
    # otherwise falls back to CPU — no manual configuration needed. Force a
    # device with "cuda" or "cpu".
    device: str = "auto"


settings = MLSettings()
