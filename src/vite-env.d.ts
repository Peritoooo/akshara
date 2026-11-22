/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Leave unset to build the local-only app. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key. Never the service_role key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Bridge exposed by electron/preload.cjs. Absent in the web build. */
interface AksharaDesktopBridge {
  onAuthLink(handler: (url: string) => void): () => void;
  getAuthLink(): Promise<string | null>;
}

interface Window {
  aksharaDesktop?: AksharaDesktopBridge;
}
