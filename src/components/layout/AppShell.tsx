import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useSessionStore } from "@/store/session";
import { Sidebar } from "./Sidebar";
import { MobileHeader, MobileTabBar } from "./MobileNav";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export function AppShell() {
  const { pathname } = useLocation();
  const signedIn = useSessionStore((state) => state.phase === "authenticated");

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-20 rounded-full bg-ink px-4 py-2 text-sm text-canvas transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <ScrollToTop />
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-[272px]">
        <MobileHeader />
        <main id="main-content" className="flex-1 pb-28 lg:pb-0">
          <div key={pathname} className="tk-fade">
            <Outlet />
          </div>
        </main>
        <footer className="hidden border-t border-line lg:block">
          <div className="page-wrap flex items-center justify-between py-7">
            <p className="text-[0.7rem] text-ink-muted">
              <span className="font-display text-[0.85rem] text-ink">Akshara</span>
              <span className="mx-2 text-line-strong">·</span>
              Every letter opens a new world.
            </p>
            <p className="text-[0.625rem] uppercase tracking-[0.14em] text-ink-muted">
              {signedIn ? "Your library · Synced to your account" : "Your library · Stored on this device"}
            </p>
          </div>
        </footer>
      </div>
      <MobileTabBar />
    </div>
  );
}
