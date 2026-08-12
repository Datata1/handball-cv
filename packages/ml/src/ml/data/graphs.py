"""
Frame dict → PyTorch Geometric Data graph.

Each frame becomes a graph where:
  nodes  = players on court (with court_x/y)
  edges  = k-NN by court distance (directed)

Node features (10-d):
  court_x, court_y, velocity_x, velocity_y,
  dist_ball, dist_goal, has_ball,
  team_a, team_b, is_unknown_team

Edge features (4-d):
  distance, delta_x, delta_y, same_team
"""

from __future__ import annotations

import torch
from torch_geometric.data import Data

_GOAL_A = (0.0, 10.0)  # left goal centre on a 40m x 20m court
_GOAL_B = (40.0, 10.0)  # right goal centre


def frame_to_graph(
    frame: dict,  # type: ignore[type-arg]
    actor_track_id: int,
    k_neighbors: int = 5,
) -> Data:
    """
    Convert one frame dict (from ml.data.features.load_frame_window) into a PyG graph.

    actor_track_id: the player whose action is being predicted (has_ball node is marked)
    """
    players = [p for p in frame["players"] if p.get("court_x") is not None]
    if not players:
        # Return empty graph — callers should filter these out
        return Data(
            x=torch.zeros((0, 10)),
            edge_index=torch.zeros((2, 0), dtype=torch.long),
            edge_attr=torch.zeros((0, 4)),
        )

    ball = frame.get("ball")
    ball_x = ball["court_x"] if ball else 20.0
    ball_y = ball["court_y"] if ball else 10.0

    node_features = []
    for p in players:
        cx, cy = float(p["court_x"]), float(p["court_y"])
        vx, vy = float(p.get("velocity_x", 0.0)), float(p.get("velocity_y", 0.0))
        dist_ball = ((cx - ball_x) ** 2 + (cy - ball_y) ** 2) ** 0.5
        dist_goal = ((cx - _GOAL_B[0]) ** 2 + (cy - _GOAL_B[1]) ** 2) ** 0.5
        has_ball = 1.0 if p["track_id"] == actor_track_id else 0.0
        team_a = 1.0 if p.get("team") == "A" else 0.0
        team_b = 1.0 if p.get("team") == "B" else 0.0
        is_unknown = 1.0 if p.get("team") not in ("A", "B") else 0.0
        node_features.append(
            [cx, cy, vx, vy, dist_ball, dist_goal, has_ball, team_a, team_b, is_unknown]
        )

    x = torch.tensor(node_features, dtype=torch.float)
    positions = x[:, :2]  # court_x, court_y

    # k-NN edges by court distance
    dist_matrix = torch.cdist(positions, positions)
    n = len(players)
    edge_index_list: list[list[int]] = []
    edge_attr_list: list[list[float]] = []

    for i in range(n):
        dists = dist_matrix[i].clone()
        dists[i] = float("inf")
        k = min(k_neighbors, n - 1)
        _, neighbors = dists.topk(k, largest=False)
        for j_tensor in neighbors:
            j = int(j_tensor.item())
            dx = float(positions[j, 0].item() - positions[i, 0].item())
            dy = float(positions[j, 1].item() - positions[i, 1].item())
            d = float(dist_matrix[i, j].item())
            same_team = 1.0 if players[i].get("team") == players[j].get("team") else 0.0
            edge_index_list.append([i, j])
            edge_attr_list.append([d, dx, dy, same_team])

    edge_index = torch.tensor(edge_index_list, dtype=torch.long).t().contiguous()
    edge_attr = torch.tensor(edge_attr_list, dtype=torch.float)

    return Data(x=x, edge_index=edge_index, edge_attr=edge_attr)
