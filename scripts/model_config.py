"""
Model paths configuration for WELS Handball Analytics Platform.
Define where models should be saved locally.
"""

from pathlib import Path

# Root data directory
DATA_DIR = Path(__file__).parent.parent / "data"

# Model storage paths
MODEL_PATHS = {
    # Court Detection Model (for detecting court/field boundaries)
    "court_detection": {
        "name": "Court Detection Model",
        "save_path": DATA_DIR / "input" / "models" / "ingestion" / "court_detection.pt",
    },
    # Ball Detection Model (for detecting ball position)
    "ball_detection": {
        "name": "Ball Detection Model",
        "save_path": DATA_DIR / "input" / "models" / "ingestion" / "ball_detection.pt",
    },
    # Player Detection Model (for detecting players)
    "player_detection": {
        "name": "Player Detection Model",
        "save_path": DATA_DIR / "input" / "models" / "ingestion" / "player_detection.pt",
    },
}


# Ensure directories exist
def ensure_model_dirs() -> None:
    """Create model directories if they don't exist."""
    for _, model_config in MODEL_PATHS.items():
        save_path = Path(model_config["save_path"])
        save_path.parent.mkdir(parents=True, exist_ok=True)


if __name__ == "__main__":
    # Print all model paths
    ensure_model_dirs()
    print("Model storage paths:")
    for model_key, model_config in MODEL_PATHS.items():
        print(f"  {model_key}: {model_config['save_path']}")
