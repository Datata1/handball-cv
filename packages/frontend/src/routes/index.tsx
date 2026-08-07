import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

// Exported for index.stories.tsx — rendering it needs no router context.
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
