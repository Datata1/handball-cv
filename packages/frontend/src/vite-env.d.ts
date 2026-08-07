/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the WELS backend API, e.g. http://localhost:8000 */
  readonly VITE_BACKEND_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
