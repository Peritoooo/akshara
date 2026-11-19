import { Flame } from "lucide-react";
import { useLibraryStore } from "@/store/library";
import { useSettingsStore } from "@/store/settings";
import { getStreak, sessionsByDay } from "@/lib/stats";
import { dateKey } from "@/lib/utils";

export function ReadingGoal({ compact = false }: { compact?: boolean }) {
  const sessions = useLibraryStore((state) => state.sessions);
  const dailyGoal = useSettingsStore((state) => state.dailyGoal);
  const todayMinutes = sessionsByDay(sessions)[dateKey(new Date())] ?? 0;
  const streak = getStreak(sessions);
  const percent = Math.min(1, todayMinutes / dailyGoal);
  const radius = 17;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={
        compact
          ? "flex items-center gap-3"
          : "rounded-xl border border-line bg-surface/70 p-3.5"
      }
    >
      <div className="relative h-11 w-11 shrink-0">
        <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth="2.5"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="var(--accent-strong)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[0.65rem] font-medium tabular-nums text-ink">
          {Math.round(percent * 100)}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] font-medium text-ink">Daily reading goal</p>
        <p className="mt-0.5 text-[0.625rem] text-ink-muted">
          {todayMinutes} of {dailyGoal} min today
        </p>
        <p className="mt-1 flex items-center gap-1 text-[0.625rem] text-accent-strong">
          <Flame className="h-3 w-3" />
          {streak} day streak
        </p>
      </div>
    </div>
  );
}
