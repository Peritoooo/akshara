import { supabase } from "@/lib/supabase";
import { clearLocalAccount, useSessionStore } from "@/store/session";

export interface AuthLink {
  access_token: string;
  refresh_token: string;
  type: string | null;
}

/**
 * Password-reset links look like
 *   akshara://auth/recovery#access_token=…&refresh_token=…&type=recovery
 * The tokens live in the fragment so they are never sent to a server as part
 * of the path.
 */
export function parseAuthLink(raw: string): AuthLink | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "akshara:" || url.hostname !== "auth") return null;
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const access = fragment.get("access_token");
    const refresh = fragment.get("refresh_token");
    if (!access || !refresh) return null;
    return {
      access_token: access,
      refresh_token: refresh,
      type: fragment.get("type"),
    };
  } catch {
    return null;
  }
}

/** Reads `sub` from the JWT without verifying it — only used to spot a switch. */
function subjectOf(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { sub?: unknown };
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

/** Turns a desktop auth link into a session and opens the recovery screen. */
export async function adoptAuthLink(raw: string): Promise<boolean> {
  if (!supabase) return false;
  const link = parseAuthLink(raw);
  if (!link) return false;

  // A link can arrive while someone else is signed in on a shared machine.
  // Never let the previous account's library carry over to the new one.
  const currentUser = useSessionStore.getState().userId;
  const linkUser = subjectOf(link.access_token);
  if (currentUser && linkUser && currentUser !== linkUser) {
    await clearLocalAccount();
  }

  const { error } = await supabase.auth.setSession({
    access_token: link.access_token,
    refresh_token: link.refresh_token,
  });
  if (error) return false;

  if (link.type === "recovery") {
    useSessionStore.setState({ recovery: true });
  }
  return true;
}

/** Subscribes to links forwarded by the desktop shell. Web builds have none. */
export function listenForAuthLinks(handler: (url: string) => void): () => void {
  const bridge = typeof window === "undefined" ? undefined : window.aksharaDesktop;
  return bridge ? bridge.onAuthLink(handler) : () => undefined;
}

/** A link that arrived before the renderer was ready. */
export async function takePendingAuthLink(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const bridge = window.aksharaDesktop;
  if (!bridge) return null;
  try {
    return (await bridge.getAuthLink()) ?? null;
  } catch {
    return null;
  }
}
