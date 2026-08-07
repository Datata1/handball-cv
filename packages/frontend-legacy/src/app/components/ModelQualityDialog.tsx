import { useState } from 'react';
import { motion } from 'motion/react';
import { Gauge, CheckCircle2, ShieldCheck, Users, Activity, MapPin } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

/**
 * Model-level quality metrics. These describe the trained models' performance
 * against the acceptance criteria (benchmark on the validation set) — they are
 * NOT per-video values, which is why they live on the start page rather than
 * inside a single match report.
 */
interface ModelMetric {
  key: string;
  title: string;
  requirement: string;
  value: number;
  threshold: number | null; // null → no minimum (bonus metric)
  icon: typeof Users;
  description: string;
}

const MODEL_METRICS: ModelMetric[] = [
  {
    key: 'player',
    title: 'Spielererkennung',
    requirement: 'Anforderung 3.1: ≥ 80 %',
    value: 82,
    threshold: 80,
    icon: Users,
    description: 'Anteil der Spieler mit stabiler Bounding-Box über die gesamte Sequenz.',
  },
  {
    key: 'team',
    title: 'Teameinteilung',
    requirement: 'Anforderung 3.2: ≥ 85 %',
    value: 87,
    threshold: 85,
    icon: Activity,
    description: 'Genauigkeit der automatischen Teamzuordnung (HDBSCAN über Trikotfarben).',
  },
  {
    key: 'formation',
    title: 'Formationsklassifizierung',
    requirement: 'Anforderung 3.3: ≥ 75 %',
    value: 76,
    threshold: 75,
    icon: ShieldCheck,
    description: 'Genauigkeit bei Abwehrformationen (6:0, 5:1, 3:2:1) in statischen Phasen.',
  },
  {
    key: 'field',
    title: 'Spielfeld-Erkennung',
    requirement: 'Zusätzliche Metrik (2.1)',
    value: 90,
    threshold: null,
    icon: MapPin,
    description: 'Anteil der Frames mit erfolgreicher Homographie-Projektion auf das Feld.',
  },
];

function MetricCard({ metric }: { metric: ModelMetric }) {
  const Icon = metric.icon;
  const passed = metric.threshold === null ? true : metric.value >= metric.threshold;
  const barGradient = passed
    ? 'linear-gradient(to right, rgb(34 197 94), rgb(22 163 74))'
    : 'linear-gradient(to right, rgb(239 68 68), rgb(220 38 38))';

  return (
    <motion.div
      className="flex flex-col p-5 rounded-xl border-2 bg-white"
      style={{ borderColor: passed ? 'rgb(34 197 94)' : 'rgb(239 68 68)' }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-slate-100 shrink-0">
            <Icon className="w-5 h-5 text-slate-700" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-gray-900 leading-tight">{metric.title}</h4>
            <p className="text-xs text-gray-500">{metric.requirement}</p>
          </div>
        </div>
        {passed ? (
          <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
        ) : (
          <span className="text-2xl font-bold text-red-600 leading-none shrink-0">⚠</span>
        )}
      </div>

      <div className="flex items-end justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-600">Messwert</span>
        <span className="text-2xl font-bold text-gray-900 tabular-nums">{metric.value}%</span>
      </div>
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${metric.value}%`, background: barGradient }} />
      </div>

      <p className="text-xs text-gray-500 mt-3 grow">{metric.description}</p>

      <span
        className={`mt-3 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold text-white ${
          passed ? 'bg-green-600' : 'bg-red-600'
        }`}
      >
        {passed ? '✓ Erfüllt' : '✗ Nicht erfüllt'}
      </span>
    </motion.div>
  );
}

export function ModelQualityDialog() {
  const [open, setOpen] = useState(false);
  const allPassed = MODEL_METRICS.every((m) => m.threshold === null || m.value >= m.threshold);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="border-2 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800 shadow-sm transition-all"
        >
          <Gauge className="w-5 h-5 mr-2" />
          Modellqualität
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            Modellqualität &amp; Abnahmekriterien
          </DialogTitle>
          <DialogDescription className="text-base">
            Diese Kennzahlen beschreiben die Leistung der trainierten Modelle (Benchmark auf den
            Validierungsdaten) und gelten für die gesamte Plattform – nicht für ein einzelnes Video.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {MODEL_METRICS.map((m) => (
            <MetricCard key={m.key} metric={m} />
          ))}
        </div>

        <div
          className="mt-5 p-5 rounded-xl border-2 bg-gradient-to-r from-green-50 to-sky-50"
          style={{ borderColor: allPassed ? 'rgb(34 197 94)' : 'rgb(234 179 8)' }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold text-gray-900">Gesamtbewertung</h4>
              <p className="text-sm text-gray-600">
                {allPassed
                  ? 'Alle Mindestanforderungen aus dem Abnahmekatalog erfüllt.'
                  : 'Einige Anforderungen unterschreiten die Mindestwerte.'}
              </p>
            </div>
            <span className="text-4xl font-bold text-green-600 shrink-0">{allPassed ? '✓' : '⚠'}</span>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Referenzwerte aus der Modell-Evaluierung. Sie werden bei einem erneuten Training des Modells
          aktualisiert und ändern sich nicht pro analysiertem Video.
        </p>
      </DialogContent>
    </Dialog>
  );
}
