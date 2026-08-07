# API fixtures

Captured from a running backend (`uvicorn backend.app:app`) against a seeded
DuckDB, then pretty-printed. **They are not hand-written**, which is the point:
every derived field here — `duration`'s `MM:SS` formatting, `intensity`'s
normalisation against the busiest zone, the `available_track_ids` dedupe, the
`heatmap_points` team normalisation — is computed in the route, and inventing
them by hand is how a schema comes to describe a response the backend never
sends.

Two edits after capture, both noted so nobody mistakes them for the real shape:

- `matches.json` — `video_path` rewritten to `/srv/wels/…`; the capture had the
  absolute path of a scratch directory.
- `stats.json`, `heatmap-points.json` — `heatmap_points` truncated to 8 entries.
  The real arrays run to 12 000 and nothing in the schema constrains their
  length.

## What each one is here to pin down

| File | Endpoint | Why it exists |
|---|---|---|
| `matches.json` | `GET /matches` | The healthy row, with meta sidecar fields populated |
| `matches-processing.json` | `GET /matches` | Captured **while a match was processing**: the in-flight stub row *and* a healthy match degenerated to the same empty shape, because the read freeze empties the DuckDB query. This is why `matchMetaSchema` has no `.min(1)` |
| `stats.json` | `GET /stats` | Six-entry zone arrays; `intensity` vs `count`; the point cloud |
| `heatmap-points.json` | `GET /heatmap-points` | Both team domains in one body: `available_track_ids[].team === "unknown"` next to `heatmap_points[].team === "U"` |
| `heatmap-points-phase.json` | same, filtered | `?phase_id&perspective&track_ids` narrowing the result |
| `scoreboard.json` | `GET /scoreboard` | Leading readings with a clock but `null` scores |
| `scoreboard-summary.json` | `GET /scoreboard/summary` | Validated `team`, and a goal with `game_time: null` |
| `goals.json` | `GET /goals` | The same rows *without* server-side validation |
| `formation-summary.json` | `GET /formation-summary` | `formations` as an open `dict[str, int]` |
| `formation-scenes.json` | `GET /formation-scenes` | Ordered by `start_frame`, so `scene_id` is not ascending |
| `team-phases.json` | `GET /team-phases` | |
| `plays.json` | `GET /plays` | A play with `details` trajectories and a coach label, and one with `details: null` and `label: null` |
| `play-summary.json` | `GET /play-summary` | `success_rate: null` when no attack was rated |
| `attacks.json` | `GET /attacks` | All three `outcome` values |
| `video-output.json` | `GET /videos/{id}/output` | `status: "done"` with `video_path: null` — ingestion ran without `annotate_video` |

## Recapturing

Seed a database, point the backend at it, and curl. The seed script is not
committed; the shapes above are what matter, and they change only when a route
changes.
