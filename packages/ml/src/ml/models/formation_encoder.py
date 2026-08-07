"""
SimCLR formation encoder using a DeepSets backbone.

Architecture rationale:
- DeepSets is permutation-invariant: the same formation encoded in any player
  order gives the same embedding. This is critical because player ordering in
  DuckDB rows is arbitrary (ByteTrack track_id order).
- Per-player MLP + masked mean pool + formation MLP = simple, fast, interpretable.
- Projection head follows the SimCLR recipe: keep it separate from the encoder
  so we can discard it after training and use the richer encoder representation.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F  # noqa: N812


class _PlayerMLP(nn.Module):
    def __init__(self, hidden: int) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(2, 32),
            nn.LayerNorm(32),
            nn.ReLU(),
            nn.Linear(32, hidden),
            nn.ReLU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class FormationEncoder(nn.Module):
    """
    Permutation-invariant formation encoder (DeepSets).

    Input:  (B, N, 2)  — batch of formations, N players each, 2D position
    Output: (B, out_dim) — formation embedding
    """

    def __init__(self, player_hidden: int = 64, out_dim: int = 128) -> None:
        super().__init__()
        self.player_enc = _PlayerMLP(player_hidden)
        self.formation_net = nn.Sequential(
            nn.Linear(player_hidden, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
            nn.Linear(128, out_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Padding mask: entries close to (0, 0) after centroid-subtraction are padding.
        # We use a small epsilon because centroid-subtracted real coords can be near zero.
        mask = (x.abs().sum(-1) > 1e-5).float().unsqueeze(-1)  # (B, N, 1)

        player_emb = self.player_enc(x)  # (B, N, player_hidden)
        denom = mask.sum(1).clamp(min=1)  # (B, 1)
        pooled = (player_emb * mask).sum(1) / denom  # (B, player_hidden)
        return self.formation_net(pooled)  # (B, out_dim)


class SimCLRFormation(nn.Module):
    """
    SimCLR wrapper: Encoder + Projection Head.

    Use .encode() to get the representation (for downstream tasks / storage).
    Use .forward() to get the L2-normalised projection (for NT-Xent loss).
    """

    def __init__(self, encoder_out: int = 128, proj_dim: int = 64) -> None:
        super().__init__()
        self.encoder = FormationEncoder(out_dim=encoder_out)
        self.proj_head = nn.Sequential(
            nn.Linear(encoder_out, 128),
            nn.ReLU(),
            nn.Linear(128, proj_dim),
        )

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        return self.encoder(x)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = self.encoder(x)
        z = self.proj_head(h)
        return F.normalize(z, dim=-1)


def nt_xent_loss(z1: torch.Tensor, z2: torch.Tensor, temperature: float = 0.5) -> torch.Tensor:
    """
    Normalized Temperature-scaled Cross Entropy Loss (NT-Xent / SimCLR loss).

    (z1_i, z2_i) are two augmented views of the same formation → positive pair.
    All other 2(B-1) pairs in the batch are treated as negatives.

    z1, z2: (B, D) L2-normalised projections.
    """
    B = z1.size(0)  # noqa: N806
    z = torch.cat([z1, z2], dim=0)  # (2B, D)
    sim = torch.mm(z, z.T) / temperature  # (2B, 2B) cosine similarity

    # Mask self-similarity (diagonal)
    eye = torch.eye(2 * B, dtype=torch.bool, device=z.device)
    sim.masked_fill_(eye, float("-inf"))

    # Positive pair for z1_i is z2_i (index i+B) and vice versa
    labels = torch.cat(
        [
            torch.arange(B, 2 * B, device=z.device),
            torch.arange(B, device=z.device),
        ]
    )
    return F.cross_entropy(sim, labels)
