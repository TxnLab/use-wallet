/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB3AUTH_CLIENT_ID?: string
  readonly VITE_WEB3AUTH_VERIFIER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
