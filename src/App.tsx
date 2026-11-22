import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeSync, useResolvedTheme } from "@/hooks/useTheme";
import { startSync } from "@/lib/sync";
import { adoptAuthLink, listenForAuthLinks, takePendingAuthLink } from "@/lib/authLink";
import { initSession, useSessionStore } from "@/store/session";
import { AuthPage, RecoveryPage } from "@/pages/Auth";
import { HomePage } from "@/pages/Home";
import { LibraryPage } from "@/pages/Library";
import { BookDetailsPage } from "@/pages/BookDetails";
import { FavoritesPage } from "@/pages/Favorites";
import { StatsPage } from "@/pages/Stats";
import { SettingsPage } from "@/pages/Settings";
import { NotFoundPage } from "@/pages/NotFound";

const ReaderPage = lazy(() =>
  import("@/pages/Reader/Reader").then((module) => ({
    default: module.ReaderPage,
  })),
);

function ReaderFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] dark:bg-[#17191B]">
      <div className="flex flex-col items-center">
        <LogoMark className="w-16 animate-pulse" />
        <p className="mt-5 text-[0.625rem] uppercase tracking-[0.24em] text-ink-muted">
          Opening the book
        </p>
      </div>
    </div>
  );
}

function SessionBoot() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center">
        <LogoMark className="w-14 animate-pulse" />
        <p className="mt-5 text-[0.625rem] uppercase tracking-[0.24em] text-ink-muted">
          Opening your reading room
        </p>
      </div>
    </div>
  );
}

function GlobalToaster() {
  const theme = useResolvedTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={theme}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-line !bg-surface !text-ink !shadow-lift !font-sans",
          title: "!text-[0.8125rem] !font-medium",
          description: "!text-[0.75rem] !text-ink-muted",
          closeButton: "!border-line !bg-surface !text-ink-muted",
        },
      }}
    />
  );
}

/** Starts and stops metadata sync alongside the signed-in session. */
function SyncBridge() {
  const userId = useSessionStore((state) => state.userId);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let stop: (() => void) | undefined;

    void startSync(userId).then((cleanup) => {
      if (cancelled) cleanup();
      else stop = cleanup;
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId]);

  return null;
}

/** Receives `akshara://` links from the desktop shell (recovery, future OAuth). */
function AuthLinkBridge() {
  useEffect(() => {
    let disposed = false;

    const handle = (url: string) => {
      void adoptAuthLink(url).then((adopted) => {
        if (!adopted && !disposed) {
          // An expired or malformed link: stay on the sign-in screen.
          console.warn("Ignored an unusable auth link.");
        }
      });
    };

    const unsubscribe = listenForAuthLinks(handle);
    void takePendingAuthLink().then((url) => {
      if (url && !disposed) handle(url);
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const phase = useSessionStore((state) => state.phase);
  const recovery = useSessionStore((state) => state.recovery);

  useEffect(() => {
    void initSession();
  }, []);

  if (recovery) return <RecoveryPage />;
  if (phase === "local") return <>{children}</>;
  if (phase === "loading") return <SessionBoot />;
  if (phase === "anonymous") return <AuthPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <AuthLinkBridge />
      <AuthGate>
        <TooltipProvider>
          <SyncBridge />
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="favorites" element={<FavoritesPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="book/:bookId" element={<BookDetailsPage />} />
              <Route path="home" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route
              path="read/:bookId"
              element={
                <Suspense fallback={<ReaderFallback />}>
                  <ReaderPage />
                </Suspense>
              }
            />
          </Routes>
          <GlobalToaster />
        </TooltipProvider>
      </AuthGate>
    </BrowserRouter>
  );
}
