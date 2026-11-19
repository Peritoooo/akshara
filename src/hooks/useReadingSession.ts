import { useEffect } from "react";
import { useLibraryStore } from "@/store/library";

const TICK_SECONDS = 15;
const FLUSH_EVERY_MS = 5 * 60 * 1000;

/**
 * Counts active reading time while the reader is open.
 * Time is logged in whole minutes once a minute has accumulated,
 * and again when the tab is hidden or the reader closes.
 */
export function useReadingSession(bookId: string | undefined) {
  const logSession = useLibraryStore((state) => state.logSession);

  useEffect(() => {
    if (!bookId) return;

    let seconds = 0;

    const tick = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      seconds += TICK_SECONDS;
    }, TICK_SECONDS * 1000);

    const flush = () => {
      const minutes = Math.floor(seconds / 60);
      if (minutes < 1) return;
      seconds -= minutes * 60;
      logSession(bookId, minutes);
    };

    const flushTimer = window.setInterval(flush, FLUSH_EVERY_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [bookId, logSession]);
}
