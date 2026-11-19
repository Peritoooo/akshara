import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadingStatus } from "@/types";

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "accent" | "sage";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.625rem] font-medium uppercase tracking-[0.12em]",
        tone === "neutral" && "border-line bg-surface/70 text-ink-muted",
        tone === "accent" && "border-accent/35 bg-accent-soft/60 text-accent-strong",
        tone === "sage" && "border-sage/30 bg-sage/10 text-sage",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-soft/60 font-display text-[0.8rem] text-accent-strong dark:bg-accent-soft",
        className,
      )}
    >
      {initials || "A"}
    </span>
  );
}

export function StarRating({
  rating,
  className,
  showValue = true,
}: {
  rating?: number;
  className?: string;
  showValue?: boolean;
}) {
  if (!rating) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[0.75rem] text-ink-muted", className)}>
      <Star className="h-3 w-3 fill-accent text-accent" />
      {showValue ? <span>{rating.toFixed(1)}</span> : null}
    </span>
  );
}

const statusLabels: Record<ReadingStatus, string> = {
  reading: "Reading",
  want: "Want to read",
  finished: "Finished",
};

export function StatusBadge({ status }: { status: ReadingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.625rem] font-medium uppercase tracking-[0.1em]",
        status === "reading" && "bg-accent-soft/70 text-accent-strong dark:bg-accent-soft",
        status === "want" && "bg-muted text-ink-muted",
        status === "finished" && "bg-sage/10 text-sage",
      )}
    >
      <span
        className={cn(
          "h-1 w-1 rounded-full",
          status === "reading" && "bg-accent-strong",
          status === "want" && "bg-ink-muted",
          status === "finished" && "bg-sage",
        )}
      />
      {statusLabels[status]}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong/70 bg-surface/40 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface text-accent-strong shadow-soft">
        {icon}
      </div>
      <h3 className="font-display text-[1.4rem] tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/80",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent dark:after:via-white/5",
        className,
      )}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="font-display text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] tracking-[-0.025em] text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "hide-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.75rem] font-medium transition-all duration-200",
              active
                ? "bg-ink text-canvas shadow-soft"
                : "text-ink-muted hover:bg-muted hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn(
                  "text-[0.625rem] tabular-nums",
                  active ? "text-canvas/60" : "text-ink-muted/70",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
