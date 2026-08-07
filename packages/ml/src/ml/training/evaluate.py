from __future__ import annotations

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from ml.data.dataset import ACTION_CLASSES


def evaluate(
    model: nn.Module,
    loader: DataLoader,  # type: ignore[type-arg]
    device: torch.device,
) -> float:
    """Return accuracy on the given loader."""
    model.eval()
    correct = 0
    total = 0

    with torch.no_grad():
        for (sample,) in loader:
            graphs, label = sample
            graphs = [g.to(device) for g in graphs]
            label_t = label.to(device).unsqueeze(0)

            logits = model(graphs)
            pred = logits.argmax(dim=-1)
            correct += int((pred == label_t).sum().item())
            total += 1

    return correct / total if total > 0 else 0.0


def confusion_matrix(
    model: nn.Module,
    loader: DataLoader,  # type: ignore[type-arg]
    device: torch.device,
) -> dict[str, dict[str, int]]:
    """Return a confusion matrix as {true_label: {predicted_label: count}}."""
    model.eval()
    matrix: dict[str, dict[str, int]] = {a: {b: 0 for b in ACTION_CLASSES} for a in ACTION_CLASSES}

    with torch.no_grad():
        for (sample,) in loader:
            graphs, label = sample
            graphs = [g.to(device) for g in graphs]
            logits = model(graphs)
            pred_idx = int(logits.argmax(dim=-1).item())
            true_idx = int(label.item())
            true_label = ACTION_CLASSES[true_idx]
            pred_label = ACTION_CLASSES[pred_idx]
            matrix[true_label][pred_label] += 1

    return matrix
