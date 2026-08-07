"""
CLI: wels-formation-train

Trains a contrastive formation encoder on all matches available in DuckDB
and saves the checkpoint to data/input/models/formation_encoder.pt.

Usage:
    wels-formation-train
    wels-formation-train --match-id 5a61b4c5
    wels-formation-train --epochs 300 --batch-size 128 --stride 5

After training, run wels-score <match_id> to embed all frames with the new
checkpoint. The scorer automatically picks it up from data/input/models/.
"""

from __future__ import annotations

import argparse
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train contrastive formation encoder on DuckDB player data"
    )
    parser.add_argument(
        "--match-id",
        default=None,
        help="Restrict training to one match (legacy, use --match-ids for multiple)",
    )
    parser.add_argument(
        "--match-ids",
        nargs="+",
        default=None,
        metavar="MATCH_ID",
        help="Restrict training to specific matches (space-separated list)",
    )
    parser.add_argument("--epochs", type=int, default=200, help="Training epochs (default: 200)")
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size (default: 64)")
    parser.add_argument(
        "--stride", type=int, default=5, help="Frame stride for data loading (default: 5)"
    )
    parser.add_argument(
        "--min-players", type=int, default=4, help="Min players per frame sample (default: 4)"
    )
    args = parser.parse_args()

    from ml.config import MLSettings
    from ml.data.features import open_readonly
    from ml.data.formation_features import load_formation_samples
    from ml.device import resolve_device
    from ml.training.contrastive_formation import train_formation_encoder

    settings = MLSettings()
    checkpoint_path = settings.models_dir / "formation_encoder.pt"

    logger.info("Loading formation samples from %s", settings.duckdb_path)
    # --match-ids takes precedence over --match-id
    if args.match_ids:
        filter_id: str | list[str] | None = args.match_ids
    else:
        filter_id = args.match_id

    conn = open_readonly(settings.duckdb_path)
    samples = load_formation_samples(
        conn,
        match_id=filter_id,
        min_players=args.min_players,
        stride=args.stride,
    )
    conn.close()

    if not samples:
        logger.error(
            "No formation samples found. Make sure wels-ingest has been run "
            "and players are on court (on_court=TRUE, pixel_foot_x IS NOT NULL)."
        )
        sys.exit(1)

    logger.info("Loaded %d formation samples", len(samples))

    device = str(resolve_device(settings.device))

    train_formation_encoder(
        samples=samples,
        checkpoint_path=checkpoint_path,
        epochs=args.epochs,
        batch_size=args.batch_size,
        device=device,
    )

    logger.info("Done. Run 'wels-score <match_id>' to apply the new encoder.")


if __name__ == "__main__":
    main()
