import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      to="/"
      className={cn("flex items-center gap-3 outline-none", className)}
      aria-label="Akshara home"
    >
      <LogoMark className="w-11 shrink-0" />
      {!compact ? (
        <span className="flex flex-col gap-[3px]">
          <span className="text-[0.925rem] font-medium uppercase tracking-[0.28em] text-ink">
            Akshara
          </span>
          <span className="text-[0.5rem] uppercase tracking-[0.18em] text-ink-muted">
            Every letter opens a world
          </span>
        </span>
      ) : null}
    </Link>
  );
}
