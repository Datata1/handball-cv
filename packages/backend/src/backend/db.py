"""
DuckDB utility for backend — read-only connection and query helpers.
"""

from pathlib import Path
from typing import Any

import duckdb

from backend.config import settings
from backend.status import all_statuses


def query_duckdb(query: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    """
    Execute a read-only query and return rows as a list of dicts.

    Returns an empty list if the database does not exist or is currently locked
    by the ingestion subprocess (Windows: DuckDB disallows read+write from
    different processes simultaneously).
    """
    db_path = Path(settings.duckdb_path)
    if not db_path.exists():
        return []

    # On Windows, DuckDB refuses a write connection while any reader holds the file.
    # Skip reads while ingestion is running so the subprocess can acquire a write lock.
    if any(s == "processing" for s in all_statuses().values()):
        return []

    conn = duckdb.connect(str(db_path), read_only=True)
    try:
        cursor = conn.execute(query, params or [])
        cols = [desc[0] for desc in cursor.description]
        return [dict(zip(cols, row, strict=True)) for row in cursor.fetchall()]
    except (duckdb.IOException, duckdb.CatalogException):
        return []
    finally:
        conn.close()
