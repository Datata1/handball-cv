"""
CLI entry point for standalone play detection (Spielzugerkennung).

    wels-plays <match_id> [options]

Runs only the rule-based play detectors (Kreuzen, Einläufer, Tempogegenstoß)
and writes the play_events table — without re-running the full wels-score
pipeline. Unlike wels-score it tolerates matches that have player data but no
matches-table row (several existing datasets are such orphans): fps is then
derived from the frames table.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_FPS = 30.0


def _resolve_fps(conn, match_id: str) -> float:  # type: ignore[no-untyped-def]
    """fps from the matches table, else derived from frames, else default."""
    row = conn.execute("SELECT fps FROM matches WHERE match_id = ?", [match_id]).fetchone()
    if row is not None:
        return float(row[0])

    row = conn.execute(
        "SELECT MAX(frame_id), MAX(timestamp_s) FROM frames WHERE match_id = ?",
        [match_id],
    ).fetchone()
    if row is not None and row[0] and row[1]:
        fps = float(row[0]) / float(row[1])
        logger.warning(
            "Match '%s' not in matches table — derived fps %.1f from frames", match_id, fps
        )
        return fps

    logger.warning(
        "Match '%s' has no matches/frames metadata — assuming %.0f fps", match_id, _DEFAULT_FPS
    )
    return _DEFAULT_FPS


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="wels-plays",
        description="Detect offensive plays for a match and write play_events to DuckDB.",
    )
    parser.add_argument("match_id", help="Match identifier (player data must exist)")
    parser.add_argument(
        "--db",
        metavar="PATH",
        type=Path,
        default=None,
        help="Path to DuckDB database file. Overrides WELS_DUCKDB_PATH.",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging.",
    )

    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
        datefmt="%H:%M:%S",
    )

    from ml.config import MLSettings
    from ml.scoring import detect_play_events
    from ml.storage.schema import connect

    settings = MLSettings()  # reads WELS_* env vars
    if args.db is not None:
        settings = settings.model_copy(update={"duckdb_path": args.db})

    conn = connect(settings.duckdb_path)

    count_row = conn.execute(
        "SELECT COUNT(*) FROM players WHERE match_id = ? AND court_x IS NOT NULL",
        [args.match_id],
    ).fetchone()
    if count_row is None or not count_row[0]:
        print(
            f"Error: no court-mapped player data for match '{args.match_id}'. "
            "Run wels-ingest with calibration first.",
            file=sys.stderr,
        )
        sys.exit(1)

    fps = _resolve_fps(conn, args.match_id)
    detect_play_events(conn, args.match_id, fps)

    # Print a human-readable summary for manual validation (HWCP-156)
    rows = conn.execute(
        """
        SELECT play_type, team, start_time_s, end_time_s, confidence
        FROM play_events
        WHERE match_id = ?
        ORDER BY start_time_s
        """,
        [args.match_id],
    ).fetchall()
    conn.close()

    if not rows:
        print("No plays detected.")
        return

    print(f"\n{len(rows)} plays detected for '{args.match_id}':\n")
    for play_type, team, t0, t1, conf in rows:
        m0, s0 = divmod(int(t0), 60)
        m1, s1 = divmod(int(t1), 60)
        # ASCII separator: Windows consoles often render dashes as mojibake
        print(
            f"  {m0:02d}:{s0:02d}-{m1:02d}:{s1:02d}  "
            f"{play_type:<16} Team {team}  (Konfidenz {conf:.2f})"
        )


if __name__ == "__main__":
    main()
