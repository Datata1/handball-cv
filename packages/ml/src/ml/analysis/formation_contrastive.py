"""
Contrastive formation inference: embed a formation and classify it.

After training (wels-formation-train), this module loads the checkpoint and
provides two operations:

  embed()    → (128,) float32 vector from the encoder (pre-projection)
  classify() → formation label string via k-NN over labeled reference embeddings

The reference embeddings are built from synthetic canonical formations so
classification works out-of-the-box without manual labeling. As real labeled
data accumulates the reference set can be replaced / extended.

Label mapping
─────────────
  "6-0"        Six defenders in a compact line
  "5-1"        Five in line + one presser
  "4-2"        Four back + two forward
  "attack"     Team positioned in opponent half
  "transition" Spread across whole court
  "unknown"    Fewer than MIN_PLAYERS valid positions
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import torch

from ml.data.formation_features import COURT_H, COURT_W, IMAGE_H, IMAGE_W, MAX_PLAYERS
from ml.models.formation_encoder import SimCLRFormation

logger = logging.getLogger(__name__)

MIN_PLAYERS = 4
_FORMATION_LABELS = ["6-0", "5-1", "4-2", "3-2-1", "3-3", "attack", "transition"]


def _load_model(checkpoint_path: Path, device: str = "cpu") -> SimCLRFormation:
    model = SimCLRFormation(encoder_out=128, proj_dim=64)
    state = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    return model.to(device)


def _positions_to_tensor(
    positions: list[tuple[float, float]],
    use_court: bool,
) -> torch.Tensor:
    """
    Convert raw positions to the normalized, centroid-subtracted tensor that
    the encoder expects.
    """
    raw = np.array(positions, dtype=np.float32)
    if use_court:
        raw[:, 0] /= COURT_W
        raw[:, 1] /= COURT_H
    else:
        raw[:, 0] /= IMAGE_W
        raw[:, 1] /= IMAGE_H

    centroid = raw.mean(axis=0)
    raw -= centroid

    padded = np.zeros((MAX_PLAYERS, 2), dtype=np.float32)
    n = min(len(raw), MAX_PLAYERS)
    padded[:n] = raw[:n]

    return torch.from_numpy(padded).unsqueeze(0)  # (1, MAX_PLAYERS, 2)


# ── Reference embeddings (synthetic canonical formations) ─────────────────────


def _synthetic_6_0() -> np.ndarray:
    """Six players in a horizontal line."""
    xs = np.zeros(6)
    ys = np.linspace(-0.4, 0.4, 6)
    return np.column_stack([xs, ys]).astype(np.float32)


def _synthetic_5_1() -> np.ndarray:
    """Five in line + one presser forward."""
    xs = np.concatenate([np.zeros(5), [0.15]])
    ys = np.concatenate([np.linspace(-0.35, 0.35, 5), [0.0]])
    return np.column_stack([xs, ys]).astype(np.float32)


def _synthetic_4_2() -> np.ndarray:
    """Four back + two mid."""
    xs = np.concatenate([np.full(4, -0.05), np.full(2, 0.12)])
    ys = np.concatenate([np.linspace(-0.3, 0.3, 4), np.linspace(-0.15, 0.15, 2)])
    return np.column_stack([xs, ys]).astype(np.float32)


def _synthetic_3_2_1() -> np.ndarray:
    """Three back + two mid + one presser."""
    xs = np.concatenate([np.full(3, -0.1), np.full(2, 0.05), [0.2]])
    ys = np.concatenate([np.linspace(-0.3, 0.3, 3), np.array([-0.15, 0.15]), [0.0]])
    return np.column_stack([xs, ys]).astype(np.float32)


def _synthetic_3_3() -> np.ndarray:
    """Three back + three forward defenders."""
    xs = np.concatenate([np.full(3, -0.1), np.full(3, 0.1)])
    ys = np.concatenate([np.linspace(-0.25, 0.25, 3), np.linspace(-0.25, 0.25, 3)])
    return np.column_stack([xs, ys]).astype(np.float32)


def _synthetic_attack() -> np.ndarray:
    """Players spread in front (simulates attacking positions)."""
    xs = np.random.uniform(0.1, 0.45, 6)
    ys = np.random.uniform(-0.45, 0.45, 6)
    return np.column_stack([xs, ys]).astype(np.float32)


def _synthetic_transition() -> np.ndarray:
    """Players spread across the full court."""
    xs = np.random.uniform(-0.4, 0.4, 6)
    ys = np.random.uniform(-0.45, 0.45, 6)
    return np.column_stack([xs, ys]).astype(np.float32)


_SYNTHETIC_GENERATORS = {
    "6-0": _synthetic_6_0,
    "5-1": _synthetic_5_1,
    "4-2": _synthetic_4_2,
    "3-2-1": _synthetic_3_2_1,
    "3-3": _synthetic_3_3,
    "attack": _synthetic_attack,
    "transition": _synthetic_transition,
}


def _build_reference_embeddings(
    model: SimCLRFormation,
    n_per_class: int = 50,
    device: str = "cpu",
) -> tuple[np.ndarray, list[str]]:
    """Build reference embeddings from synthetic canonical formations."""
    np.random.seed(0)
    all_emb, all_labels = [], []

    with torch.no_grad():
        for label, gen_fn in _SYNTHETIC_GENERATORS.items():
            for _ in range(n_per_class):
                raw = gen_fn()
                padded = np.zeros((MAX_PLAYERS, 2), dtype=np.float32)
                n = min(len(raw), MAX_PLAYERS)
                padded[:n] = raw[:n]
                x = torch.from_numpy(padded).unsqueeze(0).to(device)
                emb = model.encode(x).squeeze(0).cpu().numpy()
                all_emb.append(emb)
                all_labels.append(label)

    return np.array(all_emb), all_labels


class ContrastiveFormationClassifier:
    """
    Embeds formations and classifies them via k-NN over reference embeddings.

    Usage:
        clf = ContrastiveFormationClassifier.from_checkpoint(path)
        label = clf.classify([(court_x, court_y), ...], use_court=True)
        emb   = clf.embed([(court_x, court_y), ...], use_court=True)
    """

    def __init__(
        self,
        model: SimCLRFormation,
        ref_embeddings: np.ndarray,
        ref_labels: list[str],
        k: int = 5,
        device: str = "cpu",
    ) -> None:
        self._model = model
        self._ref_emb = ref_embeddings  # (N_ref, D)
        self._ref_labels = ref_labels
        self._k = k
        self._device = device

    @classmethod
    def from_checkpoint(
        cls,
        checkpoint_path: Path,
        k: int = 5,
        device: str = "cpu",
    ) -> ContrastiveFormationClassifier:
        model = _load_model(checkpoint_path, device)
        ref_emb, ref_labels = _build_reference_embeddings(model, device=device)
        return cls(model, ref_emb, ref_labels, k=k, device=device)

    @torch.no_grad()
    def embed(
        self,
        positions: list[tuple[float, float]],
        use_court: bool = True,
    ) -> np.ndarray:
        """Return (128,) encoder embedding for a set of player positions."""
        x = _positions_to_tensor(positions, use_court).to(self._device)
        return self._model.encode(x).squeeze(0).cpu().numpy()

    def classify(
        self,
        positions: list[tuple[float, float]],
        use_court: bool = True,
    ) -> str:
        """
        Return a formation label string via k-NN over reference embeddings.

        Falls back to "unknown" when fewer than MIN_PLAYERS positions are given.
        """
        if len(positions) < MIN_PLAYERS:
            return "unknown"

        emb = self.embed(positions, use_court)

        # Cosine similarity to all reference embeddings
        norm_emb = emb / (np.linalg.norm(emb) + 1e-8)
        norm_ref = self._ref_emb / (np.linalg.norm(self._ref_emb, axis=1, keepdims=True) + 1e-8)
        sims = norm_ref @ norm_emb  # (N_ref,)

        top_k_idx = np.argsort(sims)[-self._k :]
        top_k_labels = [self._ref_labels[i] for i in top_k_idx]
        label = max(set(top_k_labels), key=top_k_labels.count)
        return label
