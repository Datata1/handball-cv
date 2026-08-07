"""
Contrastive learning training for handball formation recognition.

Entry point: train_formation_encoder()

The core idea: apply augmentations that simulate imperfect homography / noisy
bounding box detections. Two differently-augmented views of the same frame are
a positive pair. The SimCLR encoder learns embeddings that are invariant to
these perturbations — giving robust formation recognition even when player
positions are slightly off due to calibration errors or missed detections.

Augmentations and their physical motivation
─────────────────────────────────────────────
  jitter         Gaussian noise (sigma ~2-4% of field) - bbox center estimation error
  scale          ±5% uniform scale                  — wrong homography scale factor
  rotation       ±3° rotation around centroid       — camera tilt estimation error
  dropout        Remove 1 random player             — missed detection / occlusion
  outlier        Move 1 player to random position   — wrong bbox-to-track assignment
  permute        Shuffle player order               — enforce permutation invariance
"""

from __future__ import annotations

import logging
import random
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset

from ml.data.formation_features import FormationSample
from ml.models.formation_encoder import SimCLRFormation, nt_xent_loss

logger = logging.getLogger(__name__)


# ── Augmentations ────────────────────────────────────────────────────────────


def _jitter(pos: np.ndarray, sigma: float = 0.025) -> np.ndarray:
    mask = pos.sum(-1) != 0.0
    pos[mask] += np.random.normal(0, sigma, pos[mask].shape)
    return pos


def _scale(pos: np.ndarray, low: float = 0.95, high: float = 1.05) -> np.ndarray:
    factor = np.random.uniform(low, high)
    mask = pos.sum(-1) != 0.0
    pos[mask] *= factor
    return pos


def _rotate(pos: np.ndarray, max_deg: float = 3.0) -> np.ndarray:
    angle = np.radians(np.random.uniform(-max_deg, max_deg))
    c, s = np.cos(angle), np.sin(angle)
    rot = np.array([[c, -s], [s, c]], dtype=np.float32)
    mask = pos.sum(-1) != 0.0
    pos[mask] = pos[mask] @ rot.T
    return pos


def _dropout(pos: np.ndarray) -> np.ndarray:
    valid_idx = np.where(pos.sum(-1) != 0.0)[0]
    if len(valid_idx) > 1:
        drop = random.choice(valid_idx.tolist())
        pos[drop] = 0.0
    return pos


def _outlier(pos: np.ndarray, p: float = 0.2) -> np.ndarray:
    """Replace one player with a random outlier position (simulates bad bbox)."""
    if random.random() >= p:
        return pos
    valid_idx = np.where(pos.sum(-1) != 0.0)[0]
    if len(valid_idx) > 1:
        idx = random.choice(valid_idx.tolist())
        pos[idx] = np.random.uniform(-0.5, 0.5, 2).astype(np.float32)
    return pos


def augment(positions: np.ndarray) -> np.ndarray:
    """
    Apply a random combination of augmentations to a (MAX_PLAYERS, 2) formation.

    All augmentations preserve padding (zero entries) and are designed to
    simulate the types of errors that occur in practice:
      - Imperfect bounding box → position jitter / outlier
      - Wrong homography scale → scale perturbation
      - Camera tilt error    → rotation
      - Missed detection     → player dropout
    """
    pos = positions.copy()
    pos = _jitter(pos)
    if random.random() < 0.7:
        pos = _scale(pos)
    if random.random() < 0.5:
        pos = _rotate(pos)
    if random.random() < 0.5:
        pos = _dropout(pos)
    pos = _outlier(pos, p=0.2)
    # Shuffle: DeepSets is invariant, but this makes aug diversity explicit
    np.random.shuffle(pos)
    return pos


# ── Dataset ──────────────────────────────────────────────────────────────────


class FormationContrastiveDataset(Dataset):
    """Emits (view1, view2) pairs — two independently augmented views of one frame."""

    def __init__(self, samples: list[FormationSample]) -> None:
        self.samples = samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        raw = self.samples[idx].positions
        v1 = torch.from_numpy(augment(raw))
        v2 = torch.from_numpy(augment(raw))
        return v1, v2


# ── Training loop ────────────────────────────────────────────────────────────


def train_formation_encoder(
    samples: list[FormationSample],
    checkpoint_path: Path,
    epochs: int = 200,
    batch_size: int = 64,
    lr: float = 3e-4,
    temperature: float = 0.5,
    device: str = "cpu",
) -> SimCLRFormation:
    """
    Train a SimCLR formation encoder and save the checkpoint.

    Args:
        samples:         Training data from load_formation_samples().
        checkpoint_path: Where to save the trained model (.pt file).
        epochs:          Number of training epochs.
        batch_size:      SimCLR batch size (larger = more negatives = better).
        lr:              Adam learning rate.
        temperature:     NT-Xent temperature τ.
        device:          "cpu" or "cuda".

    Returns:
        Trained SimCLRFormation model (on CPU, eval mode).
    """
    if not samples:
        raise ValueError("No training samples. Run wels-ingest with a calibration file first.")

    logger.info("Training contrastive formation encoder on %d samples", len(samples))

    dataset = FormationContrastiveDataset(samples)
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        drop_last=True,
        num_workers=0,
    )

    model = SimCLRFormation(encoder_out=128, proj_dim=64).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for v1, v2 in loader:
            v1, v2 = v1.to(device), v2.to(device)
            z1 = model(v1)
            z2 = model(v2)
            loss = nt_xent_loss(z1, z2, temperature)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        scheduler.step()
        if (epoch + 1) % 50 == 0:
            avg = total_loss / len(loader)
            logger.info(
                "  Epoch %3d/%d  loss=%.4f  lr=%.6f",
                epoch + 1,
                epochs,
                avg,
                scheduler.get_last_lr()[0],
            )

    model.eval().cpu()
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), checkpoint_path)
    logger.info("Checkpoint saved: %s", checkpoint_path)
    return model
