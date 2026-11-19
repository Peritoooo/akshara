import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  barClassName?: string;
  label?: string;
  size?: "xs" | "sm" | "md";
}

export function ProgressBar({
  value,
  className,
  barClassName,
  label = "Reading progress",
  size = "xs",
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={cn(
        "w-full overflow-hidden rounded-full bg-line/70",
        size === "xs" ? "h-[3px]" : size === "sm" ? "h-1" : "h-1.5",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-accent-strong transition-[width] duration-500 ease-out",
          barClassName,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
