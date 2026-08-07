"""Authenticates with Google Drive and saves token.json to credentials/."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from drive_service import DriveService

CREDS_DIR = Path(__file__).parent.parent / "credentials"

DriveService(
    credentials_path=str(CREDS_DIR / "credentials.json"),
    token_path=str(CREDS_DIR / "token.json"),
)

print("Done — credentials/token.json saved. You can now run: docker compose up --build")
