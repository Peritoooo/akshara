import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settings";
import type { AppTheme } from "@/types";

export function useResolvedTheme(): Exclude<AppTheme, "system"> {
  const theme = useSettingsStore((state) => state.theme);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return theme === "system" ? (systemDark ? "dark" : "light") : theme;
}

export function ThemeSync() {
  const resolved = useResolvedTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "dark" ? "#17191B" : "#F7F5F0");
  }, [resolved]);

  return null;
}
