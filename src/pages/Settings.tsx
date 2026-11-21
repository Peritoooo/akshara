import { useMemo, useState } from "react";
import {
  Check,
  Cloud,
  CloudOff,
  Download,
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Save,
  Sun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { seedSettings } from "@/data/seed";
import { useLibraryStore } from "@/store/library";
import { useSessionStore } from "@/store/session";
import { useSettingsStore } from "@/store/settings";
import type { AppTheme, ReaderFont, ReaderThemeChoice } from "@/types";
import { cn } from "@/lib/utils";
import { describeSync, useSyncStatus } from "@/lib/syncStatus";
import { syncNow } from "@/lib/sync";
import { Avatar } from "@/components/ui/Misc";
import { Button, IconButton } from "@/components/ui/Button";
import { LogoMark } from "@/components/layout/LogoMark";
import { TextInput } from "@/components/ui/Field";
import { Slider } from "@/components/ui/Slider";
import { Dialog } from "@/components/ui/Dialog";
import { useResolvedTheme } from "@/hooks/useTheme";

const appThemes: Array<{
  value: AppTheme;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Paper", description: "Warm off-white", icon: Sun },
  { value: "dark", label: "Charcoal", description: "Deep and quiet", icon: Moon },
  { value: "system", label: "System", description: "Follow your device", icon: Monitor },
];

const readerThemes: Array<{
  value: ReaderThemeChoice;
  label: string;
  bg: string;
  fg: string;
  accent: string;
}> = [
  { value: "follow", label: "Match website", bg: "#EFE9DE", fg: "#2A2621", accent: "#8A6D43" },
  { value: "light", label: "Paper", bg: "#F7F5F0", fg: "#2A2621", accent: "#8A6D43" },
  { value: "sepia", label: "Sepia", bg: "#F2E7D3", fg: "#3A2F22", accent: "#8A6535" },
  { value: "dark", label: "Night", bg: "#17191B", fg: "#E9E5DD", accent: "#C6A978" },
];

const fonts: Array<{
  value: ReaderFont;
  label: string;
  stack: string;
  description: string;
}> = [
  {
    value: "literata",
    label: "Literata",
    stack: "var(--font-reading)",
    description: "A contemporary reading serif",
  },
  {
    value: "newsreader",
    label: "Newsreader",
    stack: "'Newsreader Variable', Georgia, serif",
    description: "Editorial and light on the page",
  },
  {
    value: "inter",
    label: "Inter",
    stack: "var(--font-sans)",
    description: "Clear, quiet sans-serif",
  },
];

const shortcuts = [
  { keys: ["←", "→"], label: "Previous / next page" },
  { keys: ["F"], label: "Toggle full-screen reading" },
  { keys: ["T"], label: "Table of contents" },
  { keys: ["B"], label: "Add a bookmark" },
  { keys: ["S"], label: "Reading appearance" },
  { keys: ["?"], label: "Show all shortcuts" },
  { keys: ["Esc"], label: "Close panels" },
];

function SettingSection({
  eyebrow,
  title,
  description,
  children,
  last = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section
      className={cn(
        "grid gap-6 py-10 lg:grid-cols-[13rem_1fr] lg:gap-12",
        !last && "border-b border-line",
      )}
    >
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 font-display text-[1.35rem] leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-muted">
          {description}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const settings = useSettingsStore();
  const resolvedTheme = useResolvedTheme();
  const resetDemo = useLibraryStore((state) => state.resetDemo);
  const session = useSessionStore();
  const syncPhase = useSyncStatus((state) => state.phase);
  const syncPending = useSyncStatus((state) => state.pending);
  const lastSyncedAt = useSyncStatus((state) => state.lastSyncedAt);
  const syncError = useSyncStatus((state) => state.error);
  const signedIn = session.phase === "authenticated";
  const [syncing, setSyncing] = useState(false);
  const storageSize = useMemo(() => {
    try {
      const payload = Object.keys(localStorage)
        .filter((key) => key.startsWith("akshara-"))
        .map((key) => localStorage.getItem(key) ?? "")
        .join("");
      return `${Math.max(1, Math.round(new Blob([payload]).size / 1024))} KB`;
    } catch {
      return "—";
    }
  }, []);

  const [name, setName] = useState(settings.displayName);
  const [resetOpen, setResetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const saveName = () => {
    settings.setDisplayName(name);
    setName(name.trim() || "Reader");
    toast.success("Profile updated");
  };

  const exportData = () => {
    const library = useLibraryStore.getState();
    const payload = {
      app: "Akshara",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        theme: settings.theme,
        displayName: settings.displayName,
        dailyGoal: settings.dailyGoal,
        reader: settings.reader,
      },
      library: {
        entries: library.entries,
        positions: library.positions,
        collections: library.collections,
        bookmarks: library.bookmarks,
        highlights: library.highlights,
        sessions: library.sessions,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `akshara-library-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Library exported", {
      description: "A JSON copy has been downloaded to your device.",
    });
  };

  const handleReset = () => {
    resetDemo();
    settings.resetSettings();
    setName(seedSettings.displayName);
    setResetOpen(false);
    toast("Reading state cleared", {
      description: "Your local reading state has been cleared. Import a PDF to begin again.",
    });
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    const result = await syncNow();
    setSyncing(false);
    if (result.ok) {
      toast.success("Library is up to date");
    } else {
      toast.error("Could not sync yet", {
        description: result.message,
      });
    }
  };

  const handleSignOut = async () => {
    const result = await session.signOut();
    if (!result.ok) {
      toast.error("Still signed in", { description: result.message });
      return;
    }
    setSignOutOpen(false);
    toast("Signed out", {
      description: "Your library stays safely on your account.",
    });
  };

  const marginLabel = ["Narrow", "Regular", "Generous"][settings.reader.margin - 1] ?? "Regular";

  return (
    <div className="page-wrap max-w-[1120px] pb-16 pt-9 lg:pt-12">
      <header>
        <p className="eyebrow">Make it yours</p>
        <h1 className="display-title mt-3 text-[clamp(2.3rem,4.2vw,3.4rem)] text-ink">
          Settings
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Appearance, reading preferences, and the small details that make a library
          feel like your own.
          {signedIn
            ? " Your reading metadata syncs to your account; PDF files stay on this device."
            : " Everything is stored on this device."}
        </p>
      </header>

      <div className="mt-9">
        {signedIn ? (
          <SettingSection
            eyebrow="Account"
            title="Signed in and in step"
            description="Progress, highlights, bookmarks, collections, and reading sessions follow you to every device."
          >
            <div className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={settings.displayName} className="h-11 w-11 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[0.8rem] font-medium text-ink">
                      {settings.displayName}
                    </p>
                    <p className="truncate text-[0.68rem] text-ink-muted">
                      {session.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleSyncNow()}
                    disabled={syncing || syncPhase === "syncing"}
                  >
                    <RefreshCw
                      className={cn("h-3.5 w-3.5", (syncing || syncPhase === "syncing") && "animate-spin")}
                    />
                    Sync now
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSignOutOpen(true)}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="flex items-center gap-2 text-[0.7rem] text-ink-muted">
                  {syncPhase === "offline" || syncPhase === "error" ? (
                    <CloudOff className="h-3.5 w-3.5 text-rose" />
                  ) : (
                    <Cloud className="h-3.5 w-3.5 text-accent-strong" />
                  )}
                  {describeSync(syncPhase, syncPending, lastSyncedAt)}
                  {lastSyncedAt ? (
                    <span className="text-ink-muted/80">
                      · {new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : null}
                </p>
                <p className="text-[0.65rem] text-ink-muted">
                  PDF files never leave this device.
                </p>
              </div>

              {syncError && (syncPhase === "error" || syncPhase === "offline") ? (
                <p className="mt-3 rounded-lg border border-rose/25 bg-rose/5 px-3 py-2 text-[0.68rem] leading-relaxed text-rose">
                  {syncError}
                </p>
              ) : null}
            </div>
          </SettingSection>
        ) : null}

        <SettingSection
          eyebrow="Appearance"
          title="The room around the books"
          description="Akshara is designed for long, quiet sessions. Choose the light that suits your desk."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {appThemes.map((theme) => {
              const active = settings.theme === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => settings.setTheme(theme.value)}
                  aria-pressed={active}
                  className={cn(
                    "group overflow-hidden rounded-xl border text-left transition-all duration-200",
                    active
                      ? "border-accent-strong shadow-soft"
                      : "border-line hover:border-line-strong",
                  )}
                >
                  <div
                    className={cn(
                      "relative flex h-[4.5rem] items-end gap-1.5 border-b border-line p-3",
                      theme.value === "light" && "bg-[#F7F5F0]",
                      theme.value === "dark" && "bg-[#17191B]",
                      theme.value === "system" &&
                        "bg-[linear-gradient(110deg,#F7F5F0_50%,#17191B_50%)]",
                    )}
                  >
                    <span
                      className={cn(
                        "h-7 w-5 rounded-[1px] shadow-sm",
                        theme.value === "dark"
                          ? "bg-[#2A2D31]"
                          : "bg-[#E8E0D2]",
                        theme.value === "system" && "bg-[#8C7865]",
                      )}
                    />
                    <span
                      className={cn(
                        "h-8 w-6 rounded-[1px] shadow-sm",
                        theme.value === "dark"
                          ? "bg-[#C6A978]/40"
                          : "bg-[#B69A69]/60",
                      )}
                    />
                    <theme.icon
                      className={cn(
                        "absolute right-3 top-3 h-3.5 w-3.5",
                        theme.value === "dark" ? "text-[#A5A39E]" : "text-[#8C8478]",
                        theme.value === "system" && "text-[#EAE4DA]",
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between bg-surface px-3 py-2.5">
                    <div>
                      <p className="text-[0.75rem] font-medium text-ink">{theme.label}</p>
                      <p className="text-[0.6rem] text-ink-muted">{theme.description}</p>
                    </div>
                    {active ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-strong text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          {settings.theme === "system" ? (
            <p className="mt-3 flex items-center gap-1.5 text-[0.65rem] text-ink-muted">
              <Laptop className="h-3 w-3" />
              Currently showing the {resolvedTheme} theme.
            </p>
          ) : null}
        </SettingSection>

        <SettingSection
          eyebrow="Profile"
          title="A name on the bookplate"
          description="This name appears in your greeting and on your reading record."
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex items-center gap-3">
              <Avatar name={name || "Reader"} className="h-12 w-12 text-base" />
              <div>
                <p className="text-[0.75rem] text-ink">Your bookplate</p>
                <p className="mt-1 text-[0.65rem] text-ink-muted">
                  {signedIn
                    ? "Synced to your account"
                    : "Shown locally on this device"}
                </p>
              </div>
            </div>
            <div className="flex flex-1 items-end gap-2">
              <div className="flex-1">
                <label htmlFor="display-name" className="mb-1.5 block text-[0.65rem] text-ink-muted">
                  Display name
                </label>
                <TextInput
                  id="display-name"
                  value={name}
                  maxLength={40}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveName();
                  }}
                  placeholder="Your name"
                />
              </div>
              <Button
                size="md"
                onClick={saveName}
                disabled={!name.trim() || name.trim() === settings.displayName}
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </div>
        </SettingSection>

        <SettingSection
          eyebrow="Reading"
          title="Type, page, and light"
          description="These defaults apply whenever you open a book. They can also be changed from inside the reader."
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-7">
              <div>
                <p className="mb-3 text-[0.7rem] font-medium text-ink">Reading theme</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {readerThemes.map((theme) => {
                    const active = settings.reader.theme === theme.value;
                    return (
                      <button
                        key={theme.value}
                        type="button"
                        onClick={() => settings.setReader({ theme: theme.value })}
                        aria-pressed={active}
                        className={cn(
                          "rounded-lg border p-2.5 text-left transition-all",
                          active ? "border-accent-strong" : "border-line hover:border-line-strong",
                        )}
                        style={{ backgroundColor: theme.bg }}
                      >
                        <span
                          className="block font-display text-[1.15rem] leading-none"
                          style={{ color: theme.fg }}
                        >
                          Aa
                        </span>
                        <span className="mt-3 flex items-center justify-between">
                          <span
                            className="text-[0.6rem] uppercase tracking-[0.12em]"
                            style={{ color: theme.fg, opacity: 0.6 }}
                          >
                            {theme.label}
                          </span>
                          {active ? (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: theme.accent }}
                            />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[0.7rem] font-medium text-ink">Typeface</p>
                <div className="space-y-2">
                  {fonts.map((font) => {
                    const active = settings.reader.fontFamily === font.value;
                    return (
                      <button
                        key={font.value}
                        type="button"
                        onClick={() => settings.setReader({ fontFamily: font.value })}
                        aria-pressed={active}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-lg border px-3.5 py-3 text-left transition-colors",
                          active
                            ? "border-accent-strong bg-accent-soft/30"
                            : "border-line hover:border-line-strong",
                        )}
                      >
                        <span
                          className="w-9 shrink-0 text-[1.45rem] leading-none text-ink"
                          style={{ fontFamily: font.stack }}
                        >
                          Aa
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.75rem] font-medium text-ink">
                            {font.label}
                          </span>
                          <span className="block text-[0.6rem] text-ink-muted">
                            {font.description}
                          </span>
                        </span>
                        {active ? <Check className="h-3.5 w-3.5 text-accent-strong" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="font-size" className="text-[0.7rem] font-medium text-ink">
                      Text size
                    </label>
                    <span className="text-[0.65rem] tabular-nums text-ink-muted">
                      {settings.reader.fontSize}px
                    </span>
                  </div>
                  <Slider
                    id="font-size"
                    label="Text size"
                    value={settings.reader.fontSize}
                    min={16}
                    max={26}
                    step={1}
                    onChange={(value) => settings.setReader({ fontSize: value })}
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="line-height" className="text-[0.7rem] font-medium text-ink">
                      Line spacing
                    </label>
                    <span className="text-[0.65rem] tabular-nums text-ink-muted">
                      {settings.reader.lineHeight.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    id="line-height"
                    label="Line spacing"
                    value={settings.reader.lineHeight}
                    min={1.4}
                    max={2.2}
                    step={0.05}
                    onChange={(value) => settings.setReader({ lineHeight: value })}
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="page-margin" className="text-[0.7rem] font-medium text-ink">
                      Page margins
                    </label>
                    <span className="text-[0.65rem] text-ink-muted">{marginLabel}</span>
                  </div>
                  <Slider
                    id="page-margin"
                    label="Page margins"
                    value={settings.reader.margin}
                    min={1}
                    max={3}
                    step={1}
                    onChange={(value) => settings.setReader({ margin: value })}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  settings.setReader(seedSettings.reader);
                  toast("Reading preferences restored");
                }}
                className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                <RotateCcw className="h-3 w-3" />
                Restore reading defaults
              </button>
            </div>

            <div className="lg:sticky lg:top-8 lg:self-start">
              <p className="mb-2 text-[0.6rem] uppercase tracking-[0.16em] text-ink-muted">
                Live preview
              </p>
              <div
                data-reader-theme={settings.reader.theme}
                className="reader-surface overflow-hidden rounded-xl border border-line px-6 py-6 sm:px-7"
              >
                <p
                  className="text-[0.5625rem] uppercase tracking-[0.16em]"
                  style={{ color: "var(--reader-muted)" }}
                >
                  The Picture of Dorian Gray · Chapter II
                </p>
                <p
                  className="mt-4"
                  style={{
                    fontFamily: fonts.find((f) => f.value === settings.reader.fontFamily)?.stack,
                    fontSize: `${settings.reader.fontSize}px`,
                    lineHeight: settings.reader.lineHeight,
                    color: "var(--reader-ink)",
                    paddingInline: `${(settings.reader.margin - 1) * 6}px`,
                  }}
                >
                  “The only way to get rid of a temptation is to yield to it. Resist it,
                  and your soul grows sick with longing for the things it has forbidden
                  to itself.”
                </p>
                <p
                  className="mt-3 text-[0.5625rem]"
                  style={{ color: "var(--reader-muted)" }}
                >
                  — Oscar Wilde
                </p>
              </div>
              <p className="mt-3 text-[0.6rem] leading-relaxed text-ink-muted">
                Margin changes are most visible on wider reading canvases. Line length
                is capped for comfortable reading.
              </p>
            </div>
          </div>
        </SettingSection>

        <SettingSection
          eyebrow="Daily goal"
          title="A reasonable promise"
          description="Set a daily target that fits your life. Fifteen honest minutes are worth more than an hour of intention."
        >
          <div className="max-w-lg">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {[15, 30, 45, 60].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => settings.setDailyGoal(minutes)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[0.7rem] font-medium transition-colors",
                    settings.dailyGoal === minutes
                      ? "border-ink bg-ink text-canvas"
                      : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="daily-goal" className="text-[0.7rem] font-medium text-ink">
                Daily reading goal
              </label>
              <span className="text-[0.65rem] tabular-nums text-ink-muted">
                {settings.dailyGoal} minutes
              </span>
            </div>
            <Slider
              id="daily-goal"
              label="Daily reading goal"
              value={settings.dailyGoal}
              min={5}
              max={180}
              step={5}
              onChange={(value) => settings.setDailyGoal(value)}
            />
            <p className="mt-3 text-[0.65rem] leading-relaxed text-ink-muted">
              Your goal appears in the sidebar and on the reading statistics page. It is
              a guide, never a debt.
            </p>
          </div>
        </SettingSection>

        <SettingSection
          eyebrow="Keyboard"
          title="Reader shortcuts"
          description="The reader is designed to be used without your hands leaving the page."
        >
          <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.label}
                className="flex items-center justify-between gap-3 border-b border-line/70 py-2"
              >
                <span className="text-[0.75rem] text-ink-soft">{shortcut.label}</span>
                <span className="flex gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd
                      key={key}
                      className="min-w-[1.65rem] rounded-md border border-line bg-canvas px-1.5 py-0.5 text-center text-[0.625rem] font-medium text-ink-muted shadow-[0_1px_0_var(--line)]"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[0.65rem] text-ink-muted">
            <KeyRound className="h-3 w-3" />
            Shortcuts are disabled while typing in a note.
          </p>
        </SettingSection>

        <SettingSection
          eyebrow="Your data"
          title="Yours to keep"
          description={
            signedIn
              ? "Reading metadata lives on your account and in this browser; PDF files stay on the device that imported them."
              : "Akshara is local-first. Your reading positions, notes, and preferences are kept in this browser."
          }
          last
        >
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.8rem] font-medium text-ink">
                  {signedIn ? "Library stored on this device" : "Local library data"}
                </p>
                <p className="mt-1 text-[0.68rem] text-ink-muted">
                  {Object.keys(useLibraryStore.getState().entries).length} books · {storageSize} stored
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={exportData}>
                  <Download className="h-3.5 w-3.5" />
                  Export copy
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset library
                </Button>
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[0.65rem] leading-relaxed text-ink-muted">
                {signedIn
                  ? "Clearing this browser's data removes the local copy of your metadata and your imported PDFs. Your account copy is pulled back the next time you sign in, but PDFs must be imported again on this device."
                  : "Your library holds only the books you import. Everything stays on this device — there is no account, server, or cloud sync. Export a copy before clearing this browser's data."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2.5 text-[0.65rem] leading-relaxed text-ink-muted">
            <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              {signedIn
                ? "Resetting removes this library from your account too — on every device. It cannot be undone."
                : "Reset clears your library, collections, highlights, and reading sessions. It cannot be undone."}
            </p>
          </div>
        </SettingSection>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
        <div className="flex items-center gap-2">
          <LogoMark className="w-8" />
          <p className="text-[0.65rem] text-ink-muted">
            Akshara · v0.1 · Every letter opens a new world.
          </p>
        </div>
        <p className="text-[0.6rem] uppercase tracking-[0.14em] text-ink-muted">
          Local-first reading
        </p>
      </div>

      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset your library?"
        description="All local reading positions, notes, highlights, collections, and preferences will be cleared from this device. Your imported PDF files are removed too."
        footer={
          <>
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="h-9 rounded-full bg-rose px-4 text-[0.8125rem] font-medium text-white transition-opacity hover:opacity-90"
            >
              Reset everything
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-lg border border-line bg-canvas p-3.5">
          <IconButton label="Warning" variant="ghost" className="text-rose" tabIndex={-1}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <p className="text-[0.75rem] leading-relaxed text-ink-muted">
            Your current progress and personal notes will be cleared. Export a copy
            first if you would like to keep them.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out of this device?"
        description="Your library stays on your account. This device keeps the PDF files, so signing back in restores your place without re-importing them."
        footer={
          <>
            <button
              type="button"
              onClick={() => setSignOutOpen(false)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Stay signed in
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="h-9 rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-canvas transition-opacity hover:opacity-90"
            >
              Sign out
            </button>
          </>
        }
      >
        <p className="text-[0.75rem] leading-relaxed text-ink-muted">
          Any changes still waiting to reach the server are sent first. If you are
          offline, sign-out waits so nothing is lost.
        </p>
      </Dialog>
    </div>
  );
}
