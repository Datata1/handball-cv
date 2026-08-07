"""
Inference — load a trained checkpoint and predict on a frame window.

This is the entry point the backend will call when serving predictions.
"""

from __future__ import annotations

from pathlib import Path

import torch

from ml.config import MLSettings
from ml.data.dataset import ACTION_CLASSES
from ml.data.features import load_frame_window, open_readonly
from ml.data.graphs import frame_to_graph
from ml.device import resolve_device
from ml.models.action import ActionPredictor


class ActionInference:
    def __init__(self, checkpoint_path: Path, settings: MLSettings | None = None) -> None:
        self._settings = settings or MLSettings()
        self._device = resolve_device(self._settings.device)
        self._model = ActionPredictor(
            node_features=self._settings.node_features,
            hidden_dim=self._settings.hidden_dim,
            lstm_hidden=self._settings.lstm_hidden,
            num_actions=len(ACTION_CLASSES),
        ).to(self._device)
        self._model.load_state_dict(
            torch.load(checkpoint_path, map_location=self._device, weights_only=True)
        )
        self._model.eval()

    def predict(
        self,
        match_id: str,
        center_frame: int,
        actor_track_id: int,
    ) -> dict[str, float]:
        """
        Predict action probabilities for one player at one frame.

        Returns a dict of {action_name: probability}, e.g.:
          {"pass": 0.62, "shot": 0.25, "dribble": 0.08, "hold": 0.05}
        """
        conn = open_readonly(self._settings.duckdb_path)
        frames = load_frame_window(conn, match_id, center_frame, self._settings.window_size)
        conn.close()

        if not frames:
            raise ValueError(f"No data for match={match_id} frame={center_frame}")

        graphs = [
            frame_to_graph(f, actor_track_id, self._settings.k_neighbors).to(self._device)
            for f in frames
        ]

        with torch.no_grad():
            logits = self._model(graphs)
            probs = torch.softmax(logits, dim=-1).squeeze(0).tolist()

        return {action: float(prob) for action, prob in zip(ACTION_CLASSES, probs, strict=False)}
