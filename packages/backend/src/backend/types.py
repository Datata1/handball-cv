"""
Pydantic model for match/video metadata.
"""

from typing import Literal

from pydantic import BaseModel

type MatchStatus = Literal["processing", "done", "failed", "unknown"]


class MatchMeta(BaseModel):
    match_id: str
    file_name: str
    video_path: str
    fps: float
    total_frames: int
    status: MatchStatus = "unknown"
    date: str | None = None
    duration: str | None = None
    ingested_at: str | None = None
    display_name: str | None = None
    team_a_name: str | None = None
    team_b_name: str | None = None


class GoalEvent(BaseModel):
    frame_number: int
    timestamp_sec: float
    game_time: str | None = None
    team: Literal["home", "away"]
    score_home: int
    score_away: int


class ScoreboardSummary(BaseModel):
    match_id: str
    final_score_home: int | None = None
    final_score_away: int | None = None
    final_game_time: str | None = None
    goals: list[GoalEvent] = []
