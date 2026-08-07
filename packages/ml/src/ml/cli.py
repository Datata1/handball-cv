"""
CLI entry point for the batch scoring job.

    wels-score <match_id> [options]

Reads ingested match data from DuckDB and writes pre-computed predictions:
  - action_predictions  (requires a trained checkpoint)
  - formations          (rule-based, always runs)
  - possession_phases   (derived from has_ball, always runs)

Run wels-ingest first to populate the source tables.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="wels-score",
        description="Pre-compute ML predictions for a match and write to DuckDB.",
    )
    parser.add_argument("match_id", help="Match identifier (must already be ingested)")
    parser.add_argument(
        "--checkpoint",
        metavar="PATH",
        type=Path,
        default=None,
        help="Path to trained model checkpoint (.pt). If omitted, action predictions are skipped.",
    )
    parser.add_argument(
        "--db",
        metavar="PATH",
        type=Path,
        default=None,
        help="Path to DuckDB database file. Overrides WELS_DUCKDB_PATH.",
    )
    parser.add_argument(
        "--device",
        metavar="DEVICE",
        default=None,
        help="PyTorch device for action predictor (e.g. 'cpu', 'cuda'). Overrides WELS_DEVICE.",
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
    from ml.scoring import MatchScorer

    settings = MLSettings()  # reads WELS_* env vars
    if args.db is not None:
        settings = settings.model_copy(update={"duckdb_path": args.db})
    if args.device is not None:
        settings = settings.model_copy(update={"device": args.device})

    # Resolve checkpoint: CLI flag → settings default
    checkpoint = args.checkpoint
    if checkpoint is None and settings.models_dir is not None:
        default_ckpt = settings.models_dir / "action_predictor_best.pt"
        if default_ckpt.exists():
            checkpoint = default_ckpt

    scorer = MatchScorer(settings, checkpoint_path=checkpoint)

    try:
        scorer.score(args.match_id)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
