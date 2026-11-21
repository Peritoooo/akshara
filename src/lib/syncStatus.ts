import { create } from "zustand";

export type SyncPhase = "idle" | "syncing" | "offline" | "error";

interface SyncStatusState {
  phase: SyncPhase;
  pending: number;
  lastSyncedAt?: string;
  error?: string;
  set: (patch: Partial<Omit<SyncStatusState, "set">>) => void;
}

/** Small, dependency-free status store so the UI can show sync health. */
export const useSyncStatus = create<SyncStatusState>()((set) => ({
  phase: "idle",
  pending: 0,
  set: (patch) => set(patch),
}));

export function describeSync(
  phase: SyncPhase,
  pending: number,
  lastSyncedAt?: string,
) {
  if (phase === "syncing") return "Syncing…";
  if (phase === "offline") {
    return pending > 0
      ? `Offline · ${pending} change${pending === 1 ? "" : "s"} waiting`
      : "Offline";
  }
  if (phase === "error") return "Sync paused · retrying";
  if (pending > 0) return `${pending} change${pending === 1 ? "" : "s"} to sync`;
  if (!lastSyncedAt) return "Synced";
  return "Synced";
}
