"""Editable match metadata stored as JSON sidecar files.

Keeps user-facing fields (display name, team names) separate from DuckDB so the
backend never needs a write connection to the database.
"""

import json
from pathlib import Path
from typing import Any

_MONOREPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
META_DIR = _MONOREPO_ROOT / "data" / "output" / "meta"


def read_meta(match_id: str) -> dict[str, Any]:
    path = META_DIR / f"{match_id}.json"
    if not path.exists():
        return {}
    try:
        result = json.loads(path.read_text(encoding="utf-8"))
        return result if isinstance(result, dict) else {}
    except Exception:
        return {}


def write_meta(match_id: str, data: dict[str, Any]) -> None:
    META_DIR.mkdir(parents=True, exist_ok=True)
    path = META_DIR / f"{match_id}.json"
    current = read_meta(match_id)
    current.update({k: v for k, v in data.items() if v is not None})
    path.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
