import { create } from "zustand";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { clearSyncState, flushPending, stopSync } from "@/lib/sync";
import { emptyLibraryState, useLibraryStore } from "@/store/library";

export type SessionPhase =
  | "loading"
  | "anonymous"
  | "authenticated"
  /** Build has no Supabase configuration: behave like the local-only app. */
  | "local";

interface SessionState {
  phase: SessionPhase;
  userId?: string;
  email?: string;
  signOut: () => Promise<{ ok: boolean; message?: string }>;
}

export const useSessionStore = create<SessionState>()(() => ({
  phase: isSupabaseConfigured ? "loading" : "local",
  signOut: async () => {
    const remaining = await flushPending();
    if (remaining > 0) {
      return {
        ok: false,
        message:
          "Some changes have not reached the server yet. Reconnect to the internet and try again so nothing is lost.",
      };
    }

    stopSync();
    clearSyncState();
    // Another account (or the local-only app) must never see this library.
    useLibraryStore.setState(emptyLibraryState());
    await supabase?.auth.signOut();
    return { ok: true };
  },
}));

let started = false;

function applySession(session: { user?: { id: string; email?: string } } | null) {
  if (!session?.user) {
    useSessionStore.setState({ phase: "anonymous", userId: undefined, email: undefined });
    return;
  }
  useSessionStore.setState({
    phase: "authenticated",
    userId: session.user.id,
    email: session.user.email,
  });
}

/** Start listening to the auth session. Safe to call from an effect. */
export async function initSession() {
  if (started) return;
  started = true;

  if (!supabase) {
    useSessionStore.setState({ phase: "local" });
    return;
  }

  const { data } = await supabase.auth.getSession();
  applySession(data.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
}
