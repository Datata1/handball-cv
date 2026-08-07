"""Unit tests for graph construction — no DuckDB or GPU needed."""

import torch

from ml.data.graphs import frame_to_graph


def _make_frame(n_players: int = 4) -> dict:  # type: ignore[type-arg]
    players = []
    for i in range(n_players):
        players.append(
            {
                "track_id": i,
                "team": "A" if i % 2 == 0 else "B",
                "court_x": float(i * 5),
                "court_y": float(i * 2),
                "velocity_x": 0.0,
                "velocity_y": 0.0,
                "has_ball": i == 0,
                "confidence": 0.9,
            }
        )
    return {
        "frame_id": 0,
        "players": players,
        "ball": {"court_x": 2.5, "court_y": 1.0},
    }


def test_node_count() -> None:
    frame = _make_frame(n_players=4)
    graph = frame_to_graph(frame, actor_track_id=0)
    assert graph.x.shape == (4, 10)


def test_node_features_dtype() -> None:
    graph = frame_to_graph(_make_frame(), actor_track_id=0)
    assert graph.x.dtype == torch.float


def test_edge_count_k3() -> None:
    # With k=3 and 4 nodes each node gets 3 outgoing edges → 12 edges total
    graph = frame_to_graph(_make_frame(n_players=4), actor_track_id=0, k_neighbors=3)
    assert graph.edge_index.shape[1] == 12


def test_empty_frame_returns_empty_graph() -> None:
    frame = {"frame_id": 0, "players": [], "ball": None}
    graph = frame_to_graph(frame, actor_track_id=0)
    assert graph.x.shape[0] == 0
