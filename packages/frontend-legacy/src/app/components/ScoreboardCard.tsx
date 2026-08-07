import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { fetchScoreboardSummary, GoalEvent, ScoreboardData } from './api';

const TIMELINE_MAX_MINUTE = 60;

function parseMinute(gameTime: string | null): number | null {
  if (!gameTime) return null;
  const parts = gameTime.split(':').map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return null;
  const [minutes, seconds] = parts;
  return minutes + seconds / 60;
}

interface ScoreboardCardProps {
  matchId?: string;
  teamAName: string;
  teamBName: string;
}

export function ScoreboardCard({ matchId, teamAName, teamBName }: ScoreboardCardProps) {
  const [data, setData] = useState<ScoreboardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    if (!matchId) {
      setStatus('empty');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    fetchScoreboardSummary(matchId)
      .then(result => {
        if (cancelled) return;
        if (result) {
          setData(result);
          setStatus('ready');
        } else {
          setStatus('empty');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const teamName = (team: GoalEvent['team']) => (team === 'home' ? teamAName : teamBName);
  const teamColor = (team: GoalEvent['team']) => (team === 'home' ? 'bg-red-500' : 'bg-blue-500');

  if (status === 'loading') {
    return (
      <Card className="p-6 border-2 border-sky-200 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-9 bg-gray-100 rounded w-1/3 mx-auto" />
          <div className="h-10 bg-gray-100 rounded-lg w-full" />
          <div className="h-16 bg-gray-100 rounded w-full" />
        </div>
      </Card>
    );
  }

  if (status === 'empty' || status === 'error' || !data) {
    return (
      <Card className="p-6 border-2 border-sky-200 shadow-lg">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          <Target className="w-5 h-5 text-sky-600" />
          Spielstand & Tor-Timeline
        </h3>
        <p className="text-sm text-gray-500">
          {status === 'error'
            ? 'Spielstand konnte nicht geladen werden.'
            : 'Noch keine Scoreboard-Daten für dieses Match verfügbar.'}
        </p>
      </Card>
    );
  }

  const goals = data.goals;

  return (
    <Card className="p-6 border-2 border-sky-200 shadow-lg">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-sky-600" />
        Spielstand & Tor-Timeline
      </h3>

      {/* Score + final game time */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-4">
          <span className="text-lg font-semibold text-red-600 truncate max-w-[10rem]">{teamAName}</span>
          <span className="text-4xl font-bold text-gray-900 tabular-nums">
            {data.final_score_home ?? '–'} : {data.final_score_away ?? '–'}
          </span>
          <span className="text-lg font-semibold text-blue-600 truncate max-w-[10rem]">{teamBName}</span>
        </div>
        {data.final_game_time && (
          <p className="text-sm text-gray-400 mt-1">Endstand bei Spielzeit {data.final_game_time}</p>
        )}
      </div>

      {/* Timeline */}
      <div className="mb-6">
        {goals.length > 0 ? (
          <>
            <div className="relative h-10 bg-gray-100 rounded-lg">
              {goals.map((g, i) => {
                const minute = parseMinute(g.game_time);
                if (minute === null) return null;
                const pct = Math.min(100, Math.max(0, (minute / TIMELINE_MAX_MINUTE) * 100));
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div
                        className={`absolute top-1 bottom-1 w-1.5 rounded-full cursor-pointer ${teamColor(g.team)}`}
                        style={{ left: `${pct}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {g.game_time ?? '–:–'} · {teamName(g.team)} · {g.score_home}:{g.score_away}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0&apos;</span>
              <span>30&apos;</span>
              <span>60&apos;</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center">Keine Tore in diesem Match erkannt.</p>
        )}
      </div>

      {/* Chronological goal list */}
      {goals.length > 0 && (
        <div className="space-y-1">
          {goals.map((g, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-100 last:border-0"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${teamColor(g.team)}`} />
              <span className="tabular-nums text-gray-500 w-12 shrink-0">{g.game_time ?? '–:–'}</span>
              <span className="text-gray-700 flex-1 truncate">{teamName(g.team)}</span>
              <span className="tabular-nums font-semibold text-gray-900">
                {g.score_home}:{g.score_away}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
