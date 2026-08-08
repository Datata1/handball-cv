import type { MatchMeta } from '@/shared/api'

/**
 * The shapes `GET /matches` actually returns, shared by every dashboard story.
 * `processing` and `degenerate` are copies of `matches-processing.json`: while
 * any match is being ingested, the read freeze empties the DuckDB query and a
 * perfectly healthy match comes back with the same empty fields as the in-flight
 * stub row.
 */

export const done: MatchMeta = {
  match_id: 'seed01',
  file_name: 'seed01.mp4',
  video_path: '/srv/wels/data/input/videos/seed01.mp4',
  fps: 25,
  total_frames: 1500,
  status: 'done',
  date: '2026-08-07T23:32:40.153507',
  duration: '01:00',
  ingested_at: '2026-08-07T23:32:40.153507',
  display_name: 'Testspiel Nord vs Süd',
  team_a_name: 'HSG Nord',
  team_b_name: 'TV Süd',
}

/** No `display_name` and no meta sidecar — the card falls back to the file name. */
export const unnamed: MatchMeta = {
  ...done,
  match_id: 'seed02',
  file_name: 'aufzeichnung-2026-05-02.mp4',
  duration: '72:15',
  date: '2026-05-02T18:04:00',
  ingested_at: '2026-05-02T18:04:00',
  display_name: null,
  team_a_name: null,
  team_b_name: null,
}

export const longNames: MatchMeta = {
  ...done,
  match_id: 'seed03',
  display_name: 'Landesliga Nord — 14. Spieltag, Nachholspiel im Sportpark Ost',
  team_a_name: 'Handballspielgemeinschaft Nordheide-Winsen II',
  team_b_name: 'Turn- und Sportverein Süderelbe von 1897 e. V.',
  duration: '68:42',
  date: '2026-06-14T20:15:00',
  ingested_at: '2026-06-14T20:15:00',
}

/** The stub row `GET /matches` appends for a match that has no DuckDB row yet. */
export const processing: MatchMeta = {
  match_id: 'pending9',
  file_name: '',
  video_path: '',
  fps: 0,
  total_frames: 0,
  status: 'processing',
  date: null,
  duration: null,
  ingested_at: null,
  display_name: null,
  team_a_name: null,
  team_b_name: null,
}

export const failed: MatchMeta = {
  ...processing,
  match_id: 'broken4',
  status: 'failed',
}

export const mixed: MatchMeta[] = [done, processing, failed, unnamed]

/** Stands in for `/thumbnail`, which no story should reach over the network. */
export const thumbnailSrc =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'><rect width='320' height='180' fill='%230f3460'/><circle cx='160' cy='120' r='34' fill='%23e94560'/><rect y='150' width='320' height='30' fill='%2316213e'/></svg>"

/** A URL shaped like the endpoint but guaranteed to fail, for the fallback. */
export const brokenThumbnailSrc = 'data:image/jpeg;base64,not-an-image'
