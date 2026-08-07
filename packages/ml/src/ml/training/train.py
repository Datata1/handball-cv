"""
Training entry point: wels-train

Usage:
    wels-train [--db data/output/duckdb/matches.duckdb] [--output data/input/models/action.pt] [--epochs 50]
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split

from ml.config import MLSettings
from ml.data.dataset import ActionDataset
from ml.device import resolve_device
from ml.models.action import ActionPredictor
from ml.training.evaluate import evaluate

logger = logging.getLogger(__name__)


def _collate(batch):  # type: ignore[no-untyped-def]
    """
    Custom collate: keep samples as individual (graphs, label) pairs.
    Graph batching across a sequence is non-trivial; we process one sample at a time.
    A proper batched version using PyG Batch can be added once training is validated.
    """
    return batch


def train(settings: MLSettings) -> None:
    device = resolve_device(settings.device)
    logger.info("Training on %s", device)

    dataset = ActionDataset(
        settings.duckdb_path,
        window=settings.window_size,
        k_neighbors=settings.k_neighbors,
    )
    logger.info("Dataset: %d samples, %d classes", len(dataset), len(dataset._samples))

    val_size = max(1, int(len(dataset) * settings.val_split))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=1, shuffle=True, collate_fn=_collate)
    val_loader = DataLoader(val_ds, batch_size=1, shuffle=False, collate_fn=_collate)

    model = ActionPredictor(
        node_features=settings.node_features,
        hidden_dim=settings.hidden_dim,
        lstm_hidden=settings.lstm_hidden,
        num_actions=4,
    ).to(device)

    optimizer = optim.Adam(model.parameters(), lr=settings.learning_rate)
    criterion = nn.CrossEntropyLoss()

    best_val_acc = 0.0
    settings.models_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = settings.models_dir / "action_best.pt"

    for epoch in range(1, settings.epochs + 1):
        model.train()
        total_loss = 0.0

        for (sample,) in train_loader:
            graphs, label = sample
            graphs = [g.to(device) for g in graphs]
            label_t = label.to(device).unsqueeze(0)

            logits = model(graphs)
            loss = criterion(logits, label_t)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        val_acc = evaluate(model, val_loader, device)
        avg_loss = total_loss / max(len(train_loader), 1)

        logger.info(
            "Epoch %d/%d  loss=%.4f  val_acc=%.3f", epoch, settings.epochs, avg_loss, val_acc
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), checkpoint_path)
            logger.info("  Saved checkpoint (val_acc=%.3f)", val_acc)

    logger.info(
        "Training complete. Best val_acc=%.3f. Checkpoint: %s", best_val_acc, checkpoint_path
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="wels-train")
    parser.add_argument("--db", type=Path, default=None)
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--device", default=None)
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%H:%M:%S",
    )

    overrides: dict[str, object] = {}
    if args.db:
        overrides["duckdb_path"] = args.db
    if args.epochs:
        overrides["epochs"] = args.epochs
    if args.device:
        overrides["device"] = args.device

    settings = MLSettings(**overrides)  # type: ignore[arg-type]
    train(settings)


if __name__ == "__main__":
    main()
