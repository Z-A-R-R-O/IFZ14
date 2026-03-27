/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_LEGAL?: string;
  readonly VITE_APP_DESCRIPTION?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_ACCESS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
