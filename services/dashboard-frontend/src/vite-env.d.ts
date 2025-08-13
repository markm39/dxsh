/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKFLOW_API_URL?: string
  readonly VITE_WORKFLOW_API_KEY?: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}