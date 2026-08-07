import { Users, Activity, Target, TrendingUp, MapPin, Clock, Award, Zap, Camera, Shield, Play, BarChart3, Video, Loader2, Pencil, Check, X, ChevronDown, ChevronUp, ArrowLeft, Crosshair, GraduationCap } from 'lucide-react';
import { Card } from './ui/card';
import { DemoBadge, DemoBanner, InfoBanner } from './DataBadges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { motion } from 'motion/react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchMatchStats, patchMatch, MatchStats, fetchFormationSummary, FormationSummary, fetchFormationScenes, FormationScene, fetchTeamPhases, TeamPhase, fetchHeatmapPoints, TrackInfo, fetchPlaySummary, fetchPlays, labelPlayEvent, PlaySummary, PlayEvent, PlayEventDetails } from './api';
import { ScoreboardCard } from './ScoreboardCard';

const COURT_X = 40;
const COURT_Y = 40;
const COURT_W = 920;
const COURT_H = 420;
const DENSITY_GRID_COLS = 46;
const DENSITY_GRID_ROWS = 21;


function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getHeatmapTileStyle(
  intensity: number,
  dominance?: number,
  shares?: { red: number; blue: number; unknown: number }
) {
  const normalized = Math.max(0, Math.min(100, intensity)) / 100;
  if (typeof dominance === 'number' && shares) {
    const d = Math.max(-1, Math.min(1, dominance));
    const abs = Math.abs(d);
    const redSplit = Math.round(Math.max(0, Math.min(1, shares.red)) * 1000) / 10;
    const unknownSplit = Math.round(
      Math.max(redSplit / 100, Math.min(1, shares.red + shares.unknown)) * 1000
    ) / 10;
    const redAlpha = 0.35 + normalized * 0.45;
    const blueAlpha = 0.35 + normalized * 0.45;
    const unknownAlpha = 0.28 + normalized * 0.3;
    const border = d >= 0
      ? `rgba(37, 99, 235, ${0.35 + abs * 0.55})`
      : `rgba(239, 68, 68, ${0.35 + abs * 0.55})`;
    return {
      background: `linear-gradient(90deg,
        rgba(239, 68, 68, ${redAlpha}) 0%,
        rgba(239, 68, 68, ${redAlpha}) ${redSplit}%,
        rgba(148, 163, 184, ${unknownAlpha}) ${redSplit}%,
        rgba(148, 163, 184, ${unknownAlpha}) ${unknownSplit}%,
        rgba(37, 99, 235, ${blueAlpha}) ${unknownSplit}%,
        rgba(37, 99, 235, ${blueAlpha}) 100%)`,
      borderColor: border,
      color: normalized > 0.62 ? 'white' : '#1e3a5f',
    };
  }
  return {
    background: `linear-gradient(145deg,
      rgba(224, 242, 254, ${0.75 + normalized * 0.2}) 0%,
      rgba(56, 189, 248, ${0.3 + normalized * 0.4}) 55%,
      rgba(14, 116, 144, ${0.25 + normalized * 0.65}) 100%)`,
    borderColor: `rgba(14, 116, 144, ${0.25 + normalized * 0.7})`,
    color: intensity > 50 ? 'white' : '#1e3a5f',
  };
}

const LEFT_ZONE_CENTERS: Record<string, { x: number; y: number }> = {
  LA: { x: 145, y: 378 },
  RL: { x: 280, y: 320 },
  RM: { x: 285, y: 250 },
  RR: { x: 280, y: 180 },
  RA: { x: 145, y: 122 },
  KL: { x: 100, y: 250 },
};

const RIGHT_ZONE_CENTERS: Record<string, { x: number; y: number }> = {
  LA: { x: 855, y: 122 },
  RL: { x: 720, y: 180 },
  RM: { x: 715, y: 250 },
  RR: { x: 720, y: 320 },
  RA: { x: 855, y: 378 },
  KL: { x: 900, y: 250 },
};

const DENSITY_SAMPLE_OFFSETS: Array<{ dx: number; dy: number; weight: number }> = [
  { dx: 0, dy: 0, weight: 1.0 },
  { dx: -1.0, dy: -0.15, weight: 0.6 },
  { dx: 1.0, dy: -0.15, weight: 0.6 },
  { dx: 0.75, dy: 0.65, weight: 0.52 },
  { dx: -0.75, dy: 0.65, weight: 0.52 },
  { dx: 0, dy: -1.05, weight: 0.46 },
  { dx: -1.55, dy: 0.25, weight: 0.36 },
  { dx: 1.55, dy: 0.25, weight: 0.36 },
  { dx: -0.45, dy: 1.25, weight: 0.3 },
  { dx: 0.45, dy: 1.25, weight: 0.3 },
  { dx: -1.2, dy: -0.95, weight: 0.26 },
  { dx: 1.2, dy: -0.95, weight: 0.26 },
  { dx: 0, dy: 1.75, weight: 0.22 },
];

function getZoneSpread(zone: string): number {
  if (zone === 'KL') return 18;
  if (zone === 'RM') return 30;
  if (zone === 'RL' || zone === 'RR') return 25;
  return 22;
}

function getDensityZoneColor(shares: { red: number; blue: number; unknown: number }): string {
  const red = { r: 239, g: 68, b: 68 };
  const blue = { r: 37, g: 99, b: 235 };
  const gray = { r: 148, g: 163, b: 184 };
  const r = red.r * shares.red + blue.r * shares.blue + gray.r * shares.unknown;
  const g = red.g * shares.red + blue.g * shares.blue + gray.g * shares.unknown;
  const b = red.b * shares.red + blue.b * shares.blue + gray.b * shares.unknown;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function EditableField({
  value,
  placeholder,
  onSave,
  textClassName = '',
}: {
  value: string;
  placeholder: string;
  onSave: (val: string) => void;
  textClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);

  const commit = () => {
    cancelledRef.current = false;
    onSave(draft.trim() || value);
    setEditing(false);
  };

  const cancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    cancelledRef.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          onBlur={() => { if (!cancelledRef.current) commit(); }}
          className={`border border-white/50 rounded px-2 py-0.5 bg-white/20 outline-none min-w-32 ${textClassName}`}
        />
        <button onMouseDown={e => { e.preventDefault(); cancel(e); }} className="opacity-70 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 cursor-pointer ${textClassName}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Klicken zum Bearbeiten"
    >
      <span>{value || <span className="italic opacity-60">{placeholder}</span>}</span>
      <Pencil className="w-3.5 h-3.5 opacity-40 shrink-0" />
    </span>
  );
}

function EditableFieldDark({
  value,
  placeholder,
  onSave,
  textClassName = '',
}: {
  value: string;
  placeholder: string;
  onSave: (val: string) => void;
  textClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);

  const commit = () => {
    cancelledRef.current = false;
    onSave(draft.trim() || value);
    setEditing(false);
  };

  const cancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    cancelledRef.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          onBlur={() => { if (!cancelledRef.current) commit(); }}
          className={`border border-sky-400 rounded px-2 py-0.5 bg-white text-gray-900 outline-none min-w-32 ${textClassName}`}
        />
        <button onMouseDown={e => { e.preventDefault(); cancel(e); }} className="text-red-500 hover:text-red-600">
          <X className="w-4 h-4" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 cursor-pointer ${textClassName}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Klicken zum Bearbeiten"
    >
      <span>{value || <span className="italic opacity-50">{placeholder}</span>}</span>
      <Pencil className="w-3.5 h-3.5 opacity-30 shrink-0" />
    </span>
  );
}

interface Throw {
  frame_id: number;
  track_id: number;
  team: string;
  court_x: number;
  court_y: number;
  is_goal: boolean;
  throw_type: string;
}

interface AnalysisData {
  duration: number;
  playersDetected: number;
  totalShots: number;
  successfulShots: number;
  framesExtracted: number;
  ballDetectionRate: number;
  teamAName: string;
  teamBName: string;
  possession: {
    teamA: number;
    teamB: number;
  };
  defensiveFormations: Array<{
    formation: string;
    frequency: number;
    successRate: number;
  }>;
  offensivePlays: Array<{
    play: string;
    frequency: number;
    successRate: number;
  }>;
  shotPositions: {
    rueckraum: { attempts: number; goals: number };
    kreis: { attempts: number; goals: number };
    aussenLinks: { attempts: number; goals: number };
    aussenRechts: { attempts: number; goals: number };
  };
  playerStats: Array<{
    id: number;
    name: string;
    shots: number;
    goals: number;
    assists: number;
    distance: number;
    team: 'A' | 'B';
  }>;
  throws: Throw[];
  events: Array<{
    time: string;
    type: string;
    description: string;
  }>;
  heatmapData: Array<{
    zone: string;
    intensity: number;
  }>;
  qualityMetrics: {
    playerDetectionRate: number;
    teamClassificationAccuracy: number;
    formationAccuracy: number;
    fieldDetectionConfidence: number;
  };
}

interface AnalysisResultsProps {
  data: AnalysisData;
  videoName: string;
  matchId?: string;
}

const BACKEND_URL = window.location.origin.includes(':3000')
  ? window.location.origin.replace(':3000', ':8000')
  : 'http://localhost:8000';

function formatSceneTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function PhaseTimeline({
  phases,
  selectedPhaseId,
  onSelectPhase,
  teamAName,
  teamBName,
}: {
  phases: TeamPhase[];
  selectedPhaseId: number | null;
  onSelectPhase: (phaseId: number | null) => void;
  teamAName: string;
  teamBName: string;
}) {
  if (phases.length === 0) return null;

  const totalStart = phases.reduce((min, p) => Math.min(min, p.start_time_s), Infinity);
  const totalEnd = phases.reduce((max, p) => Math.max(max, p.end_time_s), 0);
  const totalDuration = totalEnd - totalStart || 1;

  return (
    <div className="w-full">
      <div className="relative h-9 bg-slate-100 rounded-lg overflow-hidden">
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => onSelectPhase(null)}
        />
        {phases.map((ph, i) => {
          const left = ((ph.start_time_s - totalStart) / totalDuration) * 100;
          const width = ((ph.end_time_s - ph.start_time_s) / totalDuration) * 100;
          const isActive = selectedPhaseId === ph.phase_id;
          const isOffenseA = ph.offense_team === 'A';

          return (
            <div
              key={ph.phase_id}
              onClick={e => { e.stopPropagation(); onSelectPhase(isActive ? null : ph.phase_id); }}
              className={`absolute top-0.5 bottom-0.5 rounded cursor-pointer transition-all ${
                isOffenseA ? 'bg-red-500' : 'bg-blue-500'
              } ${
                isActive
                  ? 'opacity-100 ring-2 ring-yellow-400 z-10 shadow-md'
                  : 'opacity-50 hover:opacity-85'
              }`}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%` }}
              title={`Phase ${i + 1}: ${isOffenseA ? teamAName : teamBName} Angriff (${formatSceneTime(ph.start_time_s)} – ${formatSceneTime(ph.end_time_s)})`}
            >
              {width > 5 && (
                <span className="text-[10px] text-white font-semibold px-1.5 leading-8 block truncate">
                  P{i + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>{formatSceneTime(totalStart)}</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {teamAName} Angriff
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            {teamBName} Angriff
          </span>
        </div>
        <span>{formatSceneTime(totalEnd)}</span>
      </div>
    </div>
  );
}

function PhaseVideoPlayer({ matchId, phase, teamLabel }: { matchId: string; phase: TeamPhase; teamLabel: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = `${BACKEND_URL}/api/v1/matches/${matchId}/video`;

  const seekToStart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = phase.start_time_s;
    }
  };

  const onTimeUpdate = () => {
    const vid = videoRef.current;
    if (vid && !vid.paused && vid.currentTime >= phase.end_time_s) {
      vid.pause();
      vid.currentTime = phase.start_time_s;
    }
  };

  const onPlay = () => {
    const vid = videoRef.current;
    if (vid && vid.currentTime >= phase.end_time_s) {
      vid.currentTime = phase.start_time_s;
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-sky-200">
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 px-4 py-2 text-white text-sm font-medium flex items-center gap-2">
        <Video className="w-4 h-4" />
        {teamLabel} ({formatSceneTime(phase.start_time_s)} – {formatSceneTime(phase.end_time_s)})
      </div>
      <div className="bg-black">
        <video
          ref={videoRef}
          src={src}
          controls
          preload="metadata"
          className="w-full max-h-96"
          onLoadedMetadata={seekToStart}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
        >
          Ihr Browser unterstützt das Video-Element nicht.
        </video>
      </div>
    </Card>
  );
}

function ScenePlayer({ matchId, scene }: { matchId: string; scene: { start_time_s: number; end_time_s: number } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = `${BACKEND_URL}/api/v1/matches/${matchId}/video`;

  const seekToStart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = scene.start_time_s;
    }
  };

  const onTimeUpdate = () => {
    const vid = videoRef.current;
    if (vid && !vid.paused && vid.currentTime >= scene.end_time_s) {
      vid.pause();
      vid.currentTime = scene.start_time_s;
    }
  };

  const onPlay = () => {
    const vid = videoRef.current;
    if (vid && vid.currentTime >= scene.end_time_s) {
      vid.currentTime = scene.start_time_s;
    }
  };

  return (
    <div className="bg-black rounded-b-xl overflow-hidden">
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        className="w-full"
        onLoadedMetadata={seekToStart}
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
      >
        Ihr Browser unterstützt das Video-Element nicht.
      </video>
    </div>
  );
}

// ── Play detection (Spielzugerkennung) ──────────────────────────────────────

const PLAY_TYPE_META: Record<string, { label: string; description: string }> = {
  kreuzen: {
    label: 'Kreuzen',
    description: 'Zwei Rückraumspieler tauschen laufend die Position',
  },
  einlaeufer: {
    label: 'Einläufer',
    description: 'Rückraumspieler läuft an den Kreis ein',
  },
  parallelstoss: {
    label: 'Parallelstoß',
    description: 'Zwei Rückraumspieler stoßen gemeinsam Richtung Tor',
  },
  tempogegenstoss: {
    label: 'Tempogegenstoß',
    description: 'Schneller Gegenstoß aus der eigenen Hälfte',
  },
};

const TRACK_COLORS = ['#dc2626', '#ea580c', '#0284c7', '#7c3aed'];

/** Mini top-view court (40x20m) with the trajectories of the involved players. */
function PlayEventField({ details }: { details: PlayEventDetails | null }) {
  const tracks = details?.tracks ?? [];
  if (tracks.length === 0) return null;

  return (
    <div className="p-4 bg-white border-t border-orange-100">
      <svg viewBox="-1 -1 42 22" className="w-full max-w-xl mx-auto" role="img" aria-label="Spielfeld mit Laufwegen">
        {/* Court outline, centre line, 6m and 9m lines */}
        <rect x="0" y="0" width="40" height="20" fill="#f0f9ff" stroke="#94a3b8" strokeWidth="0.15" />
        <line x1="20" y1="0" x2="20" y2="20" stroke="#94a3b8" strokeWidth="0.1" />
        <path d="M 0 4 A 6 6 0 0 1 6 10 A 6 6 0 0 1 0 16" fill="none" stroke="#94a3b8" strokeWidth="0.12" />
        <path d="M 40 4 A 6 6 0 0 0 34 10 A 6 6 0 0 0 40 16" fill="none" stroke="#94a3b8" strokeWidth="0.12" />
        <path d="M 0 1 A 9 9 0 0 1 9 10 A 9 9 0 0 1 0 19" fill="none" stroke="#cbd5e1" strokeWidth="0.1" strokeDasharray="0.5 0.4" />
        <path d="M 40 1 A 9 9 0 0 0 31 10 A 9 9 0 0 0 40 19" fill="none" stroke="#cbd5e1" strokeWidth="0.1" strokeDasharray="0.5 0.4" />
        {/* Attacked goal marker */}
        {typeof details?.goal_x === 'number' && (
          <rect x={details.goal_x === 0 ? -0.6 : 40} y="8.5" width="0.6" height="3" fill="#16a34a" />
        )}
        {/* Trajectories: dot at start, arrowhead-ish dot at end */}
        {tracks.map((track, i) => {
          const color = TRACK_COLORS[i % TRACK_COLORS.length];
          const pts = track.points;
          if (pts.length < 2) return null;
          const polyline = pts.map(([, x, y]) => `${x},${y}`).join(' ');
          const [, x0, y0] = pts[0];
          const [, x1, y1] = pts[pts.length - 1];
          const isCentroid = track.track_id === -1;
          return (
            <g key={track.track_id}>
              <polyline
                points={polyline}
                fill="none"
                stroke={color}
                strokeWidth="0.3"
                strokeLinecap="round"
                strokeDasharray={isCentroid ? '0.8 0.5' : undefined}
                opacity="0.85"
              />
              <circle cx={x0} cy={y0} r="0.4" fill="white" stroke={color} strokeWidth="0.2" />
              <circle cx={x1} cy={y1} r="0.5" fill={color} />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-4 justify-center mt-2 text-xs text-gray-600">
        {tracks.map((track, i) => (
          <span key={track.track_id} className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded" style={{ background: TRACK_COLORS[i % TRACK_COLORS.length] }} />
            {track.track_id === -1 ? 'Teamschwerpunkt' : `Spieler-Track ${track.track_id}`}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-green-600" />
          angegriffenes Tor
        </span>
      </div>
    </div>
  );
}

function PlayScenesView({
  matchId,
  playType,
  teamNames,
  onBack,
}: {
  matchId: string;
  playType: string;
  teamNames: { A: string; B: string };
  onBack: () => void;
}) {
  const [events, setEvents] = useState<PlayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEventId, setActiveEventId] = useState<number | null>(null);
  // Coach verdicts (label loop). Kept locally so a click is reflected instantly;
  // persisted via labelPlayEvent. Initialised from whatever the backend stored.
  const [labels, setLabels] = useState<Record<number, 'correct' | 'wrong' | null>>({});

  useEffect(() => {
    setLoading(true);
    setActiveEventId(null);
    fetchPlays(matchId, playType)
      .then(data => {
        setEvents(data);
        setLabels(Object.fromEntries(data.map(e => [e.event_id, e.label ?? null])));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [matchId, playType]);

  const setVerdict = (eventId: number, verdict: 'correct' | 'wrong') => {
    // Toggle off when the same verdict is clicked again
    const next = labels[eventId] === verdict ? null : verdict;
    setLabels(prev => ({ ...prev, [eventId]: next }));
    labelPlayEvent(matchId, eventId, next).catch(() => {});
  };

  const meta = PLAY_TYPE_META[playType] ?? { label: playType, description: '' };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-orange-600 hover:text-orange-800 mb-6 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Übersicht
      </button>

      <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <Play className="w-6 h-6 text-orange-600" />
        {meta.label}
      </h3>
      <p className="text-gray-500 mb-6">{meta.description}</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-500">
          <Play className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Keine Szenen verfügbar</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-4">{events.length} Szene{events.length !== 1 ? 'n' : ''} gefunden</p>
          {events.map((event, index) => {
            const isActive = activeEventId === event.event_id;
            const duration = Math.max(1, Math.round(event.end_time_s - event.start_time_s));
            const teamName = event.team === 'A' ? teamNames.A : event.team === 'B' ? teamNames.B : event.team;
            return (
              <div key={event.event_id} className="border-2 border-orange-200 rounded-xl overflow-hidden">
                <div
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isActive ? 'bg-orange-50' : 'hover:bg-orange-50'}`}
                  onClick={() => setActiveEventId(isActive ? null : event.event_id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-gray-800">
                        {formatSceneTime(event.start_time_s)} – {formatSceneTime(event.end_time_s)}
                      </div>
                      <div className="text-sm text-gray-500">{duration}s Dauer</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.outcome === 'goal' && (
                      <Badge className="bg-green-600 text-xs">⚽ Tor</Badge>
                    )}
                    {labels[event.event_id] === 'correct' && (
                      <Badge className="bg-green-600 text-xs">✓ bestätigt</Badge>
                    )}
                    {labels[event.event_id] === 'wrong' && (
                      <Badge className="bg-gray-500 text-xs">✗ falsch</Badge>
                    )}
                    <Badge className={event.team === 'A' ? 'bg-red-600 text-xs' : 'bg-blue-600 text-xs'}>{teamName}</Badge>
                    <Badge className="bg-orange-600 text-xs">Konfidenz {(event.confidence * 100).toFixed(0)}%</Badge>
                    {isActive
                      ? <ChevronUp className="w-5 h-5 text-orange-600" />
                      : <ChevronDown className="w-5 h-5 text-orange-400" />
                    }
                  </div>
                </div>
                {isActive && (
                  <>
                    <PlayEventField details={event.details} />
                    <ScenePlayer matchId={matchId} scene={event} />
                    {/* Label loop: the coach confirms or corrects the detection. Each verdict
                        is stored and later used as training data to improve play detection. */}
                    <div className="p-5 bg-gradient-to-r from-orange-50 to-amber-50 border-t-2 border-orange-100">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-orange-100 shrink-0">
                          <GraduationCap className="w-5 h-5 text-orange-700" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">Hat das System diesen Spielzug richtig erkannt?</h4>
                          <p className="text-sm text-gray-600 mt-0.5">
                            Ihre Bewertung wird <strong>gespeichert</strong> und dient als Trainingsdaten:
                            Je mehr Szenen Sie bestätigen oder korrigieren, desto genauer erkennt das Modell
                            Spielzüge in Zukunft.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setVerdict(event.event_id, 'correct')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                            labels[event.event_id] === 'correct'
                              ? 'bg-green-600 text-white border-green-600 shadow'
                              : 'bg-white text-green-700 border-green-300 hover:border-green-500'
                          }`}
                        >
                          <Check className="w-4 h-4" /> Richtig erkannt
                        </button>
                        <button
                          onClick={() => setVerdict(event.event_id, 'wrong')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                            labels[event.event_id] === 'wrong'
                              ? 'bg-red-600 text-white border-red-600 shadow'
                              : 'bg-white text-red-700 border-red-300 hover:border-red-500'
                          }`}
                        >
                          <X className="w-4 h-4" /> Falsch erkannt
                        </button>
                        {labels[event.event_id] != null && (
                          <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                            <Check className="w-4 h-4" />
                            Gespeichert – fließt ins Modelltraining ein
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormationScenesView({
  matchId,
  team,
  formation,
  teamLabel,
  onBack,
}: {
  matchId: string;
  team: string;
  formation: string;
  teamLabel: string;
  onBack: () => void;
}) {
  const [scenes, setScenes] = useState<FormationScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setActiveSceneId(null);
    fetchFormationScenes(matchId, team, formation)
      .then(data => { setScenes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [matchId, team, formation]);

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sky-600 hover:text-sky-800 mb-6 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zu allen Formationen
      </button>

      <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <Shield className="w-6 h-6 text-sky-600" />
        Formation {formation}
      </h3>
      <p className="text-gray-500 mb-6">{teamLabel}</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      ) : scenes.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-500">
          <Shield className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Keine Szenen verfügbar</p>
          <p className="text-sm mt-2">
            Führe <code className="bg-gray-100 px-1 rounded">wels-score {matchId}</code> erneut aus, um Szenen zu generieren.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-4">{scenes.length} Szene{scenes.length !== 1 ? 'n' : ''} gefunden</p>
          {scenes.map((scene, index) => {
            const isActive = activeSceneId === scene.scene_id;
            const duration = Math.round(scene.end_time_s - scene.start_time_s);
            return (
              <div key={scene.scene_id} className="border-2 border-sky-200 rounded-xl overflow-hidden">
                <div
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isActive ? 'bg-sky-50' : 'hover:bg-sky-50'}`}
                  onClick={() => setActiveSceneId(isActive ? null : scene.scene_id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-gray-800">
                        {formatSceneTime(scene.start_time_s)} – {formatSceneTime(scene.end_time_s)}
                      </div>
                      <div className="text-sm text-gray-500">{duration}s Dauer</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-sky-600 text-xs">{formatSceneTime(scene.start_time_s)}</Badge>
                    {isActive
                      ? <ChevronUp className="w-5 h-5 text-sky-600" />
                      : <ChevronDown className="w-5 h-5 text-sky-400" />
                    }
                  </div>
                </div>
                {isActive && <ScenePlayer matchId={matchId} scene={scene} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OutputVideoTab({
  matchId,
  teamAName,
  teamBName,
  status,
  videoPath,
}: {
  matchId?: string;
  teamAName: string;
  teamBName: string;
  status: 'loading' | 'processing' | 'ready' | 'unavailable' | 'error';
  videoPath: string | null;
}) {
  const [phases, setPhases] = useState<TeamPhase[]>([]);
  const [currentPhase, setCurrentPhase] = useState<TeamPhase | null>(null);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    fetchTeamPhases(matchId).then((ps) => {
      if (!cancelled) setPhases(ps);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const t = e.currentTarget.currentTime;
      const phase = phases.find((p) => t >= p.start_time_s && t <= p.end_time_s) ?? null;
      setCurrentPhase((prev) => (prev?.phase_id === phase?.phase_id ? prev : phase));
    },
    [phases],
  );

  const teamName = (team: string) => (team === 'A' ? teamAName : teamBName);

  if (status === 'loading' || status === 'processing') {
    return (
      <Card className="p-8 shadow-xl border-2 border-sky-200">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-sky-600 mb-4" />
          <p className="text-lg text-gray-600">
            {status === 'loading' ? 'Lade Video...' : 'Warte auf verarbeitetes Video...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Das Video wird nach der Pipeline-Verarbeitung verfügbar sein.
          </p>
        </div>
      </Card>
    );
  }

  if (status === 'unavailable') {
    return (
      <Card className="p-8 shadow-xl border-2 border-gray-200">
        <div className="flex flex-col items-center justify-center py-12">
          <Video className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-lg text-gray-600">Kein annotiertes Video</p>
          <p className="text-sm text-gray-500 mt-2">
            Für dieses Match wurde kein annotiertes Video erzeugt. Aktivieren Sie die Option
            beim Upload, um eines zu generieren.
          </p>
        </div>
      </Card>
    );
  }

  if (status === 'error' || playbackFailed || !videoPath) {
    return (
      <Card className="p-8 shadow-xl border-2 border-red-200">
        <div className="flex flex-col items-center justify-center py-12">
          <Video className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-lg text-gray-600">Video nicht verfügbar</p>
          <p className="text-sm text-gray-500 mt-2">
            Das Output-Video wurde noch nicht generiert.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8 shadow-xl border-2 border-sky-200">
      <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Video className="w-6 h-6 text-sky-600" />
        Output Video
      </h3>
      <p className="text-gray-600 mb-6">
        Das annotierte Video mit Bounding Boxes und Spieler-Tracking.
      </p>
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {phases.length > 0 && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            {currentPhase ? (
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-500/90 text-white shadow">
                  Angriff: {teamName(currentPhase.offense_team)}
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-sky-700/90 text-white shadow">
                  Abwehr: {teamName(currentPhase.defense_team)}
                </span>
              </div>
            ) : (
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-black/60 text-white shadow">
                Umschaltspiel
              </span>
                )}
                </div>
                )}

        <video
          controls
          className="w-full h-full"
          src={videoPath}
          onTimeUpdate={handleTimeUpdate}
          onError={(e) => {
            const target = e.target as HTMLVideoElement;
            console.error("Video load error:", target.error?.code, target.src);
            setPlaybackFailed(true);
          }}
          onLoadedMetadata={(e) => {
            const target = e.target as HTMLVideoElement;
            console.log("Video metadata loaded:", {
              duration: target.duration,
              width: target.videoWidth,
              height: target.videoHeight
            });
          }}
        >
          Ihr Browser unterstützt das Video-Element nicht.
        </video>
      </div>
    </Card>
  );
}

export function AnalysisResults({ data, videoName, matchId }: AnalysisResultsProps) {
  const [realStats, setRealStats] = useState<MatchStats | null>(null);
  const [formationSummary, setFormationSummary] = useState<FormationSummary[] | null>(null);
  const [playSummary, setPlaySummary] = useState<PlaySummary[] | null>(null);
  const [selectedPlayType, setSelectedPlayType] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(videoName);
  const [teamAName, setTeamAName] = useState(data.teamAName || 'Team A');
  const [teamBName, setTeamBName] = useState(data.teamBName || 'Team B');
  const [heatmapMode, setHeatmapMode] = useState<'density' | 'tiles'>('density');
  const [showUnassignedInHeatmap, setShowUnassignedInHeatmap] = useState(false);
  const [perspective, setPerspective] = useState<'offense' | 'defense' | 'both'>('both');
  const [windowRange, setWindowRange] = useState<[number, number] | null>(null);
  const displayTeamAName = teamAName.trim() || 'Team A';
  const displayTeamBName = teamBName.trim() || 'Team B';
  const [selectedFormation, setSelectedFormation] = useState<{ team: string; formation: string } | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [teamPhases, setTeamPhases] = useState<TeamPhase[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<Array<{ x: number; y: number; team: string }> | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);
  const [availableTrackIds, setAvailableTrackIds] = useState<TrackInfo[]>([]);
  const [hoveredThrow, setHoveredThrow] = useState<Throw | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [outputVideoStatus, setOutputVideoStatus] = useState<
    'loading' | 'processing' | 'ready' | 'unavailable' | 'error'
  >('loading');
  const [outputVideoPath, setOutputVideoPath] = useState<string | null>(null);

  // Poll the output-video endpoint so we only surface the tab when a video
  // was actually generated (annotation can be skipped at upload).
  useEffect(() => {
    if (!matchId) {
      setOutputVideoStatus('loading');
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkVideo = async () => {
      if (cancelled) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/videos/${matchId}/output`);
        const result = await response.json();
        if (cancelled) return;

        if (result.status === 'ready') {
          setOutputVideoPath(`${BACKEND_URL}/api/v1/videos/${matchId}/output/video`);
          setOutputVideoStatus('ready');
        } else if (result.status === 'processing') {
          setOutputVideoStatus('processing');
          timeoutId = setTimeout(checkVideo, 5000);
        } else {
          // Terminal without a video file: annotation was skipped at upload
          // (status "done" + video_path null) or the pipeline failed.
          setOutputVideoStatus('unavailable');
        }
      } catch {
        if (!cancelled) setOutputVideoStatus('error');
      }
    };

    setOutputVideoStatus('loading');
    checkVideo();

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [matchId]);

  const showOutputVideoTab =
    outputVideoStatus === 'ready' || outputVideoStatus === 'processing';

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    fetchMatchStats(matchId).then(d => { if (!cancelled && d) setRealStats(d); }).catch(() => {});
    fetchFormationSummary(matchId).then(d => { if (!cancelled && d) setFormationSummary(d); }).catch(() => {});
    fetchPlaySummary(matchId).then(d => { if (!cancelled) setPlaySummary(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    fetchTeamPhases(matchId).then(setTeamPhases).catch(() => {});
  }, [matchId]);

  // Initialize window range when phase selection changes
  useEffect(() => {
    if (selectedPhaseId !== null) {
      const ph = teamPhases.find(p => p.phase_id === selectedPhaseId);
      if (ph) setWindowRange([ph.start_time_s, ph.end_time_s]);
    } else {
      setWindowRange(null);
    }
  }, [selectedPhaseId, teamPhases]);

  // Unified heatmap fetch — fires on every filter change except slider debounce
  useEffect(() => {
    if (!matchId) {
      setHeatmapPoints(null);
      setAvailableTrackIds([]);
      return;
    }
    let cancelled = false;
    setHeatmapLoading(true);

    fetchHeatmapPoints(matchId, {
      phaseId: selectedPhaseId ?? undefined,
      trackIds: selectedTrackIds.length ? selectedTrackIds : undefined,
      perspective,
    }).then(d => {
      if (!cancelled && d) {
        setHeatmapPoints(d.heatmap_points);
        setAvailableTrackIds(d.available_track_ids);
      }
      if (!cancelled) setHeatmapLoading(false);
    });
    return () => { cancelled = true; };
  }, [matchId, selectedPhaseId, selectedTrackIds, perspective]);

  // Debounced time window: re-fetch when slider range changes
  useEffect(() => {
    if (!matchId || windowRange === null) return;

    const [winStart, winEnd] = windowRange;
    if (winEnd <= winStart) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      fetchHeatmapPoints(matchId, {
        phaseId: selectedPhaseId ?? undefined,
        trackIds: selectedTrackIds.length ? selectedTrackIds : undefined,
        perspective,
        windowStartS: winStart,
        windowEndS: winEnd,
      }).then(d => {
        if (!cancelled && d) setHeatmapPoints(d.heatmap_points);
      });
    }, 200);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [windowRange, selectedPhaseId, matchId, realStats?.duration_seconds]);

  const saveName = (val: string) => {
    setDisplayName(val);
    if (matchId) patchMatch(matchId, { display_name: val }).catch(() => {});
  };

  const saveTeamA = (val: string) => {
    setTeamAName(val);
    if (matchId) patchMatch(matchId, { team_a_name: val }).catch(() => {});
  };

  const saveTeamB = (val: string) => {
    setTeamBName(val);
    if (matchId) patchMatch(matchId, { team_b_name: val }).catch(() => {});
  };

  // Merge: real data overrides mock where available
  const hasPossession = realStats ? (realStats.possession_a + realStats.possession_b) > 0 : false;
  // When a real matchId is present, show real values or "–"; never show misleading mock numbers.
  const hasReal = realStats !== null;
  const display = {
    framesExtracted:    hasReal ? realStats!.total_frames    : data.framesExtracted,
    duration:           hasReal ? realStats!.duration_seconds : data.duration,
    possessionA: hasPossession ? realStats!.possession_a : data.possession.teamA,
    possessionB: hasPossession ? realStats!.possession_b : data.possession.teamB,
  };

  // Trefferquote and per-position shot data have no live source yet → demo only.
  const shotAccuracy = matchId ? null : ((data.successfulShots / data.totalShots) * 100).toFixed(1);

  const heatmapLeft = realStats?.heatmap_left?.length ? realStats.heatmap_left : null;
  const heatmapRight = realStats?.heatmap_right?.length ? realStats.heatmap_right : null;
  const leftTeamA = realStats?.heatmap_left_by_team?.A ?? [];
  const leftTeamB = realStats?.heatmap_left_by_team?.B ?? [];
  const leftTeamU = realStats?.heatmap_left_by_team?.U ?? [];
  const rightTeamA = realStats?.heatmap_right_by_team?.A ?? [];
  const rightTeamB = realStats?.heatmap_right_by_team?.B ?? [];
  const rightTeamU = realStats?.heatmap_right_by_team?.U ?? [];

  const buildZoneSplitMap = (
    teamA: Array<{ zone: string; count: number }>,
    teamB: Array<{ zone: string; count: number }>,
    teamU: Array<{ zone: string; count: number }>,
    includeUnassigned: boolean
  ) => {
    const aMap = new Map(teamA.map(z => [z.zone, z.count]));
    const bMap = new Map(teamB.map(z => [z.zone, z.count]));
    const uMap = new Map(teamU.map(z => [z.zone, z.count]));
    const zoneKeys = new Set([...aMap.keys(), ...bMap.keys(), ...uMap.keys()]);
    const result = new Map<string, { dominance: number; shares: { red: number; unknown: number; blue: number } }>();
    for (const zone of zoneKeys) {
      const a = aMap.get(zone) ?? 0;
      const b = bMap.get(zone) ?? 0;
      const u = includeUnassigned ? (uMap.get(zone) ?? 0) : 0;
      const total = a + b + u;
      if (!total) {
        result.set(zone, { dominance: 0, shares: { red: 0.5, unknown: 0, blue: 0.5 } });
        continue;
      }
      result.set(zone, {
        dominance: (b - a) / total,
        shares: {
          red: a / total,
          unknown: u / total,
          blue: b / total,
        },
      });
    }
    return result;
  };

  const leftDominanceByZone = buildZoneSplitMap(
    leftTeamA,
    leftTeamB,
    leftTeamU,
    showUnassignedInHeatmap
  );
  const rightDominanceByZone = buildZoneSplitMap(
    rightTeamA,
    rightTeamB,
    rightTeamU,
    showUnassignedInHeatmap
  );

  const densityCloudPoints = useMemo(() => {
    const hasFilter = selectedTrackIds.length > 0 || perspective !== 'both' || windowRange !== null;
    const sourcePoints = heatmapLoading ? [] : (heatmapPoints ?? (hasFilter ? [] : realStats?.heatmap_points ?? []));
    if (sourcePoints.length) {
      const maxPoints = 3500;
      const stride = Math.max(1, Math.ceil(sourcePoints.length / maxPoints));
      const sampled = sourcePoints.filter((_, idx) => idx % stride === 0);
      return sampled.flatMap((point, idx) => {
        const clampedX = Math.max(0, Math.min(40, point.x));
        const clampedY = Math.max(0, Math.min(20, point.y));
        const px = COURT_X + (clampedX / 40) * COURT_W;
        const py = COURT_Y + (clampedY / 20) * COURT_H;
        const team = point.team === 'A' || point.team === 'B' ? point.team : 'U';
        if (team === 'U' && !showUnassignedInHeatmap) return [];

        const shares = team === 'A'
          ? { red: 1, blue: 0, unknown: 0 }
          : team === 'B'
            ? { red: 0, blue: 1, unknown: 0 }
            : { red: 0, blue: 0, unknown: 1 };

        return DENSITY_SAMPLE_OFFSETS.map((offset, offsetIdx) => ({
          key: `pt-${idx}-s${offsetIdx}`,
          x: px + offset.dx * 6.5,
          y: py + offset.dy * 6.5,
          intensity: Math.max(0, Math.min(100, 45 * offset.weight)),
          shares,
          weight: offset.weight,
        }));
      });
    }

    if (hasFilter) return [];

    const fallbackSeeds = [
      ...(heatmapLeft ?? []).map(zone => {
        const center = LEFT_ZONE_CENTERS[zone.zone];
        const split = leftDominanceByZone.get(zone.zone);
        return {
          key: `left-${zone.zone}`,
          zone: zone.zone,
          x: center?.x ?? 250,
          y: center?.y ?? 250,
          intensity: zone.intensity,
          shares: split?.shares ?? { red: 0.5, blue: 0.5, unknown: 0 },
        };
      }),
      ...(heatmapRight ?? []).map(zone => {
        const center = RIGHT_ZONE_CENTERS[zone.zone];
        const split = rightDominanceByZone.get(zone.zone);
        return {
          key: `right-${zone.zone}`,
          zone: zone.zone,
          x: center?.x ?? 750,
          y: center?.y ?? 250,
          intensity: zone.intensity,
          shares: split?.shares ?? { red: 0.5, blue: 0.5, unknown: 0 },
        };
      }),
    ];

    return fallbackSeeds.flatMap(seed => {
      const spread = getZoneSpread(seed.zone);
      return DENSITY_SAMPLE_OFFSETS.map((offset, index) => ({
        key: `${seed.key}-s${index}`,
        x: seed.x + offset.dx * spread,
        y: seed.y + offset.dy * spread,
        intensity: Math.max(0, Math.min(100, seed.intensity * offset.weight)),
        shares: seed.shares,
        weight: offset.weight,
      }));
    });
  }, [
    heatmapPoints,
    heatmapLoading,
    realStats,
    showUnassignedInHeatmap,
    heatmapLeft,
    heatmapRight,
    leftDominanceByZone,
    rightDominanceByZone,
  ]);

  const densityGridCells = useMemo(() => {
    if (!densityCloudPoints.length) return [];

    const cellW = COURT_W / DENSITY_GRID_COLS;
    const cellH = COURT_H / DENSITY_GRID_ROWS;
    const sigma = 95;
    const twoSigmaSq = 2 * sigma * sigma;

    const rawCells: Array<{
      key: string;
      x: number;
      y: number;
      w: number;
      h: number;
      value: number;
      shares: { red: number; blue: number; unknown: number };
    }> = [];

    let maxValue = 0;

    for (let row = 0; row < DENSITY_GRID_ROWS; row++) {
      for (let col = 0; col < DENSITY_GRID_COLS; col++) {
        const x = COURT_X + col * cellW;
        const y = COURT_Y + row * cellH;
        const cx = x + cellW / 2;
        const cy = y + cellH / 2;

        let value = 0;
        let redSum = 0;
        let blueSum = 0;
        let unknownSum = 0;

        for (const point of densityCloudPoints) {
          const dx = cx - point.x;
          const dy = cy - point.y;
          const influence = (point.intensity / 100) * Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
          if (influence < 0.002) continue;
          value += influence;
          redSum += influence * point.shares.red;
          blueSum += influence * point.shares.blue;
          unknownSum += influence * point.shares.unknown;
        }

        const shares = value
          ? { red: redSum / value, blue: blueSum / value, unknown: unknownSum / value }
          : { red: 0.5, blue: 0.5, unknown: 0 };

        maxValue = Math.max(maxValue, value);
        rawCells.push({ key: `c-${row}-${col}`, x, y, w: cellW, h: cellH, value, shares });
      }
    }

    return rawCells.map(cell => {
      const normalized = maxValue ? cell.value / maxValue : 0;
      return {
        ...cell,
        normalized,
        opacity: 0.05 + normalized * 0.5,
      };
    });
  }, [densityCloudPoints]);


  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div 
        className="flex items-center justify-between bg-gradient-to-r from-blue-900 via-sky-600 to-orange-500 p-6 rounded-2xl shadow-2xl text-white"
        variants={itemVariants}
      >
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Award className="w-8 h-8" />
            Match-Report Overview
          </h2>
          <div className="text-blue-100 mt-1">
            <EditableField
              value={displayName}
              placeholder="Spielname eingeben…"
              onSave={saveName}
              textClassName="text-blue-100"
            />
          </div>
        </div>
        <Badge variant="outline" className="text-lg bg-white text-blue-900 border-0 px-4 py-2">
          <Clock className="w-4 h-4 mr-2" />
          {formatDuration(display.duration)}
        </Badge>
      </motion.div>

      {/* Key Metrics */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants}>
          <Card className="p-6 hover:shadow-xl transition-all border-2 border-transparent hover:border-sky-400 bg-gradient-to-br from-sky-50 to-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-sky-500 to-blue-700 rounded-xl shadow-lg">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Frames extrahiert</p>
                <p className="text-3xl font-bold text-sky-600">{display.framesExtracted.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-6 hover:shadow-xl transition-all border-2 border-transparent hover:border-green-400 bg-gradient-to-br from-green-50 to-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm text-gray-600 font-medium">Trefferquote</p>
                  <DemoBadge label="Demo" />
                </div>
                <p className="text-3xl font-bold text-green-600">{shotAccuracy !== null ? `${shotAccuracy}%` : '–'}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Scoreboard & Goal Timeline */}
      <motion.div variants={itemVariants}>
        <ScoreboardCard matchId={matchId} teamAName={teamAName} teamBName={teamBName} />
      </motion.div>

      {/* Team Colors and Possession */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 border-2 border-sky-200 shadow-lg">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-600" />
            Teameinteilung
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-2 border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500 rounded-full border-2 border-red-700"></div>
                <EditableFieldDark
                  value={teamAName}
                  placeholder="Team A"
                  onSave={saveTeamA}
                  textClassName="font-semibold text-gray-900"
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-blue-700"></div>
                <EditableFieldDark
                  value={teamBName}
                  placeholder="Team B"
                  onSave={saveTeamB}
                  textClassName="font-semibold text-gray-900"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-sky-200 shadow-lg">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            Ballbesitz-Verteilung
            {!hasPossession && <DemoBadge label="Demo" />}
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-red-600">{displayTeamAName}</span>
                <span className="font-bold text-red-600">{display.possessionA}%</span>
              </div>
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full"
                  style={{ width: `${display.possessionA}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-blue-600">{displayTeamBName}</span>
                <span className="font-bold text-blue-600">{display.possessionB}%</span>
              </div>
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                  style={{ width: `${display.possessionB}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Detailed Analysis Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="formations" className="w-full">
          <TabsList className={`grid w-full ${showOutputVideoTab ? 'grid-cols-6' : 'grid-cols-5'} bg-gradient-to-r from-blue-100 to-orange-100 p-1 rounded-xl`}>
            <TabsTrigger value="formations" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
              <Shield className="w-4 h-4 mr-2" />
              Abwehr
            </TabsTrigger>
            <TabsTrigger value="offense" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
              <Play className="w-4 h-4 mr-2" />
              Angriff
            </TabsTrigger>
            <TabsTrigger value="shots" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md" title="Demo-Vorschau – noch nicht aus dem Video berechnet">
              <BarChart3 className="w-4 h-4 mr-2" />
              Würfe
              <span className="ml-1.5 w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            </TabsTrigger>
            <TabsTrigger value="players" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
              <Zap className="w-4 h-4 mr-2" />
              Spieler
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
              <MapPin className="w-4 h-4 mr-2" />
              Heatmap
            </TabsTrigger>
            {showOutputVideoTab && (
              <TabsTrigger value="output" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Video className="w-4 h-4 mr-2" />
                Output Video
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="formations" className="mt-6">
            <Card className="shadow-xl border-2 border-sky-200">
              <div className="p-8">
                {selectedFormation && matchId ? (
                  <FormationScenesView
                    matchId={matchId}
                    team={selectedFormation.team}
                    formation={selectedFormation.formation}
                    teamLabel={selectedFormation.team === 'A' ? teamAName : selectedFormation.team === 'B' ? teamBName : `Team ${selectedFormation.team}`}
                    onBack={() => setSelectedFormation(null)}
                  />
                ) : (
                  <>
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                      <Shield className="w-6 h-6 text-sky-600" />
                      Klassifizierte Abwehrformationen
                    </h3>
                    {formationSummary && formationSummary.length > 0 ? (
                      <div className="space-y-8">
                        {formationSummary.map((teamSummary) => {
                          const NON_DEFENSIVE = new Set(['attack', 'transition', 'unknown']);
                          const entries = Object.entries(teamSummary.formations)
                            .filter(([label]) => !NON_DEFENSIVE.has(label))
                            .sort(([, a], [, b]) => b - a);
                          const total = entries.reduce((s, [, c]) => s + c, 0);
                          const dominantDefensive = entries.length > 0 ? entries[0][0] : null;
                          const teamLabel = teamSummary.team === 'A' ? teamAName : teamSummary.team === 'B' ? teamBName : `Team ${teamSummary.team}`;
                          const headerClass = teamSummary.team === 'A' ? 'text-red-600' : 'text-blue-600';
                          if (entries.length === 0) return null;
                          return (
                            <div key={teamSummary.team}>
                              <h4 className={`text-lg font-bold mb-4 ${headerClass}`}>{teamLabel}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {entries.map(([label, count], index) => {
                                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                  const isDominant = label === dominantDefensive;
                                  return (
                                    <motion.div
                                      key={label}
                                      className={`p-6 rounded-xl border-2 ${isDominant ? 'border-sky-400 bg-gradient-to-br from-sky-100 to-white' : 'border-sky-200 bg-gradient-to-br from-sky-50 to-white'} hover:shadow-lg hover:border-sky-500 transition-all ${matchId ? 'cursor-pointer' : ''}`}
                                      initial={{ opacity: 0, scale: 0.9 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: index * 0.1 }}
                                      onClick={() => matchId && setSelectedFormation({ team: teamSummary.team, formation: label })}
                                    >
                                      <div className="text-center">
                                        <div className="text-4xl font-bold text-sky-700 mb-1">{label}</div>
                                        <div className="text-gray-600 mb-3">Formation</div>
                                        {isDominant && (
                                          <Badge className="bg-sky-600 mb-3">Dominant</Badge>
                                        )}
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Häufigkeit:</span>
                                            <Badge className="bg-sky-600">{count}x</Badge>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Anteil:</span>
                                            <Badge className="bg-green-600">{pct}%</Badge>
                                          </div>
                                          <div className="mt-2">
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-gradient-to-r from-sky-500 to-sky-600 rounded-full"
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        {matchId && (
                                          <div className="mt-3 flex items-center justify-center gap-1 text-xs text-sky-600 font-medium">
                                            <Play className="w-3 h-3" />
                                            Szenen ansehen
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : matchId ? (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <Shield className="w-12 h-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">Keine Formationsdaten verfügbar</p>
                        <p className="text-sm mt-2">Führe <code className="bg-gray-100 px-1 rounded">wels-score {matchId}</code> aus, um Formationen zu analysieren.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {data.defensiveFormations.map((formation, index) => (
                          <motion.div
                            key={index}
                            className="p-6 rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white hover:shadow-lg transition-all"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <div className="text-center">
                              <div className="text-4xl font-bold text-sky-700 mb-2">{formation.formation}</div>
                              <div className="text-gray-600 mb-4">Formation</div>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">Häufigkeit:</span>
                                  <Badge className="bg-sky-600">{formation.frequency}x</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">Erfolgsquote:</span>
                                  <Badge className="bg-green-600">{formation.successRate}%</Badge>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="offense" className="mt-6">
            <Card className="shadow-xl border-2 border-orange-200">
              <div className="p-8">
                {matchId && selectedPlayType ? (
                  <PlayScenesView
                    matchId={matchId}
                    playType={selectedPlayType}
                    teamNames={{ A: displayTeamAName, B: displayTeamBName }}
                    onBack={() => setSelectedPlayType(null)}
                  />
                ) : (
                  <>
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                      <Play className="w-6 h-6 text-orange-600" />
                      Offensive Spielzüge (Regelbasierte Erkennung)
                    </h3>
                    {matchId ? (
                      playSummary === null ? (
                        <div className="flex justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                        </div>
                      ) : playSummary.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-gray-500">
                          <Play className="w-12 h-12 mb-4 opacity-30" />
                          <p className="text-lg font-medium">Keine Spielzüge erkannt</p>
                          <p className="text-sm mt-2">
                            Führe <code className="bg-gray-100 px-1 rounded">wels-plays {matchId}</code> aus, um die Spielzugerkennung zu starten.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(PLAY_TYPE_META).map(([type, meta], index) => {
                            const rows = playSummary.filter(s => s.play_type === type);
                            if (rows.length === 0) return null;
                            const total = rows.reduce((sum, r) => sum + r.count, 0);
                            const countA = rows.find(r => r.team === 'A')?.count ?? 0;
                            const countB = rows.find(r => r.team === 'B')?.count ?? 0;
                            // Attack success rate aggregated over both teams for this play type.
                            // Only meaningful when scoreboard data attributed outcomes to attacks.
                            const rated = rows.reduce((sum, r) => sum + (r.attacks_rated ?? 0), 0);
                            const goals = rows.reduce((sum, r) => sum + (r.attacks_goal ?? 0), 0);
                            const successRate = rated > 0 ? Math.round((goals / rated) * 100) : null;
                            return (
                              <motion.div
                                key={type}
                                className="p-5 rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-white hover:shadow-lg transition-all cursor-pointer"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => setSelectedPlayType(type)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h4 className="text-xl font-bold text-orange-700 mb-1">{meta.label}</h4>
                                    <p className="text-sm text-gray-500 mb-2">{meta.description}</p>
                                    <div className="flex gap-3 flex-wrap">
                                      <Badge className="bg-red-600">{displayTeamAName}: {countA}x</Badge>
                                      <Badge className="bg-blue-600">{displayTeamBName}: {countB}x</Badge>
                                      {successRate !== null && (
                                        <Badge className="bg-green-600">
                                          {successRate}% erfolgreich ({goals}/{rated} Angriffe → Tor)
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-4">
                                    <div>
                                      <div className="text-4xl font-bold text-orange-600">{total}</div>
                                      <div className="text-sm text-gray-500">Szenen ansehen</div>
                                    </div>
                                    <ChevronDown className="w-5 h-5 text-orange-400 -rotate-90" />
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        {data.offensivePlays.map((play, index) => (
                          <motion.div
                            key={index}
                            className="p-5 rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-white hover:shadow-lg transition-all"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="text-xl font-bold text-orange-700 mb-2">{play.play}</h4>
                                <div className="flex gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Häufigkeit:</span>
                                    <Badge className="bg-orange-600">{play.frequency}x</Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Erfolgsquote:</span>
                                    <Badge className="bg-green-600">{play.successRate}%</Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-4xl font-bold text-orange-600">{play.frequency}</div>
                                <div className="text-sm text-gray-500">Gesamt</div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="shots" className="mt-6 space-y-6">
            {/* Work-in-Progress Hinweis */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-amber-600 text-xl">⚙️</span>
              <div>
                <p className="font-semibold text-amber-800">Work in Progress</p>
                <p className="text-sm text-amber-700">
                  Dieser Tab zeigt aktuell synthetische Beispieldaten aus einer CSV.
                  Die finale Implementierung wird die Daten aus der DuckDB-Datenbank laden.
                </p>
              </div>
            </div>

            <Card className="shadow-xl border-2 border-blue-200">
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Target className="w-6 h-6 text-blue-600" />
                  Abschlussaktionen nach Position
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                    <h4 className="text-lg font-bold mb-4 text-blue-700">Rückraum</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Versuche:</span>
                        <span className="font-bold">{data.shotPositions.rueckraum.attempts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tore:</span>
                        <span className="font-bold text-green-600">{data.shotPositions.rueckraum.goals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quote:</span>
                        <Badge className="bg-green-600">
                          {((data.shotPositions.rueckraum.goals / data.shotPositions.rueckraum.attempts) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                    <h4 className="text-lg font-bold mb-4 text-blue-700">Kreis</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Versuche:</span>
                        <span className="font-bold">{data.shotPositions.kreis.attempts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tore:</span>
                        <span className="font-bold text-green-600">{data.shotPositions.kreis.goals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quote:</span>
                        <Badge className="bg-green-600">
                          {((data.shotPositions.kreis.goals / data.shotPositions.kreis.attempts) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                    <h4 className="text-lg font-bold mb-4 text-blue-700">Außen Links</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Versuche:</span>
                        <span className="font-bold">{data.shotPositions.aussenLinks.attempts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tore:</span>
                        <span className="font-bold text-green-600">{data.shotPositions.aussenLinks.goals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quote:</span>
                        <Badge className="bg-green-600">
                          {((data.shotPositions.aussenLinks.goals / data.shotPositions.aussenLinks.attempts) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                    <h4 className="text-lg font-bold mb-4 text-blue-700">Außen Rechts</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Versuche:</span>
                        <span className="font-bold">{data.shotPositions.aussenRechts.attempts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tore:</span>
                        <span className="font-bold text-green-600">{data.shotPositions.aussenRechts.goals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quote:</span>
                        <Badge className="bg-green-600">
                          {((data.shotPositions.aussenRechts.goals / data.shotPositions.aussenRechts.attempts) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Wurf-Karte: mini SVG court with throw positions + tooltip */}
            <Card className="shadow-xl border-2 border-blue-200">
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Crosshair className="w-6 h-6 text-blue-600" />
                  Wurf-Positionen auf dem Feld
                </h3>
                <div className="flex justify-center relative">
                  <svg viewBox="0 0 1000 500" className="w-full max-w-2xl" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))' }}>
                    {/* Court surface */}
                    <rect x="40" y="40" width="920" height="420" fill="#e8f5e9" stroke="#2e7d32" strokeWidth="3" rx="4" />
                    {/* Center line */}
                    <line x1="500" y1="40" x2="500" y2="460" stroke="#2e7d32" strokeWidth="2" strokeDasharray="8,4" />
                    {/* Center circle */}
                    <circle cx="500" cy="250" r="60" fill="none" stroke="#2e7d32" strokeWidth="2" />
                    {/* Left goal (6m arc) */}
                    <path d="M 40 160 A 60 60 0 0 1 40 340" fill="none" stroke="#2e7d32" strokeWidth="2" />
                    {/* Left goal (9m dashed) */}
                    <path d="M 40 110 A 90 90 0 0 1 40 390" fill="none" stroke="#2e7d32" strokeWidth="2" strokeDasharray="6,4" />
                    {/* Right goal (6m arc) */}
                    <path d="M 960 160 A 60 60 0 0 0 960 340" fill="none" stroke="#2e7d32" strokeWidth="2" />
                    {/* Right goal (9m dashed) */}
                    <path d="M 960 110 A 90 90 0 0 0 960 390" fill="none" stroke="#2e7d32" strokeWidth="2" strokeDasharray="6,4" />
                    {/* Goals */}
                    <rect x="20" y="210" width="20" height="80" fill="#1565c0" rx="2" />
                    <rect x="960" y="210" width="20" height="80" fill="#1565c0" rx="2" />

                    {/* Throw positions */}
                    {data.throws.map((t, i) => {
                      const svgX = 40 + (t.court_x / 40) * 920;
                      const svgY = 40 + (t.court_y / 20) * 420;
                      const isGoal = t.is_goal;
                      return (
                        <g key={i}>
                          <circle
                            cx={svgX} cy={svgY} r="14"
                            fill={isGoal ? '#16a34a' : '#dc2626'}
                            stroke="#fff" strokeWidth="3"
                            opacity={hoveredThrow === t ? "1" : "0.85"}
                            style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                            onMouseMove={(e) => {
                              const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
                              setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                              setHoveredThrow(t);
                            }}
                            onMouseLeave={() => setHoveredThrow(null)}
                          />
                        </g>
                      );
                    })}

                    {/* Legend */}
                    <g transform="translate(760, 16)">
                      <circle cx="0" cy="0" r="8" fill="#16a34a" stroke="#fff" strokeWidth="2" />
                      <text x="14" y="4" fontSize="13" fill="#374151">Tor</text>
                      <circle cx="80" cy="0" r="8" fill="#dc2626" stroke="#fff" strokeWidth="2" />
                      <text x="94" y="4" fontSize="13" fill="#374151">Fehlwurf</text>
                    </g>
                  </svg>

                  {/* Floating tooltip */}
                  {hoveredThrow && (
                    <div
                      className="absolute pointer-events-none bg-gray-900 text-white text-sm rounded-lg px-4 py-3 shadow-xl z-10"
                      style={{
                        left: tooltipPos.x + 16,
                        top: tooltipPos.y - 10,
                        minWidth: 180,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${hoveredThrow.is_goal ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="font-bold">{hoveredThrow.is_goal ? 'Tor' : 'Fehlwurf'}</span>
                      </div>
                      <div className="space-y-0.5 text-gray-300 text-xs">
                        <div>Spieler: <span className="text-white font-medium">#{hoveredThrow.track_id}</span></div>
                        <div>Team: <span className="text-white font-medium">Team {hoveredThrow.team}</span></div>
                        <div>Wurfart: <span className="text-white font-medium">{hoveredThrow.throw_type}</span></div>
                        <div>Position: <span className="text-white font-medium">({hoveredThrow.court_x.toFixed(1)}, {hoveredThrow.court_y.toFixed(1)})</span></div>
                        <div>Frame: <span className="text-white font-medium">#{hoveredThrow.frame_id}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Wurf-Typen + Spieler-Aufteilung */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-xl border-2 border-blue-200">
                <div className="p-8">
                  <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Wurfarten
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      const typeCount = new Map<string, { total: number; goals: number }>();
                      for (const t of data.throws) {
                        const cur = typeCount.get(t.throw_type) || { total: 0, goals: 0 };
                        cur.total++;
                        if (t.is_goal) cur.goals++;
                        typeCount.set(t.throw_type, cur);
                      }
                      const sorted = [...typeCount.entries()].sort((a, b) => b[1].total - a[1].total);
                      const maxTotal = sorted[0]?.[1].total || 1;
                      return sorted.map(([type, stats]) => (
                        <div key={type}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{type}</span>
                            <span className="text-gray-500">{stats.goals}/{stats.total} ({stats.total > 0 ? Math.round(stats.goals / stats.total * 100) : 0}%)</span>
                          </div>
                          <div className="flex gap-0.5 h-5 rounded-full overflow-hidden">
                            <div
                              className="bg-green-500 transition-all"
                              style={{ width: `${(stats.goals / maxTotal) * 100}%` }}
                            />
                            <div
                              className="bg-red-400 transition-all"
                              style={{ width: `${((stats.total - stats.goals) / maxTotal) * 100}%` }}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </Card>

              <Card className="shadow-xl border-2 border-blue-200">
                <div className="p-8">
                  <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Würfe pro Spieler
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-blue-200 bg-blue-50">
                          <th className="text-left py-2 px-2 font-bold">Spieler</th>
                          <th className="text-center py-2 px-2 font-bold">Team</th>
                          <th className="text-center py-2 px-2 font-bold">Würfe</th>
                          <th className="text-center py-2 px-2 font-bold">Tore</th>
                          <th className="text-center py-2 px-2 font-bold">Quote</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const trackMap = new Map<number, { name: string; team: string; throws: number; goals: number }>();
                          for (const ps of data.playerStats) {
                            trackMap.set(ps.id, { name: ps.name, team: ps.team, throws: 0, goals: 0 });
                          }
                          for (const t of data.throws) {
                            if (trackMap.has(t.track_id)) {
                              const cur = trackMap.get(t.track_id)!;
                              cur.throws++;
                              if (t.is_goal) cur.goals++;
                            } else {
                              trackMap.set(t.track_id, {
                                name: `#${t.track_id}`,
                                team: t.team,
                                throws: 1,
                                goals: t.is_goal ? 1 : 0,
                              });
                            }
                          }
                          const sorted = [...trackMap.entries()]
                            .filter(([_, v]) => v.throws > 0)
                            .sort((a, b) => b[1].throws - a[1].throws);
                          return sorted.map(([_id, p], i) => (
                            <motion.tr
                              key={_id}
                              className="border-b hover:bg-blue-50 transition-colors"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                            >
                              <td className="py-2 px-2 font-semibold">{p.name}</td>
                              <td className="text-center py-2 px-2">
                                <Badge className={p.team === 'A' ? 'bg-red-500' : 'bg-blue-500'}>
                                  Team {p.team}
                                </Badge>
                              </td>
                              <td className="text-center py-2 px-2">{p.throws}</td>
                              <td className="text-center py-2 px-2 text-green-600 font-bold">{p.goals}</td>
                              <td className="text-center py-2 px-2">
                                <Badge className={p.throws > 0 && p.goals / p.throws >= 0.5 ? 'bg-green-600' : 'bg-orange-500'}>
                                  {p.throws > 0 ? Math.round(p.goals / p.throws * 100) : 0}%
                                </Badge>
                              </td>
                            </motion.tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="players" className="mt-6">
            <Card className="shadow-xl border-2 border-sky-200">
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-sky-600" />
                  {realStats?.player_stats.length ? 'Spieler-Tracking' : 'Top Spieler'}
                  {!(realStats && realStats.player_stats.length > 0) && <DemoBadge />}
                </h3>
                {realStats && realStats.player_stats.length > 0 ? (
                  <InfoBanner>
                    Das System verfolgt jede Person als eigenen <strong>Track</strong>. Durch Kameraschnitte,
                    Verdeckungen und Auswechslungen entstehen normalerweise <strong>mehr Tracks als Spieler</strong> –
                    das ist erwartetes Verhalten und kein Fehler. Auf dem Feld stehen pro Team 7 Spieler.
                    Unten sehen Sie die langlebigsten Tracks (sortiert nach sichtbaren Frames).
                  </InfoBanner>
                ) : (
                  <p className="text-gray-600 mb-6">Beispielhafte Spielerstatistiken – zeigt, wie diese Tabelle künftig aussieht.</p>
                )}
                <div className="overflow-x-auto">
                  {realStats && realStats.player_stats.length > 0 ? (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-sky-200 bg-sky-50">
                          <th className="text-left py-4 px-4 font-bold">Track-ID</th>
                          <th className="text-center py-4 px-4 font-bold">Team</th>
                          <th className="text-center py-4 px-4 font-bold">Frames sichtbar</th>
                          <th className="text-center py-4 px-4 font-bold">Ø Konfidenz</th>
                          <th className="text-center py-4 px-4 font-bold">Distanz (m)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realStats.player_stats.map((player, index) => (
                          <motion.tr
                            key={player.track_id}
                            className="border-b hover:bg-sky-50 transition-colors"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <td className="py-4 px-4 font-semibold">#{player.track_id}</td>
                            <td className="text-center py-4 px-4">
                              <Badge className={player.team === 'A' ? 'bg-red-500' : player.team === 'B' ? 'bg-blue-500' : 'bg-gray-500'}>
                                {player.team ? `Team ${player.team}` : '—'}
                              </Badge>
                            </td>
                            <td className="text-center py-4 px-4">{player.frame_count.toLocaleString()}</td>
                            <td className="text-center py-4 px-4">{player.avg_confidence_pct.toFixed(1)}%</td>
                            <td className="text-center py-4 px-4">{player.distance_m.toFixed(1)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-sky-200 bg-sky-50">
                          <th className="text-left py-4 px-4 font-bold">Spieler</th>
                          <th className="text-center py-4 px-4 font-bold">Team</th>
                          <th className="text-center py-4 px-4 font-bold">Würfe</th>
                          <th className="text-center py-4 px-4 font-bold">Tore</th>
                          <th className="text-center py-4 px-4 font-bold">Assists</th>
                          <th className="text-center py-4 px-4 font-bold">Distanz (m)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.playerStats.map((player, index) => (
                          <motion.tr
                            key={player.id}
                            className="border-b hover:bg-sky-50 transition-colors"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <td className="py-4 px-4 font-semibold">{player.name}</td>
                            <td className="text-center py-4 px-4">
                              <Badge className={player.team === 'A' ? 'bg-red-500' : 'bg-blue-500'}>
                                Team {player.team}
                              </Badge>
                            </td>
                            <td className="text-center py-4 px-4">{player.shots}</td>
                            <td className="text-center py-4 px-4">
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                                {player.goals}
                              </span>
                            </td>
                            <td className="text-center py-4 px-4">{player.assists}</td>
                            <td className="text-center py-4 px-4">{player.distance.toFixed(0)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="heatmap" className="mt-6">
            {heatmapLeft || heatmapRight ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-fit">
                    <button
                      type="button"
                      onClick={() => setHeatmapMode('density')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                        heatmapMode === 'density'
                          ? 'bg-sky-600 text-white shadow'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Dichte-Heatmap
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeatmapMode('tiles')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                        heatmapMode === 'tiles'
                          ? 'bg-sky-600 text-white shadow'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Kachel-Heatmap
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {teamPhases.length > 0 && (
                      <select
                        className="text-sm rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        value={selectedPhaseId ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedPhaseId(val ? Number(val) : null);
                        }}
                      >
                        <option value="">Gesamtübersicht</option>
                        {teamPhases.map((ph, i) => {
                          const label = `Phase #${i + 1}: ${ph.offense_team === 'A' ? displayTeamAName : displayTeamBName} Angriff (${formatSceneTime(ph.start_time_s)} – ${formatSceneTime(ph.end_time_s)})`;
                          return (
                            <option key={ph.phase_id} value={ph.phase_id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    )}

                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 font-medium">Perspektive:</span>
                  <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
                    {(['offense', 'defense', 'both'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPerspective(p)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                          perspective === p
                            ? 'bg-sky-600 text-white shadow'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p === 'offense' ? 'Angriff' : p === 'defense' ? 'Abwehr' : 'Beide'}
                      </button>
                    ))}
                  </div>
                </div>

                {teamPhases.length > 1 && (
                  <PhaseTimeline
                    phases={teamPhases}
                    selectedPhaseId={selectedPhaseId}
                    onSelectPhase={setSelectedPhaseId}
                    teamAName={displayTeamAName}
                    teamBName={displayTeamBName}
                  />
                )}

                {availableTrackIds.length > 0 && (
                  (() => {
                    const byTeam = { A: availableTrackIds.filter(t => t.team === 'A'), B: availableTrackIds.filter(t => t.team === 'B'), U: availableTrackIds.filter(t => t.team === 'U') };
                    const teamACount = byTeam.A.length;
                    const teamBCount = byTeam.B.length;
                    const teamUCount = byTeam.U.length;
                    const teamASelected = selectedTrackIds.filter(id => byTeam.A.some(t => t.track_id === id)).length;
                    const teamBSelected = selectedTrackIds.filter(id => byTeam.B.some(t => t.track_id === id)).length;
                    const teamUSelected = selectedTrackIds.filter(id => byTeam.U.some(t => t.track_id === id)).length;
                    return (
                      <Card className="border border-slate-200">
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-700">
                              Spieler filtern
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedTrackIds(availableTrackIds.map(t => t.track_id))}
                                className="text-xs px-2 py-1 rounded bg-sky-600 text-white hover:bg-sky-700 transition"
                              >
                                Alle
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedTrackIds([])}
                                className="text-xs px-2 py-1 rounded bg-slate-300 text-slate-700 hover:bg-slate-400 transition"
                              >
                                Keine
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {teamACount > 0 && (
                              <div className="border border-red-200 rounded-lg p-2 bg-red-50/50">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-bold text-red-700">{displayTeamAName}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allA = byTeam.A.map(t => t.track_id);
                                      const allSelected = allA.every(id => selectedTrackIds.includes(id));
                                      setSelectedTrackIds(prev =>
                                        allSelected ? prev.filter(id => !allA.includes(id)) : [...new Set([...prev, ...allA])]
                                      );
                                    }}
                                    className="text-[11px] text-red-600 underline hover:text-red-800"
                                  >
                                    {teamASelected === teamACount ? 'alle abwählen' : 'alle wählen'}
                                  </button>
                                </div>
                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                                  {byTeam.A.map(t => {
                                    const checked = selectedTrackIds.includes(t.track_id);
                                    return (
                                      <label key={t.track_id} className="flex items-start gap-1.5 text-xs text-slate-700 cursor-pointer hover:bg-red-100/50 rounded px-1 py-0.5">
                                        <input
                                          type="checkbox"
                                          className="mt-0.5 h-3.5 w-3.5 rounded border-red-300 text-red-600 focus:ring-red-500 shrink-0"
                                          checked={checked}
                                          onChange={() => setSelectedTrackIds(prev =>
                                            checked ? prev.filter(id => id !== t.track_id) : [...prev, t.track_id]
                                          )}
                                        />
                                        <span className="leading-tight">
                                          <span className="font-medium">#{t.track_id}</span>
                                          <span className="text-[10px] text-slate-500 block">
                                            {formatSceneTime(t.first_time_s)}–{formatSceneTime(t.last_time_s)}
                                            <span className="ml-1">({t.frame_count}x)</span>
                                          </span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {teamBCount > 0 && (
                              <div className="border border-blue-200 rounded-lg p-2 bg-blue-50/50">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-bold text-blue-700">{displayTeamBName}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allB = byTeam.B.map(t => t.track_id);
                                      const allSelected = allB.every(id => selectedTrackIds.includes(id));
                                      setSelectedTrackIds(prev =>
                                        allSelected ? prev.filter(id => !allB.includes(id)) : [...new Set([...prev, ...allB])]
                                      );
                                    }}
                                    className="text-[11px] text-blue-600 underline hover:text-blue-800"
                                  >
                                    {teamBSelected === teamBCount ? 'alle abwählen' : 'alle wählen'}
                                  </button>
                                </div>
                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                                  {byTeam.B.map(t => {
                                    const checked = selectedTrackIds.includes(t.track_id);
                                    return (
                                      <label key={t.track_id} className="flex items-start gap-1.5 text-xs text-slate-700 cursor-pointer hover:bg-blue-100/50 rounded px-1 py-0.5">
                                        <input
                                          type="checkbox"
                                          className="mt-0.5 h-3.5 w-3.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                          checked={checked}
                                          onChange={() => setSelectedTrackIds(prev =>
                                            checked ? prev.filter(id => id !== t.track_id) : [...prev, t.track_id]
                                          )}
                                        />
                                        <span className="leading-tight">
                                          <span className="font-medium">#{t.track_id}</span>
                                          <span className="text-[10px] text-slate-500 block">
                                            {formatSceneTime(t.first_time_s)}–{formatSceneTime(t.last_time_s)}
                                            <span className="ml-1">({t.frame_count}x)</span>
                                          </span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          {teamUCount > 0 && (
                            <div className="mt-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-600">Unbekanntes Team</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allU = byTeam.U.map(t => t.track_id);
                                    const allSelected = allU.every(id => selectedTrackIds.includes(id));
                                    setSelectedTrackIds(prev =>
                                      allSelected ? prev.filter(id => !allU.includes(id)) : [...new Set([...prev, ...allU])]
                                    );
                                  }}
                                  className="text-[11px] text-slate-500 underline hover:text-slate-700"
                                >
                                  {teamUSelected === teamUCount ? 'alle abwählen' : 'alle wählen'}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {byTeam.U.map(t => {
                                  const checked = selectedTrackIds.includes(t.track_id);
                                  return (
                                    <label key={t.track_id} className="flex items-start gap-1 text-xs text-slate-600 cursor-pointer hover:bg-slate-100 rounded px-1.5 py-0.5">
                                      <input
                                        type="checkbox"
                                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-500 focus:ring-slate-400 shrink-0"
                                        checked={checked}
                                        onChange={() => setSelectedTrackIds(prev =>
                                          checked ? prev.filter(id => id !== t.track_id) : [...prev, t.track_id]
                                        )}
                                      />
                                      <span className="leading-tight">
                                        <span className="font-medium">#{t.track_id}</span>
                                        <span className="text-[10px] text-slate-400 block">
                                          {formatSceneTime(t.first_time_s)}–{formatSceneTime(t.last_time_s)}
                                        </span>
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })()
                )}

                {heatmapMode === 'density' ? (
                  <Card className="shadow-xl border-2 border-slate-200">
                    <div className="p-6 space-y-3">
                      <h3 className="text-xl font-bold">Dichte-Heatmap auf 2D-Feld</h3>
                      <p className="text-sm text-slate-600">
                        Farbton zeigt Teamdominanz, Helligkeit die Aktivitaetsdichte pro Bereich.
                      </p>

                      {!heatmapLoading && heatmapPoints !== null && heatmapPoints.length < 10 && selectedTrackIds.length > 0 && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                          Der ausgewählte Spieler hat nur <strong>{heatmapPoints.length}</strong> Datenpunkt{heatmapPoints.length === 1 ? '' : 'e'} in der Heatmap
                          (benötigt werden ~1000 Frames für eine aussagekräftige Dichte-Darstellung).
                          Das Sampling (<code className="text-xs bg-amber-100 px-1 rounded">frame_id % 100</code>) reduziert die Datenmenge.
                        </div>
                      )}

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                        <svg viewBox="0 0 1000 500" className="w-full h-auto">
                          <defs>
                            <filter id="density-blur" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur stdDeviation="28" />
                            </filter>
                          </defs>

                          {/* Court surface */}
                          <rect x={COURT_X} y={COURT_Y} width={COURT_W} height={COURT_H} rx="6" fill="#e8f0e8" stroke="#64748b" strokeWidth="3" />

                          {densityGridCells.map(cell => (
                            <rect
                              key={cell.key}
                              x={cell.x}
                              y={cell.y}
                              width={cell.w + 0.6}
                              height={cell.h + 0.6}
                              fill={getDensityZoneColor(cell.shares)}
                              opacity={cell.opacity}
                            />
                          ))}

                          {/* Center line */}
                          <line x1="500" y1="40" x2="500" y2="460" stroke="#94a3b8" strokeWidth="2" strokeDasharray="10 8" />
                          {/* Center circle */}
                          <circle cx="500" cy="250" r="42" fill="none" stroke="#94a3b8" strokeWidth="2" />

                          {/* Goals */}
                          <rect x="28" y="218.5" width="12" height="63" rx="2" fill="none" stroke="#475569" strokeWidth="3" />
                          <rect x="960" y="218.5" width="12" height="63" rx="2" fill="none" stroke="#475569" strokeWidth="3" />

                          {/* 6m line — Torraum */}
                          <g stroke="#475569" strokeWidth="2.5" fill="none">
                            <path d="M 40 92.5 A 138 126 0 0 1 178 218.5" />
                            <path d="M 178 281.5 A 138 126 0 0 1 40 407.5" />
                            <line x1="178" y1="218.5" x2="178" y2="281.5" />
                            <path d="M 960 92.5 A 138 126 0 0 0 822 218.5" />
                            <path d="M 822 281.5 A 138 126 0 0 0 960 407.5" />
                            <line x1="822" y1="218.5" x2="822" y2="281.5" />
                          </g>

                          {/* 9m line — Freiwurflinie (dashed) */}
                          <g stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeDasharray="6,5">
                            <path d="M 108 40 A 207 189 0 0 1 247 218.5" />
                            <path d="M 247 281.5 A 207 189 0 0 1 108 460" />
                            <line x1="247" y1="218.5" x2="247" y2="281.5" />
                            <path d="M 753 218.5 A 207 189 0 0 1 892 40" />
                            <path d="M 892 460 A 207 189 0 0 1 753 281.5" />
                            <line x1="753" y1="218.5" x2="753" y2="281.5" />
                          </g>

                          {/* 7m marks */}
                          <g stroke="#64748b" strokeWidth="2">
                            <line x1="201" y1="239.5" x2="201" y2="260.5" />
                            <line x1="799" y1="239.5" x2="799" y2="260.5" />
                          </g>

                          {/* 4m dots */}
                          <g fill="#64748b">
                            <circle cx="132" cy="250" r="3" />
                            <circle cx="868" cy="250" r="3" />
                          </g>

                          <g filter="url(#density-blur)">
                            {densityCloudPoints.map(point => (
                              <circle
                                key={point.key}
                                cx={point.x}
                                cy={point.y}
                                r={24 + (point.intensity / 100) * 48}
                                fill={getDensityZoneColor(point.shares)}
                                opacity={0.12 + (point.intensity / 100) * 0.5}
                              />
                            ))}
                          </g>
                        </svg>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-red-700">{displayTeamAName}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-700">{displayTeamBName}</span>
                        {showUnassignedInHeatmap && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-slate-700">Nicht zugeordnet</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[
                  { title: 'Linke Spielfeldhälfte', data: heatmapLeft, color: 'sky', dominanceByZone: leftDominanceByZone },
                  { title: 'Rechte Spielfeldhälfte', data: heatmapRight, color: 'orange', dominanceByZone: rightDominanceByZone },
                ].map(({ title, data: zones, color, dominanceByZone }) => (
                  <Card key={title} className={`shadow-xl border-2 border-${color}-200`}>
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-4">{title}</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {(zones ?? []).map((z, i) => (
                          <motion.div
                            key={z.zone}
                            className="p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 shadow-md hover:shadow-xl transition-all"
                            style={getHeatmapTileStyle(
                              z.intensity,
                              dominanceByZone.get(z.zone)?.dominance,
                              dominanceByZone.get(z.zone)?.shares
                            )}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.08 }}
                            whileHover={{ scale: 1.05 }}
                          >
                            <MapPin className="w-5 h-5" />
                            <p className="font-bold text-sm text-center">{z.label}</p>
                            <p className="text-lg font-bold">{z.intensity}%</p>
                            {typeof dominanceByZone.get(z.zone)?.dominance === 'number' && (
                              <p className="text-xs font-semibold opacity-90">
                                {dominanceByZone.get(z.zone)!.dominance > 0.08
                                  ? `${displayTeamBName} dominiert`
                                  : dominanceByZone.get(z.zone)!.dominance < -0.08
                                    ? `${displayTeamAName} dominiert`
                                    : 'Ausgeglichen'}
                              </p>
                            )}
                            {showUnassignedInHeatmap && (
                              <p className="text-[11px] font-medium opacity-85">Grau: ohne Teamzuordnung</p>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
                </div>
                )}

                {heatmapMode === 'density' && (() => {
                  const sliderPhase = selectedPhaseId !== null
                    ? teamPhases.find(p => p.phase_id === selectedPhaseId)
                    : null;
                  const sliderMin = sliderPhase?.start_time_s ?? 0;
                  const sliderMax = sliderPhase?.end_time_s ?? realStats?.duration_seconds ?? 0;
                  const defaultRange: [number, number] = [sliderMin, sliderMax];
                  const currentRange = windowRange ?? defaultRange;
                  return (
                    <Card className="border border-slate-200">
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 font-medium">Zeitfenster</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs">
                              {formatSceneTime(currentRange[0])} – {formatSceneTime(currentRange[1])}
                            </span>
                            {windowRange !== null && (
                              <button
                                type="button"
                                onClick={() => setWindowRange(null)}
                                className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition"
                              >
                                Zurücksetzen
                              </button>
                            )}
                          </div>
                        </div>
                        <Slider
                          value={currentRange}
                          onValueChange={([s, e]) => setWindowRange([s, e])}
                          min={sliderMin}
                          max={Math.max(sliderMin, sliderMax)}
                          step={0.5}
                        />
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{formatSceneTime(sliderMin)}</span>
                          <span>{formatSceneTime(sliderMax)}</span>
                        </div>
                        <div className="flex items-center gap-4 pt-1">
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-slate-500">Start:</label>
                            <input
                              type="number"
                              className="w-20 text-xs rounded border border-slate-300 px-2 py-1 text-slate-700"
                              value={Math.round(currentRange[0] * 10) / 10}
                              min={sliderMin}
                              max={currentRange[1]}
                              step={0.5}
                              onChange={e => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v < currentRange[1]) {
                                  setWindowRange([v, currentRange[1]]);
                                }
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-slate-500">Ende:</label>
                            <input
                              type="number"
                              className="w-20 text-xs rounded border border-slate-300 px-2 py-1 text-slate-700"
                              value={Math.round(currentRange[1] * 10) / 10}
                              min={currentRange[0]}
                              max={sliderMax}
                              step={0.5}
                              onChange={e => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v > currentRange[0]) {
                                  setWindowRange([currentRange[0], v]);
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })()}

                {selectedPhaseId !== null && matchId && (
                  (() => {
                    const ph = teamPhases.find(p => p.phase_id === selectedPhaseId);
                    if (!ph) return null;
                    const label = `${ph.offense_team === 'A' ? displayTeamAName : displayTeamBName} Angriff`;
                    return (
                      <PhaseVideoPlayer key={ph.phase_id} matchId={matchId} phase={ph} teamLabel={label} />
                    );
                  })()
                )}
              </div>
            ) : (
              <Card className="shadow-xl border-2 border-orange-200">
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    Aktivitäts-Heatmap
                    <DemoBadge />
                  </h3>
                  <DemoBanner>
                    Für dieses Match liegen noch keine berechneten Positionsdaten vor – die Heatmap zeigt
                    <strong> Beispielwerte</strong>.
                  </DemoBanner>
                  <div className="grid grid-cols-3 gap-6">
                    {data.heatmapData.map((zone, index) => (
                      <motion.div
                        key={index}
                        className="p-8 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-2xl transition-all"
                        style={getHeatmapTileStyle(zone.intensity)}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                      >
                        <MapPin className="w-8 h-8" />
                        <p className="font-bold text-lg text-center">{zone.zone}</p>
                        <p className="text-2xl font-bold">{zone.intensity}%</p>
                        <p className="text-sm">Aktivität</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {showOutputVideoTab && (
            <TabsContent value="output" className="mt-6">
              <OutputVideoTab
                matchId={matchId}
                teamAName={displayTeamAName}
                teamBName={displayTeamBName}
                status={outputVideoStatus}
                videoPath={outputVideoPath}
              />
            </TabsContent>
          )}
        </Tabs>
      </motion.div>
    </motion.div>
  );
}