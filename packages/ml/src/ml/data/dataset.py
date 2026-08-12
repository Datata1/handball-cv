"""
PyTorch Dataset wrapping DuckDB label queries + graph construction.

Each sample is a (graph_sequence, label) pair where:
  graph_sequence: list of T PyG Data objects (one per frame in the window)
  label:          integer action class index
"""

from __future__ import annotations

from pathlib import Path

import torch
from torch.utils.data import Dataset
from torch_geometric.data import Data

from ml.data.features import load_frame_window, load_training_samples, open_readonly
from ml.data.graphs import frame_to_graph

ACTION_CLASSES = ["pass", "shot", "dribble", "hold"]
ACTION_TO_IDX = {a: i for i, a in enumerate(ACTION_CLASSES)}


class ActionDataset(Dataset):  # type: ignore[type-arg]
    """
    Loads all labeled windows from DuckDB at construction time.

    For large datasets consider lazy loading — this eagerly builds all graphs
    which is fine for the expected scale (a few thousand samples).
    """

    def __init__(self, db_path: Path, window: int = 25, k_neighbors: int = 5) -> None:
        conn = open_readonly(db_path)
        labels_df = load_training_samples(conn, window=window)

        self._samples: list[tuple[list[Data], int]] = []

        for _, row in labels_df.iterrows():
            action = row["action"]
            if action not in ACTION_TO_IDX:
                continue  # skip unlisted action classes

            frames = load_frame_window(conn, row["match_id"], int(row["frame_id"]), window)
            if len(frames) < window:
                continue  # not enough history

            graphs = [frame_to_graph(f, int(row["track_id"]), k_neighbors) for f in frames]
            label = ACTION_TO_IDX[action]
            self._samples.append((graphs, label))

        conn.close()

    def __len__(self) -> int:
        return len(self._samples)

    def __getitem__(self, idx: int) -> tuple[list[Data], torch.Tensor]:
        graphs, label = self._samples[idx]
        return graphs, torch.tensor(label, dtype=torch.long)
