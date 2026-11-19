import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Flame,
  TrendingUp,
} from "lucide-react";
import { useBookMap } from "@/hooks/useCatalog";
import { useLibraryStore } from "@/store/library";
import { useSettingsStore } from "@/store/settings";
import {
  getGenreBreakdown,
  getMostReadBook,
  getStats,
  readingProgress,
} from "@/lib/stats";
import {
  cn,
  formatDate,
  formatMinutes,
  percentLabel,
  pluralize,
} from "@/lib/utils";
import { BookCover } from "@/components/books/BookCover";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState, SectionHeading } from "@/components/ui/Misc";
import { buttonStyles } from "@/components/ui/Button";

const heatColors = [
  "bg-line/50",
  "bg-accent/20",
  "bg-accent/35",
  "bg-accent/55",
  "bg-accent-strong",
];

function heatLevel(minutes: number) {
  if (minutes <= 0) return 0;
  if (minutes < 20) return 1;
  if (minutes < 40) return 2;
  if (minutes < 70) return 3;
  return 4;
}

export function StatsPage() {
  const sessions = useLibraryStore((state) => state.sessions);
  const entries = useLibraryStore((state) => state.entries);
  const positions = useLibraryStore((state) => state.positions);
  const dailyGoal = useSettingsStore((state) => state.dailyGoal);
  const bookMap = useBookMap();
  const stats = getStats(sessions, entries);
  const genres = getGenreBreakdown(sessions, [...bookMap.values()]);
  const mostRead = getMostReadBook(sessions, [...bookMap.values()]);
  const reading = Object.values(entries)
    .filter((entry) => entry.status === "reading")
    .sort(
      (a, b) =>
        new Date(b.lastOpenedAt ?? b.addedAt).getTime() -
        new Date(a.lastOpenedAt ?? a.addedAt).getTime(),
    );

  const maxWeek = Math.max(...stats.week.map((day) => day.minutes), dailyGoal, 1);
  const genreTotal = genres.reduce((sum, item) => sum + item.minutes, 0) || 1;
  const firstSession = sessions.length
    ? [...sessions].sort(
        (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
      )[0]
    : null;

  const metrics = [
    {
      label: "Time read",
      value: formatMinutes(stats.totalMinutes),
      detail: `${sessions.length} ${pluralize(sessions.length, "session")}`,
      icon: Clock3,
    },
    {
      label: "Books finished",
      value: String(stats.finished),
      detail: `${reading.length} in progress`,
      icon: BookOpen,
    },
    {
      label: "Reading streak",
      value: `${stats.streak} days`,
      detail: "One page is enough",
      icon: Flame,
    },
    {
      label: "Average session",
      value: formatMinutes(stats.avgSession),
      detail: `${stats.activeDays} active days`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="page-wrap pb-16 pt-9 lg:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">The reading life</p>
          <h1 className="display-title mt-3 text-[clamp(2.3rem,4.2vw,3.4rem)] text-ink">
            Reading, in numbers.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
            Not a scoreboard. A record of the hours you have given to books —
            and of the quiet rhythm they make over time.
          </p>
        </div>
        {firstSession ? (
          <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            Reading since {formatDate(firstSession.startedAt, { month: "long", year: "numeric" })}
          </div>
        ) : null}
      </header>

      {sessions.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="Your reading record is empty"
            description="Open a book and read for a few minutes. Your sessions, streak, and weekly rhythm will appear here."
            action={
              <Link to="/library" className={buttonStyles("primary", "md")}>
                Find something to read
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Metric strip */}
          <section className="mt-9 grid grid-cols-2 border-y border-line lg:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="group relative border-line px-5 py-6 first:pl-0 odd:border-r lg:border-r lg:px-7 lg:last:border-r-0 [&:nth-child(3)]:border-t [&:nth-child(4)]:border-t lg:[&:nth-child(3)]:border-t-0 lg:[&:nth-child(4)]:border-t-0"
              >
                <p className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-muted">
                  <metric.icon className="h-3 w-3 text-accent-strong" />
                  {metric.label}
                </p>
                <p className="mt-3 font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-none tracking-[-0.025em] text-ink">
                  {metric.value}
                </p>
                <p className="mt-2 text-[0.65rem] text-ink-muted">{metric.detail}</p>
              </div>
            ))}
          </section>

          {/* Weekly chart */}
          <section className="mt-10 grid gap-6 lg:grid-cols-[1.45fr_0.55fr]">
            <div className="rounded-xl border border-line bg-surface p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Last seven days</p>
                  <p className="mt-2 font-display text-[1.6rem] tracking-[-0.02em] text-ink">
                    {formatMinutes(stats.weekMinutes)}
                    <span className="ml-2 font-sans text-[0.7rem] font-normal text-ink-muted">
                      read this week
                    </span>
                  </p>
                </div>
                <div className="rounded-full border border-line bg-canvas px-3 py-1.5 text-[0.625rem] text-ink-muted">
                  Goal {dailyGoal} min / day
                </div>
              </div>

              <div className="relative mt-9 h-48">
                <div
                  className="absolute inset-x-0 border-t border-dashed border-line-strong/60"
                  style={{ bottom: `${Math.min(100, (dailyGoal / maxWeek) * 100)}%` }}
                >
                  <span className="absolute -top-5 right-0 text-[0.5625rem] uppercase tracking-[0.1em] text-ink-muted">
                    daily goal
                  </span>
                </div>
                <div className="flex h-full items-end gap-2 sm:gap-3">
                  {stats.week.map((day) => {
                    const isToday =
                      day.date.toDateString() === new Date().toDateString();
                    const height = day.minutes
                      ? Math.max(4, (day.minutes / maxWeek) * 100)
                      : 1.5;
                    return (
                      <div
                        key={day.key}
                        className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span className="text-[0.5625rem] tabular-nums text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">
                          {day.minutes}m
                        </span>
                        <div
                          className={cn(
                            "w-full max-w-[2.4rem] rounded-t-[3px] transition-all duration-700",
                            day.minutes === 0
                              ? "bg-line"
                              : isToday
                                ? "bg-accent-strong"
                                : "bg-accent/60 group-hover:bg-accent",
                          )}
                          style={{ height: `${height}%` }}
                          title={`${day.label}: ${day.minutes} minutes`}
                        />
                        <span
                          className={cn(
                            "text-[0.5625rem] uppercase tracking-[0.1em]",
                            isToday ? "font-semibold text-ink" : "text-ink-muted",
                          )}
                        >
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-xl border border-line bg-surface p-5">
                <p className="eyebrow">Your goal</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-[2.1rem] leading-none tracking-[-0.03em] text-ink">
                    {Math.round(
                      (stats.weekMinutes / (dailyGoal * 7)) * 100,
                    )}
                    %
                  </span>
                  <span className="text-[0.65rem] text-ink-muted">of weekly goal</span>
                </div>
                <ProgressBar
                  value={Math.min(1, stats.weekMinutes / (dailyGoal * 7))}
                  className="mt-4"
                  size="sm"
                />
                <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-muted">
                  {stats.weekMinutes >= dailyGoal * 7
                    ? "You have read past your weekly goal. Let the next page be for pleasure."
                    : `${formatMinutes(Math.max(0, dailyGoal * 7 - stats.weekMinutes))} of reading left to meet this week's goal.`}
                </p>
              </div>
              <div className="flex flex-1 flex-col justify-center rounded-xl border border-line bg-surface p-5">
                <p className="eyebrow">Days in a row</p>
                <p className="mt-3 flex items-center gap-2 font-display text-[2.1rem] leading-none tracking-[-0.03em] text-ink">
                  <Flame className="h-5 w-5 text-accent-strong" strokeWidth={1.4} />
                  {stats.streak}
                </p>
                <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-muted">
                  {stats.streak > 1
                    ? "A rhythm is forming. Even a few pages keeps it alive."
                    : "Read today to begin a new streak."}
                </p>
              </div>
            </div>
          </section>

          {/* Heatmap */}
          <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">The long view</p>
                <p className="mt-2 font-display text-[1.2rem] tracking-[-0.015em] text-ink">
                  Thirteen weeks of reading
                </p>
              </div>
              <div className="flex items-center gap-2 text-[0.5625rem] text-ink-muted">
                <span>Less</span>
                {heatColors.map((color) => (
                  <span key={color} className={cn("h-2.5 w-2.5 rounded-[2px]", color)} />
                ))}
                <span>More</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              <div className="flex shrink-0 flex-col gap-1 pr-1 pt-0.5">
                {["Sun", "", "Tue", "", "Thu", "", "Sat"].map((label, index) => (
                  <span
                    key={index}
                    className="h-3.5 text-[0.5rem] leading-[0.875rem] text-ink-muted sm:h-4"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                {stats.heatmap.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((day) => (
                      <div
                        key={day.key}
                        title={
                          day.minutes < 0
                            ? ""
                            : `${day.label}: ${day.minutes} ${pluralize(day.minutes, "minute")}`
                        }
                        className={cn(
                          "h-3.5 w-3.5 rounded-[2px] transition-transform hover:scale-125 sm:h-4 sm:w-4",
                          day.minutes < 0
                            ? "bg-transparent"
                            : heatColors[heatLevel(day.minutes)],
                        )}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[0.625rem] text-ink-muted">
              Each square is a day. Darker squares hold more reading.
            </p>
          </section>

          {/* Reading + genres */}
          <section className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <SectionHeading
                eyebrow="On the nightstand"
                title="In progress"
                action={
                  <Link
                    to="/library?status=reading"
                    className="flex items-center gap-1.5 text-[0.7rem] font-medium text-ink-muted hover:text-ink"
                  >
                    All books
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              />
              {reading.length > 0 ? (
                <div className="mt-5 divide-y divide-line border-y border-line">
                  {reading.map((entry) => {
                    const book = bookMap.get(entry.bookId);
                    if (!book) return null;
                    const progress = readingProgress(entry, positions[entry.bookId]);
                    return (
                      <Link
                        key={book.id}
                        to={`/read/${book.id}`}
                        className="group flex items-center gap-4 py-4"
                      >
                        <div className="w-10 shrink-0">
                          <BookCover book={book} showEdition={false} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-[0.9rem] text-ink transition-colors group-hover:text-accent-strong">
                            {book.title}
                          </p>
                          <p className="mt-0.5 truncate text-[0.65rem] text-ink-muted">
                            {book.author}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <ProgressBar value={progress} className="max-w-[8rem]" />
                            <span className="text-[0.5625rem] tabular-nums text-ink-muted">
                              {percentLabel(progress)}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-sm text-ink-muted">
                  Nothing in progress right now.{" "}
                  <Link to="/library" className="text-accent-strong underline-offset-2 hover:underline">
                    Choose a book
                  </Link>
                  .
                </p>
              )}
            </div>

            <div>
              <SectionHeading eyebrow="The shape of your reading" title="Genres" />
              <div className="mt-5 space-y-4">
                {genres.slice(0, 6).map((item, index) => (
                  <div key={item.genre}>
                    <div className="mb-1.5 flex items-center justify-between text-[0.7rem]">
                      <span className="text-ink-soft">{item.genre}</span>
                      <span className="tabular-nums text-ink-muted">
                        {formatMinutes(item.minutes)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line/60">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${(item.minutes / genreTotal) * 100}%`,
                          backgroundColor:
                            index === 0
                              ? "var(--accent-strong)"
                              : `color-mix(in srgb, var(--accent) ${75 - index * 12}%, var(--line))`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {mostRead?.book ? (
                <Link
                  to={`/book/${mostRead.book.id}`}
                  className="group mt-7 flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <div className="w-10 shrink-0">
                    <BookCover book={mostRead.book} showEdition={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-ink-muted">
                      Most read book
                    </p>
                    <p className="mt-1 truncate font-display text-[0.9rem] text-ink">
                      {mostRead.book.title}
                    </p>
                    <p className="mt-0.5 text-[0.625rem] text-ink-muted">
                      {formatMinutes(mostRead.minutes)} spent reading
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : null}
            </div>
          </section>

          <div className="mt-14 flex items-center justify-center gap-4 text-center text-[0.625rem] uppercase tracking-[0.18em] text-ink-muted">
            <span className="h-px w-10 bg-line-strong" />
            The quiet hours add up
            <span className="h-px w-10 bg-line-strong" />
          </div>
        </>
      )}
    </div>
  );
}
