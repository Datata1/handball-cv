import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

// Exported so index.stories.tsx can render it without a router context.
// Route modules are the one place a non-route export is expected here; the
// code splitter only ever moves the value assigned to `component`.
export function Home() {
  return (
    <section>
      <h1 className="text-3xl font-bold text-primary">WELS</h1>
      <p className="mt-1 text-muted-foreground">
        Handballanalyse für Trainer und Analysten.
      </p>

      <p className="mt-8 rounded-lg border bg-card p-6 text-card-foreground">
        Neues Frontend-Gerüst. Ansichten entstehen als Dateien unter{' '}
        <code className="font-mono text-sm">src/routes/</code> — jede Datei ist eine
        echte URL.
      </p>
    </section>
  )
}
