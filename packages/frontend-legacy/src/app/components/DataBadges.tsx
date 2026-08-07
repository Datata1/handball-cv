import { FlaskConical, Info } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Visual markers that make it obvious which parts of the UI show data computed
 * from the uploaded video (live) versus illustrative placeholder data that
 * shows how a feature will look in the future (demo).
 */

const DEMO_DEFAULT_TITLE =
  'Beispieldaten – zeigt, wie dieser Bereich künftig aussehen wird. Diese Werte werden noch nicht aus Ihrem Video berechnet.';

const LIVE_DEFAULT_TITLE = 'Aus Ihrem hochgeladenen Video berechnet.';

export function DemoBadge({ label = 'Demo-Daten', title }: { label?: string; title?: string }) {
  return (
    <span
      title={title ?? DEMO_DEFAULT_TITLE}
      className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 align-middle"
    >
      <FlaskConical className="w-3 h-3" />
      {label}
    </span>
  );
}

export function LiveBadge({ label = 'Live-Daten', title }: { label?: string; title?: string }) {
  return (
    <span
      title={title ?? LIVE_DEFAULT_TITLE}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 align-middle"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {label}
    </span>
  );
}

/** Prominent banner for a whole section that only contains demo/preview data. */
export function DemoBanner({ title = 'Vorschau – noch nicht aktiv', children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-4">
      <FlaskConical className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-amber-800">{title}</p>
        <div className="text-sm text-amber-800/90 mt-0.5">{children}</div>
      </div>
    </div>
  );
}

/** Neutral info banner for explaining a metric in plain language. */
export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
      <Info className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
      <div className="text-sm text-sky-900/90">{children}</div>
    </div>
  );
}
