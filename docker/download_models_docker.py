"""Downloads WELS models from Google Drive on container startup.

Credentials must be mounted at /app/credentials/ (see docker-compose.yml).
Run 'make auth' locally once to generate token.json before starting Docker.
"""

import sys
from pathlib import Path

sys.path.insert(0, "/app/scripts")

from download_models import ModelDownloader
from model_config import ensure_model_dirs

CREDENTIALS = Path("/app/credentials/credentials.json")
TOKEN = Path("/app/credentials/token.json")

if not CREDENTIALS.exists() or not TOKEN.exists():
    print("==> credentials/ not mounted or incomplete — skipping model download.")
    sys.exit(0)

# Keep in sync with the folder IDs in scripts/download_models.py
MODEL_FOLDER_IDS = {
    "court_detection": "1CwLiXa2giQdRKC5Z0vR7TgaYUfckgxF5",
    "ball_detection": "1-a4mVanJs-B7ANjrdXiHNmaun4M2z1GO",
    "player_detection": "19khgz2aQ-dt_4oPkv61VdndsjF3hbP4G",
}

ensure_model_dirs()
downloader = ModelDownloader(credentials_path=str(CREDENTIALS), token_path=str(TOKEN))

failed = []
for model_key, folder_id in MODEL_FOLDER_IDS.items():
    ok = downloader.download_model_from_folder(
        model_key=model_key, folder_id=folder_id, overwrite=False
    )
    if not ok:
        failed.append(model_key)

if failed:
    print(f"WARNING: Failed to download: {', '.join(failed)}")
    sys.exit(1)
