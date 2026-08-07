"""
GCN + LSTM action predictor.

Architecture:
  Per frame:   node features → GCNConv(→64) → ReLU → GCNConv(→128) → global mean pool
               → 128-d frame embedding

  Across T frames:
               [emb_t-T, ..., emb_t] → LSTM(hidden=128) → last hidden state
               → Linear(128 → num_actions) → logits
"""

from __future__ import annotations

import torch
import torch.nn as nn
from torch_geometric.data import Data
from torch_geometric.nn import GCNConv, global_mean_pool


class ActionPredictor(nn.Module):
    def __init__(
        self,
        node_features: int = 10,
        hidden_dim: int = 128,
        lstm_hidden: int = 128,
        num_actions: int = 4,
    ) -> None:
        super().__init__()

        self.gcn1 = GCNConv(node_features, 64)
        self.gcn2 = GCNConv(64, hidden_dim)
        self.relu = nn.ReLU()

        self.lstm = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=lstm_hidden,
            batch_first=True,
        )

        self.fc = nn.Linear(lstm_hidden, num_actions)

    def encode_frame(self, data: Data) -> torch.Tensor:
        """Encode one frame graph into a fixed-size (1, hidden_dim) embedding."""
        x = self.relu(self.gcn1(data.x, data.edge_index))
        x = self.relu(self.gcn2(x, data.edge_index))
        batch = (
            data.batch
            if hasattr(data, "batch") and data.batch is not None
            else torch.zeros(x.size(0), dtype=torch.long, device=x.device)
        )
        return global_mean_pool(x, batch)  # (1, hidden_dim)

    def forward(self, graph_sequence: list[Data]) -> torch.Tensor:
        """
        Args:
            graph_sequence: list of T PyG Data objects (one per frame)

        Returns:
            logits: (1, num_actions)
        """
        embeddings = [self.encode_frame(g) for g in graph_sequence]
        seq = torch.stack(embeddings, dim=1)  # (1, T, hidden_dim)
        lstm_out, _ = self.lstm(seq)
        last = lstm_out[:, -1, :]  # (1, hidden_dim)
        return self.fc(last)  # (1, num_actions)
