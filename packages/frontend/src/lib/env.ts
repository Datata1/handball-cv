/**
 * The single place the backend origin is resolved.
 *
 * The previous frontend had three competing strategies across four files —
 * including one that derived the origin by string-replacing `:3000` with
 * `:8000`, which broke on every deployed host. Everything that talks to the
 * API must import this.
 *
 * Set it per environment in `.env.local` (dev) or as a Docker build arg
 * (`VITE_BACKEND_URL`); Vite substitutes `VITE_`-prefixed vars at build time.
 */
export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
