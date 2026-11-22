import { create } from "zustand";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { clearSyncState, flushPending, stopSync } from "@/lib/sync";
import { clearPdfFiles } from "@/lib/pdfStore";
import { emptyLibraryState, useLibraryStore } from "@/store/library";
import { useSettingsStore } from "@/store/settings";

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
  /** A recovery link was opened: show the "set a new password" screen. */
  recovery: boolean;
  signOut: () => Promise<{ ok: boolean; message?: string }>;
  deleteAccount: () => Promise<{ ok: boolean; message?: string }>;
  finishRecovery: () => void;
}

/**
 * Signing out means another person may use this device next. Keep the device
 * theme, but clear everything that belongs to the account, including the
 * profile fields that would otherwise be adopted by the next sign-in.
 */
function clearDeviceProfile() {
  const { theme } = useSettingsStore.getState();
  useSettingsStore.getState().resetSettings();
  useSettingsStore.setState({ theme });
}

export const useSessionStore = create<SessionState>()(() => ({
  phase: isSupabaseConfigured ? "loading" : "local",
  recovery: false,
  finishRecovery: () => useSessionStore.setState({ recovery: false }),

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
    clearDeviceProfile();
    await supabase?.auth.signOut();
    return { ok: true };
  },

  deleteAccount: async () => {
    if (!supabase) {
      return { ok: false, message: "Accounts are not configured in this build." };
    }

    const remaining = await flushPending();
    if (remaining > 0) {
      return {
        ok: false,
        message:
          "Some changes have not reached the server yet. Reconnect and try again so nothing is left behind.",
      };
    }

    const { error } = await supabase.rpc("delete_account");
    if (error) {
      const text = error.message.toLowerCase();
      return {
        ok: false,
        message: text.includes("not signed in")
          ? "Your session expired. Sign in again, then delete the account."
          : error.message,
      };
    }

    // The server is gone for this account: wipe the copy on this device too.
    stopSync();
    clearSyncState();
    useLibraryStore.setState(emptyLibraryState());
    await clearPdfFiles();
    clearDeviceProfile();
    await supabase.auth.signOut({ scope: "local" });
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

  supabase.auth.onAuthStateChange((event, session) => {
    // A recovery link signs the user in with a short-lived session; keep the
    // app on the password screen until they choose a new password.
    if (event === "PASSWORD_RECOVERY") {
      useSessionStore.setState({ recovery: true });
    }
    applySession(session);
  });
}
