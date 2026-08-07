import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Upload, BarChart3, Calendar, Clock, Search, Filter, Video, Activity, Pencil, X, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import logoImg from '../../imports/Logo.png';
import { fetchMatches, fetchLatestScore, patchMatch, deleteMatch, MatchMeta, MatchStatus } from './api';
import { ModelQualityDialog } from './ModelQualityDialog';


interface DashboardProps {
  onNewUpload: () => void;
  onViewMatch: (matchId: string, data: any, fileName: string) => void;
}

type DashboardMatch = {
  id: string;
  fileName: string;
  displayName: string;
  date: string;
  duration: string;
  status: MatchStatus;
  thumbnail: string;
  teams: {
    teamA: string;
    teamB: string;
    score: string;
  };
  scoreLatest: { home: number | null; away: number | null } | null;
};

function withTeamNameFallback(name: string | undefined, fallback: 'Team A' | 'Team B'): string {
  return name?.trim() || fallback;
}

function replaceTeamPlaceholders(description: string, teamAName: string, teamBName: string): string {
  return description
    .replaceAll('Team A', teamAName)
    .replaceAll('Team B', teamBName);
}

function mapApiMatchToDashboard(m: MatchMeta): DashboardMatch {
  return {
    id: m.match_id,
    fileName: m.file_name || m.match_id,
    displayName: m.display_name || '',
    date: m.date || '',
    duration: m.duration || '',
    status: m.status,
    thumbnail: `${import.meta.env.VITE_BACKEND_URL || ''}/api/v1/matches/${m.match_id}/thumbnail`,
    teams: { teamA: m.team_a_name || '', teamB: m.team_b_name || '', score: '' },
    scoreLatest: null,
  };
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
    const trimmed = draft.trim();
    onSave(trimmed);
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
      <span className="inline-flex items-center gap-1 z-10" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          onBlur={() => { if (!cancelledRef.current) commit(); }}
          className="text-sm border border-sky-400 rounded px-1 py-0.5 bg-white text-gray-900 outline-none w-36"
        />
        <button
          onMouseDown={e => { e.preventDefault(); cancel(e); }}
          className="text-red-500 hover:text-red-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 cursor-pointer ${textClassName}`}
      onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      title="Klicken zum Bearbeiten"
    >
      <span>{value || <span className="italic opacity-60">{placeholder}</span>}</span>
      <Pencil className="w-3 h-3 opacity-30 shrink-0" />
    </span>
  );
}

function generateMockAnalysis(teamAName = 'Team A', teamBName = 'Team B'): any {
  const displayTeamAName = withTeamNameFallback(teamAName, 'Team A');
  const displayTeamBName = withTeamNameFallback(teamBName, 'Team B');

  return {
    duration: 3247,
    playersDetected: 14,
    totalShots: 42,
    successfulShots: 28,
    framesExtracted: 97410,
    ballDetectionRate: 94.3,
    teamAName: displayTeamAName,
    teamBName: displayTeamBName,
    possession: {
      teamA: 58,
      teamB: 42,
    },
    defensiveFormations: [
      { formation: '6-0', frequency: 42, successRate: 67 },
      { formation: '5-1', frequency: 28, successRate: 71 },
      { formation: '3-2-1', frequency: 15, successRate: 58 },
    ],
    offensivePlays: [
      { play: 'Kreuzen', frequency: 24, successRate: 62 },
      { play: 'Parallelstoß', frequency: 18, successRate: 55 },
      { play: 'Kempa-Trick', frequency: 8, successRate: 75 },
      { play: 'Konter', frequency: 16, successRate: 81 },
    ],
    shotPositions: {
      rueckraum: { attempts: 26, goals: 18 },
      kreis: { attempts: 12, goals: 8 },
      aussenLinks: { attempts: 4, goals: 2 },
      aussenRechts: { attempts: 4, goals: 2 },
    },
    playerStats: [
      { id: 7, name: 'Spieler #7', shots: 12, goals: 8, assists: 3, distance: 2847, team: 'A' },
      { id: 13, name: 'Spieler #13', shots: 9, goals: 7, assists: 5, distance: 3124, team: 'A' },
      { id: 21, name: 'Spieler #21', shots: 8, goals: 5, assists: 2, distance: 2653, team: 'B' },
      { id: 4, name: 'Spieler #4', shots: 6, goals: 4, assists: 4, distance: 2891, team: 'A' },
      { id: 18, name: 'Spieler #18', shots: 7, goals: 4, assists: 1, distance: 2447, team: 'B' },
    ],
    throws: [
      { frame_id: 100, track_id: 417, team: 'B', court_x: 16.2, court_y: 9.8, is_goal: false, throw_type: 'Sprungwurf' },
      { frame_id: 250, track_id: 285, team: 'B', court_x: 9.5, court_y: 2.1, is_goal: true, throw_type: 'Durchbruch' },
      { frame_id: 750, track_id: 338, team: 'A', court_x: 14.3, court_y: 13.5, is_goal: false, throw_type: 'Sprungwurf' },
      { frame_id: 820, track_id: 903, team: 'A', court_x: 5.8, court_y: 9.2, is_goal: true, throw_type: 'Dreher' },
      { frame_id: 920, track_id: 619, team: 'A', court_x: 15.8, court_y: 14.7, is_goal: true, throw_type: 'Sprungwurf' },
      { frame_id: 1050, track_id: 629, team: 'A', court_x: 9.2, court_y: 3.8, is_goal: false, throw_type: 'Kempa' },
      { frame_id: 1150, track_id: 658, team: 'A', court_x: 5.1, court_y: 10.8, is_goal: true, throw_type: 'Aufsetzer' },
    ],
    events: [
      { time: '02:34', type: 'goal', description: 'Tor durch Spieler #7 - Sprungwurf aus 8m' },
      { time: '05:12', type: 'save', description: 'Parade des Torwarts - Wurf von Spieler #13' },
      { time: '08:45', type: 'goal', description: 'Tor durch Spieler #21 - Durchbruch und Abschluss' },
      { time: '12:23', type: 'penalty', description: replaceTeamPlaceholders('7-Meter für Team A - Foul erkannt', displayTeamAName, displayTeamBName) },
      { time: '15:56', type: 'goal', description: 'Tor durch Spieler #13 - Kempa-Trick erfolgreich' },
      { time: '19:34', type: 'timeout', description: replaceTeamPlaceholders('Team-Timeout Team B', displayTeamAName, displayTeamBName) },
      { time: '23:17', type: 'goal', description: 'Tor durch Spieler #4 - Konter abgeschlossen' },
      { time: '27:42', type: 'save', description: 'Glanzparade - Wurf von Spieler #7 gehalten' },
    ],
    heatmapData: [
      { zone: 'Links außen', intensity: 45 },
      { zone: 'Linker Rückraum', intensity: 72 },
      { zone: 'Mitte', intensity: 89 },
      { zone: 'Rechter Rückraum', intensity: 68 },
      { zone: 'Rechts außen', intensity: 51 },
      { zone: 'Kreis', intensity: 94 },
    ],
    qualityMetrics: {
      playerDetectionRate: 82,
      teamClassificationAccuracy: 87,
      formationAccuracy: 76,
      fieldDetectionConfidence: 90,
    },
  };
}

const getTeamColor = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    'Rot': 'bg-red-500',
    'Blau': 'bg-blue-500',
    'Grün': 'bg-green-500',
    'Gelb': 'bg-yellow-500',
    'Weiß': 'bg-gray-300',
    'Schwarz': 'bg-gray-900'
  };
  return colorMap[color] || 'bg-gray-500';
}


function StatusBadge({ status }: { status: MatchStatus }) {
  switch (status) {
    case 'done':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Fertig
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Verarbeitung
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Fehlgeschlagen
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Unbekannt
        </span>
      );
  }
}

export function Dashboard({ onNewUpload, onViewMatch }: DashboardProps) {

  const [matches, setMatches] = useState<DashboardMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scoreCache = useRef<Map<string, { home: number | null; away: number | null } | null>>(new Map());

  const loadMatches = useCallback(async (): Promise<DashboardMatch[]> => {
    const apiMatches = await fetchMatches();

    const newDone = apiMatches.filter(
      m => m.status === 'done' && !scoreCache.current.has(m.match_id)
    );
    await Promise.allSettled(
      newDone.map(async m => {
        const latest = await fetchLatestScore(m.match_id);
        scoreCache.current.set(
          m.match_id,
          latest ? { home: latest.score_home, away: latest.score_away } : null,
        );
      })
    );

    return apiMatches.map(m => {
      const base = mapApiMatchToDashboard(m);
      const score = scoreCache.current.get(m.match_id);
      return {
        ...base,
        scoreLatest: score !== undefined ? score : null,
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const doLoad = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const result = await loadMatches();
        if (!cancelled) { setMatches(result); setError(null); }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    doLoad(true);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    const es = new EventSource(`${backendUrl}/api/v1/status/stream`);
    es.addEventListener('status', () => { if (!cancelled) doLoad(); });
    es.onerror = () => {};

    return () => {
      cancelled = true;
      es.close();
    };
  }, [loadMatches]);

  const handlePatch = useCallback(
    async (matchId: string, data: { display_name?: string; team_a_name?: string; team_b_name?: string }) => {
      // Optimistic update
      setMatches(prev => prev.map(m => {
        if (m.id !== matchId) return m;
        return {
          ...m,
          displayName: data.display_name ?? m.displayName,
          teams: {
            ...m.teams,
            teamA: data.team_a_name ?? m.teams.teamA,
            teamB: data.team_b_name ?? m.teams.teamB,
          },
        };
      }));
      try {
        await patchMatch(matchId, data);
      } catch {
        // Revert on error by reloading
        loadMatches().then(updated => setMatches(updated)).catch(() => {});
      }
    },
    [loadMatches],
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(async (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId !== matchId) {
      setConfirmDeleteId(matchId);
      return;
    }
    setDeletingId(matchId);
    setConfirmDeleteId(null);
    try {
      await deleteMatch(matchId);
      setMatches(prev => prev.filter(m => m.id !== matchId));
    } catch {
      loadMatches().then(updated => setMatches(updated)).catch(() => {});
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteId, loadMatches]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  const totalAnalyses = matches.length;
  const totalVideoMinutes = matches
    .filter(m => m.status === 'done' && m.duration.includes(':'))
    .reduce((acc, m) => {
      const [min, sec] = m.duration.split(':').map(s => parseInt(s, 10));
      return acc + (isNaN(min) ? 0 : min) + (isNaN(sec) ? 0 : sec / 60);
    }, 0);
  const lastAnalysisDate = matches
    .filter(m => m.status === 'done' && !!m.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date ?? null;

  const filteredMatches = useMemo(() => {
    const filtered = matches.filter(match =>
      match.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.teams.teamA.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.teams.teamB.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        return a.fileName.localeCompare(b.fileName);
      }
    });

    return filtered;
  }, [matches, searchQuery, sortBy]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="SportsVision Logo" className="h-16" />
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-900 via-sky-600 to-orange-500 bg-clip-text text-transparent">
                SportsVision Analytics
              </h1>
              <p className="text-gray-600">Handball Video Intelligence Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ModelQualityDialog />
            <Button
              onClick={onNewUpload}
              className="bg-gradient-to-r from-blue-900 to-sky-600 hover:from-blue-800 hover:to-sky-500 shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              <Upload className="w-5 h-5 mr-2" />
              Neues Video hochladen
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Analysen gesamt</p>
              <p className="text-3xl font-bold text-gray-900">{totalAnalyses}</p>
            </div>
            <BarChart3 className="w-12 h-12 text-blue-900 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-sky-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Gesamte Videozeit</p>
              <p className="text-3xl font-bold text-gray-900">{Math.round(totalVideoMinutes)}<span className="text-lg text-gray-600">min</span></p>
            </div>
            <Video className="w-12 h-12 text-sky-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Letzte Analyse</p>
              <p className="text-lg font-bold text-gray-900">{lastAnalysisDate ? new Date(lastAnalysisDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) : '–'}</p>
            </div>
            <Calendar className="w-12 h-12 text-orange-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">System-Status</p>
              <p className="text-lg font-bold text-green-600">Aktiv</p>
            </div>
            <Activity className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>
      </motion.div>

      {/* Recent Matches */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Match-Historie</h2>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Suche nach Dateiname oder Team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                aria-label="Sortierung auswählen"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
              >
                <option value="date">Sortieren: Neueste zuerst</option>
                <option value="name">Sortieren: Name A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <span className="text-gray-500 text-lg">Lade Matches…</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <span className="text-red-500 text-lg">{error}</span>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Keine Matches gefunden</p>
            <p className="text-gray-400 text-sm mt-2">Versuchen Sie eine andere Suche</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((match, index) => {
            const isClickable = match.status === 'done';
            return (
            <motion.div
              key={match.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all ${
                isClickable ? 'hover:shadow-2xl cursor-pointer group' : 'opacity-80'
              }`}
              onClick={() => isClickable && onViewMatch(
                match.id,
                generateMockAnalysis(match.teams.teamA, match.teams.teamB),
                match.displayName || match.fileName,
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              whileHover={isClickable ? { scale: 1.02 } : undefined}
            >
              {/* Thumbnail */}
              <div className="relative h-40 overflow-hidden bg-gradient-to-br from-blue-900 to-sky-600">
                {match.status === 'done' ? (
                  <img
                    src={match.thumbnail}
                    alt={match.fileName}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {match.status === 'processing' && (
                      <div className="text-white/70 text-center">
                        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
                        <span className="text-sm">Wird verarbeitet…</span>
                      </div>
                    )}
                    {match.status === 'failed' && (
                      <div className="text-red-200 text-center">
                        <span className="text-3xl">✕</span>
                        <p className="text-sm mt-1">Verarbeitung fehlgeschlagen</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute top-3 right-3">
                  <StatusBadge status={match.status} />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  {isClickable ? (
                    <EditableField
                      value={match.displayName}
                      placeholder={match.fileName}
                      onSave={val => handlePatch(match.id, { display_name: val })}
                      textClassName="text-white font-semibold text-sm"
                    />
                  ) : (
                    <p className="text-white font-semibold text-sm truncate">{match.displayName || match.fileName}</p>
                  )}
                  {match.duration && (
                    <div className="flex items-center gap-1 mt-1 text-white/90 text-xs">
                      <Clock className="w-3 h-3" />
                      {match.duration}
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full bg-red-500 shrink-0"></div>
                    {isClickable ? (
                      <EditableField
                        value={match.teams.teamA}
                        placeholder="Team A"
                        onSave={val => handlePatch(match.id, { team_a_name: val })}
                        textClassName="text-sm text-gray-700"
                      />
                    ) : (
                      <span className="text-sm text-gray-700">{match.teams.teamA || 'Team A'}</span>
                    )}
                    <span className="text-xs text-gray-400 shrink-0">vs</span>
                    <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></div>
                    {isClickable ? (
                      <EditableField
                        value={match.teams.teamB}
                        placeholder="Team B"
                        onSave={val => handlePatch(match.id, { team_b_name: val })}
                        textClassName="text-sm text-gray-700"
                      />
                    ) : (
                      <span className="text-sm text-gray-700">{match.teams.teamB || 'Team B'}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{match.date ? new Date(match.date).toLocaleDateString('de-DE') : ''}</span>
                </div>

                {match.scoreLatest && (
                  <div className="mt-2 flex items-center justify-center gap-2 py-1.5 px-3 bg-gray-50 rounded-lg">
                    <span className="text-lg font-bold text-gray-900 tabular-nums">
                      {match.scoreLatest.home ?? '–'}
                    </span>
                    <span className="text-gray-400 font-medium">:</span>
                    <span className="text-lg font-bold text-gray-900 tabular-nums">
                      {match.scoreLatest.away ?? '–'}
                    </span>
                  </div>
                )}

                {/* Footer: action / status on the left, delete on the right */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {match.status === 'done' && (
                      <span className="text-sky-600 group-hover:text-sky-700">Analyse öffnen →</span>
                    )}
                    {match.status === 'processing' && (
                      <span className="text-amber-600">Pipeline läuft…</span>
                    )}
                    {match.status === 'failed' && (
                      <span className="text-red-600">Verarbeitung fehlgeschlagen</span>
                    )}
                  </div>

                  {confirmDeleteId === match.id ? (
                    <span className="flex items-center gap-2 text-sm" onClick={e => e.stopPropagation()}>
                      <span className="text-gray-600">Wirklich löschen?</span>
                      <button
                        onClick={e => handleDelete(match.id, e)}
                        className="text-red-600 font-semibold hover:text-red-700"
                      >Ja</button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="text-gray-500 hover:text-gray-700"
                      >Nein</button>
                    </span>
                  ) : (
                    <button
                      onClick={e => handleDelete(match.id, e)}
                      disabled={deletingId === match.id}
                      title="Match löschen"
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
            );
            })}
          </div>
        )}
      </motion.div>

      {/* Technology Footer */}
    </div>
  );
};